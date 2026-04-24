# Phase 3: Notifier + Cron Deployment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 03-notifier-cron-deployment
**Areas discussed:** Desktop notification, Cron setup method

---

## Desktop Notification

| Option | Description | Selected |
|--------|-------------|----------|
| osascript | macOS built-in, zero deps | |
| node-notifier | npm package, richer API | |
| terminal-notifier | brew CLI, most features | |
| Slack webhook | HTTP POST, phone alert, zero new deps | ✓ |
| Telegram bot | Bot API, requires BotFather setup | |

**User's choice:** Slack webhook (user asked about phone/Slack/email — Slack chosen for simplicity)
**Notes:** User prioritised phone reach over desktop popup. osascript/desktop notification deprioritised. NOT-02 requirement satisfied in spirit by Slack.

Trigger: only when `alert_active` flips false → true (new slot). No duplicate pings.
Webhook URL: GitHub Actions secret (`SLACK_WEBHOOK_URL`).

---

## Cron Setup Method

| Option | Description | Selected |
|--------|-------------|----------|
| Plain crontab + shell wrapper | Simple, any Mac | |
| macOS launchd plist | Mac-native, survives login | |
| pm2 process manager | Self-healing, nice logs | |
| GitHub Actions (hourly cron) | Cloud-hosted, logs in UI, no laptop dependency | ✓ |

**User's choice:** GitHub Actions — private repo `ZZZZZEROTSU/License-checker`
**Notes:** User proposed GitHub Actions; preferred over local cron because no laptop dependency. Playwright Chromium installed in CI (avoids local SSL proxy issue). state.json committed back to repo with `[skip ci]` to preserve alert dedup state.

Browser: `npx playwright install chromium --with-deps` on Ubuntu runner.
Secrets: `SLACK_WEBHOOK_URL`, `TARGET_URL`, `SLOT_CATEGORY`, `ALERT_BEFORE` all as repo secrets.
State: `output/state.json` committed back after each run (`[skip ci]`).

---

## Log File

Not explicitly discussed — delegated to Claude's discretion.
Decision: `output/kawasaki.log`, append-only, mirrors `[kawasaki] ISO — <message>` format.

---

## Claude's Discretion

- Slack payload format (plain text vs blocks)
- `workflow_dispatch` trigger addition
- Error handling for failed Slack POST
- `.gitignore` entries for `output/`

## Deferred Ideas

- Telegram notification (v2 NOTF-01)
- Email notification
- Notification throttle/cooldown (v2 NOTF-02)
- Sentinel file (v2 NOTF-03)
