import { chromium, type Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const TARGET_URL = process.env.TARGET_URL;
const CALENDAR_SELECTOR = process.env.CALENDAR_SELECTOR ?? '';
const SLOT_CATEGORY = process.env.SLOT_CATEGORY ?? '';   // e.g. "普通車ＡＭ" — empty = all categories
const OUTPUT_DIR = path.resolve(process.cwd(), 'output');
const PAGE_TIMEOUT_MS = 30_000;
const CF_TIMEOUT_MS = 30_000;
const CF_POLL_MS = 1_000;
const MASTER_TIMEOUT_MS = 180_000;  // 3 min — covers multi-page navigation
const NEXT_BTN_SEL = 'input[aria-label="2週後のカレンダーページへ"]';
const MAX_PAGES = 20;  // safety cap

if (!TARGET_URL) {
  process.stderr.write('ERROR: TARGET_URL is not set in .env\n');
  process.exit(1);
}

console.log(`[kawasaki] Watching: ${TARGET_URL}`);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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

const CHROME_PATH =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });

async function run(): Promise<void> {
  const page = await browser.newPage();

  await page.goto(TARGET_URL!, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

  await waitForCloudflare(page);

  // Stage 1: wait for network idle — wrap in try/catch for pages with persistent polling
  try {
    await page.waitForLoadState('networkidle', { timeout: PAGE_TIMEOUT_MS });
  } catch {
    process.stderr.write(
      `[${new Date().toISOString()}] WARN: networkidle timed out — continuing to readyState check\n`
    );
  }

  // Stage 2: wait for document.readyState === 'complete'
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: PAGE_TIMEOUT_MS });

  // Stage 3: wait for calendar container if selector provided
  if (CALENDAR_SELECTOR) {
    await page.waitForSelector(CALENDAR_SELECTOR, { state: 'visible', timeout: PAGE_TIMEOUT_MS });
  }

  // Capture first-page HTML snapshot and screenshot
  const html = await page.content();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'snapshot.html'), html, 'utf-8');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'snapshot.png'), fullPage: true });

  const slotSel = CALENDAR_SELECTOR
    ? `${CALENDAR_SELECTOR} td[onclick^="selectDate"]`
    : 'td[onclick^="selectDate"]';

  type SlotRecord = {
    onclick: string;
    classList: string[];
    svgAriaLabel: string;
    labelText: string;
    allAttributes: Record<string, string>;
  };

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
    console.log(`[kawasaki] Page ${pageNum + 1}: ${pageSlots.length} available slots`);

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

  if (allData.length === 0) {
    throw new Error(
      `DATA COLLECTION FAILURE — selector "${slotSel}" matched 0 slot cells across all pages. ` +
      `Open output/snapshot.html to identify the correct selector.`
    );
  }

  // Filter by category if SLOT_CATEGORY is set (matches sr-only label prefix, e.g. "普通車ＡＭ")
  const filtered = SLOT_CATEGORY
    ? allData.filter(d => d.labelText.startsWith(SLOT_CATEGORY))
    : allData;

  if (SLOT_CATEGORY) {
    console.log(`[kawasaki] Category filter "${SLOT_CATEGORY}": ${filtered.length}/${allData.length} slots`);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'buttons.json'), JSON.stringify(filtered, null, 2), 'utf-8');

  console.log(`[kawasaki] Wrote ${filtered.length} slot records to output/buttons.json`);
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
  process.stderr.write(`[${new Date().toISOString()}] ERROR: ${msg}\n`);
  await browser.close().catch(() => {});
  process.exit(1);
} finally {
  clearTimeout(masterTimeout!);
}

await browser.close();
