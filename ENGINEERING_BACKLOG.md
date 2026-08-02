# Master Engineering Backlog — `dev-hr-management`

**Status:** LIVING DOCUMENT — this file is the permanent source of truth for backend engineering work from this point forward.
**Baseline inputs:** Principal Engineer Audit Report (2026-08-01) + Execution Roadmap (2026-08-01).
**Scope:** `server/` (Express/MongoDB backend). Frontend apps (`auth/`, `dashboard/`, `support/`) are referenced only where a backend change has a required frontend companion — they are not independently audited here.
**Last updated:** 2026-08-02 · **Updated by:** Principal Engineer review — E8-F2-T2 split: compression middleware implemented (no stop condition applies), cursor pagination stopped on (public API change, pending design sign-off). E8-F1-T1 also presented and stopped on (public API versioning). Autonomous backlog execution has now reached the end of the executable P3 tier — remaining work is all pending your input. **E2-F3-T1 closed by owner decision (2026-08-02):** production verification confirmed zero `OrderAsset` documents and no write path creates them; no migration is required; encryption will be implemented together with any future `OrderAsset` creation feature, not speculatively ahead of it. **E5-F1-T2 Phase 1a shipped (2026-08-02):** Outbox worker infrastructure (claim/dispatch/mark-processed/mark-failed loop, in-process poller registered in `scheduler.service.ts`, graceful-shutdown wiring) implemented with placeholder handlers only. **Phase 1b shipped (2026-08-02) for the 2 of 3 events whose business intent was fully provable from the codebase:** `admin.quotation.regenerate_link` now has a real handler reusing `QuotationService.sendQuotation()` unchanged; `admin.outbox.replay` was removed entirely (producer and consumer) in favor of a direct, synchronous `OutboxService.replayMany()` call, since it only ever wrapped a cheap idempotent DB update with no live frontend caller. `quotation.superseded` remains on its placeholder — its intent could not be proven without guessing (would need a new notification-type schema value plus a product decision on who gets notified), so it was deliberately left unimplemented rather than invented.

---

## 0. How This Document Works (read this before touching anything)

1. **Every piece of backend work maps to a Task ID here before it's implemented.** If work doesn't have an ID, it doesn't get merged — create the backlog entry first, even if it's two lines.
2. **Hierarchy:** `Epic → Feature → Task → Subtask`. IDs are stable once assigned (`E2-F1-T3`) — never renumber, only append or mark `SUPERSEDED`.
3. **Status values:** `Not Started` · `In Progress` · `Blocked` · `In Review` · `Done` · `Deferred` · `Closed` · `Superseded`. `Closed` = a gating question resolved the task out of scope entirely (e.g. the risk it addresses doesn't currently exist) — distinct from `Deferred` (still relevant, revisit later) and `Superseded` (replaced by different work). Update status in the Dashboard table (§1) *and* the Task Detail Card (§3–10) — they must never disagree; the Dashboard is the source of truth for "what's the state right now," the Detail Card is the source of truth for "why."
4. **Definition of Ready** (a Task may move to `In Progress`): exact files identified, dependencies satisfied or explicitly waived, testing strategy defined, rollback plan defined.
5. **Definition of Done** (a Task may move to `Done`): acceptance criteria all checked, tests passing in CI, rollback plan validated as *theoretically* sound (not necessarily executed), Dashboard + Detail Card updated, and — if the task changed architecture, data model, or a cross-cutting convention — §11 (Architecture Decisions Log) is updated.
6. **New issues discovered mid-implementation** (regressions, newly noticed debt, scope surprises) get filed as new Tasks under the most relevant existing Feature, or a new Feature under the most relevant Epic if none fits. They do not get silently folded into an in-flight Task's scope — scope creep inside a Task is exactly the kind of untracked risk this process exists to prevent.
7. **No Epic/Feature/Task is ever deleted.** If something becomes irrelevant, mark it `Deferred` or `Superseded` with a one-line reason, so the historical record of *why* a decision was made survives.
8. **This document does not replace tests, CI, or code review — it is the layer above them**: the thing that answers "what is the state of the whole system's engineering health," which no single PR or test suite can answer by itself.

---

## 1. Status Dashboard

| ID | Title | Epic | Priority | Status | Effort | Regression Risk |
|---|---|---|---|---|---|---|
| E1-F1-T1 | Enforce order status state machine | Data Integrity | P0 | Done* | 3–5 hrs | Low |
| E1-F1-T2 | Reconcile order-list-page status dropdown with backend transition table | Data Integrity | P0 | Done* | 2–3 hrs | Low |
| E2-F1-T1 | Escape regex in Quotation/Receipt search | Security | P0 | Done | 1 hr | Very Low |
| E2-F2-T1 | Validate security-critical env vars at boot | Security | P0 | Done | 1–2 hrs | Very Low |
| E3-F1-T1 | Add `/healthz` + graceful shutdown | Ops Readiness | P0 | Done* | 2–3 hrs | Very Low |
| E2-F3-T1 | Real encryption for order assets | Security | P1 | Closed | 1.5–2.5 days | Medium |
| E4-F1-T1 | Wire up Outbox admin API | Observability | P1 | Done* | 4–6 hrs | Very Low |
| E3-F2-T1 | Minimal CI (typecheck + build gate) | Ops Readiness | P1 | Done | 3–4 hrs | Very Low |
| E6-F2-T3 | Fix pre-existing unused-import typecheck errors | Code Health | P1 | Done | ~15 min | Very Low |
| E1-F2-T1 | Extract shared payroll day-counting logic | Data Integrity | P1 | Done* | 1–1.5 days | Medium |
| E1-F3-T1 | Fix Receipt zero-payment race condition | Data Integrity | P1 | Done* | 3–4 hrs | Low |
| E5-F1-T2 | Implement Outbox event consumer (queue is currently write-only) | Reliability | P1 | In Progress (2 of 3 event handlers shipped; `quotation.superseded` blocked on product decision) | 1–2 days (Phase 1) | Low |
| E7-F1-T1 | Test framework + state-machine test suite | Quality Engineering | P2 | Deferred | 4–6 days | Low |
| E3-F3-T1 | Dockerize local dev | Ops Readiness | P2 | Done* | 1–1.5 days | Low |
| E5-F1-T1 | Move notifications onto BullMQ | Reliability | P2 | Not Started | 2–3 days | Medium |
| E1-F2-T2 | Payroll mismatch → explicit confirmation | Data Integrity | P2 | Not Started | 1 day | Low |
| E6-F1-T1 | Delete or wire orphaned controllers | Code Health | P2 | Done* | 3–5 hrs | Low |
| E6-F1-T2 | Delete dead `queue.service.ts` stub | Code Health | P3 | Done | ~10 min | Very Low |
| E4-F2-T1 | Consolidate audit-trail mechanisms | Observability | P2 | Not Started | 2–3 days | Medium |
| E6-F2-T1 | Structured logging cleanup (console.* → pino) | Code Health | P3 | Blocked | 2–3 days | Very Low |
| E3-F4-T1 | Redis-backed rate limiter | Ops Readiness | P3 | Deferred | 1 day | Low |
| E8-F2-T1 | Redis cache for reference-data reads | API Platform | P3 | Not Started | 2–3 days | Medium |
| E4-F3-T1 | TTL/retention policy for append-only collections | Observability | P3 | Not Started | 1 day | Low |
| E6-F2-T2 | Named constants for magic numbers | Code Health | P3 | Done | 3–4 hrs | Very Low |
| E8-F1-T1 | API versioning + OpenAPI spec | API Platform | P3 | Not Started | 3–5 days | Low |
| E8-F2-T2 | Compression middleware + cursor pagination | API Platform | P3 | Blocked (compression done, pagination needs API design sign-off) | 1–2 days | Low |

**Completion:** 15 / 26 Tasks done (6 fully `Done`, 9 marked `Done*` — see notes on each). 1 `Closed` (E2-F3-T1), 2 `Deferred` (E7-F1-T1, E3-F4-T1), 2 `Blocked` (E6-F2-T1 — scale/practicality; E8-F2-T2 — half done, half pending API design). **Pending your decision (not blocked on this sandbox, blocked on you):** E5-F1-T2 (product decision), E5-F1-T1 (architecture), E1-F2-T2 (public API contract + frontend coordination), E4-F2-T1 (architecture), E8-F2-T1 (architecture — cache invalidation strategy), E4-F3-T1 (business — retention window approval), E8-F1-T1 (public API versioning), E8-F2-T2's cursor-pagination half (public API design). **Every remaining `Not Started` task in the backlog now requires your input — the autonomous pass is complete for this session.** **P0 remaining:** 0/5 — all P0 tasks addressed. **P1 status:** E3-F2-T1 and E6-F2-T3 both fully `Done`. E1-F3-T1, E4-F1-T1, E1-F2-T1 all `Done*` (open follow-ups documented on each). **E2-F3-T1** is now `Closed` — production verification confirmed zero `OrderAsset` documents and no write path creates them; nothing to migrate; encryption will be built alongside any future asset-creation feature. **E5-F1-T2** is now `In Progress` — worker infrastructure (Phase 1a) shipped, plus 2 of 3 business handlers (Phase 1b): `admin.quotation.regenerate_link` (real handler, reuses `sendQuotation()`) and `admin.outbox.replay` (removed, replaced with a direct synchronous call). `quotation.superseded` remains blocked on the same product decision as before (see its Subtask a). **P2 status:** E6-F1-T1 now `Done*` — `quotation-timeline.controller.ts` wired, `wallet-transaction.controller.ts` confirmed already live. **E7-F1-T1 `Deferred`** — needs a test-framework architecture decision before implementation. **E3-F3-T1 now `Done*`** — Docker local-dev stack authored (Dockerfile, docker-compose.yml, README); the transactional-flow verification and the `docker-compose up` run itself are open follow-ups (no Docker daemon in this environment).

*`Done*` on E1-F1-T1 = the guard clause, model, and unit test matrix are complete and verified; the HTTP-level integration test (Subtask d) is `Blocked`, not skipped — it has a hard dependency on DB test infrastructure that doesn't exist yet (E7-F1-T1). See the Task Detail Card in §3 for the full breakdown; this is not being counted as fully `Done` until that subtask either completes or is formally waived.

---

## 2. Epic Map

```
E1  Data Integrity & Workflow Correctness
    F1  Order Lifecycle State Machine
    F2  Payroll Calculation Consistency
    F3  Financial Ledger Integrity

E2  Security Hardening
    F1  Input Validation
    F2  Secrets & Config Validation
    F3  Data-at-Rest Protection

E3  Operational Readiness (DevOps/SRE)
    F1  Health & Lifecycle Management
    F2  CI/CD Pipeline
    F3  Containerization
    F4  Rate Limiting at Scale

E4  Observability & Auditability
    F1  Outbox Operability
    F2  Unified Audit Trail
    F3  Data Retention

E5  Reliability & Async Processing
    F1  Durable Background Jobs

E6  Code Health & Technical Debt
    F1  Dead Code Elimination
    F2  Code Quality Standards

E7  Quality Engineering
    F1  Automated Test Coverage

E8  API Platform Maturity
    F1  API Versioning & Documentation
    F2  Performance Optimization
```

---

## 3. E1 — Data Integrity & Workflow Correctness

**Epic intent:** The core Quotation→Order→Receipt→Payroll pipeline is where a bug directly costs money or breaks a client-facing promise. This Epic contains everything that could silently produce a wrong financial or workflow outcome.

### E1-F1 — Order Lifecycle State Machine

#### E1-F1-T1: Enforce `ALLOWED_STATUS_TRANSITIONS` in `OrderService.transitionStatus`
- **Priority:** P0 · **Status:** Done* (see Subtask d note — one subtask blocked on out-of-scope infra, not silently dropped)
- **Business value:** Prevents any staff role from moving an order through an undesigned status path (e.g. `CANCELLED → DELIVERED`), which today can trigger premature asset-unlock (client credentials/deliverables exposed) on a path nobody validated.
- **Engineering effort:** 3–5 hrs (actual: ~4 hrs)
- **Regression risk:** Low — the change only *restricts* previously-permitted writes; cannot corrupt data, worst case is an over-eager rejection of a transition someone actually needed. **One confirmed behavior change:** same-status transitions (e.g. re-submitting `PENDING → PENDING`) now throw `409` instead of silently succeeding, because `ALLOWED_STATUS_TRANSITIONS` has no self-transition entries — this matches the existing `Quotation` model's transition-table convention, so it's consistent with the codebase, not a new pattern, but is a real behavior change for any caller that resubmits the current status (e.g. a double-click).
- **Dependencies:** None. Subtask (a) completed first, before writing the fix.
- **Exact files:**
  - `server/src/services/order.service.ts` — added `export function assertValidOrderTransition(from, to)` (guard clause, mirrors `assertTransition` in `quotation.service.ts`), called from `transitionStatus()` immediately after the order is fetched and before any write.
  - `server/src/models/order.model.ts` — comment at `ALLOWED_STATUS_TRANSITIONS` (~L27) corrected to reference the actual enforcing function instead of a generic "enforced elsewhere" note.
  - `server/src/controllers/order.controller.ts` — audited only, not modified (already forwards errors via `next(err)`, which correctly surfaces the new `AppError(409)`).
  - New: `server/src/services/__tests__/order-status-transitions.test.ts` — 41 tests (36-case matrix + 5 sanity checks).
- **Testing strategy:** Unit-tested all 36 status-pair combinations directly against the exported `assertValidOrderTransition` guard (Node's built-in `node:test` + `tsx`, zero new dependencies) — this is a deliberate scope decision, see Subtask (d) note. `npx tsc --noEmit` run clean against the whole `server/` package post-change (4 pre-existing, unrelated errors in `migrate-relational-data.ts` confirmed present before this change and untouched by it).
- **Rollout plan:** Single PR, no feature flag needed, no data migration — deploy directly, tests pass.
- **Rollback plan:** `git revert` on the two modified files — safe by construction, since the change can only reject writes that previously succeeded, never allow new ones.
- **Acceptance criteria:**
  - [x] All 36 transition-pair cases verified (unit-tested directly against the guard function; see Subtask d for why this is unit- rather than HTTP-level).
  - [x] Invalid transitions throw `AppError` with `statusCode 409` **before any DB write occurs** (guard runs before `findOneAndUpdate`, stronger than the original "leave the DB unchanged" wording, which implied a post-write check).
  - [ ] ~~Existing lifecycle QA script passes unchanged~~ — no formal QA script exists in-repo; substituted with the happy-path transitions being explicitly asserted as `allowed` in the unit matrix (`PENDING→IN_PROGRESS`, `IN_PROGRESS→COMPLETED`, `COMPLETED→DELIVERED`, `DELIVERED→REVISION`, `REVISION→IN_PROGRESS`, both `→CANCELLED` paths) — all pass. Documented here as a substitution, not silently marked done.
  - [x] Model comment matches implementation.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Grep every caller of `transitionStatus` (controllers, scripts, schedulers) and confirm none depends on an out-of-table transition | **Done** — single caller (`order.controller.ts:76`), whose own doc comment already assumed state-machine enforcement |
| b | Import `ALLOWED_STATUS_TRANSITIONS`, add the guard clause, throw `AppError(409)` on violation | **Done** |
| c | Write the 36-case unit test matrix | **Done** — 41/41 passing (`node --import tsx --test`) |
| d | Write integration test for `PATCH /orders/:id/status` (1 valid, 1 invalid case) | **Blocked** — requires a live/in-memory MongoDB, which this repo has no test infrastructure for yet (that setup is E7-F1-T1's explicit scope). Implementing it here would mean either (a) standing up `mongodb-memory-server`/a test framework — out of this task's scope per the instruction to implement E1-F1-T1 only — or (b) running against the real configured `MONGO_URI`, which risks mutating non-test data and was rejected as unsafe. Deferred to E7-F1-T1, where the guard-function unit coverage from this task should be extended with a true HTTP-level test once DB test infra exists. |
| e | Run full manual order-lifecycle QA script, record result | **Substituted** — no formal script exists in-repo; happy-path transitions are asserted directly in the unit matrix instead (see Acceptance Criteria note) |
| f | Update the stale comment in `order.model.ts` | **Done** |

---

#### E1-F1-T2: Reconcile order-list-page status dropdown with `ALLOWED_STATUS_TRANSITIONS`
- **Priority:** P0 · **Status:** Done* (see acceptance-criteria notes — one criterion partially verified, not silently claimed complete)
- **Discovered:** 2026-08-01, during a caller audit requested for E1-F1-T1 (searching frontend + backend for callers depending on idempotent same-status updates). No self-transition callers were found — see that audit's conclusion — but this unrelated, more serious issue surfaced in the process and is filed here per backlog governance rule 6 (new issues found mid-work get filed as their own Task, not folded into the triggering task's scope).
- **Business value:** Since E1-F1-T1 shipped, the order **list** page's status dropdown ([orders/page.tsx:123-129](dashboard/src/app/(root)/orders/page.tsx)) offered every status except the current one as a clickable option — including transitions `ALLOWED_STATUS_TRANSITIONS` forbids (e.g. `CANCELLED → DELIVERED`, `PENDING → COMPLETED`). The code comment there read, verbatim, `"No workflow restriction — staff can set any status directly."` — a direct contradiction of what the backend now enforces. Before E1-F1-T1, those clicks silently succeeded; after it, they 409'd with a `"Failed to update status"` toast for what the UI presented as a normal, always-available action.
- **Engineering effort:** 2–3 hrs (actual: ~2.5 hrs) · **Regression risk:** Low — confirmed via `git diff`: no request payload shape or API contract touched, only which options the dropdown offers.
- **Pre-implementation audit (Steps 1-2, as required):** confirmed via `useUpdateOrderStatusMutation` call-site grep that exactly 2 components change order status (`orders/[id]/page.tsx`, `orders/page.tsx`); 3 more display status read-only (`orders/invoice/page.tsx`, `OrderHistoryTable.tsx`, and a status *filter* — not a transition control — on `clients/[id]/page.tsx`) and needed no changes. Compared both transition-changing components against the backend: the detail page's `statusWorkflow` table already matched `ALLOWED_STATUS_TRANSITIONS` in `order.model.ts` value-for-value; only the list page's table disagreed.
- **Dependencies:** None.
- **Exact files:**
  - New: `dashboard/src/constants/orderStatusWorkflow.ts` — single shared `ORDER_STATUS_WORKFLOW` table (relocated verbatim from the already-correct detail page, zero value changes) + `getFilteredStatusOptions(order)`.
  - `dashboard/src/app/(root)/orders/[id]/page.tsx` — removed its local `statusWorkflow`/`getFilteredStatusOptions` (14 lines), now imports from the shared module; also dropped the now-unused `IOrder` import.
  - `dashboard/src/app/(root)/orders/page.tsx` — removed its local `ALL_ORDER_STATUSES`/`getFilteredStatusOptions` and the "No workflow restriction" comment (7 lines), now imports from the shared module.
  - New: `dashboard/src/constants/__tests__/orderStatusWorkflow.test.mjs` — 7 tests.
- **Revision (2026-08-02, requested by reviewer before merge):** the initial implementation added `"allowImportingTsExtensions": true` to `dashboard/tsconfig.json` so the test file's explicit `.ts` import specifier (needed for Node's extensionless-resolution-free ESM loader to find `orderStatusWorkflow.ts`) would also type-check under `tsc`. Reviewer asked for the test implementation to be adjusted instead of touching project-wide compiler configuration. Resolved by writing the test as a plain `.mjs` file instead of `.ts`: `tsconfig.json`'s `include` list only covers `.ts`/`.tsx`/`.mts` sources, so a `.mjs` file falls outside the TypeScript project entirely and `tsc` never parses it or its import specifiers — while Node's runtime resolution doesn't care what parsed the importer, so the test still exercises the real `orderStatusWorkflow.ts` module directly. `tsconfig.json` is confirmed byte-identical to its pre-task state (`git diff` empty). One incidental bug caught and fixed during this revision: the file's own doc comment contained the literal sequences `**/*.ts` and `**/*.tsx`, each of which embeds `*/` and prematurely terminated the `/** ... */` block comment — a real syntax error, unrelated to the module-format question, fixed by rewording the comment.
- **Testing strategy:** `getFilteredStatusOptions`/`ORDER_STATUS_WORKFLOW` unit-tested via `node --test` directly against a plain `.mjs` test file that imports the real `.ts` module (zero new test-framework dependency, no project-wide compiler config change — see the Revision note above) — covering the table matching the backend value-for-value, `cancelled` being terminal, and every status's filtered-options result including the exact `cancelled → []` case that was the original bug. Additionally — beyond what was asked, but a meaningful practical check — started the actual Next.js dev server and loaded `/orders`, confirming the real Next.js bundler (a different resolution path than `tsc`/`node --test`) resolves the new `@/constants/orderStatusWorkflow` import cleanly at compile time (`GET /orders 200`, no console errors, no build error).
- **Rollout plan:** Frontend-only change, direct deploy, no backend/API coordination needed (the backend side of this contract already shipped with E1-F1-T1).
- **Rollback plan:** Revert the two page files (drops back to their pre-E1-F1-T2 state) — no backend or data impact either direction. The new shared module and test file are inert if the pages don't import them. `tsconfig.json` is untouched, so there is nothing to roll back there.
- **Acceptance criteria:**
  - [x] List page and detail page present identical, workflow-correct status options for the same order — both now call the same function against the same table; verified by the 7 passing tests plus code inspection of both call sites.
  - [x] No remaining "no workflow restriction" comment/logic anywhere in the frontend — confirmed via grep across `dashboard/src`, zero matches.
  - [ ] ~~Manual click-through of all 6 statuses on the list page produces no unexpected 409s~~ — **partially verified, not fully**: confirmed the page compiles and serves successfully (200) with the new import via a live Next.js dev server, and confirmed the underlying filtering logic exactly matches the backend table via unit tests. Could not complete an actual authenticated click-through against live order data — this sandbox has no reachable auth/backend (same MongoDB network-isolation limitation noted on every task this session). A real manual click-through against a running deployment is recommended before treating this as fully closed, and is flagged as an open follow-up.

---

### E1-F2 — Payroll Calculation Consistency

#### E1-F2-T1: Extract shared `computeWorkDayStats()` helper
- **Priority:** P1 · **Status:** Done* (see acceptance-criteria note — the live-DB before/after snapshot test is an open follow-up, not silently skipped)
- **Business value:** Eliminates the risk that `getPayrollPreview` (what an admin *approves*) and `processPayroll` (what actually gets *paid*) silently diverge after a future rule change is applied to only one of the three current copies.
- **Engineering effort:** 1–1.5 days (actual: ~3 hrs) · **Regression risk:** Medium as scoped — confirmed via `git diff`: the three call sites' surrounding logic (query construction, 22-day fallback, `absentDays` composition, salary math) is untouched; only the day-counting loop itself was replaced.
- **Dependencies:** None. **Blocks:** E1-F2-T2 (payroll confirmation flow) — that task should build against the post-extraction canonical function.
- **Pre-implementation equivalence check performed (required by this task's own instructions — stop-and-report if the three implementations aren't behaviorally identical):** traced all three call sites' full day-loop logic line by line. Found the loop **order** differs — `getPayrollPreview`/`processPayroll` check "unemployed" first and `continue` early per day (single pass); `getAbsentDates` resolves off-date/shift/work-day first into a candidate list, then applies the unemployed check in a *second* pass over just those candidates. Proved this is not a behavioral difference: both structures evaluate the identical set of boolean conditions (unemployed, off-date, shift-resolves, is-work-day, before-today, has-attendance-record) combined with AND, which is commutative — so both necessarily produce the same final missing-punch set, in the same order (both iterate `daysInMonth` ascending). This proof is not just asserted in a comment — it's encoded as an executable test (see Testing strategy) that independently re-implements the old two-pass algorithm and asserts it matches the new single-pass function's output across multiple fixtures. All other differences between the three (a redundant `new Date()` wrap in one, precomputed-vs-inline `getBDDateString(joinDate)`) were confirmed to be purely stylistic with no behavioral effect. **Conclusion: the three were behaviorally identical** — proceeded with implementation rather than stopping.
- **One incidental discovery, handled as a necessary consequence of the extraction, not scope creep:** `processPayroll`'s `workDaysCount` local was already dead output in the pre-extraction code — computed and reassigned by the 22-day fallback but never read afterward (confirmed via `git show HEAD`; the increment operator `workDaysCount++` satisfied TypeScript's "used" check without the value ever being consumed). The new call-based structure can't reproduce that disguise, and `noUnusedLocals` correctly flagged it. Dropped the unread value entirely from that one call site — zero behavioral effect, since it was never read in the original code either. `getPayrollPreview`'s and `getAbsentDates`'s equivalent locals (`expectedWorkDates` in both, `workDaysCount` in `getPayrollPreview`) were already confirmed likewise unused *after* their loops in the original code, but that call site does need `workDaysCount` for its own 22-day-fallback computation, so it's kept there (see Exact files).
- **Exact files:**
  - New: `server/src/services/payroll-calculation.util.ts` — `computeWorkDayStats()`, a pure function (no DB/Mongoose import) taking already-fetched data and returning `{ workDaysCount, unemployedDays, expectedWorkDates, missingPunchDates }`. Imports `getBDDateString`/`getBDWeekDay` from the existing `utils/date.util.ts` rather than duplicating them (an earlier draft copied them locally to keep "zero imports" — reverted, since duplicating a date-util would have been new duplication, contrary to this task's purpose).
  - `server/src/services/payroll.service.ts` — `getPayrollPreview` (~L179-216), `processPayroll` (~L427-449), `getAbsentDates` (~L827-863) each now call `computeWorkDayStats()`; each site's own caller-specific logic (22-day fallback in the first two, its deliberate absence in `getAbsentDates`, `absentDays` composition, the `{date, status}` shape `getAbsentDates` returns) stays local to that call site, unchanged in behavior. One necessary reordering: `getAbsentDates` now fetches `allAttendance` *before* calling the shared function (previously fetched partway through, after the old first pass) since the function needs attendance records as an input — the query itself is byte-identical, only its position moved; it doesn't depend on anything the old loop computed.
  - New: `server/src/services/__tests__/payroll-calculation.util.test.ts` — 17 tests.
- **Testing strategy:** The backlog's specified live-DB snapshot test (`getPayrollPreview`/`processPayroll`/`getAbsentDates` output on real staff/month data, before vs. after) requires a live MongoDB this sandbox cannot reach — same limitation as every DB-touching task this session, and E7-F1-T1's explicit scope. Substituted with two complementary things: (1) a full unit-test matrix directly against the pure `computeWorkDayStats()` — normal month, mid-month join, mid-month exit, join+exit combined, no shift assignment, shift excluding a specific weekday, multiple shift assignments mid-month, shift off-dates, the today/future boundary, string-vs-Date attendance input — all listed edge cases from the original task plus more; (2) an explicit **equivalence-proof test**: an independent re-implementation of `getAbsentDates`'s original two-pass algorithm (written directly in the test file, not imported from anywhere) is asserted to produce identical `missingPunchDates` to the new single-pass function across multiple combined fixtures (unemployment + off-dates + partial attendance together, plus a small sweep of further scenarios). This is the executable form of the equivalence argument above, not just a claim. What remains unverified: real production data run through the actual before/after functions end-to-end — flagged as an open follow-up.
- **Rollout plan:** Single PR; behavior-preserving refactor, no flag needed — unchanged from the original plan.
- **Rollback plan:** Revert commit — safe; each call site's surrounding logic (fetch queries, fallback, composition) was left untouched, so a revert cleanly restores the prior inline implementations with no data impact either direction.
- **Acceptance criteria:**
  - [x] All three call sites use the one function — verified via `git diff`.
  - [ ] ~~Snapshot tests prove zero behavioral drift~~ — **substituted, not fully met as originally worded**: the live-DB snapshot comparison this criterion describes needs infrastructure this sandbox doesn't have. In its place: 17 unit tests including an explicit two-pass-vs-single-pass equivalence proof against the exact historical algorithm difference found during pre-implementation analysis. A live-data run is recommended before treating this as fully closed in production and is flagged as an open follow-up.
  - [x] New unit tests cover all listed edge cases — mid-month join/exit, no-shift-assignment, and shift-off-dates are all covered, plus additional cases (multi-assignment mid-month changes, today/future boundary, string-vs-Date input).

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Capture pre-refactor output snapshots for a representative test matrix | **Substituted** — live-DB snapshotting not possible in this sandbox; replaced with the equivalence-proof unit test described above, which targets the exact structural difference a naive snapshot test would have been guarding against |
| b | Extract `computeWorkDayStats()` into `payroll-calculation.util.ts` | **Done** |
| c | Replace all three inline implementations with calls to the shared function | **Done** |
| d | Re-run snapshot comparison, confirm zero diff | **Blocked** — same live-DB limitation as Subtask (a); the equivalence-proof and edge-case unit tests are the substitute evidence |
| e | Add standalone unit tests for the extracted function's edge cases | **Done** — 17 tests |

#### E1-F2-T2: Payroll amount mismatch → explicit confirmation, not silent auto-fold
- **Priority:** P2 · **Status:** Not Started
- **Business value:** Prevents a payroll operator's data-entry typo from being silently booked as an intentional bonus/deduction — forces explicit intent for anything outside a ±2 rounding tolerance.
- **Engineering effort:** 1 day (backend) + **required, tracked-separately frontend companion change**
- **Regression risk:** Low — makes the system strictly more conservative; failure mode is "extra confirm click," not "wrong payment."
- **Dependencies:** E1-F2-T1 must be `Done` first (confirmation logic should compare against the canonical expected-amount function). **Not independently shippable** — see note below.
- **Exact files:** `server/src/services/payroll.service.ts` (`processPayroll` ~L540), `server/src/controllers/payroll.controller.ts`; **companion (out of this repo's backend scope, must be tracked as a linked ticket):** `dashboard/src/redux/features/payroll` + payroll processing UI.
- **Testing strategy:** In-tolerance case unchanged; out-of-tolerance without confirmation flag → mismatch reported, no write; out-of-tolerance with confirmation flag → processes and logs as today.
- **Rollout plan:** **Do not deploy the backend change alone** — coordinate a joint release with the frontend companion change, or operators will hit an unexplained new failure mode with no UI to resolve it.
- **Rollback plan:** Revert to silent-fold behavior — safe but re-opens the original risk; treat as "buy time," not a resolution.
- **Acceptance criteria:** In-tolerance unchanged · out-of-tolerance requires explicit confirmation · audit log unaffected · frontend companion ticket linked and required before production rollout.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Design the confirmation-required response contract (shape, status code) | Not Started |
| b | Implement backend mismatch-detection + confirmation gate | Not Started |
| c | File and link the required frontend companion ticket | Not Started |
| d | Unit tests: in-tolerance, out-of-tolerance unconfirmed, out-of-tolerance confirmed | Not Started |
| e | Joint staging verification with frontend change before production rollout | Not Started |

---

### E1-F3 — Financial Ledger Integrity

#### E1-F3-T1: Fix Receipt zero-payment race condition
- **Priority:** P1 · **Status:** Done* (see acceptance-criteria note — one criterion is an open pre-deploy gate this sandbox cannot clear, not silently skipped)
- **Business value:** Closes the one place in the codebase where the "check-then-create" duplicate-prevention pattern (used correctly everywhere else — Order, Quotation) wasn't applied, protecting the 1:1 quotation-group↔receipt invariant under concurrent requests.
- **Engineering effort:** 3–4 hrs (actual: ~2.5 hrs) · **Regression risk:** Low — confirmed via `git diff`: additive-only changes (a schema constraint tightening + a try/catch around an existing `save()` call); no existing read/write path altered.
- **Dependencies:** None.
- **Pre-implementation verification performed:** read `createZeroPaymentReceipt` end-to-end and confirmed the exact race: `ReceiptModel.findOne({ quotationGroupId })` followed later by `receipt.save()` with no DB-level constraint between the two — a second concurrent call that passes `findOne` before the first call's `save()` commits will itself `save()` successfully today, producing two receipts for one quotation group. Compared against `outbox.service.ts`'s existing `if (err?.code === 11000) return null;` idiom (the codebase's established "duplicate key => already exists, resolve idempotently" pattern) and mirrored its shape rather than inventing a new one.
- **Exact files:**
  - `server/src/models/receipt.model.ts` — `quotationGroupId` field changed from `{ required: true, index: true }` to `{ required: true, unique: true }` (a unique index supersedes a plain index on the same field), with an inline comment pointing to this task and the service-side handling.
  - `server/src/services/receipt.service.ts` — `createZeroPaymentReceipt` (~L87–135): wrapped `receipt.save()` in a `try/catch`; on `err.code === 11000`, re-queries by `quotationGroupId` and returns the winning document instead of throwing, mirroring the existing early-return-on-`findOne` behavior. Non-`11000` errors are rethrown unchanged.
  - New: `server/src/scripts/check-duplicate-receipt-groups.ts` — read-only script (no writes) that aggregates `Receipt` by `quotationGroupId` and reports any group with more than one receipt. Operationalizes Subtask (a): built so whoever has production DB access can run it before this index is deployed; not executed against real production data by me (see acceptance-criteria note — no network path to production from this sandbox, the same constraint noted on every DB-touching task this session).
  - New: `server/src/services/__tests__/receipt-zero-payment-race.test.ts` — 4 tests.
- **Testing strategy:** The backlog's specified test (`Promise.all` of two simultaneous creations against a live, unique-indexed MongoDB) requires real DB infrastructure that doesn't exist in this sandbox (no network path to Mongo, no `mongodb-memory-server` — E7-F1-T1's explicit scope, same limitation as every DB-touching task this session). Substituted with a deterministic unit-level equivalent: `ReceiptModel.findOne`/`ReceiptModel.prototype.save`/`InvoiceCounter.findByIdAndUpdate` are monkey-patched to reproduce the exact sequence a real race produces (existence check sees nothing, save then fails with a real Mongo `E11000`), proving the catch-and-retry logic resolves to the concurrent winner instead of throwing. Also covered: non-`11000` errors still propagate (not silently swallowed), the no-race happy path is unaffected and not spuriously retried, and the pre-existing early-return-on-`findOne` path is untouched. This verifies the *application-level* half of the fix directly; the *DB-level* half (the unique index actually rejecting a concurrent duplicate write) is verified by code inspection of the schema change only, not exercised against a real MongoDB — flagged as an open follow-up, same as the acceptance-criteria note below.
- **Rollout plan:** Unchanged from the original plan — run `check-duplicate-receipt-groups.ts` against production first; only deploy once it reports zero duplicate groups (or after reconciling any it finds). The code change (service catch logic) is safe to deploy on its own at any time; the schema's `unique: true` should not go live until the check is clean, since Mongoose's automatic index build would otherwise fail against a collection with existing duplicates.
- **Rollback plan:** Revert `receipt.model.ts` (drops the unique index back to a plain index) and/or `receipt.service.ts` (drops the catch, reverting to the pre-existing race) — either or both are independently safe, no data loss either direction.
- **Acceptance criteria:**
  - [ ] ~~Production data confirmed duplicate-free (or reconciled) before index creation~~ — **not verifiable from this sandbox**, no network path to the production database (same limitation as every prior production-data check this session, e.g. E2-F2-T1's Subtask c). The read-only `check-duplicate-receipt-groups.ts` script is built and ready; running it against production and reconciling any findings is a required, explicit pre-deploy step for whoever has that access, flagged here as an open item rather than assumed clean.
  - [x] Unique index live in code — `quotationGroupId` is declared `unique: true` in the schema; whether it is actually live in a given deployment's database depends on the production check above completing successfully first (Mongoose builds indexes automatically on connect, and that build would fail — loudly, not silently — against a collection with existing duplicates, which is itself a real safety backstop even before the manual check runs).
  - [x] Concurrent creation attempts idempotently resolve to one receipt — verified via the 4 deterministic unit tests described above; the true live-DB `Promise.all` version of this check is recommended before this is fully trusted in production and is noted as an open follow-up.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Query production for existing duplicate `quotationGroupId` values in `Receipt` | **Blocked** — tooling built (`check-duplicate-receipt-groups.ts`), but this sandbox has no network path to production to actually run it; required pre-deploy step for whoever has DB access |
| b | If duplicates found: manually reconcile (merge/void) before proceeding | **Blocked** — depends on (a)'s result, unknown from this sandbox |
| c | Add unique index on `Receipt.quotationGroupId` | **Done** |
| d | Add `11000`-catch idempotent-return logic to `createZeroPaymentReceipt` | **Done** |
| e | Write and pass the concurrent-call test | **Done** — substituted a deterministic monkey-patched unit-test equivalent for the live-DB version; see Testing strategy note |

---

## 4. E2 — Security Hardening

### E2-F1 — Input Validation

#### E2-F1-T1: Escape regex in Quotation/Receipt search
- **Priority:** P0 · **Status:** Done
- **Business value:** Closes a ReDoS vector reachable by any of 5 staff roles; the fix already exists and is proven in 7 other services — this is finishing an established pattern, not inventing one.
- **Engineering effort:** 1 hr (actual: ~1 hr) · **Regression risk:** Very low.
- **Dependencies:** None.
- **Exact files:**
  - `server/src/services/quotation.service.ts` — `getQuotations()` (~L863-875): added `import { escapeRegex } from '../lib/sanitize.js';`, compute `const escaped = escapeRegex(filters.search);` once, all 3 `$or` clauses (`quotationNumber`, `details.title`, `client.contactName`) now use `escaped` instead of raw `filters.search`.
  - `server/src/services/receipt.service.ts` — `getReceipts()` (~L226-241): identical treatment for its 3 `$or` clauses (`receiptNumber`, `clientName`, `projectTitle`).
  - New: `server/src/services/__tests__/search-regex-escaping.test.ts` — 9 tests.
- **Pre-implementation verification performed** (per explicit request): confirmed via grep that these are the *only* `$regex`/`new RegExp` sites in either file; traced `req.query.search` in both controllers back to raw, unsanitized query-string input with nothing in between; confirmed `escapeRegex()`'s existing call-site idiom (`client.service.ts:17-23` — escape once into a local, reuse across all `$or` clauses) and mirrored it exactly rather than introducing a new pattern.
- **Testing strategy:** Unit-tested `escapeRegex()` directly (Node's built-in `node:test` + `tsx`, same zero-new-dependency approach as E1-F1-T1) across three categories: normal search terms (behavior-preserving), terms containing regex metacharacters (now literal, not pattern — includes a `.` wildcard-neutralization check and a full metacharacter-escaping check), and regex-injection-shaped payloads (`(a+)+$` and two other catastrophic-backtracking patterns, asserting sub-500ms resolution as proof of no ReDoS). A full DB-backed integration test through the actual HTTP endpoints is out of scope for the same reason documented on E1-F1-T1's Subtask (d) — no DB test harness exists yet (E7-F1-T1).
- **Rollout plan:** Direct deploy, no flag, shipped.
- **Rollback plan:** One-line revert per file — verified as a clean, isolated diff (2 files, 2-line import + 4-line change each).
- **Acceptance criteria:**
  - [x] Both endpoints treat search input as literal substring — verified by the metacharacter-escaping tests.
  - [x] No hang/crash on metacharacter input — verified by the ReDoS-timing tests (sub-500ms on payloads that would otherwise exhibit catastrophic backtracking).
  - [x] Existing search UX unchanged — verified by the "normal search" test group (plain alphanumeric terms, case-insensitive substring matching, unaffected).

**Verification performed:**
- `node --import tsx --test src/services/__tests__/*.test.ts` → **50/50 passing** (41 from E1-F1-T1 + 9 new).
- `npx tsc --noEmit` → clean on both modified files (4 pre-existing, unrelated errors in `migrate-relational-data.ts`, confirmed identical to before this change).
- `git diff` reviewed — confirmed minimal, isolated change: only the two intended service files modified, no unrelated code touched.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Import `escapeRegex` into both services | **Done** |
| b | Wrap `filters.search` before `$regex` construction in both | **Done** |
| c | Add metacharacter-input test + regression test for both endpoints | **Done** — 9 tests across normal/metacharacter/injection-payload categories |

### E2-F2 — Secrets & Config Validation

#### E2-F2-T1: Validate security-critical env vars at boot
- **Priority:** P0 · **Status:** Done
- **Business value:** Moves `ENCRYPTION_KEY` validation into the same clear, aggregated `requiredVars` failure message every other required config value already uses, instead of a scattered, uncontextualized throw buried in `utils/crypto.ts`.
- **Correction to the original framing, found during pre-implementation tracing:** the original "silent mid-request production crash" framing was likely imprecise. `crypto.ts`'s throw is at module top-level, and it's reached via a static ESM import chain (`app.ts` → `routes/index.ts` → `billing.route.ts` → `invoice.controller.ts` → `crypto.ts`) that evaluates eagerly at process load, before `server.listen()`. So a missing `ENCRYPTION_KEY` most likely already failed the process early, not mid-request — just with a worse error message and later in the import graph than necessary. I could not fully execution-verify this end-to-end (this sandbox has no network path to the project's configured MongoDB Atlas cluster, so a full boot attempt fails on that first), so this is reasoning-based, stated as such rather than presented as confirmed. Either way, this task's actual value is unchanged: earlier, clearer, consistently-formatted failure.
- **Engineering effort:** 1–2 hrs (actual: ~1.5 hrs) · **Regression risk:** Very low — confirmed `ENCRYPTION_KEY` is already present in this repo's `server/.env` (checked key presence only, not its value), so this change does not break the current environment. No visibility into any separate production secret store; that should be checked independently before deploying there.
- **Dependencies:** None. **Blocks:** E2-F3-T1 (asset encryption) — can now rely on `ENCRYPTION_KEY` being guaranteed present.
- **Exact files:**
  - `server/src/config/env.config.ts` — added `'ENCRYPTION_KEY'` to `requiredVars`; added a new soft-warn block (`softWarnVars` = `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME`, `GEMINI_API_KEY`) that `console.warn`s at startup if any are missing, without blocking boot, plus an inline comment documenting the hard-vs-soft decision and its rationale.
  - New: `server/src/config/__tests__/env-config-validation.test.ts` — 6 tests, run as isolated child processes (see below).
- **Decision documented (Subtask b):** `AWS_*`/`GEMINI_API_KEY` stay soft, not hard-required. Traced both already-existing fallback behaviors before deciding: `s3-upload.service.ts:8-9` constructs its S3 client with `|| 'dummy'` credential fallbacks and never throws at import time; `ai-chat.service.ts:53-58`'s `getAI()` already throws its own clear, request-scoped error, only when AI chat is actually invoked. Both gate optional features, not core paths, and both already fail gracefully — hard-requiring them would block environments that don't use S3 attachments or AI chat at all. Full rationale is in the code comment directly above the soft-warn block, not just here.
- **Testing strategy:** Since `env.config.ts` has real module-level side effects (`dotenv.config()` + a top-level throw) that would leak into any test importing it directly, each scenario spawns an isolated child process importing only `env.config.ts` against a fully-controlled fake environment. Verified: full valid config boots cleanly; missing `ENCRYPTION_KEY` fails with the expected message; a pre-existing required var (`MONGO_URI`) still fails the same way as before this change (regression check); multiple simultaneous missing vars are listed together; missing soft-warn vars produce a warning but do **not** block boot; a fully valid config produces no warning. No real secrets from `server/.env` are read or used by the tests — all values are fabricated dummies, and dotenv's "don't override an already-set key" behavior (confirmed, not assumed) is what makes setting a var to `''` in the spawned environment a reliable way to simulate "missing" without needing to touch the real `.env` file.
- **Rollout plan:** Direct deploy, no flag. **Pre-deploy check for any environment other than this repo's own `server/.env`:** confirm `ENCRYPTION_KEY` is actually set there before shipping — not re-verified here, since I only have visibility into this repo's local `.env`.
- **Rollback plan:** Revert `env.config.ts` — no state impact, affects only startup validation behavior.
- **Acceptance criteria:**
  - [x] Missing var fails startup with a clear message — verified (`missing ENCRYPTION_KEY fails startup immediately with a clear message` test).
  - [x] Documented decision on AWS/Gemini vars (hard-required vs. soft-warned) — documented both in-code and above; soft-warn implemented and tested.
  - [x] Existing valid configs unaffected — verified (`full valid config boots successfully` test) and confirmed `ENCRYPTION_KEY` already present in this repo's `.env`.

**Verification performed:**
- `node --import tsx --test src/config/__tests__/env-config-validation.test.ts` → **6/6 passing**.
- `node --import tsx --test src/**/__tests__/*.test.ts` (full suite) → **56/56 passing** (50 pre-existing + 6 new).
- `npx tsc --noEmit` → clean on the modified file (same 4 pre-existing, unrelated errors in `migrate-relational-data.ts`, confirmed identical to before).
- `git diff` reviewed — confirmed minimal, isolated change: one file modified (`env.config.ts`), one new test directory added, no unrelated code touched.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Add `ENCRYPTION_KEY` to `requiredVars` | **Done** |
| b | Decide + document hard-required vs. soft-warn treatment for `AWS_*`/`GEMINI_API_KEY` | **Done** — soft-warn, decision + rationale documented in-code |
| c | Confirm production `.env` has `ENCRYPTION_KEY` set, before merge | **Partially done** — confirmed present in this repo's `server/.env` (key presence only checked, not value); no access to verify any separate production secret store, flagged as an open item for whoever deploys there |
| d | Test: missing-var startup failure + full-config successful boot | **Done** — 6 tests covering hard-required and soft-warn behavior |

### E2-F3 — Data-at-Rest Protection

#### E2-F3-T1: Real encryption for order assets
- **Priority:** P1 · **Status:** Closed (2026-08-02, owner decision)
- **Business value:** The system stores `CREDENTIAL`-type order assets and currently returns them as plaintext with a `TODO: decrypt with AWS KMS` marker — the highest real-world-harm item in the whole backlog *if* that asset type is in active use. Production verification (below) found it is not.
- **Closure reason (owner-confirmed, 2026-08-02):**
  - Production verification confirmed **zero** `OrderAsset` documents exist in the database — there is nothing to protect today.
  - No write path exists anywhere in the codebase that creates an `OrderAsset` document (confirmed by code + git-history search during this task's Subtask a investigation) — the plaintext-storage risk this task describes has no current attack surface.
  - No migration is required as a consequence — there are no legacy rows to backfill.
  - Encryption will be implemented together with any future feature that adds an `OrderAsset` creation path, rather than built speculatively ahead of one — consistent with this session's discipline on other unconfirmed-requirement items (E3-F4-T1, E5-F1-T2).
  - The read-only investigation script used to confirm the zero-document count (`server/src/scripts/check-order-asset-encryption.ts`) was deliberately **not committed** — it served its one-time purpose and is not needed as standing tooling.
- **Engineering effort:** 1.5–2.5 days (not spent — closed at the gating question) · **Regression risk:** N/A — no code changed.
- **Dependencies:** E2-F2-T1 (`Done`). **Gating question (Subtask a) answered — see Closure reason.**
- **Exact files:** None changed. (Original scope, now moot: `server/src/services/order.service.ts` asset create + `getAssetByAccessToken` ~L574–604, `server/src/models/order-asset.model.ts` — revisit these when an `OrderAsset` creation feature is actually built.)
- **Testing strategy:** N/A — no implementation.
- **Rollout plan:** N/A.
- **Rollback plan:** N/A.
- **Acceptance criteria:** Superseded by closure — see Closure reason above. The `TODO: decrypt with AWS KMS` marker in `order.service.ts` remains as-is and should be revisited when an `OrderAsset` write path is actually built, not before.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | **Gate:** confirm with product owner whether `AssetType.CREDENTIAL` has real production data | **Done** — confirmed zero `OrderAsset` documents in production; task closed as a direct result |
| b | Wire `encryptPayload()`/`decryptPayload()` into asset create/read paths | **Closed — not applicable** (no write path exists to wire into; revisit if one is built) |
| c | Add `encryptionVersion` marker field to distinguish migrated vs. legacy rows | **Closed — not applicable** (no legacy rows exist) |
| d | (Conditional on a) Write + dry-run the backfill migration script against staging | **Closed — not applicable** (gate answered "no data"; migration not needed) |
| e | Round-trip + DB-inspection tests | **Closed — not applicable** |
| f | Run backfill in production only after write-path has soaked, with a pre-migration snapshot | **Closed — not applicable** |
| g | Replace TODO comment with accurate scheme documentation | **Closed — deferred** to whenever an `OrderAsset` creation feature is built, since the comment describes intended future behavior, not a current defect |

---

## 5. E3 — Operational Readiness (DevOps/SRE)

### E3-F1 — Health & Lifecycle Management

#### E3-F1-T1: Add `/healthz` + graceful shutdown
- **Priority:** P0 · **Status:** Done* (see Subtask c note — substituted with a stronger deterministic automated test, not silently skipped)
- **Business value:** Foundational for any load balancer/orchestrator integration and for avoiding mid-transaction request kills on deploy/restart.
- **Engineering effort:** 2–3 hrs (actual: ~2.5 hrs) · **Regression risk:** Very low, purely additive — confirmed via `git diff` that no existing route, middleware, or startup sequencing was modified.
- **Dependencies:** None. Prerequisite (soft) for E3-F3-T1 (Docker healthcheck) — now satisfied.
- **Testability constraint hit (same as the last 3 tasks):** the full `server.ts`/`app.ts` module graph can't be imported in a test here — `app.ts` imports `lib/auth.ts`, which does `await client()` (a real MongoDB connection) at module top level, and this sandbox has no network path to the project's configured cluster. Resolved by extracting both pieces of decision logic into small, dependency-free/injectable modules (see Exact files) so they're directly testable without a real DB or a real `process.exit`, with the real entrypoints reduced to thin wiring.
- **Exact files:**
  - New: `server/src/lib/health.ts` — pure function `getHealthStatus(mongoReadyState: number)`, no mongoose import, returns `{statusCode, body}` for readyState 1 (connected → 200) vs. anything else (→ 503).
  - New: `server/src/lib/gracefulShutdown.ts` — `createGracefulShutdown(server, {timeoutMs, closeResources, exit, onLog})` factory implementing the timeout-race: `server.close()` → `closeResources()` → `exit(0)`, or `exit(1)` if `timeoutMs` elapses first. All side-effecting dependencies (`closeResources`, `exit`, `onLog`) are injected, defaulting to `mongoose.connection.close`-shaped behavior / `process.exit` / no-op in production use.
  - `server/src/app.ts` — added `import mongoose` + `import { getHealthStatus }`, and a 6-line `GET /healthz` route registered outside the `/api` auth gate (same placement pattern as the existing `GET /`).
  - `server/src/server.ts` — added `import mongoose` + `import { createGracefulShutdown }`; wired `createGracefulShutdown(server, { closeResources: () => mongoose.connection.close(), onLog: (level, event, meta) => logger[level](meta, event) })` and registered it on both `SIGTERM` and `SIGINT`.
  - New: `server/src/lib/__tests__/health.test.ts`, `server/src/lib/__tests__/gracefulShutdown.test.ts`.
- **Testing strategy:** `getHealthStatus` unit-tested directly across all 4 mongoose readyState values plus an unrecognized value (defensive default). `createGracefulShutdown` tested against a **bare in-process `http.Server`** (no Express, no app.ts): (1) happy path — no open connections, resources close, `exit(0)` fires quickly, timeout never triggers; (2) **the actual acceptance-criterion scenario** — a raw TCP socket is opened and deliberately never closed, which makes `server.close()`'s callback hang exactly the way a stuck/slow client connection would in production; with a short configured `timeoutMs` (150ms), the test asserts `exit(1)` fires at ≥130ms and <2150ms, proving the bounded-timeout mechanism actually works, not just that it exists in the code; (3) `closeResources` rejecting still results in `exit(0)` with the error logged — a failed DB-close must not block process exit, since guaranteed exit is the actual goal.
- **Rollout plan:** Direct deploy, additive only, shipped.
- **Rollback plan:** Remove the `GET /healthz` route and the `SIGTERM`/`SIGINT` registration (2 files) — the two new lib files are inert if unused, zero impact either way.
- **Acceptance criteria:**
  - [x] `/healthz` reflects real DB connectivity — `getHealthStatus`'s readyState mapping is fully unit-tested; the route itself is a 2-line pass-through of `mongoose.connection.readyState` into that tested function, verified by code review since the route handler itself can't be exercised without a real DB connection in this sandbox (documented limitation, not silently assumed correct).
  - [x] `SIGTERM` drains in-flight requests — `server.close()` (Node's own connection-draining behavior) is used unmodified; the wrapping logic around it is fully tested.
  - [x] Process exits within a bounded timeout even on a hung request — **directly verified**, not just asserted: the hung-connection test proves forced exit fires within the configured window and not indefinitely.

**Verification performed:**
- `node --import tsx --test src/lib/__tests__/health.test.ts src/lib/__tests__/gracefulShutdown.test.ts` → **8/8 passing**.
- `node --import tsx --test src/**/__tests__/*.test.ts` (full suite) → **64/64 passing** (56 pre-existing + 8 new).
- `npx tsc --noEmit` → clean on all 4 touched/new files (same 4 pre-existing, unrelated errors in `migrate-relational-data.ts`, confirmed identical to before).
- `git diff` reviewed for both `app.ts` and `server.ts` — confirmed strictly additive, no existing line altered or removed in either file.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Implement `/healthz` with `mongoose.connection.readyState` check | **Done** |
| b | Implement `SIGTERM`/`SIGINT` graceful-drain handler with timeout | **Done** |
| c | Manual test: kill mid-request, verify drain + bounded exit | **Substituted** — a live manual SIGTERM-against-the-running-dev-server test isn't possible in this sandbox (the app can't fully boot without network access to the real MongoDB cluster, same limitation as every prior task this session). Replaced with a **deterministic automated equivalent that is arguably stronger**: a real TCP connection is opened and deliberately never closed, forcing `server.close()` into exactly the hung state a stuck client would cause, and the test asserts the forced-exit timeout actually fires within bounds — this is not a simulation of the scenario, it's the same underlying Node.js behavior (`server.close()` waiting on live connections) exercised directly. A true end-to-end manual test against a running deployment is still recommended before this is fully trusted in production, and is noted here as an open follow-up for whoever can run the app against a real network. |

### E3-F2 — CI/CD Pipeline

#### E3-F2-T1: Minimal CI — typecheck + build gate
- **Priority:** P1 · **Status:** Done (all three acceptance criteria now met — E6-F2-T3, the blocker on the third, is itself `Done` as of 2026-08-02)
- **Business value:** Makes the existing strict `tsconfig.json` actually enforce something on every push instead of only when a developer remembers to run `tsc` locally — the cheapest multiplier on every other task's safety.
- **Engineering effort:** 3–4 hrs (actual: ~1 hr) · **Regression risk:** Very low, CI-only — confirmed via `git status`/`git diff` that only the new workflow file was added, zero application code touched.
- **Dependencies:** None (confirmed satisfied — all P0 work done). Should land before E7-F1-T1 (test framework) so the test step can be appended to the same pipeline; **deliberately does not run tests yet** for exactly that reason, even though `node --test` suites already exist from P0 work — appending a test step is earmarked for E7-F1-T1, not this task.
- **Exact files:** new `.github/workflows/ci.yml` — triggers on push/PR to `main`, checks out, sets up Node 24 (matching this project's actual dev environment, for consistency), `npm ci` in `server/`, runs `npx tsc --noEmit`. Scoped to `server/` only, matching the backlog's declared scope; frontend apps intentionally not typechecked here.
- **Discovery made while implementing (filed, not fixed):** the exact command this workflow runs currently fails on `main` today — 4 pre-existing, unrelated `noUnusedLocals` errors in `src/scripts/migrate-relational-data.ts` (confirmed present and untouched since before any P0 work this session). Filed as **E6-F2-T3**, elevated to P1 since it's now a concrete CI blocker, not fixed here per instructions not to resolve unrelated issues mid-task.
- **Testing strategy:** Could not literally trigger GitHub Actions from this environment (no network path to push/observe a live run). Verified both paths locally instead: ran the exact command (`npx tsc --noEmit` in `server/`) and confirmed it **exits non-zero (2)** on the current pre-existing errors — proving the gate correctly fails a broken build, using real existing breakage rather than an artificially introduced one. The "clean passes" path is backed by consistent evidence across every task this session: the identical command has reliably exited 0 with no output on every individual file touched, and on the dashboard app entirely, whenever there were genuinely zero errors. Workflow YAML manually reviewed for structural correctness (consistent 2-space indentation, no tabs); no YAML linter was available in this environment to do a stricter parse check — flagged as a minor unverified detail, not asserted as certain.
- **Rollout plan:** Merge directly, no app-code risk. Will show red on `main` immediately after merge, for the reason filed as E6-F2-T3 — not a defect in this task, but worth knowing before treating a red CI badge as alarming.
- **Rollback plan:** Delete the workflow file — zero impact either direction, purely additive.
- **Acceptance criteria:**
  - [x] CI runs on every push/PR — workflow correctly triggers on both events per its `on:` block.
  - [x] Broken build fails — verified directly (exit code 2 on the current real errors).
  - [x] Clean build passes — **now true on `main`** as of E6-F2-T3 (2026-08-02): `npx tsc --noEmit` in `server/` exits 0 with no output. The gate mechanism was already proven correct (see testing strategy); the blocker was `main` itself, which is now clean.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Write `ci.yml` running `npx tsc --noEmit` (or `npm run build`) for `server/` | **Done** |
| b | Verify against a deliberately broken build | **Done** — used the real pre-existing errors rather than introducing an artificial one |
| c | Verify against a clean build | **Done** — clean as of E6-F2-T3 (2026-08-02) |

### E3-F3 — Containerization

#### E3-F3-T1: Dockerize local dev
- **Priority:** P2 · **Status:** Done*
- **Business value:** Removes the bus-factor/onboarding risk of hand-configured local Mongo/Redis, and is the first real-world verification that Mongo is actually configured as a replica set (a load-bearing assumption for every transactional code path in this system).
- **Engineering effort:** 1–1.5 days (actual: ~2 hrs) · **Regression risk:** Low, dev-tooling only — confirmed via `git diff`: no application code touched, only new infra files + a README addition.
- **Dependencies:** None blocking (E3-F1-T1's `/healthz` exists but wasn't wired into the compose healthcheck in this pass — see note below).
- **Environment check performed before implementing:** `docker` CLI is present in this environment but the daemon isn't running (`failed to connect to the docker API ... daemon is running?`) — confirmed via `docker ps`. This is a genuine execution/verification limitation, not one of the four stop conditions (business decision, DB schema, public API, or architecture) — proceeded with authoring the files, documented what couldn't be run.
- **Exact files:**
  - New: `server/Dockerfile` — multi-stage (`base` → `deps` → `build` → `runtime`), Node 24 (`node:24-slim`, matching CI and this environment's own Node version). `PUPPETEER_SKIP_DOWNLOAD=true` is set deliberately — Puppeteer's Chrome download during `npm ci`'s postinstall would need additional Debian dependencies out of scope for this task; PDF-generation endpoints will not work in this container without further work, documented in-file, not silently broken.
  - New: `docker-compose.yml` — `mongo` (single-node replica set via `--replSet rs0` + a one-shot `mongo-init-replica-set` service that calls `rs.initiate()`, gated on a healthcheck), `redis`, and `server` (built to the `deps` stage, running `npm run dev` with the local `server/` directory bind-mounted for hot reload — a dev-loop setup, not the static production build the `Dockerfile` alone would produce). All `server` environment values are explicit, labeled local-dev-only placeholders — just enough to satisfy `env.config.ts`'s presence checks, not real credentials.
  - New: `server/.dockerignore`.
  - `README.md` — new "Option A: Backend via Docker Compose" section ahead of the existing manual setup instructions (kept as "Option B", unmodified).
- **Testing strategy:** What was verified: `docker compose config` (syntax/structure validation, no daemon needed) passed cleanly; `tsc --noEmit` and the full 134-test suite confirm zero impact on application code. **What could not be verified**, per the environment check above: actually running `docker-compose up`, and this task's own specified acceptance criterion — the quotation→order→receipt transactional flow (`createNewVersion`) actually succeeding against the containerized replica-set Mongo. This is the same class of limitation as every DB-dependent task this session, just one level further out (no daemon, not just no reachable Mongo).
- **Rollout plan:** Additive tooling, no production path touched — unchanged from the original plan.
- **Rollback plan:** N/A — no production impact either direction; delete the 3 new files and the README section to fully revert.
- **Acceptance criteria:**
  - [x] One-command working local stack — `docker-compose up` is the one command; structure validated via `docker compose config`, not run end-to-end (see above).
  - [ ] ~~Transactional path confirmed working against replica-set Mongo, closing the audit's open question~~ — **not verified**, no Docker daemon available in this environment. Flagged as an open follow-up for whoever can run `docker-compose up` and exercise `createNewVersion`.
  - [x] README updated.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Write multi-stage `Dockerfile` | **Done** |
| b | Write `docker-compose.yml` with Mongo (replica-set single-node), Redis, server | **Done** |
| c | Verify transactional flow end-to-end against the container stack | **Blocked** — no Docker daemon available in this environment; open follow-up |
| d | Update `README.md` local-dev instructions | **Done** |

### E3-F4 — Rate Limiting at Scale

#### E3-F4-T1: Redis-backed rate limiter
- **Priority:** P3 · **Status:** Deferred
- **Deferral reason (2026-08-02):** This card's own business-value note already states the trigger condition — "only matters once the app runs multiple instances." Whether production currently runs multiple instances is a deployment-topology fact with no visibility from code; a business/infra question, not something to guess at. Building Redis-backed rate limiting ahead of an actual multi-instance need would be speculative work — the same discipline applied to E2-F3-T1. Revisit when multi-instance deployment is confirmed real.
- **Business value:** Only matters once the app runs multiple instances — correctly deferred given current single-instance deployment.
- **Engineering effort:** 1 day · **Regression risk:** Low.
- **Dependencies:** `ioredis` already installed.
- **Exact files:** `server/src/middlewares/rate-limit.middleware.ts`.
- **Testing strategy:** Verify shared limits across two local instances hitting the same Redis.
- **Rollout plan:** Direct swap of store implementation.
- **Rollback plan:** Revert to in-memory store.
- **Acceptance criteria:** Rate limits consistent across N instances in a local multi-instance test.

**Subtasks:** *(deferred — expand when scheduled)*

---

## 6. E4 — Observability & Auditability

### E4-F1 — Outbox Operability

#### E4-F1-T1: Wire up Outbox admin API
- **Priority:** P1 · **Status:** Done* (see acceptance-criteria note — the live HTTP+DB integration test is an open follow-up, not silently skipped)
- **Business value:** The Outbox pattern is load-bearing for reliable event delivery but has zero HTTP surface — today, recovering a dead-lettered event requires direct DB access. This closes the gap using logic that already exists and is fully implemented.
- **Engineering effort:** 4–6 hrs (actual: ~2 hrs) · **Regression risk:** Very low — confirmed via `git diff`: strictly additive (one new route file, one new import + one new array entry in `routes/index.ts`), no existing route or controller logic touched.
- **Dependencies:** None.
- **Subtask (a) verification performed:** read `outbox.controller.ts` and `outbox.service.ts` side by side. The controller's 4 exported handlers (`listOutbox`, `getOutboxById`, `replayOutboxById`, `replayOutboxMany`) call `OutboxService.list`, `OutboxEventModel.findById` (direct, no dedicated service method — acceptable for a simple by-id lookup), `OutboxService.replayById`, and `OutboxService.replayMany` respectively — all four exist on the current service with matching signatures. **No adjustment needed; the controller was already correct and fully implemented**, exactly as the task description anticipated. Also confirmed Express is v5 (`package.json`), under which async route-handler rejections are auto-forwarded to `next(err)` — so the controller's lack of internal `try/catch` (unlike some older Express-4-era controllers in this codebase) is correct, not a gap.
- **Exact files:**
  - New: `server/src/routes/outbox.route.ts` — `GET /`, `GET /:id`, `POST /replay` (bulk), `POST /:id/replay` (single), each gated by `authorize(Role.SUPER_ADMIN, Role.ADMIN)` before the controller handler, mirroring the existing `authorize(...ROLES)` idiom used in `receipt.route.ts`/`payroll-bank-settings.route.ts` rather than inventing a new pattern.
  - `server/src/routes/index.ts` — added one import + one `{ path: "/outbox", route: outboxRoute }` entry to `moduleRoutes`, in the same style as every other module route.
  - `server/src/controllers/outbox.controller.ts` — **not modified**; verified matching per the note above.
  - New: `server/src/routes/__tests__/outbox-route.test.ts` — 28 tests.
- **Testing strategy:** The backlog's specified "list + replay-one integration test" needs a live HTTP server + DB, which this sandbox cannot provide (no network path to Mongo, no DB test harness yet — E7-F1-T1's explicit scope, the same limitation noted on every DB-touching task this session). Substituted with tests that inspect Express's own `Router.stack` on the real, exported `outboxRoute` object (not a mock or a re-implementation of it) to confirm all 4 routes are registered with the correct controller handler wired in, then extract the *actual* `authorize(...)` middleware instance from each route's handler chain by reference and invoke it directly with constructed `req`/`res`/`next` — proving the real security gate on the real routes, not a theoretical one. Covers: 3 non-admin roles → 403, no `req.user` → 401, both `SUPER_ADMIN` and `ADMIN` → admitted (`next()` called, no response written), across all 4 routes (28 cases total). What is *not* covered here: the controller/service logic actually running against real data (list returning real events, replay actually flipping a dead-lettered event to `pending`) — that requires the live DB this sandbox doesn't have, flagged as an open follow-up.
- **Rollout plan:** Direct deploy, additive route surface, `SUPER_ADMIN`/`ADMIN` only — unchanged from the original plan.
- **Rollback plan:** Remove the 2-line addition to `routes/index.ts` (or delete `outbox.route.ts` entirely) — underlying `OutboxService`/`OutboxEventModel` untouched either way.
- **Acceptance criteria:**
  - [x] Admin can list + replay dead-lettered events via API — all 4 endpoints registered and correctly wired to the already-implemented, already-correct service methods (verified by code inspection, per Subtask a); route registration itself verified by the 4 "registered endpoints" tests. The live-data version of this check (real list/replay against a real DB) is an open follow-up, not yet run.
  - [x] Non-admins get 403 — verified directly against the real middleware instance wired into each of the 4 routes; 401 for unauthenticated also verified as a bonus (not originally a listed criterion, but a natural companion case).

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Verify `outbox.controller.ts` matches current `OutboxService` interface, adjust if stale | **Done** — verified matching, no adjustment needed |
| b | Write `outbox.route.ts` (list, replay-one, replay-bulk), admin-only | **Done** |
| c | Register route in `routes/index.ts` | **Done** |
| d | Integration + AuthZ tests | **Done** — AuthZ fully verified against the real wired middleware; the DB-backed integration half is substituted per the documented sandbox limitation and flagged as an open follow-up |

### E4-F2 — Unified Audit Trail

#### E4-F2-T1: Consolidate audit-trail mechanisms
- **Priority:** P2 · **Status:** Not Started
- **Business value:** Today, "what happened to this order/quotation" requires querying three separate systems (`AuditLog`, `OrderStatusHistory`, plain logs) with no single source of truth — a real gap for any future compliance or incident-investigation need.
- **Engineering effort:** 2–3 days · **Regression risk:** Medium — cross-cutting write-path change.
- **Dependencies:** Best sequenced after E7-F1-T1 (tests exist for regression safety) and after E4-F1-T1/E6-F1-T1 establish the "investigate-before-changing" pattern for cross-cutting work.
- **Exact files:** `server/src/services/order.service.ts` (3 `OrderStatusHistoryModel.create` sites), `server/src/services/quotation.service.ts` (status-transition points currently `logger.info()`-only).
- **Testing strategy:** Per-site test confirming both the existing side effect and the new `AuditLog` entry are created together; full-lifecycle integration test proving a complete, gap-free trail.
- **Rollout plan:** Go-forward only — explicitly no backfill of historical log-only events.
- **Rollback plan:** Each site's addition is independently revertible with zero risk to pre-existing behavior.
- **Acceptance criteria:** Written canonical-vs-projection decision documented in code · every order/quotation status transition produces an `AuditLog` entry · single-query full history works · no-backfill decision explicitly documented.

**Subtasks:** *(expand at scheduling time — decision-first task, see body above)*

### E4-F3 — Data Retention

#### E4-F3-T1: TTL/retention policy for append-only collections
- **Priority:** P3 · **Status:** Not Started
- **Business value:** Cheap now, painful to retrofit once `AuditLog`/`OutboxEvent`/notifications are large.
- **Engineering effort:** 1 day · **Regression risk:** Low but **irreversible by nature** — get the window right before enabling.
- **Dependencies:** Should follow E4-F2-T1 (need to know what's canonical before deciding what's safe to expire).
- **Exact files:** `server/src/models/audit-log.model.ts`, `server/src/models/outbox-event.model.ts`.
- **Testing strategy:** Verify TTL index creation and expiry behavior in a throwaway test collection.
- **Rollout plan:** Business-approved retention window required before index creation (recommend 1–2 yrs `AuditLog`, 90 days processed `OutboxEvent`).
- **Rollback plan:** Drop TTL index — un-expired documents safe; already-expired documents are unrecoverable, hence the up-front approval requirement.
- **Acceptance criteria:** TTL indexes live with documented, approved retention windows.

**Subtasks:** *(deferred — expand when scheduled)*

---

## 7. E5 — Reliability & Async Processing

### E5-F1 — Durable Background Jobs

#### E5-F1-T1: Move notification side-effects onto BullMQ
- **Priority:** P2 · **Status:** Not Started
- **Business value:** Task notifications currently run as fire-and-forget IIFEs that silently lose messages on process crash/restart — using infrastructure (BullMQ, Redis) that's already installed and unused for this purpose.
- **Engineering effort:** 2–3 days · **Regression risk:** Medium — migrate one call site at a time, not all 5 together.
- **Dependencies:** Benefits from E7-F1-T1 (tests) for regression coverage per call site. Requires auditing `queue.service.ts`/`redis-queue.service.ts` maturity first (not yet traced end-to-end).
- **Exact files:** `server/src/services/task.service.ts` (5 IIFE sites), `server/src/services/queue.service.ts` / `redis-queue.service.ts`, `server/src/services/notification.service.ts`.
- **Testing strategy:** Enqueue-survives-restart unit test; per-call-site integration test; staging chaos test (kill process immediately after trigger, confirm delivery after restart).
- **Rollout plan:** One call site per release, not a big-bang migration.
- **Rollback plan:** Each migrated call site independently revertible to inline-IIFE.
- **Acceptance criteria:** All 5 sites go through the queue · chaos test proves crash-survival · queue failures are visible/alertable, not silent.

**Subtasks:** *(expand per call site at scheduling time)*

---

#### E5-F1-T2: Implement an Outbox event consumer — the queue is currently write-only

- **Priority:** P1 · **Status:** In Progress — **Phase 1a done (worker infrastructure), Phase 1b done for 2 of 3 events (see below), `quotation.superseded` still blocked on a product decision**
- **Discovered:** 2026-08-02, during investigation ahead of E6-F1-T1 (wiring up `quotation-timeline.controller.ts`, whose two admin actions enqueue Outbox events). Filed as its own task per backlog governance rule 6 (new issues found mid-investigation get filed, not folded into the triggering task).
- **2026-08-02 — architecture proposal reviewed, Phase 1 scope split explicitly by owner decision:** a full design proposal (producer audit, event lifecycle, sync/async classification, in-process-vs-separate-process recommendation, text architecture diagram, BullMQ integration path) was presented and is not restated here in full — see that turn's transcript. Owner approved proceeding with **worker infrastructure only** first — explicitly deferring all three business handlers and explicitly **not** removing `admin.outbox.replay` as a producer in that first pass. This card is split into sub-phases:
  - **Phase 1a (worker infrastructure) — Done.** See "What shipped in Phase 1a" below.
  - **Phase 1b (business handlers, evidence-only) — Done for `admin.quotation.regenerate_link` and `admin.outbox.replay`; blocked for `quotation.superseded`.** A follow-up investigation ([see that turn's transcript](server/src/services/outbox-worker.service.ts)) traced each event's business intent using only the existing codebase (no guessing), per the instruction to stop and flag rather than invent behavior where intent isn't provable. Two of three were fully provable; the owner then explicitly approved implementing only those two. See "What shipped in Phase 1b" below.
- **What shipped in Phase 1a (worker infrastructure only, no business logic):**
  - New `server/src/services/outbox-worker.service.ts` — the first caller anywhere in the codebase of `OutboxService.claimNext`/`markProcessed`/`markFailed`. Pure, injectable core (`processNextOutboxEvent`, `drainOutboxEvents`) claims one event, dispatches to a name-based handler registry, and calls `markProcessed`/`markFailed` — unit-tested without a live DB (same DI pattern as `lib/gracefulShutdown.ts`/`lib/health.ts`). Real wiring layer (`startOutboxWorker`/`stopOutboxWorker`) polls every `OUTBOX_POLL_INTERVAL_MS` (5s, new constant in `constants/timing.ts`), draining up to 10 events per tick, bounded so one tick can never run unbounded.
  - `server/src/services/scheduler.service.ts` — registers `startOutboxWorker()` in `startAllSchedulers()` alongside the existing 6 jobs, same pattern. `stopAllSchedulers()` changed from sync to `async` so it can `await stopOutboxWorker()`, letting an in-flight claim finish instead of being abandoned.
  - `server/src/server.ts` — **pre-existing gap fixed as a direct consequence of "respect graceful shutdown" being in this task's explicit scope:** `stopAllSchedulers()` was previously never called anywhere, including on `SIGTERM`/`SIGINT`. `closeResources` now calls `await schedulerService.stopAllSchedulers()` before `mongoose.connection.close()` — benefits all 6 pre-existing scheduler jobs too, not just the Outbox worker.
- **What shipped in Phase 1b (business handlers for the 2 provable events; `quotation.superseded` deliberately untouched):**
  - **`admin.quotation.regenerate_link` — real handler, reusing `QuotationService.sendQuotation()` unchanged.** `outbox-worker.service.ts`'s handler resolves `event.payload.quotationGroupId` to the group's current `{ isLatestVersion: true }` quotation (same lookup `createNewVersion()` already performs), then calls `QuotationService.sendQuotation(latest._id.toString(), actorUserId)` — zero duplicated token/email/PDF logic. Throws a clear error (retried/dead-lettered normally) if the payload is missing `quotationGroupId` or no latest quotation exists for the group. The event stays async — sending an email is real I/O, and the admin endpoint already returns `202 Accepted`, which was accurate all along, just previously unfulfilled.
  - **`admin.outbox.replay` — removed entirely, producer and consumer.** The investigation found it only ever wrapped `OutboxService.replayMany`, a cheap, synchronous, idempotent DB update the sibling `/outbox/replay` admin route already calls directly — routing it through the queue added latency and a second failure point for no benefit, and a full-tree grep confirmed neither this endpoint nor `regenerate-link` has any frontend caller today, so there was no live consumer whose contract this could break. `quotation-timeline.controller.ts`'s `requestReplay()` no longer calls `OutboxService.enqueue()`: it resolves `failed`/`dead_letter` event ids for the quotation group directly (or uses explicitly-provided `ids`) and calls `OutboxService.replayMany()` inline. **Response shape changed** (documented, not silently equivalent): `202 Accepted` + `{ outboxEventId }` → `200 OK` + `{ replayedCount, ids }`, since the action is now synchronous. No handler is registered for `admin.outbox.replay` in `outbox-worker.service.ts` — nothing produces this event name anymore.
  - `server/src/routes/quotation-timeline.route.ts` — stale comment (claiming both actions were unconsumed no-ops) corrected to describe actual current behavior.
  - **`quotation.superseded` — untouched, still the Phase 1a placeholder**, per explicit instruction. Its business intent could not be proven from the codebase (see the investigation): no code anywhere reacts to a superseded quotation today, and the only plausible reading (notify staff) would require extending `NotificationModel`'s closed `type` enum — a schema change with no product sign-off. Left failing loudly (retry/backoff/dead-letter) rather than guessed at.
  - New: `server/src/controllers/__tests__/quotation-timeline-controller.test.ts` — 4 tests for `requestReplay`'s new synchronous behavior (missing `quotationGroupId`, default-mode group resolution + replay, explicit `ids` bypass the lookup, zero-events-found short-circuit), using the same Mongoose-model monkey-patch pattern as `receipt-zero-payment-race.test.ts` (E1-F3-T1).
  - `server/src/services/__tests__/outbox-worker.test.ts` — extended with 3 new describe blocks: `quotation.superseded` placeholder (unchanged behavior, re-asserted), `admin.outbox.replay` confirmed unregistered, and 4 new tests for the real `admin.quotation.regenerate_link` handler (missing payload field, no-latest-quotation-found, happy path delegates to `sendQuotation` with the exact resolved args, missing `actorUserId` still calls through with an empty string) — `QuotationModel.findOne`/`QuotationService.sendQuotation` monkey-patched per test, restored in `afterEach`.
- **Verification (Phase 1b):** `npx tsc --noEmit` clean. Full suite `158/158` passing (151 pre-existing + 4 new controller tests + 3 net-new worker tests). `git diff` reviewed — scoped to `outbox-worker.service.ts`, `quotation-timeline.controller.ts`, `quotation-timeline.route.ts` (comment only), plus the two test files; no schema change, no unrelated route touched.

**Problem statement:** `OutboxService`'s entire consumer-side API — `claimNext()`, `markProcessed()`, `markFailed()` — has zero callers anywhere in the codebase. Every event written via `OutboxService.enqueue()` lands in MongoDB with `status: 'pending'` and stays there permanently; nothing ever claims, processes, completes, or fails it. The transactional-outbox pattern's producer/schema/admin-tooling side is fully built; the consumer/dispatcher half was never implemented.

**Business impact:** Exactly one producer is live in production today: [`quotation.service.ts:744`](server/src/services/quotation.service.ts:744)'s `quotation.superseded` event, fired on every quotation version revision. Whatever downstream effect this was meant to trigger has never happened, for as long as this code has existed — and what that effect was supposed to be is genuinely unknown; no consumer code, not even a stub, exists anywhere to infer intent from. Secondarily, this gap directly undermines the correctness of two admin-facing features: E4-F1-T1's Outbox replay API (already shipped — replaying an event today only resets its status field, it doesn't reprocess anything) and E6-F1-T1's planned `requestReplay`/`requestRegenerateLink` actions (would return `202 Accepted` and silently do nothing). Both present as functional to an admin while being no-ops — worse than not having the feature, since nothing signals the gap.

**Root cause:** Incomplete feature, not a regression. Git history shows `claimNext()` was added in the single commit that introduced `outbox.service.ts` and has never had a caller added or removed since. No worker, cron, `setInterval` loop, or BullMQ job references Outbox anywhere. `scheduler.service.ts` (the app's only in-process job runner, started at boot via `server.ts`) runs 6 unrelated jobs (attendance check, leave expiry, monthly finance SMS, meeting reminders, chat auto-ticket conversion, telemetry health checks) — none touch Outbox. `bullmq` is an installed but entirely unused dependency (zero imports in `src/`). `package.json` defines exactly one runtime entrypoint (`start: node dist/server.js`); no separate worker script or deploy config implies a second process exists elsewhere. (Cannot fully rule out an out-of-repo consumer — no visibility beyond this codebase — but there is zero evidence of one and the rest of the architecture argues against it.)

**Architecture analysis:**
- **Producers (3 total, all traced):** `quotation.service.ts:744` (`quotation.superseded`, live); `quotation-timeline.controller.ts:131` (`admin.outbox.replay`, not yet routed — pending E6-F1-T1); `quotation-timeline.controller.ts:159` (`admin.quotation.regenerate_link`, not yet routed).
- **Consumer API** (already well-designed, just unused): `claimNext(lockId, now)` does lock-based claiming with stale-lock recovery (`lockedAt` older than 5 minutes is reclaimable); `markFailed` implements exponential backoff (`2^attempts` seconds, capped at 15 min) and transitions to `dead_letter` after `maxAttempts` (default 10); `markProcessed` clears lock state and stamps `processedAt`. This state machine is sound — it just has no driver calling it.
- `OutboxEvent` has no TTL/retention index — `pending` events accumulate unboundedly (relevant to, but not blocking on, E4-F3-T1).
- **Note found in passing, not fixed here:** E5-F1-T1's own card references `server/src/services/queue.service.ts` / `redis-queue.service.ts` as existing infrastructure to audit — neither file exists in the current codebase. Worth reconciling when E5-F1-T1 is picked up; out of scope for this task to correct.
- **Unknown, flagged rather than guessed at:** how many `quotation.superseded` events already sit `pending` in production today (potentially a backlog stretching back to this code's introduction), and what the event's intended downstream behavior actually is.

**Acceptance criteria:**
- A documented product/business decision exists on what (if anything) `quotation.superseded` should trigger downstream, made *before* any consumer logic is written for it — do not guess at unconfirmed requirements (the exact mistake this session avoided on E2-F3-T1). **Still not met** — see "What shipped in Phase 1b" above.
- A working consumer processes pending `OutboxEvent` documents to completion (claim → handle → `markProcessed`/`markFailed`), with failures visible/alertable, not silent. **Met** for the worker infrastructure (Phase 1a) and for `admin.quotation.regenerate_link` (Phase 1b).
- An admin replay via the existing E4-F1-T1 API results in the event actually being reprocessed end-to-end, not just its status field flipping. **Superseded, met differently than originally worded:** the E6-F1-T1 quotation-timeline replay action (`admin.outbox.replay`) is no longer an Outbox event at all — it calls `OutboxService.replayMany` synchronously and directly, so replay is immediate and real, not eventually-consistent via a second queued event. The original E4-F1-T1 `/outbox/:id/replay` API was always direct in this way; that criterion is unaffected.
- Zero behavior change to any of the 3 existing producer call sites. **Revised, with reasoning documented:** `admin.outbox.replay`'s producer was deliberately removed (see Phase 1b investigation — it only ever wrapped a synchronous, idempotent DB call with no live frontend caller to break). `quotation.superseded` and `admin.quotation.regenerate_link` producers are unchanged.
- E4-F1-T1's and E6-F1-T1's replay/regenerate-link actions are confirmed functional end-to-end. **Met** for both: replay is now genuinely synchronous and direct; regenerate-link's Outbox event now has a real consumer (`QuotationService.sendQuotation()`).

**Rollout plan:** Two phases. **Phase 1** (this task's actual scope): the product decision above, plus a minimal consumer scoped to `quotation.superseded` only — an in-process interval mirroring `scheduler.service.ts`'s existing pattern (not a full BullMQ migration; that's E5-F1-T1's separate, larger scope, and conflating the two would be scope creep on both). Before enabling it, run a one-time count of existing `pending` events in whichever environment it deploys to, so an accumulated backlog doesn't arrive as an unexpected burst on first run. **Phase 2** (deferred, not estimated): generalize to a pluggable per-`eventName` handler registry if/when more event types are added — expand at scheduling time, only if actually needed.
- **Rollback plan:** Purely additive — no schema change, no change to any producer call site. Disabling the new consumer (stop the interval / remove the call) returns the system to its current, already-long-standing write-only state; no data loss either direction, since events that were never processed simply remain `pending`, exactly as today.
- **Risks:**
  - Unknown existing backlog size — first-run processing could be a burst rather than steady-state; mitigate with a pre-enable count and bounded-batch processing.
  - Building a consumer before confirming `quotation.superseded`'s intended behavior risks shipping the wrong side effect — mitigated by making the product decision an explicit acceptance criterion, not an implementation detail.
  - Risk of becoming another half-built piece (a generic dispatcher with no real handlers) if scope creeps beyond Phase 1 — mitigated by scoping Phase 1 to exactly one event type with an approved, concrete behavior.
- **Dependencies:** None blocking the start of the investigation/decision subtask. The actual consumer implementation depends on that decision (this task's own first subtask). Loosely related to E5-F1-T1 (BullMQ notification migration) and E4-F3-T1 (TTL/retention for `OutboxEvent`) — not blocking either direction, but a shared queue-infrastructure decision could plausibly serve both this task and E5-F1-T1; that's a design question for whoever picks this up, not resolved here.
- **Testing strategy:** Unit tests for the consumer's claim/process/complete/fail state transitions against constructed fixtures, following this session's established pattern of extracting pure decision logic away from the Mongo calls so it's testable without a live DB. Integration test (once E7-F1-T1's DB test infrastructure exists) proving a pending event is actually claimed, processed, and marked processed end-to-end. A chaos-style test killing the process mid-processing to confirm `claimNext`'s existing stale-lock recovery logic actually works once a real caller exists (it's implemented but has never been exercised by anything).
- **Estimated effort:** 1–2 days for Phase 1 (product decision + minimal single-event-type consumer). Phase 2 (generalized dispatcher) not yet estimated — scope and effort depend entirely on whether additional event types materialize.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Get a documented product/business decision on `quotation.superseded`'s intended downstream behavior (or explicit confirmation none is needed yet) | **Not Started** — architecture proposal surfaced the question (internal-notification reading vs. client-facing), not yet answered |
| b | Query production for existing `pending` `OutboxEvent` count/age, to size the first-run backlog | **Not Started** — no production DB access from this sandbox, same limitation noted on every prior DB-touching task this session |
| c | Implement a minimal `scheduler.service.ts`-style consumer for `quotation.superseded` only (Phase 1) | **Done (infrastructure only)** — generalized handler-registry consumer shipped (`outbox-worker.service.ts`), registered in `scheduler.service.ts`; deliberately dispatches to a placeholder for `quotation.superseded` rather than real behavior, per explicit instruction to build infrastructure only this pass. The registry approach was chosen over a `quotation.superseded`-only consumer because it needed to safely coexist with the two other live producers without silently mishandling them |
| d | Unit tests for claim/process/complete/fail state transitions | **Done** — 14 tests in `outbox-worker.test.ts` covering the injectable claim/dispatch/mark-processed/mark-failed core and the placeholder-handler registry |
| e | Verify E4-F1-T1's replay API results in real reprocessing, not just a status flip | **Done, by removal rather than by consumer** — `admin.outbox.replay` no longer round-trips through the Outbox at all; `requestReplay()` calls `OutboxService.replayMany()` directly and synchronously, so "reprocessing" is now immediate by construction, not something a consumer needs to fulfill |
| g | Implement `admin.quotation.regenerate_link`'s handler, reusing `QuotationService.sendQuotation()` | **Done** — see "What shipped in Phase 1b" above |
| h | Remove `admin.outbox.replay` as an Outbox event; replace with a direct `OutboxService.replayMany()` call in `requestReplay()` | **Done** |
| f | Document Phase 2 (generalized dispatcher) as deferred/expand-later, not implemented now | **Superseded by implementation** — Phase 1a shipped the generalized per-`eventName` registry directly (rather than a `quotation.superseded`-only consumer later generalized), since supporting the registry pattern from the start was no more expensive than a single-event version and avoids a second migration later. Business handlers per event type remain deferred (Phase 1b), matching this subtask's original intent. |

---

## 8. E6 — Code Health & Technical Debt

### E6-F1 — Dead Code Elimination

#### E6-F1-T1: Delete or wire orphaned controllers
- **Priority:** P2 · **Status:** Done*
- **Business value:** `quotation-timeline.controller.ts` had no routes — a maintenance trap, and a complete, useful admin observability feature (merged quotation/outbox/order timeline + replay/regenerate-link actions) sitting entirely disconnected.
- **Engineering effort:** 3–5 hrs (actual: ~1.5 hrs) · **Regression risk:** Low — confirmed via `git diff`: strictly additive, no existing controller/service logic touched.
- **Dependencies:** None.
- **Investigation performed (corrects the original task premise):** grepped the whole `server/src` tree for both controllers. `quotation-timeline.controller.ts` had zero references anywhere outside itself — genuinely orphaned. `wallet-transaction.controller.ts` was **already fully wired** in `staff.route.ts` (`GET /staffs/wallet-transactions/me`, `GET /staffs/wallet-transactions/all`, `POST /staffs/wallet-transactions/withdraw`, correctly role-gated) and actively consumed by the dashboard (`redux/features/staff/staffApi.ts`) — the backlog's "no routes" claim about it was stale. **Decision: wallet-transaction.controller.ts needs no action.** This correction was discovered while investigating this task, one turn before E5-F1-T2 was also discovered during the same investigation pass.
- **Exact files:**
  - New: `server/src/routes/quotation-timeline.route.ts` — `GET /:quotationGroupId`, `POST /:quotationGroupId/replay`, `POST /:quotationGroupId/regenerate-link`, each gated by `authorize(Role.SUPER_ADMIN, Role.ADMIN)` (same idiom as `outbox.route.ts` from E4-F1-T1).
  - `server/src/routes/index.ts` — one import + one `moduleRoutes` entry.
  - `server/src/controllers/quotation-timeline.controller.ts` — **not modified**, already correct.
  - New: `server/src/routes/__tests__/quotation-timeline-route.test.ts` — 21 tests.
- **Known limitation, documented in-code, not silently shipped as fully functional:** per **E5-F1-T2** (filed separately), the two POST actions enqueue an `OutboxEvent` that nothing currently consumes — wiring them is still correct (harmless, consistent with the rest of the system's current behavior) but they do not yet cause any real downstream effect. A comment in `quotation-timeline.route.ts` makes this explicit so it isn't mistaken for working end-to-end.
- **Testing strategy:** Same approach as E4-F1-T1 — inspects Express's real `Router.stack` on the actual exported route object to confirm all 3 endpoints are registered with the correct controller handlers, then invokes the real wired `authorize(...)` middleware directly to prove 403/401/admission across all 3 routes. A live HTTP+DB integration test (real `getTimeline` output) needs infrastructure this sandbox doesn't have — same limitation as every DB-touching task this session.
- **Rollout plan:** Direct deploy, additive route surface, `SUPER_ADMIN`/`ADMIN` only — unchanged from the original plan.
- **Rollback plan:** Remove the 2-line addition to `routes/index.ts` (or delete `quotation-timeline.route.ts`) — underlying controller/service untouched either way.
- **Acceptance criteria:**
  - [x] Documented decision per controller — `quotation-timeline.controller.ts`: wired. `wallet-transaction.controller.ts`: no action needed, already live (backlog corrected).
  - [x] No dead imports remain — confirmed via `git diff`; no controller/service files were touched, only new routing added.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Investigate whether dashboard frontend references a timeline endpoint | **Done** — zero references found in `dashboard/src`/`auth/src`/`support/src` |
| b | Investigate whether wallet feature has any live data or usage | **Done** — found already wired and consumed; not orphaned, backlog corrected |
| c | Execute decision (wire or delete) per controller | **Done** — wired `quotation-timeline.controller.ts`; no action on `wallet-transaction.controller.ts` |
| d | Confirm zero dangling references post-execution | **Done** — `git diff` confirms no controller/service files touched, only additive routing |

#### E6-F1-T2: Delete dead `queue.service.ts` stub

- **Priority:** P3 · **Status:** Done
- **Discovered:** 2026-08-02, while investigating E5-F1-T1 (correcting that task's dependency note, which referenced `queue.service.ts`/`redis-queue.service.ts` as existing infrastructure to audit).
- **Business value:** `server/src/services/queue.service.ts` is a stub — `export const emailQueue = { add: async () => {} }` / `subscriptionQueue` likewise — with a comment claiming it exists "for compatibility with existing code." Grepped the whole `server/src` tree: **zero imports of this file anywhere.** The compatibility it claims to preserve doesn't need preserving; nothing calls it. Pure dead-code maintenance trap — a future engineer could reasonably assume calling `emailQueue.add()` does something.
- **Engineering effort:** ~10 min · **Regression risk:** Very low — deleting an unreferenced file.
- **Dependencies:** None. Note: `redis-queue.service.ts` is a *different* file, actively used by `live-chat.service.ts`/`socket/support.namespace.ts` for the live-chat support queue (unrelated domain — session waiting-line + agent presence, not job/notification durability) — not part of this task, not orphaned, no action needed there.
- **Exact files:** `server/src/services/queue.service.ts` (delete).
- **Testing strategy:** `npx tsc --noEmit` clean after deletion · grep confirms zero remaining references.
- **Rollout plan:** Direct deploy, no flag.
- **Rollback plan:** `git revert` — trivial, no runtime impact either direction (the file was never called).
- **Acceptance criteria:** [x] File deleted · [x] typecheck clean (`tsc --noEmit` exits 0, full 134-test suite unaffected) · [x] zero remaining references (confirmed via `git diff` — clean single-file deletion, no other file touched).

### E6-F2 — Code Quality Standards

#### E6-F2-T1: Structured logging cleanup (console.* → pino)
- **Priority:** P3 · **Status:** Blocked · **Effort:** 2–3 days · **Risk:** Very low.
- **Blocked reason (2026-08-02):** Not a business/schema/API/architecture block — a scale/practicality one, documented rather than pushed through. Recount confirms 52 files (not 49) contain `console.*` (including 5 standalone CLI scripts under `src/scripts/*.ts` — see scoping note below). `meeting.service.ts` alone has 36 call sites, representative of the pattern across all 52: this isn't a mechanical rename. Pino's `logger.error(mergingObject, message)` is object-first, unlike `console.error(message, ...args)`; a naive `console.X` → `logger.X` rename with unchanged argument order would compile and pass a `zero console.*` grep check while producing unstructured logs disguised as structured ones — the opposite of this task's purpose. Doing this correctly requires per-call-site judgment across ~330 sites, genuinely the 2-3 days this card already estimates, not something to compress into a single pass alongside a dozen other tasks. Picking this up properly means budgeting it as its own dedicated, unhurried pass — likely file-by-file with its own verification per batch, not one commit.
- **Scoping correction, to apply whenever this is picked up:** exclude `src/scripts/*.ts` (5 files: `migrate-relational-data.ts`, `migrate-client-ids.ts`, `delete-fuyad.ts`, `check-duplicate-receipt-groups.ts`, `check-order-asset-encryption.ts`) from the "zero `console.*`" target. These are one-off CLI tools meant for direct terminal use by a developer running them manually — `console.log` is the *correct* choice there, not a violation of this task's intent, and every existing script in this codebase (including two written this session) already uses it that way deliberately. Structured/redacted logging is for the running server process, not developer-facing CLI output. Revise the acceptance criteria to "zero `console.*` in `server/src` outside `scripts/`" when this is scheduled.
- **Exact files:** 47 files (52 minus the 5 scripts above) — see the recount above; the original "49" estimate was close but not exact.
- **Acceptance criteria:** Zero `console.*` in `server/src` outside `src/scripts/`, enforced going forward by an ESLint `no-console` rule folded into E3-F2-T1's CI.

#### E6-F2-T2: Named constants for magic numbers
- **Priority:** P3 · **Status:** Done · **Effort:** 3–4 hrs (actual: ~20 min) · **Risk:** Very low.
- **Investigation performed:** grepped both files for numeric literals in time/tolerance contexts (deliberately excluded HTTP status codes and percentage-division arithmetic — not "magic numbers" in the sense this task means). Found 3: `TOKEN_EXPIRY_DAYS = 30` in `quotation.service.ts` (already a locally-named constant, just not in a shared file), the 5-minute duplicate-quotation idempotency window (a bare `5 * 60 * 1000`), and the 7-day order-asset access window (a bare `7` with only an inline comment). No tolerance-shaped magic numbers found in either file — the payroll ±2 rounding tolerance mentioned elsewhere in this backlog lives in `payroll.service.ts`, outside this task's stated exact files, not pulled in.
- **Exact files:** New `server/src/constants/timing.ts` (`TOKEN_EXPIRY_DAYS`, `DUPLICATE_QUOTATION_WINDOW_MS`, `ASSET_ACCESS_WINDOW_DAYS`); `quotation.service.ts` and `order.service.ts` updated to import and use them.
- **Testing strategy:** New `server/src/constants/__tests__/timing.test.ts` — 3 tests pinning each constant's exact value against the literal it replaced, so this value-preserving refactor can't silently drift. `git diff` reviewed and confirms all 3 numeric values are byte-identical to what they replaced (30, `5 * 60 * 1000`, 7) — no behavior change.
- **Acceptance criteria:** [x] No bare numeric literals for the identified time windows/tolerances remain in `quotation.service.ts`/`order.service.ts`.

#### E6-F2-T3: Fix pre-existing unused-import typecheck errors in `migrate-relational-data.ts`
- **Priority:** P1 · **Status:** Done
- **Discovered:** 2026-08-02, while implementing E3-F2-T1 (Minimal CI). Elevated to P1 (out of step with its E6-F2 siblings, which are P3) because it was a concrete, immediate blocker: `npx tsc --noEmit` — the exact command the CI workflow runs — exited non-zero on `main` because of this, independent of any other work.
- **Business value:** Restores "clean `main` passes" as actually true, so the CI gate is meaningful from the next push onward instead of permanently red for an unrelated reason.
- **Engineering effort:** ~15 min (actual: ~15 min) · **Regression risk:** Very low — confirmed via `git diff`: a pure 4-line import deletion, no other line touched.
- **Dependencies:** None.
- **Investigation performed before fixing (per process — this task was filed without investigation, investigated now):** grepped the file for `QuotationModel`, `OrderModel`, `OrderTaskModel`, `ReceiptModel` — each identifier appears exactly once, on its own `import` line, with zero references anywhere in the function body. The script performs all its reads/writes via `mongoose.connection.db.collection('quotations'/'orders'/'ordertasks'/'receipts')` (raw driver access to pre-migration collection shapes), not via these Mongoose models — so these 4 imports were dead from the start, not a stale reference to logic that moved. The remaining 7 model imports (`QuotationServiceModel`, `QuotationLineItemModel`, `QuotationMilestoneModel`, `OrderAssetModel`, `OrderStatusHistoryModel`, `SubtaskModel`, `ReceiptPaymentModel`) are all genuinely used to write the new relational rows and were left untouched.
- **Exact files:** `server/src/scripts/migrate-relational-data.ts` — removed the 4 unused imports (originally lines 5, 10, 14, 17: `QuotationModel`, `OrderModel`, `OrderTaskModel`, `ReceiptModel`).
- **Testing strategy:** No new automated test — this is a dead-import deletion in a one-off migration script with no behavior change (the removed identifiers were never referenced, so there is nothing to unit-test; the script's live runtime behavior is unaffected by construction, and this sandbox has no network path to a real MongoDB to exercise the script end-to-end, same constraint noted on every DB-touching task this session). Verified instead: `npx tsc --noEmit` in `server/` exits 0 with no output (was exit 2 with 4 errors before); full existing suite (`node --import tsx --test src/**/__tests__/*.test.ts`) still 64/64 passing, confirming zero regression elsewhere.
- **Rollout plan:** Direct deploy, no flag — pure dead-code removal.
- **Rollback plan:** `git revert` — trivial, no data/runtime impact either direction (the imports were unused, so restoring them is also a no-op at runtime).
- **Acceptance criteria:**
  - [x] `npx tsc --noEmit` clean in `server/` — verified, exit 0, no output.
  - [x] CI (E3-F2-T1) goes green on `main` — E3-F2-T1's third acceptance criterion ("clean build passes") is now met using this exact command; see that task's updated card.
  - [x] Script's intended behavior preserved — confirmed by inspection: the 4 removed imports had zero references in the file, so the script's actual logic (raw-collection reads + the 7 still-used model writes) is byte-for-byte unchanged aside from the import list.

---

## 9. E7 — Quality Engineering

### E7-F1 — Automated Test Coverage

#### E7-F1-T1: Test framework + state-machine test suite
- **Priority:** P2 (start in parallel with P0/P1 — it's additive and never blocks) · **Status:** Deferred
- **Deferral reason (2026-08-02):** Investigated ahead of implementation — introduces a new test framework (`vitest`, alongside the existing `node --test` suites) and a new heavyweight dev dependency (`mongodb-memory-server`) that downloads and runs a real MongoDB binary. This is an architecture decision, not mechanical work, per this session's explicit workflow rule to pause for approval on framework/architecture changes. Network probes suggest it's technically feasible in this environment (npm registry reachable, MongoDB binary host responds) — unlike every other DB-dependent task this session — which is worth revisiting specifically for that reason. Deferred, not abandoned: re-pick this up when ready to make that architecture call; doing so would also unblock several already-`Done*` tasks' open live-DB follow-ups (E1-F1-T1, E1-F3-T1, E4-F1-T1, E1-F2-T1, E6-F1-T1).
- **Business value:** The highest-leverage structural investment on the backlog — every other Task on this document is verified by manual QA today; this is the safety net that makes every future change cheaper and safer.
- **Engineering effort:** 4–6 days · **Regression risk:** Low — purely additive, cannot regress production by definition.
- **Dependencies:** Best sequenced after E1-F1-T1 (test the *fixed* order state machine, not the bug). Benefits from E3-F2-T1 (CI) existing.
- **Exact files:** new `server/vitest.config.ts`, new `server/src/services/__tests__/*.test.ts`, likely new dev dependency `mongodb-memory-server`.
- **Testing strategy (of this task itself):** Priority coverage order — (1) Quotation transitions, (2) Order transitions post-fix, (3) `createOrderFromQuotation` idempotency, (4) `createNewVersion` idempotency key, (5) Receipt payment math, (6) `computeWorkDayStats`.
- **Rollout plan:** Additive, ship incrementally per coverage area.
- **Rollback plan:** N/A — tests don't deploy to production.
- **Acceptance criteria:** Framework runs in CI on every PR · all 6 priority areas covered · testing convention documented.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Stand up Vitest + `mongodb-memory-server` | Not Started |
| b | Quotation state machine tests | Not Started |
| c | Order state machine tests (post E1-F1-T1) | Not Started |
| d | Idempotency tests (order creation, quotation versioning) | Not Started |
| e | Receipt payment ledger tests | Not Started |
| f | `computeWorkDayStats` tests (post E1-F2-T1) | Not Started |
| g | Wire test run into CI, document convention | Not Started |

---

## 10. E8 — API Platform Maturity

### E8-F1 — API Versioning & Documentation

#### E8-F1-T1: API versioning + OpenAPI spec
- **Priority:** P3 · **Status:** Not Started · **Effort:** 3–5 days · **Risk:** Low.
- **Dependencies:** Highest ROI once the API surface stabilizes post P0–P2 work — don't document endpoints about to change shape.
- **Exact files:** `routes/index.ts` (`/api/v1` prefix, `/api` kept as backward-compat alias), new OpenAPI spec file.
- **Acceptance criteria:** All routes reachable under `/api/v1` · spec published · existing `/api` consumers unaffected.

### E8-F2 — Performance Optimization

#### E8-F2-T1: Redis cache for reference-data reads
- **Priority:** P3 · **Status:** Not Started · **Effort:** 2–3 days · **Risk:** Medium (cache invalidation).
- **Exact files:** New cache-aside wrapper around `client.service.ts`, `service.service.ts`, `currency-rate.service.ts`.
- **Rollout plan:** Ship behind a feature flag so it can be disabled without a code revert if staleness appears.
- **Acceptance criteria:** Measurable latency improvement · zero observed staleness after a week of staging soak.

#### E8-F2-T2: Compression middleware + cursor pagination
- **Priority:** P3 · **Status:** Blocked (split — see below)
- **Split rationale (2026-08-02):** This card bundles two pieces with different risk profiles. Compression is transparent to clients (negotiated via `Accept-Encoding`/`Content-Encoding`, no response shape change) — implemented directly, no stop condition applies. Cursor pagination adds a new query parameter and response shape (a `nextCursor` field) to existing list endpoints — a public API change, matching the stop condition. Implemented the first, stopped before the second, rather than either rushing an API design or leaving the safe half undone waiting on the other.
- **Compression — Done:** Added the `compression` npm package (+ `@types/compression`) and `app.use(compression())` in `server/src/app.ts`, placed after `helmet` and before the global rate limiter. Gzips/deflates response bodies above the package's default 1KB threshold. **Verification:** `tsc --noEmit` clean, full 137-test suite unaffected (expected — no application logic touched). Could not boot the actual app to verify live compression end-to-end: importing `app.ts` triggers a real MongoDB connection attempt via `lib/auth.ts` at module load time, the same constraint documented on E3-F1-T1 back near the start of this session. Verified via code review instead — `compression()` is a standard, widely-used Express middleware; the registration point (after `helmet`, before routes) is correct and matches its documented usage. A live check (e.g. `curl -H "Accept-Encoding: gzip" ... -I`) is an open follow-up for whoever can run this against a real server.
- **Cursor pagination — not implemented, pending your input:** Needs a design decision (which field to cursor by per endpoint, cursor encoding scheme, response shape for `nextCursor`) before implementation — a public API change, not something to default my way past.
- **Exact files (compression only, this pass):** `server/src/app.ts`, `server/package.json`, `server/package-lock.json`.
- **Acceptance criteria:** [x] Compression active above a size threshold (implemented, unverified live per above) · [ ] Cursor pagination available as opt-in on at least one high-traffic endpoint — not implemented, pending API design approval.

---

## 11. Architecture Decisions Log

*Populated as Tasks that touch architecture/cross-cutting conventions complete. Empty at initial creation — this section exists so future decisions (e.g. "AuditLog is canonical, OrderStatusHistory is a projection" from E4-F2-T1, or "AWS/Gemini env vars are soft-warn not hard-fail" from E2-F2-T1) have a permanent home instead of living only in a PR description that gets harder to find over time.*

| Date | Decision | Driving Task | Rationale |
|---|---|---|---|
| — | *(none yet)* | — | — |

---

## 12. Change Log

| Date | Change | By |
|---|---|---|
| 2026-08-01 | Initial backlog created from Audit Report + Execution Roadmap. 22 Tasks across 8 Epics. | Principal Engineer review |
| 2026-08-01 | E1-F1-T1 implemented: order status transitions now enforced via `assertValidOrderTransition()` in `order.service.ts`. 41 unit tests passing, typecheck clean. Marked `Done*` — Subtask (d), the HTTP/DB-level integration test, is `Blocked` on E7-F1-T1 test infrastructure (no DB test harness exists yet) rather than completed or silently dropped. No other backlog item touched. | Principal Engineer review |
| 2026-08-01 | Frontend+backend caller audit for E1-F1-T1 (requested separately): confirmed no caller — UI or backend — depends on idempotent self-transitions; self-transition rejection is safe. Discovered, and filed as new task **E1-F1-T2**: `orders/page.tsx`'s status dropdown intentionally offers "any status" with no workflow filtering, contradicting `ALLOWED_STATUS_TRANSITIONS` now enforced server-side — a real, user-visible regression from E1-F1-T1, not yet fixed. | Principal Engineer review |
| 2026-08-01 | E2-F1-T1 implemented: `QuotationService.getQuotations` and `ReceiptService.getReceipts` now escape user search input via `escapeRegex()` before building `$regex` clauses, closing the ReDoS gap. 9 new unit tests (normal/metacharacter/injection-payload coverage), full suite 50/50 passing, typecheck clean. Marked fully `Done` — no blocked subtasks. No other backlog item touched. | Principal Engineer review |
| 2026-08-01 | E2-F2-T1 implemented: `ENCRYPTION_KEY` added to `env.config.ts`'s hard-required `requiredVars`; `AWS_*`/`GEMINI_API_KEY` documented and implemented as soft-warn (startup `console.warn`, non-blocking), decision rationale recorded in-code. 6 new isolated-child-process tests, full suite 56/56 passing, typecheck clean. Corrected the original task framing during pre-implementation tracing: the "silent mid-request crash" characterization was likely imprecise (reasoning-based, not execution-verified) — static ESM imports mean the failure most likely already happened at process load, just via a worse error message; this task's real value is a clearer, earlier, consistently-formatted failure, not fixing a previously-working app. Subtask (c) partially closed: confirmed `ENCRYPTION_KEY` present in this repo's `server/.env` (key presence only); no visibility into any separate production secret store, flagged as an open pre-deploy item for whoever ships there. No other backlog item touched. | Principal Engineer review |
| 2026-08-01 | E3-F1-T1 implemented: `GET /healthz` (reflects `mongoose.connection.readyState`) added to `app.ts`; `SIGTERM`/`SIGINT` graceful-shutdown wired in `server.ts` via new `createGracefulShutdown()` factory in `lib/gracefulShutdown.ts`. Both pieces of decision logic extracted into small dependency-free/injectable modules (`lib/health.ts`, `lib/gracefulShutdown.ts`) specifically to make them testable without a real DB connection or a real `process.exit` — same sandbox network constraint hit on every task this session. 8 new tests, including a deterministic hung-connection test that proves the bounded-timeout forced-exit actually fires within the configured window (not just asserted to exist). Full suite 64/64 passing, typecheck clean, `git diff` confirmed strictly additive in both touched files. Marked `Done*` — Subtask (c) substituted a live manual SIGTERM test (not possible in this sandbox) with a stronger deterministic automated equivalent; a true end-to-end test against a running deployment is flagged as a still-open follow-up. No other backlog item touched. | Principal Engineer review |
| 2026-08-02 | E1-F1-T2 implemented (first frontend/`dashboard` change of this backlog): extracted the order-status transition table into a single shared `dashboard/src/constants/orderStatusWorkflow.ts`, removed both pages' local copies (one already-correct, one the broken "no workflow restriction" version), both now import the same function. 7 new tests, `tsc --noEmit` clean across the whole dashboard app, and a live Next.js dev server confirmed the new import resolves cleanly (`GET /orders 200`, no console errors) — a practical check beyond what was required. Initial version added `allowImportingTsExtensions: true` to `dashboard/tsconfig.json` to support the test file's import; documented in-task, not silently added. Marked `Done*` — 2 of 3 acceptance criteria fully verified; the third ("manual click-through produces no unexpected 409s") is partially verified (compile-time + unit-test level) but not a live authenticated click-through, since this sandbox has no reachable backend — same limitation noted on every task this session, flagged as an open follow-up rather than claimed complete. No other backlog item touched. | Principal Engineer review |
| 2026-08-02 | E1-F1-T2 revised per reviewer request: removed `allowImportingTsExtensions` from `dashboard/tsconfig.json` (confirmed byte-identical to its original state via `git diff`) and rewrote `orderStatusWorkflow.test.ts` as `orderStatusWorkflow.test.mjs` — a plain `.mjs` file falls outside `tsconfig.json`'s `include` globs entirely, so `tsc` never parses it or its `.ts`-suffixed import specifier, while `node --test` still runs it directly against the real module. No project-wide configuration changed. Caught and fixed one incidental bug during the rewrite: the original comment's literal `**/*.ts`/`**/*.tsx` text embedded `*/`, prematurely closing the doc comment and causing a real syntax error, unrelated to the module-format question — reworded to avoid the sequence. 7/7 tests still passing, `tsc --noEmit` clean, `git diff` confirms only the test file and the two page files (from the original implementation) changed. No other backlog item touched. | Principal Engineer review |
| 2026-08-02 | Full P0 integration review performed (review only, no code changed): no conflicts, no new duplication, no API/contract/security/performance regressions found. Two real governance findings surfaced and separately actioned per explicit follow-up request: `ENGINEERING_BACKLOG.md` was gitignored and untracked (fixed — `.gitignore` line removed, file committed as `3d65200`), and the 3 remaining uncommitted P0 tasks were split into one clean commit each (`94dbe56` E2-F2-T1, `958c042` E3-F1-T1, `757b4f9` E1-F1-T2) without touching the 2 pre-existing commits. | Principal Engineer review |
| 2026-08-02 | E3-F2-T1 implemented: new `.github/workflows/ci.yml` — typecheck-only gate (`npx tsc --noEmit` in `server/`) on push/PR to `main`, Node 24, scoped to backend only. Deliberately does not run the existing `node --test` suites yet, per this task's own dependency note that test execution is earmarked for E7-F1-T1. Verified the fail path directly (exit code 2 against real pre-existing errors) since no live GitHub Actions run could be triggered from this environment; the pass path is backed by consistent same-command evidence across every prior task this session. Discovered mid-task that the gate's own command currently fails on `main` due to 4 pre-existing, unrelated `noUnusedLocals` errors in `migrate-relational-data.ts` — filed as new task **E6-F2-T3** (P1, elevated from its P3 siblings since it's now a concrete CI blocker) rather than fixed here. Marked `Done*` — 2 of 3 acceptance criteria met; "clean build passes" is blocked by E6-F2-T3, not by any defect in this task. No other backlog item touched. | Principal Engineer review |
| 2026-08-02 | E6-F2-T3 implemented: removed 4 dead imports (`QuotationModel`, `OrderModel`, `OrderTaskModel`, `ReceiptModel`) from `server/src/scripts/migrate-relational-data.ts`. Investigated before fixing (task was filed without investigation per process): confirmed all 4 identifiers had zero references anywhere in the file — the script reads/writes via raw `mongoose.connection.db.collection(...)` calls, not these Mongoose models — so this was pure dead-code removal, not a case of "wire vs. delete." `npx tsc --noEmit` in `server/` now exits 0 with no output (was exit 2/4 errors before); full existing test suite still 64/64 passing (zero regressions, as expected since nothing referencing these imports could have depended on them). `git diff` confirmed a clean 4-line deletion, no other line touched. All 3 acceptance criteria met, task marked fully `Done`. As a direct consequence, **E3-F2-T1's third acceptance criterion ("clean build passes") is now also met** — that task is updated from `Done*` to fully `Done` in this same change, since its own work was already complete and the only gap was this external blocker. No other backlog item touched. | Principal Engineer review |
| 2026-08-02 | E4-F1-T1 implemented: gave the Outbox pattern an HTTP admin surface. New `server/src/routes/outbox.route.ts` wires `GET /`, `GET /:id`, `POST /replay`, `POST /:id/replay` to the already-implemented `OutboxService`/`OutboxController`, each gated by `authorize(Role.SUPER_ADMIN, Role.ADMIN)` (existing codebase idiom, not a new pattern). Registered in `routes/index.ts` under `/outbox`. Subtask (a) verification confirmed `outbox.controller.ts` already matched `OutboxService`'s current interface exactly — no adjustment needed, contrary to the task's precautionary framing. 28 new tests inspect Express's real `Router.stack` on the actual exported route object, confirming all 4 endpoints are registered with the correct controller handlers, then invoke the real wired `authorize(...)` middleware instance directly to prove 403 for 3 non-admin roles, 401 for unauthenticated, and admission for both admin roles, across all 4 routes. Full suite 96/96 passing, typecheck clean, `git diff` confirmed strictly additive (one new route file, a 2-line addition to `routes/index.ts`, no existing controller/service logic touched). Marked `Done*` — the live HTTP+DB integration test specified in the backlog (real list/replay against real data) needs infrastructure this sandbox doesn't have (no network path to Mongo, no DB test harness — E7-F1-T1's scope), flagged as an open follow-up rather than assumed passing. No other backlog item touched. | Principal Engineer review |
| 2026-08-02 | E1-F3-T1 implemented: closed the Receipt zero-payment check-then-create race. `receipt.model.ts`'s `quotationGroupId` field changed from a plain index to `unique: true`, enforcing the 1:1 quotation-group↔receipt invariant at the DB level. `receipt.service.ts`'s `createZeroPaymentReceipt` now wraps `receipt.save()` in a try/catch that, on Mongo `E11000`, re-queries and returns the concurrent winner idempotently instead of throwing — mirroring the existing `outbox.service.ts` duplicate-key idiom rather than inventing a new pattern. New read-only `server/src/scripts/check-duplicate-receipt-groups.ts` operationalizes the required pre-deploy production duplicate check (Subtask a) for whoever has DB access, since this sandbox has no network path to production to run it directly — same constraint noted on every DB-touching task this session. 4 new deterministic unit tests (monkey-patched `ReceiptModel.findOne`/`.prototype.save`/`InvoiceCounter.findByIdAndUpdate`) prove the catch-and-retry logic resolves races idempotently, propagate non-`11000` errors unchanged, leave the no-race happy path unaffected, and leave the pre-existing early-return-on-`findOne` path untouched. Full suite 68/68 passing, typecheck clean, `git diff` confirmed isolated to the two intended files plus the two new files. Marked `Done*` — Subtask (a)/(b), the actual production duplicate-data check and any needed reconciliation, remain an explicit open pre-deploy gate, not silently assumed clean; the unique index should not be allowed to go live until that check passes. No other backlog item touched. | Principal Engineer review |
| 2026-08-02 | E1-F2-T1 implemented: extracted `computeWorkDayStats()` into new `server/src/services/payroll-calculation.util.ts`, a pure function taking already-fetched data, and wired it into all three duplicated call sites (`getPayrollPreview`, `processPayroll`, `getAbsentDates` in `payroll.service.ts`). Per this task's own instruction to stop if the three implementations weren't behaviorally identical: found a real structural difference (single-pass vs. two-pass unemployed-check ordering in `getAbsentDates`), proved it doesn't change behavior (AND is commutative over the same boolean conditions), and encoded that proof as an executable test — an independent re-implementation of the old two-pass algorithm asserted equivalent to the new function's output across multiple fixtures — rather than just asserting it in a comment. One incidental dead-code removal in `processPayroll` (an unread `workDaysCount` local, confirmed via `git show HEAD` to have been dead before this change too, just disguised as "used" by an increment operator) was necessary to satisfy `noUnusedLocals` and is documented as a direct consequence of the extraction, not scope creep. 17 new unit tests (edge cases + the equivalence proof), full suite 113/113 passing, typecheck clean, `git diff` reviewed — only the day-counting loops replaced, all surrounding fetch/fallback/composition logic at each call site untouched. Marked `Done*` — the backlog's specified live-DB before/after snapshot test isn't executable in this sandbox (no network path to Mongo, same limitation as every DB-touching task this session); the unit-test matrix plus the equivalence proof are the substitute evidence, with a live-data run flagged as an open follow-up. No other backlog item touched. | Principal Engineer review |
| 2026-08-02 | Investigated E6-F1-T1 (wiring up `quotation-timeline.controller.ts`) and, before implementing, traced its two admin actions' `OutboxService.enqueue()` calls back to the consumer side of the Outbox pattern. Found `claimNext()`/`markProcessed()`/`markFailed()` have zero callers anywhere in the codebase, confirmed via full-tree grep, a review of the only in-process job runner (`scheduler.service.ts`, 6 unrelated jobs), `package.json` (one entrypoint, no worker script), and git history (no evidence a consumer ever existed and was removed). The Outbox pattern has been write-only since its introduction — the one live producer, `quotation.service.ts`'s `quotation.superseded` event, has never triggered any downstream effect, and the intended effect is unknown (no consumer stub exists to infer it from). This also means the E4-F1-T1 replay API I shipped only resets a status field rather than reprocessing anything. Filed as new task **E5-F1-T2** (P1, under Epic E5/Feature F1) per governance rule 6 — investigation and full task card only, no code written or modified. Recommends a two-phase rollout (product decision on `quotation.superseded`'s intended behavior, then a minimal single-event-type consumer) rather than jumping directly to a generalized dispatcher, to avoid building for an unconfirmed requirement — the same discipline applied on E2-F3-T1. No other backlog item touched, no application code modified. | Principal Engineer review |
| 2026-08-02 | E6-F1-T1 implemented: new `server/src/routes/quotation-timeline.route.ts` wires `GET /:quotationGroupId`, `POST /:quotationGroupId/replay`, `POST /:quotationGroupId/regenerate-link` to the already-implemented `QuotationTimelineController`, admin-gated via `authorize(Role.SUPER_ADMIN, Role.ADMIN)` (same idiom as E4-F1-T1's `outbox.route.ts`). Registered in `routes/index.ts` under `/quotation-timeline`. Investigation corrected the task's original premise: `wallet-transaction.controller.ts` was found already fully wired in `staff.route.ts` and consumed by the dashboard — not orphaned, no action taken, backlog corrected. The two POST actions are documented in-code (per E5-F1-T2) as enqueue-only until a consumer exists, so they aren't mistaken for fully functional. 21 new tests (router-stack registration + real wired `authorize(...)` middleware invocation, mirroring E4-F1-T1's approach), full suite 134/134 passing, typecheck clean, `git diff` confirmed strictly additive — no controller/service files touched. Marked `Done*` — the live HTTP+DB integration test for `getTimeline` needs infrastructure this sandbox doesn't have, same limitation as every DB-touching task this session. Committed separately from the E5-F1-T2 backlog-filing commit, per one-commit-per-task discipline. No other backlog item touched. | Principal Engineer review |
| 2026-08-02 | E7-F1-T1 marked `Deferred` (not implemented): investigated ahead of implementation and found it requires an architecture decision — a new test framework (`vitest`) alongside the existing `node --test` suites, plus a new heavyweight dev dependency (`mongodb-memory-server`) that downloads and runs a real MongoDB binary. Per this session's workflow rule to pause for approval on framework/architecture changes, presented the plan and deferred rather than proceeding unapproved. Network probes suggest this may actually be feasible in this sandbox (npm registry reachable, MongoDB binary host responds) — unlike every other DB-dependent task this session — noted in the task card as a reason to revisit it specifically, not lump it in with the general "no DB access" limitation. No code changed. | Principal Engineer review |
| 2026-08-02 | E3-F3-T1 implemented: new `server/Dockerfile` (multi-stage, Node 24, `PUPPETEER_SKIP_DOWNLOAD=true` to avoid headless-Chrome dependency complexity — PDF-generation endpoints documented as non-functional in this container, not silently broken), new `docker-compose.yml` (Mongo as a single-node replica set via a one-shot `rs.initiate()` init service, Redis, and the server running `npm run dev` with source bind-mounted for hot reload), new `server/.dockerignore`, and a new "Docker Compose" option added to `README.md` ahead of the existing manual setup (kept, unmodified, as "Option B"). Checked the environment first: `docker` CLI is present but no daemon is running here (`docker ps` fails) — a genuine execution limitation, not one of the four stop conditions, so proceeded with authoring the files. Verified what was possible: `docker compose config` validates the file's structure cleanly; `tsc --noEmit` and the full 134-test suite confirm zero impact on application code (expected — no app code was touched). **Not verified:** actually running `docker-compose up`, and the task's own specified acceptance criterion (the quotation→order→receipt transactional flow succeeding against the containerized replica-set Mongo) — flagged as an explicit open follow-up, not assumed working. Marked `Done*`. No other backlog item touched. | Principal Engineer review |
| 2026-08-02 | Investigated E5-F1-T1 (BullMQ notification migration) ahead of implementation and found its own dependency note was stale in two ways, corrected here rather than left standing. First, `queue.service.ts`/`redis-queue.service.ts` **do exist** (an earlier claim this same session that they didn't was wrong — a search error, corrected now). Second, neither is usable infrastructure for this task: `queue.service.ts` is a dead stub (`emailQueue`/`subscriptionQueue` with a no-op `.add()`, zero callers anywhere) — filed as new task **E6-F1-T2** (P3) to delete it, not fixed here per governance rule 6. `redis-queue.service.ts` is real and actively used, but for an unrelated domain (the live-chat support waiting-queue + agent presence), not job/notification durability. `bullmq` remains an installed, entirely unused dependency. Net effect: E5-F1-T1 is more greenfield than its card implied — there is no existing queue infrastructure to build on. No code implemented for E5-F1-T1 itself yet; its own investigation report follows separately. | Principal Engineer review |
| 2026-08-02 | E6-F1-T2 implemented: deleted `server/src/services/queue.service.ts` — confirmed zero references anywhere in `server/src` before removing it (the only similarly-named matches were the unrelated, actively-used `redis-queue.service.ts`). `tsc --noEmit` clean, full 134-test suite unaffected, `git diff` confirmed a clean single-file deletion. All 3 acceptance criteria met, marked fully `Done`. | Principal Engineer review |
| 2026-08-02 | Presented investigation + implementation plans for E5-F1-T1, E1-F2-T2, and E4-F2-T1 and stopped before implementing any of them, per the explicit instruction to pause only for a business decision, DB schema change, public API change, or architecture decision — all three qualify: E5-F1-T1 requires a greenfield BullMQ architecture (plus an unresolved in-process-vs-separate-worker topology question); E1-F2-T2 requires designing a new response contract/status code (public API change) and has an unresolved frontend-coordination dependency outside this session's scope; E4-F2-T1 is explicitly a "decision-first task" per its own card, requiring a canonical-vs-projection architecture call before any code can be scoped. No code written for any of the three. Proceeded past them in priority order to the P2-cleared, P3 tier. | Principal Engineer review |
| 2026-08-02 | E6-F2-T1 marked `Blocked` (not implemented, not silently skipped): recounted `console.*` usage at 52 files (was 49), and read through `meeting.service.ts` (36 sites) as a representative sample. Concluded this is not a mechanical rename — pino's `logger.error(mergingObject, message)` is object-first, unlike `console.error(message, ...args)`, so correctly converting ~330 call sites requires per-site judgment on what belongs in the merging object, not a find-and-replace that would pass a "zero `console.*`" grep while producing unstructured logs disguised as structured ones. This is the backlog's own already-estimated 2-3 days of work, not something to compress into one pass alongside a dozen other tasks in a single session turn. Also corrected the task's scope: excluded `src/scripts/*.ts` (5 one-off CLI tools, including two written this session) from the "zero console.*" target, since `console.log` is the deliberately correct choice for direct-terminal-use scripts, not a violation of this task's intent — revised acceptance criteria accordingly. No code changed. This is a scale/practicality block, distinct from the four business/schema/API/architecture stop conditions, documented explicitly as such rather than conflated with them. | Principal Engineer review |
| 2026-08-02 | E3-F4-T1 marked `Deferred`: its own business-value note already states the trigger condition ("only matters once the app runs multiple instances"), and whether production currently runs multiple instances is a deployment-topology fact with no visibility from code — a business/infrastructure question, not something to guess at or build speculatively ahead of. No code changed. | Principal Engineer review |
| 2026-08-02 | Presented investigation for E8-F2-T1 (Redis cache — requires designing a cache-invalidation architecture, not decided here) and E4-F3-T1 (TTL/retention — requires a business-approved retention window, irreversible once enabled, and depends on E4-F2-T1's not-yet-made canonical-vs-projection decision) and stopped before implementing either, matching the architecture/business-decision stop conditions. No code written for either. | Principal Engineer review |
| 2026-08-02 | E6-F2-T2 implemented: new `server/src/constants/timing.ts` (`TOKEN_EXPIRY_DAYS`, `DUPLICATE_QUOTATION_WINDOW_MS`, `ASSET_ACCESS_WINDOW_DAYS`), replacing the 3 time-window magic numbers found in `quotation.service.ts`/`order.service.ts` (deliberately excluded HTTP status codes and percentage-division arithmetic — not "magic numbers" in the sense this task means; also confirmed no tolerance-shaped magic numbers exist in either file, the payroll ±2 tolerance mentioned elsewhere in this backlog lives in a different file outside this task's stated scope). All 3 extracted values confirmed byte-identical to what they replaced via `git diff`. 3 new tests pin each constant's exact value. Full suite 137/137 passing, typecheck clean. All acceptance criteria met, marked fully `Done`. No other backlog item touched. | Principal Engineer review |
| 2026-08-02 | Presented investigation for E8-F1-T1 (API versioning — literally restructures the public route surface with an `/api/v1` prefix, 3-5 days) and stopped before implementing, matching the public-API-change stop condition. | Principal Engineer review |
| 2026-08-02 | E8-F2-T2 split and partially implemented: compression is transparent to clients (no response shape change), so no stop condition applied — added the `compression` package and `app.use(compression())` in `app.ts` after `helmet`, before the global rate limiter. `tsc --noEmit` clean, full 137-test suite unaffected. Could not boot the actual app to verify live (importing `app.ts` triggers a real MongoDB connection via `lib/auth.ts` at module load — the same constraint documented on E3-F1-T1 near the start of this session); verified via code review instead (standard middleware, correct registration point) and flagged a live check as an open follow-up. Cursor pagination — the task's other half — was **not** implemented: it adds a new query parameter and response shape to existing list endpoints, a public API change requiring a design decision (cursor field per endpoint, encoding scheme, response shape) not made here. Task marked `Blocked`, not `Done`/`Done*`, since one of its two acceptance criteria is unmet pending your input. This is the last task in the executable P3 tier — every remaining `Not Started` item in the backlog now requires a business/schema/API/architecture decision from you; the autonomous execution pass ends here for this session. | Principal Engineer review |
| 2026-08-02 | E2-F3-T1 marked `Closed` (not `Deferred`), by owner decision: production verification confirmed zero `OrderAsset` documents exist and no write path in the codebase creates them, so no migration is required; encryption will be built alongside any future `OrderAsset` creation feature rather than speculatively ahead of one. The read-only investigation script used to reach this conclusion (`server/src/scripts/check-order-asset-encryption.ts`) was deleted rather than committed, per instruction — it served its one-time purpose. No application code changed; this is a backlog-only update (task card, dashboard row, completion summary, status-values legend). | Owner decision |
| 2026-08-02 | E5-F1-T2 architecture proposal (producer audit, event lifecycle, sync/async classification, in-process-vs-separate-process worker recommendation, BullMQ integration path) presented and reviewed. Owner approved proceeding with **Phase 1a (worker infrastructure) only**, explicitly excluding all business handler behavior and explicitly retaining `admin.outbox.replay` as a producer (the proposal's recommendation to drop it stands as a recommendation only, not actioned). Implemented: new `server/src/services/outbox-worker.service.ts` (injectable claim/dispatch/mark-processed/mark-failed core, unit-tested without a live DB; real wiring layer polls every 5s via a new `OUTBOX_POLL_INTERVAL_MS` constant in `constants/timing.ts`, draining up to 10 events/tick). Placeholder handlers registered for all three currently-produced event types — each throws rather than silently succeeding, so claimed events retry/backoff/dead-letter exactly like a real failing handler, keeping the dispatch path honest about doing no real work yet. `scheduler.service.ts` registers the worker in `startAllSchedulers()`/`stopAllSchedulers()` (the latter changed sync → async to await the worker's shutdown). **Side-fix required by this task's own "respect graceful shutdown" scope:** `stopAllSchedulers()` was previously never called anywhere, including on `SIGTERM`/`SIGINT` — `server.ts`'s `closeResources` only closed Mongo. Wired `await schedulerService.stopAllSchedulers()` into `closeResources` ahead of the Mongo close; this also benefits the 6 pre-existing scheduler jobs, not just the new worker, since graceful shutdown could not be respected for any of them without it. 14 new unit tests, full suite 151/151 passing, typecheck clean, `git diff` confirmed no producer call site, route, controller, or public API contract touched. Task moved from `Not Started` to `In Progress` — Phase 1b (business handlers per event type) remains blocked on the same product decision surfaced in the design proposal. | Owner-approved Phase 1 |
| 2026-08-02 | E5-F1-T2 Phase 1b investigation (business intent, per event, using only the existing codebase — no guessing): `admin.quotation.regenerate_link`'s intent was fully provable (`QuotationService.sendQuotation()` already does exactly this synchronously elsewhere; the admin endpoint's own `202` response already promised it). `admin.outbox.replay`'s intent was also provable but showed the event itself was unnecessary — it only ever wrapped a synchronous, idempotent `OutboxService.replayMany()` call the sibling `/outbox/replay` route already makes directly, and a full frontend grep confirmed neither `replay` nor `regenerate-link` has any caller in `dashboard/src` today, so nothing depends on the async contract. `quotation.superseded`'s intent could **not** be proven — no code anywhere reacts to it, and the only plausible reading (notify staff) would require extending `NotificationModel`'s closed `type` enum, a schema change with no sign-off — flagged as a missing product decision rather than guessed at. Owner approved implementing the two proven events only. Implemented: `outbox-worker.service.ts` gained a real `admin.quotation.regenerate_link` handler (resolves `quotationGroupId` → latest quotation, calls `QuotationService.sendQuotation()` unchanged, zero duplicated logic) and dropped the `admin.outbox.replay` placeholder entirely; `quotation-timeline.controller.ts`'s `requestReplay()` no longer enqueues an Outbox event — it resolves failed/dead-lettered ids for the group (or uses explicit `ids`) and calls `OutboxService.replayMany()` directly, with its response changing from `202` + `outboxEventId` to `200` + `{ replayedCount, ids }` (documented change, not silently equivalent). `quotation-timeline.route.ts`'s stale comment corrected. `quotation.superseded` left exactly as its Phase 1a placeholder — no notification logic invented. New `quotation-timeline-controller.test.ts` (4 tests, monkey-patch pattern matching E1-F3-T1's) plus 3 net-new tests in `outbox-worker.test.ts` (regenerate-link handler's 4 scenarios plus re-confirming `quotation.superseded`'s placeholder and `admin.outbox.replay`'s removal). Full suite 158/158 passing, typecheck clean, `git diff` confirmed no schema change, no producer/route touched beyond the two in scope. | Owner-approved Phase 1b (evidence-only) |

---

## 13. Sequencing Guidance (unchanged from the Execution Roadmap, restated for reference)

```
Week 1:     E1-F1-T1, E2-F1-T1, E2-F2-T1, E3-F1-T1   (all P0, ship independently as each finishes)
Week 2:     E3-F2-T1 → E4-F1-T1 → E1-F3-T1
Week 2-3:   E1-F2-T1  (start E7-F1-T1 in parallel — it's additive)
Week 3-4:   E2-F3-T1  (highest-risk item — give it dedicated room)
Week 4-6:   E7-F1-T1 continues, E3-F3-T1, E6-F1-T1
Week 6-8:   E1-F2-T2 (coordinate with frontend), E4-F2-T1
Week 8+:    E5-F1-T1, then P3 backlog opportunistically
```

If a second engineer joins, pull **E3-F3-T1 (Docker)** forward immediately regardless of the above sequencing — it is the single highest-leverage item for onboarding speed and is scheduled late here only because a solo developer needs it less urgently than the P0 security/integrity items.
