---
phase: 03-notifier-cron-deployment
plan: "02"
subsystem: ci-deployment
tags: [github-actions, cron, playwright, state-commit, ci]
dependency_graph:
  requires:
    - 03-01 (Slack notifier + dual logging + CI Chrome fix)
  provides:
    - Always-on hourly slot checking via GitHub Actions
    - Automated state persistence across CI runs
  affects:
    - .github/workflows/check.yml
    - data/state.json (persisted by CI after each run)
tech_stack:
  added:
    - GitHub Actions (ubuntu-latest runner)
    - actions/checkout@v4 with fetch-depth: 0
    - actions/setup-node@v4 with Node 24 and npm cache
    - actions/cache@v4 for Playwright Chromium binary
    - workflow_dispatch trigger with slot_category and alert_before inputs
  patterns:
    - Cron schedule 0 * * * * (UTC hourly)
    - Cache key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
    - Skip-ci state commit pattern to prevent workflow loops
key_files:
  created:
    - .github/workflows/check.yml
  modified:
    - data/state.json (runtime artifact persisted by CI)
decisions:
  - "SLOT_CATEGORY and ALERT_BEFORE moved from secrets to plain env vars with workflow_dispatch input overrides — secrets are for sensitive values only"
  - "state.json moved from output/ to data/ to separate runtime state from snapshot artifacts"
  - "Playwright binary cached under ~/.cache/ms-playwright keyed on package-lock.json hash — install-deps only runs on cache hit, full install on miss"
  - "contents: write permission added to job to allow git push of state commit"
  - "Missing state.json guard added before git add — if check run exits before writing state, commit step exits 0 cleanly"
  - "CHROME_PATH intentionally absent from workflow env — causes check.ts default of empty string, so Playwright uses its own CI binary without executablePath override"
metrics:
  duration: "~60 min (including human verification of live end-to-end run)"
  completed: "2026-04-24"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 03 Plan 02: GitHub Actions CI Deployment Summary

GitHub Actions workflow created and verified end-to-end: hourly cron (0 * * * *) on ubuntu-latest running Node 24, npm ci, cached Playwright Chromium install, npm run check with secrets + plain env vars, and a [skip ci] state commit back to the repo.

## What Was Built

### .github/workflows/check.yml

The complete GitHub Actions CI workflow that makes the slot checker autonomous.

**Triggers:**
- `schedule: cron: '0 * * * *'` — fires every hour UTC
- `workflow_dispatch` — manual trigger with two optional inputs:
  - `slot_category` (default: `普通車ＡＭ`) — overrides SLOT_CATEGORY env var
  - `alert_before` (default: empty) — overrides ALERT_BEFORE env var

**Job steps in order:**
1. `actions/checkout@v4` with `fetch-depth: 0` — full history needed for git push in state commit step
2. `actions/setup-node@v4` with `node-version: '24'` and `cache: 'npm'` — caches node_modules across runs
3. `npm ci` — deterministic install from package-lock.json
4. `actions/cache@v4` for `~/.cache/ms-playwright` keyed on OS + package-lock.json hash
5. `npx playwright install chromium --with-deps` — only runs on cache miss
6. `npx playwright install-deps chromium` — only runs on cache hit (installs system libs without re-downloading binary)
7. `npm run check` with env:
   - `TARGET_URL` and `SLACK_WEBHOOK_URL` from repository secrets
   - `SLOT_CATEGORY` and `ALERT_BEFORE` from workflow inputs with fallback defaults (plain env vars, not secrets)
   - `CHROME_PATH` intentionally absent — causes check.ts to default to `''` and use Playwright's own CI binary
8. State commit step:
   - Configures git-actions bot identity
   - Guards: exits 0 if `data/state.json` does not exist
   - `git add data/state.json`
   - `git diff --cached --quiet` check — skips commit if state unchanged
   - `git commit -m "chore(ci): update state [skip ci]"` + `git push` — [skip ci] prevents infinite loop

### Private Repo: ZZZZZEROTSU/License-checker

The private GitHub repository was created and all project code was pushed, making the workflow live.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added workflow_dispatch inputs for SLOT_CATEGORY and ALERT_BEFORE**
- **Found during:** Task 1 follow-up
- **Issue:** Original plan passed SLOT_CATEGORY and ALERT_BEFORE as secrets, but these are configuration values (not sensitive) and need to be overridable per-run for testing
- **Fix:** Added `workflow_dispatch.inputs` block with `slot_category` and `alert_before` inputs; env vars use `${{ inputs.slot_category || '普通車ＡＭ' }}` pattern
- **Commit:** 21a8ca2, 535b553

**2. [Rule 1 - Bug] Moved state.json from output/ to data/**
- **Found during:** Task 1 follow-up
- **Issue:** Workflow committed `output/state.json` but check.ts writes to `data/state.json`; path mismatch caused commit step to always find no file
- **Fix:** Updated workflow to `git add data/state.json`; also updated check.ts state path to `data/`
- **Commit:** 535b553

**3. [Rule 2 - Missing functionality] Added contents: write permission**
- **Found during:** CI run
- **Issue:** Default GITHUB_TOKEN permissions do not include `contents: write`; git push in state commit step was failing with 403
- **Fix:** Added `permissions: contents: write` to the job block
- **Commit:** 1c29c76

**4. [Rule 2 - Missing functionality] Added npm and Playwright caching**
- **Found during:** CI run performance review
- **Issue:** Every run re-downloaded node_modules and Playwright Chromium binary; hourly runs were slow and consumed network quota unnecessarily
- **Fix:** Added `cache: 'npm'` to setup-node step and `actions/cache@v4` for `~/.cache/ms-playwright` with conditional install steps
- **Commit:** 9cbde5b

**5. [Rule 1 - Bug] Added missing-file guard in state commit step**
- **Found during:** CI run edge case review
- **Issue:** If `npm run check` exits early (e.g., TARGET_URL not set, network error before state write), `git add data/state.json` would fail with "pathspec did not match any files"
- **Fix:** Added `if [ ! -f data/state.json ]; then echo "No state file — skipping commit"; exit 0; fi` before git add
- **Commit:** 8ec04fc

## Human Verification

**Checkpoint passed:** GitHub Actions workflow ran end-to-end successfully. User confirmed the live workflow executed: checkout, Node setup, npm ci, Playwright install (with cache), npm run check against the live reservation page, and state commit with [skip ci] guard — all steps completed without errors.

## Commits

| Hash | Message |
|------|---------|
| 425ca52 | feat(03-02): add GitHub Actions hourly cron workflow |
| 21a8ca2 | config(03-02): move SLOT_CATEGORY and ALERT_BEFORE from secrets to plain env vars |
| 535b553 | fix: move state.json to data/, default ALERT_BEFORE to 2 months from now, workflow_dispatch inputs |
| 1c29c76 | fix(ci): add contents: write permission for state commit |
| 9cbde5b | perf(ci): cache npm and Playwright Chromium to speed up hourly runs |
| 8ec04fc | fix(ci): skip state commit if state.json does not exist |

## Known Stubs

None.

## Threat Flags

None. The workflow uses GitHub-managed secrets for sensitive values (TARGET_URL, SLACK_WEBHOOK_URL). The state commit uses the scoped GITHUB_TOKEN with minimum required permission (contents: write). No new network endpoints or auth paths introduced beyond the existing Slack webhook.

## Self-Check: PASSED

- `.github/workflows/check.yml` exists and was verified end-to-end by human
- All 6 commits listed above are present in git log
- No files unexpectedly deleted
