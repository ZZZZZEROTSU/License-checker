import { chromium, type Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const TARGET_URL = process.env.TARGET_URL;
const CALENDAR_SELECTOR = process.env.CALENDAR_SELECTOR ?? '';
const OUTPUT_DIR = path.resolve(process.cwd(), 'output');
const PAGE_TIMEOUT_MS = 30_000;
const CF_TIMEOUT_MS = 30_000;
const CF_POLL_MS = 1_000;
const MASTER_TIMEOUT_MS = 60_000;

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
  process.stderr.write(
    `[${new Date().toISOString()}] ERROR: Cloudflare challenge did not resolve within ${CF_TIMEOUT_MS}ms\n`
  );
  process.exit(1);
}

const browser = await chromium.launch({ headless: true, channel: 'chromium' });

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

  // Capture HTML snapshot
  const html = await page.content();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'snapshot.html'), html, 'utf-8');

  // Capture PNG screenshot
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'snapshot.png'), fullPage: true });

  // Build button selector
  const buttonSel = CALENDAR_SELECTOR
    ? `${CALENDAR_SELECTOR} button`
    : 'td button, .calendar button, [role="gridcell"] button, button';

  // Extract button attributes via evaluateAll — single browser round-trip
  const data = await page.locator(buttonSel).evaluateAll(els =>
    els.map(el => ({
      text: el.textContent?.trim() ?? '',
      disabled: (el as HTMLButtonElement).disabled,
      ariaDisabled: el.getAttribute('aria-disabled'),
      classList: [...el.classList],
      allAttributes: Object.fromEntries([...el.attributes].map(a => [a.name, a.value])),
    }))
  );

  if (data.length === 0) {
    process.stderr.write(
      `[${new Date().toISOString()}] ERROR: DATA COLLECTION FAILURE — selector "${buttonSel}" ` +
      `matched 0 buttons. Open output/snapshot.html to identify the correct selector.\n`
    );
    await browser.close();
    process.exit(1);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'buttons.json'), JSON.stringify(data, null, 2), 'utf-8');

  console.log(`[kawasaki] Wrote ${data.length} button records to output/buttons.json`);
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
  process.stderr.write(`[${new Date().toISOString()}] ERROR: ${(err as Error).message}\n`);
  await browser.close().catch(() => {});
  process.exit(1);
}

await browser.close();
