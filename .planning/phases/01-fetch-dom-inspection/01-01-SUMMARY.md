---
phase: 01-fetch-dom-inspection
plan: "01"
subsystem: infra
tags: [playwright, typescript, tsx, dotenv, chromium, dom-snapshot]

# Dependency graph
requires: []
provides:
  - Greenfield project scaffold (package.json, tsconfig.json, .gitignore, .env.example)
  - src/fetch.ts — single-file DOM snapshot fetcher using Playwright headless Chromium
  - output/snapshot.html, output/snapshot.png, output/buttons.json written on successful run
  - Startup validation (exits 1 if TARGET_URL unset), Cloudflare interstitial wait, master timeout
affects: [02-slot-detection, 03-scheduler-notifications]

# Tech tracking
tech-stack:
  added:
    - playwright 1.59.1 (headless Chromium browser automation)
    - dotenv 17.4.2 (env config loading)
    - typescript 6.0.3 (type safety)
    - tsx 4.21.0 (zero-build TS execution)
    - "@types/node ^22.0.0"
  patterns:
    - Multi-stage page-ready wait: networkidle (fallback-tolerant) → readyState complete → optional selector wait
    - Cloudflare interstitial detection: poll title/URL every 1s up to 30s
    - locator.evaluateAll() for single-round-trip full button attribute extraction
    - Promise.race master timeout wrapping entire run() function
    - Empty result guard — exits 1 on zero buttons (DATA COLLECTION FAILURE)

key-files:
  created:
    - package.json
    - tsconfig.json
    - .gitignore
    - .env.example
    - src/fetch.ts
    - package-lock.json
  modified: []

key-decisions:
  - "Switched from channel: chromium to executablePath: system Chrome — corporate proxy blocks playwright install download"
  - "Slot cells are <td onclick=\"selectDate(...)\"> not <button> — selector changed to td[onclick^=\"selectDate\"]"
  - "Pagination loop added — clicks '2週後' button until disabled, collects slots across all calendar pages"
  - "SLOT_CATEGORY env var added — filters by labelText prefix (e.g. '普通車ＡＭ'), empty = all categories"
  - "networkidle timeout wrapped in try/catch — falls through to readyState rather than hard-failing on polling pages"
  - "rebrowser-playwright held in reserve — plain Playwright passed live run with no 403/CAPTCHA"

patterns-established:
  - "Pattern: All env config via dotenv at top of file; constants defined before any functions"
  - "Pattern: Startup log before browser launch to confirm URL being watched"
  - "Pattern: Empty artifact = hard error (throw Error caught by master timeout), not silent success"
  - "Pattern: Paginate by clicking JS navigation buttons and waiting for #TBL re-render"

requirements-completed: [DET-01, DET-02, DET-03, REL-03, CFG-01, CFG-03]

# Metrics
duration: 3min
completed: "2026-04-24"
---

# Phase 1 Plan 01: Fetch + DOM Inspection Summary

**Playwright headless Chromium fetcher producing snapshot.html, snapshot.png, and buttons.json from live Kanagawa license center page, with Cloudflare interstitial wait and master timeout**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-24T08:49:05Z
- **Completed:** 2026-04-24T08:52:07Z
- **Tasks:** 2
- **Files modified:** 6 created, 1 overwritten (.gitignore)

## Accomplishments

- Project scaffold with ESM package.json, strict TypeScript config, .gitignore, and .env.example template committed
- Complete src/fetch.ts implementing all six phase requirements (DET-01, DET-02, DET-03, REL-03, CFG-01, CFG-03)
- Startup validation, Cloudflare polling, multi-stage page-ready wait, three-artifact write, empty-buttons guard, 60s master timeout all implemented and verified
- npm install completed with playwright 1.59.1 and all dev dependencies

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffold** - `e9e580a` (chore)
2. **Task 2: Implement src/fetch.ts** - `40e8369` (feat)

## Files Created/Modified

- `package.json` — ESM project with fetch script, playwright 1.59.1, dotenv 17.4.2, tsx 4.21.0
- `tsconfig.json` — moduleResolution: bundler, target: ES2022, strict: true
- `.gitignore` — covers output/, .env, node_modules/
- `.env.example` — committed template with TARGET_URL placeholder and empty CALENDAR_SELECTOR
- `src/fetch.ts` — complete DOM snapshot fetcher (123 lines)
- `package-lock.json` — lockfile from npm install

## Decisions Made

- Switched from `channel: 'chromium'` to `executablePath` pointing at system Chrome — corporate proxy blocks `npx playwright install chromium` with `SELF_SIGNED_CERT_IN_CHAIN`. Override via `CHROME_PATH` env var.
- Slot elements are `<td onclick="selectDate(...)">` cells, not `<button>` — selector changed to `td[onclick^="selectDate"]` after live DOM inspection.
- Added pagination loop: clicks `input[aria-label="2週後のカレンダーページへ"]` until `disabled`, waits for `#TBL` re-render between pages. Confirmed 6 pages on live run.
- Added `SLOT_CATEGORY` env var for category filtering via `labelText` prefix match.
- `networkidle` wait wrapped in try/catch — falls through to readyState check on polling pages.

## Deviations from Plan

- **Selector**: Plan specified `button` elements; live DOM shows `<td onclick="selectDate(...)">` cells. Selector updated accordingly.
- **Pagination**: Not in original plan — discovered necessary after first run returned only first 2-week window. Loop added to cover full booking horizon.
- **Chrome binary**: `channel: 'chromium'` replaced with `executablePath` to system Chrome due to corporate TLS proxy blocking Playwright's binary download.
- **Master timeout**: Increased from 60s to 180s to accommodate multi-page navigation.

## Live Run Results (2026-04-24)

```
Page 1:  5 available slots
Page 2:  9 available slots
Page 3:  5 available slots
Page 4:  0 available slots
Page 5:  5 available slots
Page 6:  3 available slots
Total:  27 slots across all categories
普通車ＡＭ: 3 slots — 2026-06-26, 2026-06-30 (×2)
```

## Phase 2 Fingerprint (CONFIRMED)

| Signal | Value |
|--------|-------|
| Available cell selector | `td[onclick^="selectDate"]` |
| Available class | `tdSelect enable` |
| Unavailable class | `disable` (no onclick) |
| Out-of-period class | `time--cell--tri none` |
| SVG aria-label (available) | `予約可能` |
| Category + date | `labelText` — e.g. `"普通車ＡＭは2026年06月26日"` |
| CALENDAR_SELECTOR needed | No — `td[onclick^="selectDate"]` is sufficient globally |

## User Setup

```bash
cp .env.example .env
# Edit .env: set SLOT_CATEGORY=普通車ＡＭ (or your target category)
npm run fetch
# Output: output/buttons.json with available slots for the category
```

## Next Phase Readiness

Phase 2 (slot detection) can proceed immediately. All unknowns resolved:
- Availability fingerprint: `enable` class + `svgAriaLabel === "予約可能"`
- Date extraction: parse `labelText` (format: `"カテゴリは YYYY年MM月DD日"`)
- `CALENDAR_SELECTOR` is not needed — global `td[onclick^="selectDate"]` works

---
*Phase: 01-fetch-dom-inspection*
*Completed: 2026-04-24*
