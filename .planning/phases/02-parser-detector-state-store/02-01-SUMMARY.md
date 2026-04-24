---
phase: 02-parser-detector-state-store
plan: "01"
subsystem: browser-acquisition
tags: [playwright, typescript, check-ts, slot-extraction]
dependency_graph:
  requires: [01-01-SUMMARY.md]
  provides: [src/check.ts — browser launch + Cloudflare wait + pagination + evaluateAll extraction]
  affects: [src/check.ts]
tech_stack:
  added: []
  patterns: [Playwright chromium headless, multi-stage page-ready wait, evaluateAll DOM extraction, Promise.race master timeout]
key_files:
  created: [src/check.ts]
  modified: []
decisions:
  - "Master timeout catch uses process.exit(0) not exit(1) for cron compatibility (D-12)"
  - "Removed allData.length === 0 throw from browser layer — guard moves to filter layer in Plan 02"
  - "SlotRecord type, waitForCloudflare, collectPageSlots, pagination loop copied verbatim from fetch.ts"
metrics:
  duration: "1 min"
  completed_date: "2026-04-24"
requirements_satisfied: [DET-04]
---

# Phase 2 Plan 01: Browser Acquisition Layer Summary

**One-liner:** Playwright headless Chromium browser layer with Cloudflare wait, multi-stage page-ready, #TBL pagination loop, and evaluateAll SlotRecord extraction copied verbatim from fetch.ts.

## What Was Built

`src/check.ts` — the data-acquisition foundation for Phase 2. The file:

1. Launches headless Chromium via Playwright with the same constants as `fetch.ts`
2. Navigates to `TARGET_URL` and waits through Cloudflare challenges
3. Applies the 3-stage page-ready wait (networkidle in try/catch → readyState complete → optional CALENDAR_SELECTOR wait)
4. Builds `slotSel` from `CALENDAR_SELECTOR` (same logic as fetch.ts)
5. Uses `collectPageSlots()` with `evaluateAll` to extract `SlotRecord[]` per page
6. Paginates through all calendar pages via the `2週後` button until disabled or `MAX_PAGES` reached
7. Returns `allData: SlotRecord[]` — ready for Plan 02's filter/state/output layer
8. Adds Phase 2 constants: `ALERT_BEFORE`, `DEBUG`, `STATE_FILE`
9. Master timeout catch exits 0 (cron-compatible) and prints to stdout in the required format

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create src/check.ts — browser + extraction layer | e35edc6 | src/check.ts (created, 139 lines) |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-02-02 | `Promise.race` with `MASTER_TIMEOUT_MS = 180_000` kills hung browser; `browser.close()` in catch prevents process leak |

## Known Stubs

- `// TODO(plan-02): filter, state, output logic goes here` in `run()` at line 116 — intentional; Plan 02 fills this in.

## Self-Check: PASSED

- [x] `src/check.ts` exists at `/Users/ziruo.zou/tasks/test/kawasaki/src/check.ts`
- [x] Commit `e35edc6` exists in git log
- [x] `npx tsc --noEmit` exits 0
- [x] `git diff src/fetch.ts` is empty
- [x] `process.exit(1)` appears exactly once (TARGET_URL guard)
- [x] `process.exit(0)` appears in master timeout catch block
