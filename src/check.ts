import { chromium, type Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const TARGET_URL = process.env.TARGET_URL;
const CALENDAR_SELECTOR = process.env.CALENDAR_SELECTOR ?? '';
const SLOT_CATEGORY = process.env.SLOT_CATEGORY ?? '';   // e.g. "普通車ＡＭ" — empty = all categories
const CHROME_PATH =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGE_TIMEOUT_MS = 30_000;
const CF_TIMEOUT_MS = 30_000;
const CF_POLL_MS = 1_000;
const MASTER_TIMEOUT_MS = 180_000;  // 3 min — covers multi-page navigation
const NEXT_BTN_SEL = 'input[aria-label="2週後のカレンダーページへ"]';
const MAX_PAGES = 20;  // safety cap

const ALERT_BEFORE = process.env.ALERT_BEFORE ?? '';   // YYYYMMDD — empty = no threshold
const DEBUG = process.env.DEBUG === 'true';
const STATE_FILE = path.resolve(process.cwd(), 'output', 'state.json');

if (!TARGET_URL) {
  process.stderr.write('ERROR: TARGET_URL is not set in .env\n');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });

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

async function run(): Promise<SlotRecord[]> {
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

  // TODO(plan-02): filter, state, output logic goes here
  return allData;
}

try {
  await Promise.race([
    run(),
    new Promise<never>((_, rej) =>
      setTimeout(
        () => rej(new Error(`Master timeout exceeded (${MASTER_TIMEOUT_MS}ms)`)),
        MASTER_TIMEOUT_MS
      )
    ),
  ]);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  process.stdout.write(`[kawasaki] ${new Date().toISOString()} — ERROR: ${msg}\n`);
  await browser.close().catch(() => {});
  process.exit(0);
}

await browser.close();
