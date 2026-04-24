# Kawasaki License Slot Checker

## What This Is

A script that monitors a Japanese driver's license center reservation page and detects when appointment slots become available. The page is publicly accessible and availability is indicated by calendar dates or buttons becoming clickable (from greyed-out to active). The script runs on a schedule and alerts the user when a slot opens.

## Core Value

Detect the moment a clickable appointment slot appears on the Japanese license center reservation page, so the user can book before it fills again.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Script checks the reservation page for available (clickable) slots
- [ ] Script runs on a schedule (e.g. hourly via cron or similar)
- [ ] Script outputs a clear result — available or not — to terminal/log
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
| Python + requests/Playwright | Best ecosystem for HTML inspection and headless browsing on Japanese sites that may use JS-rendered content | — Pending |
| Detect by clickable vs greyed-out state | User confirmed this is how availability is signaled on the page | — Pending |
| Output to terminal first, notification later | Notification mechanism TBD — keep it simple, make it extensible | — Pending |

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
*Last updated: 2026-04-24 after initialization*
