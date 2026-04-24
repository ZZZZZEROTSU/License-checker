import { chromium, type Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const TARGET_URL = process.env.TARGET_URL;
const CALENDAR_SELECTOR = process.env.CALENDAR_SELECTOR ?? '';
const SLOT_CATEGORY = process.env.SLOT_CATEGORY ?? '';   // e.g. "普通車ＡＭ" — empty = all categories
const CHROME_PATH = process.env.CHROME_PATH ?? '';
const PAGE_TIMEOUT_MS = 30_000;
const CF_TIMEOUT_MS = 30_000;
const CF_POLL_MS = 1_000;
const MASTER_TIMEOUT_MS = 180_000;  // 3 min — covers multi-page navigation
const NEXT_BTN_SEL = 'input[aria-label="2週後のカレンダーページへ"]';
const MAX_PAGES = 20;  // safety cap

function twoMonthsFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
const ALERT_BEFORE = process.env.ALERT_BEFORE || twoMonthsFromNow();  // YYYYMMDD
const DEBUG = process.env.DEBUG === 'true';
const STATE_FILE = path.resolve(process.cwd(), 'data', 'state.json');
const LOG_FILE = path.resolve(process.cwd(), 'output', 'kawasaki.log');
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL ?? '';

if (!TARGET_URL) {
  process.stderr.write('ERROR: TARGET_URL is not set in .env\n');
  process.exit(1);
}

const browser = await chromium.launch({
  headless: true,
  ...(CHROME_PATH ? { executablePath: CHROME_PATH } : {}),
});

async function waitForCloudflare(page: Page): Promise<void> {
  const deadline = Date.now() + CF_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const title = await page.title();
    const url = page.url();
    const isCloudflare =
      title.includes('Just a moment') ||
      title.includes('Checking your browser') ||
      url.includes('challenge') ||
      url.includes('cdn-cgi');
    if (!isCloudflare) return;
    await page.waitForTimeout(CF_POLL_MS);
  }
  throw new Error(`Cloudflare challenge did not resolve within ${CF_TIMEOUT_MS}ms`);
}

type SlotRecord = {
  onclick: string;
  classList: string[];
  svgAriaLabel: string;
  labelText: string;
  allAttributes: Record<string, string>;
};

function extractDate(labelText: string): string | null {
  // labelText format: "普通車ＡＭは2026年06月26日"
  const m = labelText.match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}`;  // YYYYMMDD
}

async function sendSlackNotification(text: string): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      process.stderr.write(`[kawasaki] ${new Date().toISOString()} — WARN: Slack webhook returned ${res.status}\n`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[kawasaki] ${new Date().toISOString()} — WARN: Slack notification failed: ${msg}\n`);
  }
}

async function run(): Promise<void> {
  fs.mkdirSync(path.resolve(process.cwd(), 'output'), { recursive: true });
  const page = await browser.newPage();

  await page.goto(TARGET_URL!, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

  await waitForCloudflare(page);

  // Stage 1: wait for network idle — wrap in try/catch for pages with persistent polling
  try {
    await page.waitForLoadState('networkidle', { timeout: PAGE_TIMEOUT_MS });
  } catch {
    process.stderr.write(
      `[${new Date().toISOString()}] WARN: networkidle timed out — continuing\n`
    );
  }

  // Stage 2: wait for document.readyState === 'complete'
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: PAGE_TIMEOUT_MS });

  // Stage 3: wait for calendar container if selector provided
  if (CALENDAR_SELECTOR) {
    await page.waitForSelector(CALENDAR_SELECTOR, { state: 'visible', timeout: PAGE_TIMEOUT_MS });
  }

  const slotSel = CALENDAR_SELECTOR
    ? `${CALENDAR_SELECTOR} td[onclick^="selectDate"]`
    : 'td[onclick^="selectDate"]';

  async function collectPageSlots(): Promise<SlotRecord[]> {
    return page.locator(slotSel).evaluateAll(els =>
      els.map(el => ({
        onclick: el.getAttribute('onclick') ?? '',
        classList: [...el.classList],
        svgAriaLabel: el.querySelector('svg')?.getAttribute('aria-label') ?? '',
        labelText: el.querySelector('.sr-only')?.textContent?.trim() ?? '',
        allAttributes: Object.fromEntries([...el.attributes].map(a => [a.name, a.value])),
      }))
    );
  }

  // Collect slots across all calendar pages by clicking "2週後＞" until disabled
  const allData: SlotRecord[] = [];
  let pageNum = 0;

  while (pageNum < MAX_PAGES) {
    const pageSlots = await collectPageSlots();
    allData.push(...pageSlots);

    // Check if "2週後" button exists and is not disabled
    const nextBtn = page.locator(NEXT_BTN_SEL);
    const isDisabled = await nextBtn.getAttribute('disabled');
    const exists = (await nextBtn.count()) > 0;
    if (!exists || isDisabled !== null) break;

    // Click next page and wait for calendar to re-render
    await nextBtn.click();
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: PAGE_TIMEOUT_MS });
    // Wait for the calendar table to re-render after click
    await page.waitForSelector('#TBL', { state: 'visible', timeout: PAGE_TIMEOUT_MS });
    pageNum++;
  }

  // Step 1 — DEBUG dump (DET-06, D-11)
  if (DEBUG) {
    console.log('[kawasaki] DEBUG: raw slot records', JSON.stringify(allData, null, 2));
  }

  // Step 2 — Empty parse guard (REL-05, D-13)
  if (allData.length === 0) {
    const ts = new Date().toISOString();
    const emptyLine = `[kawasaki] ${ts} — ERROR: selector matched 0 cells — possible page structure change`;
    console.log(emptyLine);
    fs.appendFileSync(LOG_FILE, emptyLine + '\n', 'utf-8');
    await browser.close().catch(() => {});
    process.exit(0);
  }

  // Step 4 — Compute today's date string (DET-05, D-05)
  const now = new Date();
  const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  // Step 5 — Filter pipeline (DET-04, DET-05, DET-06)
  const qualifying = allData.filter(rec => {
    // Must have 'enable' class
    if (!rec.classList.includes('enable')) return false;
    // Category filter
    if (SLOT_CATEGORY && !rec.labelText.startsWith(SLOT_CATEGORY)) return false;
    // Date extraction
    const date = extractDate(rec.labelText);
    if (!date) return false;
    // Past-date filter: skip dates before today
    if (date < today) return false;
    // Threshold filter: skip dates on or after ALERT_BEFORE (if set)
    if (ALERT_BEFORE && date >= ALERT_BEFORE) return false;
    return true;
  });

  // Step 6 — Deduplicate qualifying dates
  const qualifyingDates = [...new Set(qualifying.map(r => extractDate(r.labelText)).filter(Boolean) as string[])].sort();

  // Step 7 — Read state file (D-07, D-08, D-09)
  type State = { alert_active: boolean; last_check: string; last_qualifying_dates: string[] };

  let state: State = { alert_active: false, last_check: '', last_qualifying_dates: [] };
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    state = JSON.parse(raw) as State;
  } catch {
    // Missing or corrupt file = first run; use defaults above
  }

  // Step 8 — Determine output and next state
  const ts = new Date().toISOString();
  const hasSlots = qualifyingDates.length > 0;

  function logLine(line: string): void {
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf-8');
  }

  if (!hasSlots) {
    const threshold = ALERT_BEFORE ? ` before ${ALERT_BEFORE}` : '';
    logLine(`[kawasaki] ${ts} — no qualifying slots (${SLOT_CATEGORY}${threshold})`);
    state.alert_active = false;
  } else if (!state.alert_active) {
    // New alert — notify
    for (const date of qualifyingDates) {
      logLine(`[kawasaki] ${ts} — SLOT AVAILABLE: ${SLOT_CATEGORY} on ${date}`);
    }
    const slackText = qualifyingDates
      .map(date => `[kawasaki] SLOT AVAILABLE: ${SLOT_CATEGORY} on ${date} — book now: ${TARGET_URL}`)
      .join('\n');
    await sendSlackNotification(slackText);
    state.alert_active = true;
  } else {
    // Already alerted
    for (const date of qualifyingDates) {
      logLine(`[kawasaki] ${ts} — slot open (already alerted): ${date}`);
    }
  }

  // Step 9 — Write state file
  state.last_check = ts;
  state.last_qualifying_dates = qualifyingDates;
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

let masterTimeout: ReturnType<typeof setTimeout>;
try {
  await Promise.race([
    run(),
    new Promise<never>((_, rej) => {
      masterTimeout = setTimeout(
        () => rej(new Error(`Master timeout exceeded (${MASTER_TIMEOUT_MS}ms)`)),
        MASTER_TIMEOUT_MS
      );
    }),
  ]);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  const errLine = `[kawasaki] ${new Date().toISOString()} — ERROR: ${msg}`;
  process.stdout.write(errLine + '\n');
  try { fs.appendFileSync(LOG_FILE, errLine + '\n', 'utf-8'); } catch { /* ignore if output/ missing */ }
  await browser.close().catch(() => {});
  process.exit(0);
} finally {
  clearTimeout(masterTimeout!);
}

await browser.close();
