# Kawasaki License Slot Checker

## What This Is

A script that monitors a Japanese driver's license center reservation page and detects when appointment slots become available. The page is publicly accessible and availability is indicated by calendar dates or buttons becoming clickable (from greyed-out to active). The script runs on a schedule and alerts the user when a slot opens.

## Core Value

Detect the moment a clickable appointment slot appears on the Japanese license center reservation page, so the user can book before it fills again.

## Requirements

### Validated

- [x] Script checks the reservation page for available (clickable) slots — Validated in Phase 1 & 2: `td[onclick^="selectDate"]` with `enable` class; `npm run fetch` and `npm run check` both confirmed live
- [x] Script outputs a clear result — available or not — to terminal/log — Validated in Phase 2: `[kawasaki] ISO — SLOT AVAILABLE / no qualifying slots / already alerted` confirmed live

### Active

- [ ] Script runs on a schedule (e.g. hourly via cron or similar)
- [ ] Notification mechanism when a slot is found (TBD — terminal output for now, extendable later)
- [ ] Handles the case where the page is always showing full (no false positives)

### Out of Scope

- Auto-booking — not filling out the form automatically (complexity, risk of errors)
- Login/authentication — page is publicly accessible, no credentials needed
- Multi-page or multi-location monitoring — scoped to one specific URL for now

## Context

- Target: Japanese driver's license center reservation page (specific URL to be provided at build time)
- The page is publicly accessible — no login required
- Availability signal: calendar cells or buttons that are normally greyed out become clickable/active
- The user has never seen a slot open — the page always shows full, making it hard to know what "available" looks like in the DOM
- Script needs to be robust enough to distinguish "no slots" from "site error / page changed"

## Constraints

- **Access**: Page is publicly accessible — no session management needed
- **Frequency**: Runs on a schedule (hourly) rather than continuous polling
- **Language**: No strong preference — Python is a natural fit for page scraping
- **Fragility**: Japanese government sites can change layout; detection logic should be inspectable and easy to update

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript + Playwright | Node ecosystem chosen over Python; system Chrome via executablePath works around corporate SSL proxy blocking Playwright binary download | — Validated Phase 1 |
| Detect by `enable` CSS class on `td[onclick^="selectDate"]` | DOM inspection confirmed availability is `td.enable`; greyed-out cells lack this class | — Validated Phase 1 |
| State persisted to `output/state.json` with `alert_active` flag | Prevents duplicate alerts across cron runs; resets when slots disappear | — Validated Phase 2 |
| Output to stdout with `[kawasaki]` prefix, exit 0 always | Cron-compatible; errors logged to stdout so cron captures them | — Validated Phase 2 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-24 after Phase 2 completion*
