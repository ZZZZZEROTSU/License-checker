# Roadmap: Kawasaki License Slot Checker

## Overview

Three phases build the pipeline in strict dependency order. Phase 1 is exploratory — Playwright runs against the live page to capture a DOM snapshot and identify the exact attribute fingerprint distinguishing available from booked slots. Phase 2 wires the detection logic (Parser, Detector, State Store) against that known fingerprint. Phase 3 adds the Notifier and deploys to cron, completing the fully automated monitoring loop.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Fetch + DOM Inspection** - Working Playwright fetcher that navigates to the live page, survives Cloudflare, and dumps a full DOM snapshot for offline analysis
- [ ] **Phase 2: Parser + Detector + State Store** - End-to-end detection pipeline that identifies open slots, filters past dates, deduplicates across runs, and prints timestamped console output
- [ ] **Phase 3: Notifier + Cron Deployment** - Desktop notification on slot detection, structured log file, and hourly cron scheduling

## Phase Details

### Phase 1: Fetch + DOM Inspection
**Goal**: Developer can run the fetcher against the live reservation page and receive a DOM snapshot (HTML, PNG, button-attribute JSON) that documents exactly which attribute distinguishes an available slot from a fully-booked one
**Depends on**: Nothing (first phase)
**Requirements**: DET-01, DET-02, DET-03, REL-03, CFG-01, CFG-03
**Success Criteria** (what must be TRUE):
  1. Running the script navigates to the reservation URL and prints a startup message confirming which URL it is watching
  2. The script waits for the Cloudflare challenge to clear before attempting to read the page, and does not crash on a Cloudflare interstitial
  3. The script writes `snapshot.html`, `snapshot.png`, and a JSON array of all calendar button attributes to disk
  4. If the page exceeds the timeout threshold, the script logs the error and exits with a non-zero code rather than hanging
  5. The target URL and CSS selectors are read from `.env` — changing the URL in `.env` changes which page is fetched without touching source code
**Plans**: 1 plan
Plans:
- [x] 01-01-PLAN.md — Project scaffold + complete DOM snapshot fetcher (src/fetch.ts)

### Phase 2: Parser + Detector + State Store
**Goal**: The script can be run repeatedly against the live page and correctly reports whether any clickable (non-disabled, future-dated) appointment slot is present, suppressing duplicate alerts for the same open slot across consecutive runs
**Depends on**: Phase 1
**Requirements**: DET-04, DET-05, DET-06, NOT-01, REL-01, REL-02, REL-05
**Success Criteria** (what must be TRUE):
  1. Every run prints a timestamped line to console — either "no slots found" or a list of open dates — so the script's liveness is verifiable at any time
  2. Running with `DEBUG=true` (or equivalent flag) dumps raw button attributes to stdout, enabling selector inspection without modifying source code
  3. Slots whose dates fall before today are never reported as available, even if they appear clickable in the DOM
  4. A network failure or parse error on one run logs a warning and does not prevent subsequent scheduled runs from executing
  5. If the calendar container is present but returns zero buttons, the script logs an error state rather than silently reporting "no slots" — empty parse is treated as a broken selector
**Plans**: 2 plans
Plans:
- [x] 02-01-PLAN.md — Playwright browser layer: launch, Cloudflare wait, pagination loop, evaluateAll extraction
- [x] 02-02-PLAN.md — Filter pipeline, state store, console output, .env.example + package.json wiring

### Phase 3: Notifier + Cron Deployment
**Goal**: The fully assembled script runs automatically every hour, fires an OS desktop notification the first time an open slot is detected, and appends a timestamped result line to a structured log file on every run
**Depends on**: Phase 2
**Requirements**: NOT-02, REL-04, CFG-02
**Success Criteria** (what must be TRUE):
  1. When a slot transitions from booked to available, an OS desktop popup notification appears with the slot date(s) — verified by force-triggering with a synthetic fixture
  2. Every run appends one timestamped line to a log file, so a post-hoc audit of all past checks is possible
  3. The script runs automatically once per hour via system cron and produces log output confirming execution, with no manual intervention required after initial setup
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fetch + DOM Inspection | 1/1 | Complete | 2026-04-24 |
| 2. Parser + Detector + State Store | 0/TBD | Not started | - |
| 3. Notifier + Cron Deployment | 0/TBD | Not started | - |
