# Requirements: Kawasaki License Slot Checker

**Defined:** 2026-04-24
**Core Value:** Detect the moment a clickable appointment slot appears on the Japanese license center reservation page, so the user can book before it fills again.

## v1 Requirements

### Detection

- [x] **DET-01**: Script launches a hidden Chrome browser and navigates to the reservation page URL
- [x] **DET-02**: Script waits for the Cloudflare challenge page (if present) to resolve before proceeding
- [x] **DET-03**: Script waits for the appointment calendar to fully render before reading its content
- [ ] **DET-04**: Script detects available (clickable, non-disabled) date slot buttons in the calendar
- [ ] **DET-05**: Script filters out past dates and never alerts on already-elapsed calendar dates
- [ ] **DET-06**: Debug/verbose mode dumps raw button attributes to stdout for selector inspection

### Notification

- [ ] **NOT-01**: Script prints a timestamped result (slot found / not found) to console on every run
- [ ] **NOT-02**: Script sends an OS desktop popup notification when an available slot is detected

### Reliability

- [ ] **REL-01**: A single failed check does not stop future scheduled runs — errors are caught, logged, and execution continues
- [ ] **REL-02**: Script persists state to a file after each run so the same open slot does not trigger repeated alerts every hour
- [x] **REL-03**: Script times out gracefully if the page takes too long to load, logs the error, and exits cleanly
- [ ] **REL-04**: Script appends a timestamped result line to a structured log file on every run
- [ ] **REL-05**: Script treats an empty calendar parse result as an error state, not a clean "no slots" result

### Config & Scheduling

- [x] **CFG-01**: Target URL and CSS selectors are stored in a `.env` file and not hardcoded in the script
- [ ] **CFG-02**: Script runs automatically every hour via system cron
- [x] **CFG-03**: Script prints a startup confirmation message showing the URL it is watching

## v2 Requirements

### Notification Channels

- **NOTF-01**: Telegram bot push notification when a slot is detected (10-line addition, best phone reach)
- **NOTF-02**: Notification throttle/cooldown — suppress re-alerting the same open slot across multiple consecutive detections
- **NOTF-03**: Sentinel file written to disk on slot detection as a fallback if desktop notification fails

### Resilience

- **RESL-01**: Exponential backoff on consecutive failures
- **RESL-02**: Hash of key page structural elements logged to detect silent template changes
- **RESL-03**: Multi-location support (monitor more than one reservation URL)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-booking / form submission | Crosses ethical/legal line with a government site; explicitly excluded |
| CAPTCHA solving | If the site serves a real CAPTCHA challenge (not Cloudflare wait), out of scope — manual intervention required |
| Proxy rotation | Hourly frequency on a public gov page does not warrant this |
| Login / authentication | Page is publicly accessible — no credentials needed |
| Web dashboard or UI | Single-developer local script — terminal is sufficient |
| Multi-user / SaaS distribution | Personal tool only |
| LINE Notify | Deprecated March 2025 — LINE Messaging API is higher complexity; defer to v2+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DET-01 | Phase 1 | Complete |
| DET-02 | Phase 1 | Complete |
| DET-03 | Phase 1 | Complete |
| DET-04 | Phase 2 | Pending |
| DET-05 | Phase 2 | Pending |
| DET-06 | Phase 2 | Pending |
| NOT-01 | Phase 2 | Pending |
| NOT-02 | Phase 3 | Pending |
| REL-01 | Phase 2 | Pending |
| REL-02 | Phase 2 | Pending |
| REL-03 | Phase 1 | Complete |
| REL-04 | Phase 3 | Pending |
| REL-05 | Phase 2 | Pending |
| CFG-01 | Phase 1 | Complete |
| CFG-02 | Phase 3 | Pending |
| CFG-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-04-24 after roadmap creation — traceability confirmed*
