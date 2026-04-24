# Phase 2: Parser + Detector + State Store - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 wires the detection pipeline: a new `src/check.ts` script that fetches the live page (re-using the same Playwright logic as `src/fetch.ts`), detects qualifying available slots, compares against persisted state, and prints a timestamped result to console on every run.

**In scope:** Parser (extract slot data from DOM), Detector (filter by category + date threshold), State Store (persist boolean seen-state to JSON file), `npm run check` entry point, `ALERT_BEFORE` and `SLOT_CATEGORY` config, DEBUG mode (DET-06), past-date filtering (DET-05), empty-parse error state (REL-05), graceful error handling (REL-01).

**Out of scope:** OS desktop notification (Phase 3), structured log file (Phase 3), cron scheduling (Phase 3), Telegram/push notifications (v2).

</domain>

<decisions>
## Implementation Decisions

### Run Mode
- **D-01:** `npm run check` fetches the live page itself on every run — self-contained, always fresh data. This is what cron will invoke.
- **D-02:** `npm run fetch` (src/fetch.ts) is kept as a separate debug command — writes snapshot.html, snapshot.png, buttons.json to disk for manual inspection. Two commands with different purposes.
- **D-03:** New entry point: `src/check.ts` — the Phase 2 script. It re-uses the same Playwright launch + page navigation + pagination logic from src/fetch.ts (extract to shared helper or duplicate with intent to refactor in Phase 3).

### Detection Logic
- **D-04:** Available slot fingerprint (confirmed from Phase 1 live run):
  - Selector: `td[onclick^="selectDate"]`
  - Available class: `tdSelect enable` (classList contains `enable`)
  - Date extraction: parse `labelText` — format `"カテゴリは YYYY年MM月DD日"` → extract `YYYYMMDD`
  - Category filter: `labelText.startsWith(SLOT_CATEGORY)` (already implemented in fetch.ts)
- **D-05:** Past-date filter: parse date from `labelText`, compare to today's date — never report slots where date < today (DET-05).
- **D-06:** Date threshold filter: `ALERT_BEFORE` env var (format `YYYYMMDD`, e.g. `20260601`). Only slots with date < `ALERT_BEFORE` qualify for alerting. Empty/unset = no threshold (all future dates qualify).

### State Store
- **D-07:** State model: boolean `alert_active: boolean`. Alert fires when qualifying slots (matching SLOT_CATEGORY + before ALERT_BEFORE + future-dated) exist AND `alert_active` was `false`. Silenced while `alert_active` is `true`. Resets to `false` when qualifying slots disappear, enabling re-alert on new openings.
- **D-08:** State file: `output/state.json` — gitignored (already in output/). Schema: `{ "alert_active": boolean, "last_check": "ISO timestamp", "last_qualifying_dates": ["YYYYMMDD"] }`.
- **D-09:** Missing state file = first run — treat as `alert_active: false`, create file after run.

### Console Output (NOT-01)
- **D-10:** Every run prints a timestamped line to console:
  - No qualifying slots: `[kawasaki] 2026-04-24T09:00:00Z — no qualifying slots (普通車ＡＭ before 20260601)`
  - Slots found (new alert): `[kawasaki] 2026-04-24T09:00:00Z — SLOT AVAILABLE: 普通車ＡＭ on 2026-05-15`
  - Slots found (already alerted): `[kawasaki] 2026-04-24T09:00:00Z — slot open (already alerted): 2026-05-15`
  - Error: `[kawasaki] 2026-04-24T09:00:00Z — ERROR: <message>`

### Debug Mode (DET-06)
- **D-11:** `DEBUG=true` env var dumps all raw slot records (the full objects from evaluateAll) to stdout before filtering. Set in `.env` or inline: `DEBUG=true npm run check`.

### Error Handling (REL-01, REL-05)
- **D-12:** Network failure or Playwright crash: catch error, print timestamped error line, exit 0 (not exit 1) so cron does not mark the job as failed and stop scheduling.
- **D-13:** Empty parse (selector matched 0 cells): log error state `"ERROR: selector matched 0 cells — possible page structure change"`, exit 0 (REL-05 — empty parse ≠ "no slots").

### Claude's Discretion
- File structure: whether to share Playwright launch code between fetch.ts and check.ts via a `src/browser.ts` helper, or duplicate for now — Claude decides based on code size.
- Exact date parsing implementation (regex vs Intl.DateTimeFormat vs manual split).
- State file write timing (before or after console output).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Artifacts (MUST READ)
- `src/fetch.ts` — Existing fetcher; check.ts reuses or mirrors its Playwright launch, navigation, Cloudflare wait, pagination loop, and evaluateAll extraction
- `.env.example` — Existing config template; Phase 2 adds ALERT_BEFORE
- `output/buttons.json` — Sample output from live run; confirms slot record schema

### Planning Context
- `.planning/REQUIREMENTS.md` — Phase 2 requirements: DET-04, DET-05, DET-06, NOT-01, REL-01, REL-02, REL-05
- `.planning/ROADMAP.md` — Phase 2 success criteria (5 items)
- `.planning/phases/01-fetch-dom-inspection/01-CONTEXT.md` — Phase 1 decisions (stack, patterns)
- `.planning/phases/01-fetch-dom-inspection/01-01-SUMMARY.md` — Confirmed slot fingerprint, pagination pattern, live run results

### Research
- `.planning/research/ARCHITECTURE.md` — Five-component pipeline; Parser/Detector/State Store boundaries
- `.planning/research/PITFALLS.md` — Empty parse pitfall, silent failure guard

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/fetch.ts` — Full Playwright launch + Cloudflare wait + multi-stage page-ready wait + `#TBL` pagination loop + `evaluateAll` extraction. check.ts reuses this logic directly (either import or mirror).
- `.env` / `.env.example` — dotenv config pattern already established; add ALERT_BEFORE and keep SLOT_CATEGORY.

### Established Patterns
- Startup log before browser launch: `[kawasaki] Watching: <URL>`
- Master timeout via `Promise.race` wrapping the entire run
- Hard error on empty result (now: throw, caught by master timeout catch)
- All config via dotenv constants at top of file

### Integration Points
- `check.ts` replaces `fetch.ts` as the cron entry point in Phase 3
- `output/state.json` is written by check.ts and read on the next run
- `output/` directory already exists and is gitignored

</code_context>

<specifics>
## Specific Ideas

- `ALERT_BEFORE=20260601` in `.env` — date format YYYYMMDD, matches the format in labelText
- State store schema: `{ "alert_active": boolean, "last_check": "ISO", "last_qualifying_dates": ["YYYYMMDD"] }` — `last_qualifying_dates` is for human inspection, not used in logic
- Console output prefix `[kawasaki]` established in fetch.ts — keep consistent
- Exit 0 on all errors (for cron compatibility) — only fetch.ts used exit 1 (it's a debug tool, not a scheduled runner)

</specifics>

<deferred>
## Deferred Ideas

- Shared `src/browser.ts` helper (extract Playwright launch logic) — may not be needed if check.ts is self-contained
- Re-alert after N hours even if alert_active (e.g. ALERT_COOLDOWN_HOURS) — v2
- Multiple SLOT_CATEGORY values (comma-separated) — v2
- Telegram notification on slot found — v2 (NOTF-01)

</deferred>

---

*Phase: 02-parser-detector-state-store*
*Context gathered: 2026-04-24*
