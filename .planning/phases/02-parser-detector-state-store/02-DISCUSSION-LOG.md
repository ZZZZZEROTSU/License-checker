# Phase 2: Parser + Detector + State Store - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 02-parser-detector-state-store
**Areas discussed:** Run mode, State store

---

## Run Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Always re-fetch (Recommended) | One command fetches live page AND checks for slots. Self-contained for cron. | ✓ |
| Read existing buttons.json | Check reads last output from `npm run fetch`. Faster for testing locally. | |

**User's choice:** Always re-fetch

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep fetch for debugging (Recommended) | fetch = snapshot tool, check = cron runner. Two commands, different purposes. | ✓ |
| Replace fetch with check | Single command only. Loses snapshot debug capability. | |

**User's choice:** Keep `npm run fetch` for debugging

---

## State Store

| Option | Description | Selected |
|--------|-------------|----------|
| Seen slot dates (Recommended) | Store open dates list; alert on new dates even while others stay open. | |
| Any-slot-open boolean | Store true/false. Alert once, silence until slots disappear and reappear. | ✓ (with modification) |

**User's choice:** Boolean, but with `ALERT_BEFORE` date threshold configurable in `.env` — only slots before that date qualify for alerting.

**User clarification:** "Any-slot-open boolean, but I need able to config that if the slot range that need to send alert (e.g., date < 20260601)"

---

| Option | Description | Selected |
|--------|-------------|----------|
| When slots disappear then reappear (Recommended) | Alert once when qualifying slots first appear. Re-alert when they vanish and return. | ✓ |
| Every run with qualifying slots | Alert every hour as long as a slot is open. No deduplication. | |

**User's choice:** Alert on state change (disappear → reappear triggers re-alert)

---

| Option | Description | Selected |
|--------|-------------|----------|
| In .env (Recommended) | ALERT_BEFORE=20260601 alongside other config. | ✓ |
| In source code | Hardcoded constant, requires code edit to change. | |

**User's choice:** `.env`

---

## Claude's Discretion

- File structure: shared browser helper vs duplication — Claude decides
- Date parsing implementation detail
- State file write timing

## Deferred Ideas

- Re-alert cooldown timer (ALERT_COOLDOWN_HOURS) — v2
- Multiple SLOT_CATEGORY values — v2
- Telegram notification — v2
