---
status: partial
phase: 02-parser-detector-state-store
source: [02-VERIFICATION.md]
started: 2026-04-24T12:20:00.000Z
updated: 2026-04-24T12:20:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live run — confirm output and state.json creation
expected: Running `npm run check` produces exactly one `[kawasaki] ISO — ...` line on stdout and creates `output/state.json`
result: [pending]

### 2. DEBUG mode — raw records dump
expected: With `DEBUG=true npm run check`, raw SlotRecord JSON array dumps to stdout before the result line
result: [pending]

### 3. Empty parse guard — ERROR on non-matching selector
expected: With a non-matching `CALENDAR_SELECTOR`, script prints `[kawasaki] ISO — ERROR: selector matched 0 cells — possible page structure change` and exits 0
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
