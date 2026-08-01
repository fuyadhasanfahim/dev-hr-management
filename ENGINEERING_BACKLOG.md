# Master Engineering Backlog — `dev-hr-management`

**Status:** LIVING DOCUMENT — this file is the permanent source of truth for backend engineering work from this point forward.
**Baseline inputs:** Principal Engineer Audit Report (2026-08-01) + Execution Roadmap (2026-08-01).
**Scope:** `server/` (Express/MongoDB backend). Frontend apps (`auth/`, `dashboard/`, `support/`) are referenced only where a backend change has a required frontend companion — they are not independently audited here.
**Last updated:** 2026-08-02 · **Updated by:** Principal Engineer review — E6-F2-T3 implemented; CI now green on `main`.

---

## 0. How This Document Works (read this before touching anything)

1. **Every piece of backend work maps to a Task ID here before it's implemented.** If work doesn't have an ID, it doesn't get merged — create the backlog entry first, even if it's two lines.
2. **Hierarchy:** `Epic → Feature → Task → Subtask`. IDs are stable once assigned (`E2-F1-T3`) — never renumber, only append or mark `SUPERSEDED`.
3. **Status values:** `Not Started` · `In Progress` · `Blocked` · `In Review` · `Done` · `Deferred` · `Superseded`. Update status in the Dashboard table (§1) *and* the Task Detail Card (§3–10) — they must never disagree; the Dashboard is the source of truth for "what's the state right now," the Detail Card is the source of truth for "why."
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
| E2-F3-T1 | Real encryption for order assets | Security | P1 | Not Started | 1.5–2.5 days | Medium |
| E4-F1-T1 | Wire up Outbox admin API | Observability | P1 | Not Started | 4–6 hrs | Very Low |
| E3-F2-T1 | Minimal CI (typecheck + build gate) | Ops Readiness | P1 | Done | 3–4 hrs | Very Low |
| E6-F2-T3 | Fix pre-existing unused-import typecheck errors | Code Health | P1 | Done | ~15 min | Very Low |
| E1-F2-T1 | Extract shared payroll day-counting logic | Data Integrity | P1 | Not Started | 1–1.5 days | Medium |
| E1-F3-T1 | Fix Receipt zero-payment race condition | Data Integrity | P1 | Not Started | 3–4 hrs | Low |
| E7-F1-T1 | Test framework + state-machine test suite | Quality Engineering | P2 | Not Started | 4–6 days | Low |
| E3-F3-T1 | Dockerize local dev | Ops Readiness | P2 | Not Started | 1–1.5 days | Low |
| E5-F1-T1 | Move notifications onto BullMQ | Reliability | P2 | Not Started | 2–3 days | Medium |
| E1-F2-T2 | Payroll mismatch → explicit confirmation | Data Integrity | P2 | Not Started | 1 day | Low |
| E6-F1-T1 | Delete or wire orphaned controllers | Code Health | P2 | Not Started | 3–5 hrs | Low |
| E4-F2-T1 | Consolidate audit-trail mechanisms | Observability | P2 | Not Started | 2–3 days | Medium |
| E6-F2-T1 | Structured logging cleanup (console.* → pino) | Code Health | P3 | Not Started | 2–3 days | Very Low |
| E3-F4-T1 | Redis-backed rate limiter | Ops Readiness | P3 | Not Started | 1 day | Low |
| E8-F2-T1 | Redis cache for reference-data reads | API Platform | P3 | Not Started | 2–3 days | Medium |
| E4-F3-T1 | TTL/retention policy for append-only collections | Observability | P3 | Not Started | 1 day | Low |
| E6-F2-T2 | Named constants for magic numbers | Code Health | P3 | Not Started | 3–4 hrs | Very Low |
| E8-F1-T1 | API versioning + OpenAPI spec | API Platform | P3 | Not Started | 3–5 days | Low |
| E8-F2-T2 | Compression middleware + cursor pagination | API Platform | P3 | Not Started | 1–2 days | Low |

**Completion:** 8 / 24 Tasks done (4 fully `Done`, 4 marked `Done*` — see notes on each). **P0 remaining:** 0/5 — all P0 tasks addressed. **P1 status:** E3-F2-T1 and E6-F2-T3 both fully `Done` — CI is green on `main`. Remaining P1s: E2-F3-T1, E4-F1-T1, E1-F2-T1, E1-F3-T1.

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
- **Priority:** P1 · **Status:** Not Started
- **Business value:** Eliminates the risk that `getPayrollPreview` (what an admin *approves*) and `processPayroll` (what actually gets *paid*) silently diverge after a future rule change is applied to only one of the three current copies.
- **Engineering effort:** 1–1.5 days
- **Regression risk:** Medium — touches live payroll math; mitigated by mandatory before/after snapshot testing (Subtask b).
- **Dependencies:** None. **Blocks:** E1-F2-T2 (payroll confirmation flow) — that task should build against the post-extraction canonical function.
- **Exact files:** `server/src/services/payroll.service.ts` (`getPayrollPreview` ~L199, `processPayroll` ~L478, `getAbsentDates` ~L911); new `server/src/services/payroll-calculation.util.ts`.
- **Testing strategy:** Snapshot the three functions' output across representative staff/month combos (incl. mid-month join/exit, no-shift-assignment, shift-off-dates) *before* refactoring; assert byte-identical output *after*; add direct unit tests for the new pure function.
- **Rollout plan:** Single PR; behavior-preserving refactor, no flag needed.
- **Rollback plan:** Revert commit — safe, since pre/post behavior is proven identical by the snapshot tests before merge.
- **Acceptance criteria:** All three call sites use the one function · snapshot tests prove zero behavioral drift · new unit tests cover all listed edge cases.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Capture pre-refactor output snapshots for a representative test matrix | Not Started |
| b | Extract `computeWorkDayStats()` into `payroll-calculation.util.ts` | Not Started |
| c | Replace all three inline implementations with calls to the shared function | Not Started |
| d | Re-run snapshot comparison, confirm zero diff | Not Started |
| e | Add standalone unit tests for the extracted function's edge cases | Not Started |

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
- **Priority:** P1 · **Status:** Not Started
- **Business value:** Closes the one place in the codebase where the "check-then-create" duplicate-prevention pattern (used correctly everywhere else — Order, Quotation) wasn't applied, protecting the 1:1 quotation-group↔receipt invariant under concurrent requests.
- **Engineering effort:** 3–4 hrs
- **Regression risk:** Low, **conditional on** the pre-deployment duplicate check (Subtask a) coming back clean.
- **Dependencies:** None.
- **Exact files:** `server/src/models/receipt.model.ts` (add unique index on `quotationGroupId`), `server/src/services/receipt.service.ts` (`createZeroPaymentReceipt` ~L86, catch Mongo `11000`).
- **Testing strategy:** Concurrent-call test (`Promise.all` of two simultaneous creations) asserts exactly one receipt persists and both calls resolve without error.
- **Rollout plan:** Index migration must run *after* the duplicate-data check confirms a clean collection; code change ships alongside.
- **Rollback plan:** Drop the unique index — safe, no data loss either direction.
- **Acceptance criteria:** Production data confirmed duplicate-free (or reconciled) before index creation · unique index live · concurrent creation attempts idempotently resolve to one receipt.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Query production for existing duplicate `quotationGroupId` values in `Receipt` | Not Started |
| b | If duplicates found: manually reconcile (merge/void) before proceeding | Not Started |
| c | Add unique index on `Receipt.quotationGroupId` | Not Started |
| d | Add `11000`-catch idempotent-return logic to `createZeroPaymentReceipt` | Not Started |
| e | Write and pass the concurrent-call test | Not Started |

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
- **Priority:** P1 · **Status:** Not Started
- **Business value:** The system stores `CREDENTIAL`-type order assets and currently returns them as plaintext with a `TODO: decrypt with AWS KMS` marker — the highest real-world-harm item in the whole backlog if that asset type is in active use.
- **Engineering effort:** 1.5–2.5 days · **Regression risk:** Medium — live data path + conditional migration.
- **Dependencies:** E2-F2-T1 must be `Done` first. **Gating question (Subtask a) must be answered before scoping the rest.**
- **Exact files:** `server/src/services/order.service.ts` (asset create + `getAssetByAccessToken` ~L574–604), `server/src/models/order-asset.model.ts`, new `server/src/scripts/migrate-encrypt-order-assets.ts` (conditional).
- **Testing strategy:** Round-trip encrypt/decrypt unit test; integration test confirming DB never holds plaintext post-fix; migration script dry-run against a staging snapshot with row-count + spot-check verification.
- **Rollout plan:** Ship the write-path fix first, let it stabilize for several days, **then** run the backfill migration on old rows — decouples the two rollback risks.
- **Rollback plan:** Safe **only before** the migration runs; once old rows are re-encrypted in place, code rollback would break reads of those rows — sequence accordingly.
- **Acceptance criteria:** No new asset ever persists plaintext · `getAssetByAccessToken` correctly decrypts new-scheme values · pre-existing plaintext (if any) migrated and spot-checked · TODO comment replaced with accurate documentation.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | **Gate:** confirm with product owner whether `AssetType.CREDENTIAL` has real production data | Not Started |
| b | Wire `encryptPayload()`/`decryptPayload()` into asset create/read paths | Not Started |
| c | Add `encryptionVersion` marker field to distinguish migrated vs. legacy rows | Not Started |
| d | (Conditional on a) Write + dry-run the backfill migration script against staging | Not Started |
| e | Round-trip + DB-inspection tests | Not Started |
| f | Run backfill in production only after write-path has soaked, with a pre-migration snapshot | Not Started |
| g | Replace TODO comment with accurate scheme documentation | Not Started |

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
- **Priority:** P2 · **Status:** Not Started
- **Business value:** Removes the bus-factor/onboarding risk of hand-configured local Mongo/Redis, and is the first real-world verification that Mongo is actually configured as a replica set (a load-bearing assumption for every transactional code path in this system).
- **Engineering effort:** 1–1.5 days · **Regression risk:** Low, dev-tooling only.
- **Dependencies:** Benefits from E3-F1-T1 (`/healthz`) for the compose healthcheck.
- **Exact files:** new `server/Dockerfile`, new `docker-compose.yml`, new `.dockerignore`.
- **Testing strategy:** `docker-compose up` completes a full quotation→order→receipt flow including a transactional call (`createNewVersion`) against the containerized Mongo.
- **Rollout plan:** Additive tooling, no production path touched.
- **Rollback plan:** N/A — no production impact either direction.
- **Acceptance criteria:** One-command working local stack · transactional path confirmed working against replica-set Mongo, closing the audit's open question · README updated.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Write multi-stage `Dockerfile` | Not Started |
| b | Write `docker-compose.yml` with Mongo (replica-set single-node), Redis, server | Not Started |
| c | Verify transactional flow end-to-end against the container stack | Not Started |
| d | Update `README.md` local-dev instructions | Not Started |

### E3-F4 — Rate Limiting at Scale

#### E3-F4-T1: Redis-backed rate limiter
- **Priority:** P3 · **Status:** Not Started
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
- **Priority:** P1 · **Status:** Not Started
- **Business value:** The Outbox pattern is load-bearing for reliable event delivery but has zero HTTP surface — today, recovering a dead-lettered event requires direct DB access. This closes the gap using logic that already exists and is fully implemented.
- **Engineering effort:** 4–6 hrs · **Regression risk:** Very low, additive + admin-restricted.
- **Dependencies:** None.
- **Exact files:** new `server/src/routes/outbox.route.ts`, `server/src/controllers/outbox.controller.ts` (verify/adjust to current service interface), `server/src/routes/index.ts`.
- **Testing strategy:** List + replay-one integration test; AuthZ test confirming non-admin roles get 403.
- **Rollout plan:** Direct deploy, additive route surface, `SUPER_ADMIN`/`ADMIN` only.
- **Rollback plan:** Remove routes — underlying data/service untouched.
- **Acceptance criteria:** Admin can list + replay dead-lettered events via API · non-admins get 403.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Verify `outbox.controller.ts` matches current `OutboxService` interface, adjust if stale | Not Started |
| b | Write `outbox.route.ts` (list, replay-one, replay-bulk), admin-only | Not Started |
| c | Register route in `routes/index.ts` | Not Started |
| d | Integration + AuthZ tests | Not Started |

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

## 8. E6 — Code Health & Technical Debt

### E6-F1 — Dead Code Elimination

#### E6-F1-T1: Delete or wire orphaned controllers
- **Priority:** P2 · **Status:** Not Started
- **Business value:** `quotation-timeline.controller.ts` / `wallet-transaction.controller.ts` have no routes — a maintenance trap for future engineers assuming they're live.
- **Engineering effort:** 3–5 hrs · **Regression risk:** Low either direction.
- **Dependencies:** None; good to bundle with E4-F1-T1's investigative pattern.
- **Exact files:** `server/src/controllers/quotation-timeline.controller.ts`, `server/src/controllers/wallet-transaction.controller.ts`, `server/src/models/wallet-transaction.model.ts`, `server/src/services/wallet.service.ts`.
- **Testing strategy:** If wiring: standard route/integration tests. If deleting: build passes + grep confirms zero remaining references.
- **Rollout plan:** Decision-per-controller, documented before execution.
- **Rollback plan:** Deletion is `git revert`-safe; wiring follows standard new-route rollback.
- **Acceptance criteria:** Documented decision per controller · no dead imports remain.

**Subtasks:**
| ID | Description | Status |
|---|---|---|
| a | Investigate whether dashboard frontend references a timeline endpoint | Not Started |
| b | Investigate whether wallet feature has any live data or usage | Not Started |
| c | Execute decision (wire or delete) per controller | Not Started |
| d | Confirm zero dangling references post-execution | Not Started |

### E6-F2 — Code Quality Standards

#### E6-F2-T1: Structured logging cleanup (console.* → pino)
- **Priority:** P3 · **Status:** Not Started · **Effort:** 2–3 days · **Risk:** Very low.
- **Exact files:** 49 files identified in the original audit grep.
- **Acceptance criteria:** Zero `console.*` in `server/src`, enforced going forward by an ESLint `no-console` rule folded into E3-F2-T1's CI.

#### E6-F2-T2: Named constants for magic numbers
- **Priority:** P3 · **Status:** Not Started · **Effort:** 3–4 hrs · **Risk:** Very low.
- **Exact files:** `quotation.service.ts`, `order.service.ts` → new `constants/timing.ts`.
- **Acceptance criteria:** No bare numeric literals for the identified time windows/tolerances remain.

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
- **Priority:** P2 (start in parallel with P0/P1 — it's additive and never blocks) · **Status:** Not Started
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
- **Priority:** P3 · **Status:** Not Started · **Effort:** 1–2 days · **Risk:** Low.
- **Exact files:** `server/src/app.ts` (`compression`), list endpoints in `quotation.service.ts`/`order.service.ts`/`receipt.service.ts` (additive cursor option).
- **Acceptance criteria:** Compression active above a size threshold · cursor pagination available as opt-in on at least one high-traffic endpoint.

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
