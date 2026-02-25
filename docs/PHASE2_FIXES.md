# Phase 2 Fixes — PTC Arena Sheets DataCenter

**Applied:** 2026-02-25
**Fixes:** 7 (A1, A2, A3, B1, B2, C1, C2)
**Phase 1 reference:** [PHASE1_FIXES.md](PHASE1_FIXES.md)

---

## Track A — RackConfigManager.gs (Performance)

### A1 — Batch reads in `getRackConfigMetadata()` ✅ BIGGEST WIN
**Finding:** PERF-04
**Root cause:** The function made 4 individual `.getValue()` calls per rack sheet. Since `getAllRackConfigTabs()` is called ~15 times across 5 files, and a typical install has 5 rack sheets, this produced up to 300 Sheets API calls per workflow. There were also 3 verbose `Logger.log` lines firing on every sheet on every call, adding noise to execution logs.

**Fix:** Replaced the 4 getValue() calls with a single `getRange(METADATA_ROW, META_LABEL_COL, 1, 4).getValues()[0]` batch read. Removed the verbose per-sheet debug logs.

**Impact:** 4× fewer Sheets API calls per rack sheet per `getAllRackConfigTabs()` invocation. Quieter execution logs.

---

### A2 — Cache pre-warm in `populateRackBOMFromArena()` ✅
**Finding:** PERF-05
**Root cause:** Same N+1 pattern addressed in Phase 1 B1 for BOMRefresh.gs — the function tried `arenaClient.makeRequest('/items/' + itemGuid)` (one uncached API call per BOM line) before falling back to the cached `getItemByNumber()`. For a rack with 20 BOM lines, this was 20 individual Arena API calls.

**Fix:** Added a cache pre-warm block before the `forEach` loop using `CacheService.getScriptCache()` / `arenaClient.refreshItemCache()`. Inside the loop, reversed lookup order to cache-first: `getItemByNumber()` is called first; the GUID-based `makeRequest` is only used as a fallback if the cache misses.

**Impact:** Reduces per-BOM-line API calls from 1 to ~0 (cache hits) with a single batch fetch at the start.

---

### A3 — Singleton client in `validateRackConfigurations()` ✅
**Finding:** PERF-07
**Root cause:** `new ArenaAPIClient()` was called **inside the `forEach` loop** — one new client (and one session check) per rack configuration. With 5 racks that's 5 unnecessary session checks.

**Fix:** Moved client creation before the loop using the `getArenaClient()` singleton introduced in Phase 1 A1.

**Impact:** N unnecessary session checks reduced to 1 per `validateRackConfigurations()` call.

---

## Track B — Authorization.gs (Security + Validation)

### B1 — Validate `workspaceId` is numeric on save ✅
**Finding:** SEC-01
**Root cause:** `saveArenaCredentials()` had no format validation on `workspaceId`. Users frequently paste the workspace *name* (e.g. "MyCompany") instead of the numeric ID (e.g. "123456789"), which causes a cryptic login error with no clear remediation path.

**Fix:** Added a regex check `!/^\d+$/.test(wsId)` after the existing field-presence validations in `saveArenaCredentials()`. If the workspace ID contains any non-digit characters, an error is thrown at save time with a clear message directing the user to Arena Settings → Workspace.

**Impact:** Clear user-facing error at credential save time instead of an obscure failure at login time.

---

### B2 — Validate returned `workspaceId` matches on login ✅
**Finding:** API-01
**Root cause:** The Arena login response always returns the `workspaceId` for the authenticated workspace. If a user configured a numerically-valid but incorrect workspace ID, login succeeded but subsequent API calls returned wrong or empty data with no explanation.

**Fix:** After extracting `sessionId` from the login response and before calling `saveSession()`, the returned `data.workspaceId` is compared to the stored `credentials.workspaceId`. A mismatch throws an error with both the configured and actual values.

**Impact:** Workspace mismatches are caught at login time with a clear error, rather than silently producing incorrect data.

---

## Track C — Code.gs (Error Visibility)

### C1 — Surface `onSelectionChange()` errors via toast ✅
**Finding:** QA-02
**Root cause:** Errors in `onSelectionChange()` (e.g., the History sidebar failing to open) were silently logged. Users had no indication that anything went wrong.

**Fix:** Added a non-blocking `SpreadsheetApp.toast()` call inside the catch block with a 4-second timeout. The toast failure itself is silently caught so a broken toast can't cause further issues.

**Impact:** Users see a brief "History sidebar could not open" notification instead of silent failure.

---

### C2 — Add context to `onEdit()` error log ✅
**Finding:** QA-02
**Root cause:** The `onEdit()` catch block logged only `error.message`. When debugging, there was no way to identify which sheet or row triggered the failure.

**Fix:** The log line now includes the sheet name and row number from `e.range`:
```
Error in onEdit trigger [sheet: RackConfig-1, row: 12]: <error message>
```
The trigger remains silently failing (by design — user edits shouldn't be interrupted), only the log is enriched.

**Impact:** Faster debugging of onEdit failures in execution logs.

---

## Files Changed

| File | Fixes |
|------|-------|
| `RackConfigManager.gs` | A1, A2, A3 |
| `Authorization.gs` | B1, B2 |
| `Code.gs` | C1, C2 |

---

## Verification

1. **A1:** Open spreadsheet with 3+ rack tabs — execution logs should no longer show per-sheet "Checking sheet X" debug lines.
2. **A2:** Create a rack config linked to an Arena item with 20+ BOM lines — logs show "Cache pre-warming" once, NOT per-item GUID fetches.
3. **A3:** Run `validateRackConfigurations()` — only one session check in logs, not one per rack.
4. **B1:** Try saving credentials with workspace name "MyWorkspace" — immediate error with guidance at save time.
5. **B2:** Enter a valid-format but wrong numeric workspace ID — "Workspace ID mismatch" error at login, not a silent bad-data failure later.
6. **C1:** Navigate to Rack History tab while logged out — 4-second toast appears with error message.
7. **C2:** Trigger an `onEdit()` failure — execution log includes sheet name and row number.

---

## Cumulative Phase Status

| Phase | Date | Fixes | Status |
|-------|------|-------|--------|
| Phase 1 | 2026-02-25 | 10 (A1–A5, B1–B3, C1–C3) | ✅ Complete |
| Phase 2 | 2026-02-25 | 7 (A1–A3, B1–B2, C1–C2) | ✅ Complete |
| Phase 3 | TBD | Remaining findings | Pending |
