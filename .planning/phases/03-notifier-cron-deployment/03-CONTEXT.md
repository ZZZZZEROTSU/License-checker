# Phase 3: Notifier + Cron Deployment - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Slack phone notification on first slot detection, append every run result to a log file, and deploy the script to run automatically every hour via GitHub Actions on a private repository.

New capabilities delivered:
- Slack webhook notification (phone alert) — fires once when alert_active flips false → true
- Append-only log file (output/kawasaki.log) — one line per run
- GitHub Actions workflow — hourly cron schedule, Playwright Chromium in CI, state.json committed back to repo after each run

Out of scope for this phase:
- Telegram, email, or other notification channels (v2 backlog — NOTF-01)
- Notification throttle/cooldown beyond the existing alert_active state logic
- Automatic booking or form submission

</domain>

<decisions>
## Implementation Decisions

### Notification Channel
- **D-01:** Notification target: Slack via incoming webhook — HTTP POST from built-in `fetch`, zero new npm dependencies.
- **D-02:** Notification trigger: only when `alert_active` flips `false → true` (new slot detected for the first time). Mirrors existing state logic in `src/check.ts`. No duplicate pings for slots that remain open across consecutive runs.
- **D-03:** Slack webhook URL stored as GitHub Actions repository secret (`SLACK_WEBHOOK_URL`). Also added to `.env.example` for local testing. Never committed to the repo.
- **D-04:** Notification message format (Claude's discretion — keep it simple and actionable):
  ```
  [kawasaki] SLOT AVAILABLE: 普通車ＡＭ on 20260630 — book now: <TARGET_URL>
  ```
- **D-05:** macOS desktop notification (`osascript`) is NOT required — Slack covers the phone alert use case. The ROADMAP requirement NOT-02 ("OS desktop popup") is superseded by Slack for this user's needs. Document this substitution in CONTEXT.

### Log File (REL-04)
- **D-06:** Log file path: `output/kawasaki.log` — appended on every run, same `output/` directory as `state.json`.
- **D-07:** Log format: mirror the existing `[kawasaki] ISO — <message>` console output format. Each run appends exactly the same line(s) that were printed to stdout. No additional structured fields needed.
- **D-08:** Log rotation: not required for v1 — single developer, hourly cron, log grows ~1 line/hour. Leave as unbounded append.
- **D-09:** `output/kawasaki.log` is gitignored (already covered by `output/` gitignore). Log is a runtime artifact, not committed — except the executor must add an explicit `output/*.log` entry if the wildcard is not already in `.gitignore`.

### GitHub Actions Scheduling (CFG-02)
- **D-10:** Repository: `ZZZZZEROTSU/License-checker` — private repo, created during Phase 3 execution via `gh repo create ZZZZZEROTSU/License-checker --private`.
- **D-11:** Cron schedule: `0 * * * *` (every hour on the hour, UTC). GitHub Actions uses UTC — no timezone offset needed for this use case.
- **D-12:** Workflow file: `.github/workflows/check.yml`.
- **D-13:** Browser in CI: `npx playwright install chromium --with-deps` — installs the bundled Chromium binary. GitHub's Ubuntu runner has no SSL proxy issues, so this works cleanly unlike the local macOS setup.
- **D-14:** State persistence across runs: the workflow commits `output/state.json` back to the repo after every run. This preserves `alert_active` so duplicate Slack pings are suppressed. Commit message: `chore(ci): update state [skip ci]` (the `[skip ci]` tag prevents the commit from triggering another workflow run).
- **D-15:** Secrets in CI: `SLACK_WEBHOOK_URL`, `TARGET_URL`, `SLOT_CATEGORY`, `ALERT_BEFORE` all stored as GitHub Actions repository secrets and injected as environment variables in the workflow. The `.env` file is NOT committed to the repo.
- **D-16:** Working directory for CI: repo root. `npm ci` installs dependencies, then `npm run check` runs the script.
- **D-17:** Node version in CI: match local — Node 24 LTS (`node-version: '24'`).

### Claude's Discretion
- Slack payload shape (text-only vs blocks) — keep it simple, plain text message is fine.
- Exact `.gitignore` entries to add for `output/` if not already present.
- Whether to add a `workflow_dispatch` trigger to the GitHub Actions workflow (allows manual runs from the Actions UI — recommended but Claude decides).
- Error handling for failed Slack POST (network error in CI) — log to stdout and continue; do not exit 1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 Artifacts (MUST READ)
- `src/check.ts` — The script being scheduled; Slack notification and log write are added inside this file's output section (alongside the existing `console.log` calls)
- `.env.example` — Add `SLACK_WEBHOOK_URL=` entry
- `output/state.json` — State schema: `{ alert_active, last_check, last_qualifying_dates }` — CI workflow must commit this file back after each run

### Phase 2 Context (MUST READ)
- `.planning/phases/02-parser-detector-state-store/02-CONTEXT.md` — D-10 defines the exact console output format that the log file mirrors; D-12 defines exit-0-always behavior that CI must not override

### Config
- `.env.example` — Current env var list; Phase 3 adds `SLACK_WEBHOOK_URL`

### No external specs
- GitHub Actions cron syntax and Playwright CI setup are standard — no project ADRs exist yet.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/check.ts` — All Slack notification and log-append logic goes inside the existing `run()` function's output section, immediately after the `console.log` calls. No new entry point needed.
- `output/` directory — Already created at runtime by `fs.mkdirSync`; log file write can use the same pattern.

### Established Patterns
- Console output: `[kawasaki] ${ts} — <message>` — log file mirrors this exactly using `fs.appendFileSync`.
- Exit 0 always (D-12 from Phase 2) — CI workflow must not add `|| exit 1` wrappers around `npm run check`.
- `fetch` is available natively in Node 24 — no `node-fetch` package needed for Slack POST.

### Integration Points
- `src/check.ts` Step 8 (output section): add `fs.appendFileSync(LOG_FILE, logLine + '\n')` and `sendSlackNotification(message)` call in the `!state.alert_active` branch (new alert path only).
- `package.json` scripts: no changes needed — `npm run check` is the CI entry point.
- `.github/workflows/check.yml`: new file, references all secrets as env vars.

</code_context>

<specifics>
## Specific Ideas

- User confirmed Slack is the preferred notification channel over macOS desktop popup — phone reach is the priority.
- NOT-02 (OS desktop popup) is substituted by Slack webhook for this deployment. The requirement is satisfied in spirit — user gets an alert on their phone which is better than a desktop-only popup.
- The repo `ZZZZZEROTSU/License-checker` must be created as **private** during execution.
- `[skip ci]` in the state commit message is essential — prevents the state update commit from re-triggering the workflow in an infinite loop.

</specifics>

<deferred>
## Deferred Ideas

- **Telegram notification** (NOTF-01 in v2 requirements) — user asked about phone notifications; Slack chosen for v1 simplicity. Telegram remains in v2 backlog.
- **Email notification** — mentioned during discussion; deferred to v2.
- **Notification throttle/cooldown** (NOTF-02) — existing `alert_active` state provides basic dedup; advanced cooldown deferred to v2.
- **Sentinel file on notification** (NOTF-03) — v2 backlog.

</deferred>

---

*Phase: 03-notifier-cron-deployment*
*Context gathered: 2026-04-24*
