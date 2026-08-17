---
slug: personalized-auto-prescription
status: approved
intent: clear
review_required: false
pending-action: write .omo/plans/personalized-auto-prescription.md
approach: phased readiness-gated same-event prescription, proving one complete 5K path before source-backed 800/1500/3000 expansion
---

# Draft: personalized-auto-prescription

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
1 | Evidence authority: trusted, revocable, version/hash-bound manifest activates reviewed templates without an age-only prohibition | active | reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md
2 | Prescription runtime: approved same-event templates preserve exact dose, recovery mode, safety and provenance | active | app/src/domain/detailed-prescription.ts
3 | Athlete anchor: athlete explicitly selects a same-event record and confirms CURRENT | active | app/src/screens/plan-beta/PaceEvidenceFlow.tsx
4 | Plan binding: one eligible quality session receives the personalized prescription and survives storage/reload | active | app/src/domain/plan-session-schema.ts
5 | Athlete UX: candidate and active-plan screens explain exact dose, evidence, fallback and stop rules | active | app/src/screens/plan-beta/PlanCandidates.tsx
6 | Release proof: TDD, safety mutation tests, browser QA and exact-head deployment receipt | active | .github/workflows/ci.yml

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
test strategy | TDD with failing domain, storage and browser tests before implementation | repository and programming rules require red-green evidence | yes
selection | no automatic fastest-record choice; athlete confirms record and CURRENT state | WORK_ORDER_P3_PACE_WIRING.md | yes
fallback | missing or ineligible evidence keeps the existing RPE plan, never guesses numbers | PRODUCT_NORTH_STAR.md and prescription contract | yes
conversion | same-event race pace only; no VDOT, cross-event or sprint conversion | current accepted runtime boundary | yes
youth | include middle/high-school athletes; training eligibility is based on readiness, evidence quality and safety state rather than age alone | IOC youth-development consensus and youth-HIIT evidence do not support a blanket age prohibition | yes
privacy boundary | preserve existing account, sync, sharing and sensitive-data guardian/legal guards; do not use client-declared minor status as authority | training eligibility and data-processing authorization are separate concerns | yes
dose frequency | do not change quality-day frequency in the first binding; replace exactly one already-generated eligible quality session and keep atomic RPE fallback | avoids expanding formation logic before the prescription path is proven | yes

## Findings (cited - path:lines)

- Current public plan personalizes event, experience, intent, availability and safety, but stores only REST/RPE prescriptions (`impl/src/plan-generator/candidates.ts`, `app/src/domain/plan-session-schema.ts`).
- The same-event calculation and explicit CURRENT-record flow already exist (`app/src/domain/pace-target-plan.ts:93`, `app/src/screens/plan-beta/PaceEvidenceFlow.tsx`).
- Production plan storage deliberately rejects `PACE_TARGET` (`app/src/domain/plan-beta-pace-storage.contract.test.ts`).
- The canonical approval registry is empty and the only parser-ready non-sprint seed remains DRAFT/REVIEW_REQUIRED (`app/src/domain/detailed-prescription-approvals.ts`, `specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md:708`).
- The 2026-08-16 packet has 11 technical/human blockers and no later approval supersedes it (`reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md`).
- `TEMPLATE_LIBRARY_SPEC.md` conflates minor eligibility/guardian context with template eligibility and still gives coaches final selection authority, conflicting with owner-approved athlete self-selection.
- Production detailed-prescription approval records are forgeable name/evidence strings and require `youthReview` unconditionally (`app/src/domain/detailed-prescription-approvals.ts`).
- Runtime loses required `JOG` recovery and lacks resolved warm-up, cooldown, downshift and stop components (`impl/src/prescription/runtime.ts`).
- Stored plan state intentionally rejects `PACE_TARGET`; production candidates remain `DURATION_RPE_ONLY` (`app/src/domain/plan-beta-pace-storage.contract.test.ts`, `impl/src/plan-generator/candidates.ts`).
- IOC youth-development guidance supports individually adjusted aerobic and anaerobic training and does not justify a blanket minor exclusion; programming should follow readiness, growth, recovery and individual response (`https://bjsm.bmj.com/content/49/13/843`).
- A systematic review of 24 studies and 577 athletes aged 18 or younger found that HIIT can improve aerobic and anaerobic performance in young athletes, while not proving one universal optimal dose (`https://pubmed.ncbi.nlm.nih.gov/30100881/`).
- The youth-running consensus reports that age-specific distance limits are largely opinion based and recommends risk-factor monitoring rather than a universal age cutoff (`https://pubmed.ncbi.nlm.nih.gov/33122252/`).
- The 2024 AAP clinical report identifies excessive load without recovery, emerging pain, overtraining and burnout as the actionable risks; it does not define adolescence itself as a contraindication (`https://publications.aap.org/pediatrics/article/153/2/e2023065129/196435/`).

## Decisions (with rationale)

- Reuse the existing parser, same-event calculator, safety gate, athlete record schema and explicit freshness flow; do not create a parallel prescription engine.
- Include youth athletes in the same public prescription path. Remove age-only activation blocking and replace it with explicit readiness, record-quality, recent-load, pain and recovery gates.
- Separate training eligibility from processing authorization. Existing privacy/account/sync/sharing guardian guards remain unchanged.
- Replace the unconditional youth-review role with population-applicability evidence bound to source/version/hash; do not remove sports-science/source review.
- Implement the technical path behind a fail-closed template manifest. Public numeric output requires accepted source, complete components and executable safety gates.
- Bind exactly one eligible quality session in both candidates atomically. Any authority, anchor, component or safety failure leaves both original RPE candidates unchanged.
- Preserve raw notes and symptom text outside prescription inputs.

## Scope IN

- Phase 1: V2-SEED-05 for athletes with an explicit CURRENT 5000m anchor and accepted experience scope, across youth and adult divisions.
- Phase 2: separately source, review, parse and activate one same-event template each for 800m, 1500m and 3000m. No event is presented as supported before its template passes the same gate.
- Explicit athlete record/currentness selection, provenance, plan binding, persistence and reload.
- Warm-up/cool-down component resolution, JOG recovery preservation, downshift and stop-condition display.
- No sex-, age- or school-division-only dose multiplier. Phase 1 keeps the approved template dose exact; later dose variants require separately approved template versions rather than runtime arithmetic.
- D9/RVE/Safety Gate failure-closed behavior and RPE fallback.

## Scope OUT (Must NOT have)

- Cross-event conversion, VDOT zones, sprint prescription, automatic fastest-record selection.
- Bulk activation of 30 research seeds.
- Raw memo/free-text dose input or any safety-clearance claim.
- Destructive migration or deletion of old plans/records.

## Open questions

None. Owner approved youth inclusion; first release is the one currently parser-ready 5K template after every activation blocker is closed.

## Approval gate
status: approved
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
