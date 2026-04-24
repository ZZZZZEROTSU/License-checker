---
phase: 02-parser-detector-state-store
reviewed: 2026-04-24T12:15:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/check.ts
  - .env.example
  - package.json
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-04-24T12:15:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed `src/check.ts` (the main checker script), `.env.example`, and `package.json`. The
overall structure is sound: the filter pipeline, state persistence, and multi-page navigation
loop are implemented correctly. No critical security vulnerabilities or crash-inducing bugs
were found.

Three warnings require attention: error output is incorrectly sent to stdout (masking errors
from log processors), the state file write has no error handling (silent failure hides state
loss), and the parsed state from disk is not shape-validated (a corrupt/unexpected state.json
can silently break alert logic). Four informational items cover minor issues including
suspicious dependency version numbers in package.json.

---

## Warnings

### WR-01: Error output sent to stdout instead of stderr

**File:** `src/check.ts:213`

**Issue:** The master catch block writes error messages to `process.stdout` rather than
`process.stderr`. Every other error output in the file (lines 26, 75) correctly uses
`process.stderr`. This breaks log aggregators, cron job error capture, and any caller that
checks stderr for failures.

**Fix:**
```typescript
// Line 213 — change process.stdout to process.stderr
process.stderr.write(`[kawasaki] ${new Date().toISOString()} — ERROR: ${msg}\n`);
```

---

### WR-02: State file write has no error handling — silent failure hides state loss

**File:** `src/check.ts:197-198`

**Issue:** `fs.mkdirSync` and `fs.writeFileSync` are called without any error handling. If
either throws (e.g., permission denied on the `output/` directory), the exception propagates
to the outer `try/catch` at line 201, which logs the error message and exits 0. This means
state is lost silently: the next run starts fresh with `alert_active: false`, potentially
re-firing duplicate alerts.

**Fix:**
```typescript
try {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
} catch (writeErr) {
  const msg = writeErr instanceof Error ? writeErr.message : String(writeErr);
  process.stderr.write(`[kawasaki] ${ts} — WARN: failed to write state file: ${msg}\n`);
  // Do not exit — the check result was still printed; state loss is acceptable as a warning
}
```

---

### WR-03: Parsed state.json is not shape-validated — corrupt data silently breaks alert logic

**File:** `src/check.ts:167`

**Issue:** `JSON.parse(raw) as State` uses a TypeScript type assertion, not a runtime
validation. If `state.json` contains a corrupt value (e.g., `"alert_active": "true"` as a
string, or a missing field), the downstream `if (!state.alert_active)` check on line 180 will
silently misbehave — a stringified `"true"` is truthy in JS even though it is not the boolean
`true`, but other malformed shapes could suppress or repeat alerts incorrectly.

**Fix:**
```typescript
function isValidState(obj: unknown): obj is State {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as State).alert_active === 'boolean' &&
    typeof (obj as State).last_check === 'string' &&
    Array.isArray((obj as State).last_qualifying_dates)
  );
}

try {
  const raw = fs.readFileSync(STATE_FILE, 'utf-8');
  const parsed = JSON.parse(raw);
  if (isValidState(parsed)) {
    state = parsed;
  } else {
    process.stderr.write(`[kawasaki] WARN: state.json has unexpected shape — resetting to defaults\n`);
  }
} catch {
  // Missing or corrupt file = first run; use defaults above
}
```

---

## Info

### IN-01: process.exit(0) on zero-slot "ERROR" condition hides failures from cron/monitoring

**File:** `src/check.ts:135`

**Issue:** When zero slot cells are found (a suspected page-structure change), the code logs
`ERROR: selector matched 0 cells` but exits with code 0. Cron jobs and monitoring systems
typically treat non-zero exit codes as failures. Exiting 0 means this error condition is
invisible unless stdout is actively parsed.

**Fix:** Consider `process.exit(1)` for this case to allow the caller to detect the failure:
```typescript
process.exit(1);  // was: process.exit(0)
```
If zero-slot results are expected during off-hours, document this decision with a comment.

---

### IN-02: extractDate called twice per record — redundant computation in deduplication step

**File:** `src/check.ts:159`

**Issue:** `extractDate(rec.labelText)` is called once inside the `.filter()` pipeline (line
149) and a second time in the deduplication map on line 159. The result is discarded between
the two calls. While not a bug (`.filter(Boolean)` guards the nulls), it is wasteful and
could be simplified.

**Fix:**
```typescript
// Carry the date through the filter instead of recomputing it
const qualifyingWithDates = allData.flatMap(rec => {
  if (!rec.classList.includes('enable')) return [];
  if (SLOT_CATEGORY && !rec.labelText.startsWith(SLOT_CATEGORY)) return [];
  const date = extractDate(rec.labelText);
  if (!date) return [];
  if (date < today) return [];
  if (ALERT_BEFORE && date >= ALERT_BEFORE) return [];
  return [date];
});
const qualifyingDates = [...new Set(qualifyingWithDates)].sort();
```

---

### IN-03: Suspicious dependency versions in package.json

**File:** `package.json:10,12`

**Issue:** `dotenv: 17.4.2` and `typescript: 6.0.3` are significantly ahead of the latest
published versions (dotenv ~16.x, TypeScript ~5.x as of mid-2026). These may be typos,
placeholder values, or speculative future version pins. If the actual installed packages
differ, `npm install` will fail or produce unexpected results.

**Fix:** Verify these version numbers against the actual installed packages:
```bash
npm list dotenv typescript
```
If they are incorrect, pin to the actual installed versions.

---

### IN-04: Magic string `#TBL` in waitForSelector not documented

**File:** `src/check.ts:121`

**Issue:** `page.waitForSelector('#TBL', ...)` uses a hardcoded selector that is not defined
alongside the other selectors at the top of the file (lines 18-19). If the calendar table ID
changes on the target site, this will silently break navigation without a clear failure message
tying back to the site structure.

**Fix:** Promote to a named constant with the other selectors at the top of the file:
```typescript
const CALENDAR_TABLE_SEL = '#TBL';  // add near line 18

// then at line 121:
await page.waitForSelector(CALENDAR_TABLE_SEL, { state: 'visible', timeout: PAGE_TIMEOUT_MS });
```

---

_Reviewed: 2026-04-24T12:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
