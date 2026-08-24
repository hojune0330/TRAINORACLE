---
slug: personalized-prescription-algorithm-v2
status: rebased-to-main-supplemental-review-approved
intent: clear
review_required: true
plan_path: .omo/plans/personalized-prescription-algorithm-v2.md
plan_sha256: 3f081ebbd8d8fa456ff33f01a037942e618cf13f9e549ff3feb83789df590d6b
review_round: freshness-rebase-3
review_status: supplemental-approved-current-main
momus_result: BLOCKED_FANOUT_86_OF_60
independent_result: INCONCLUSIVE_AUTH_401_BEFORE_READ
pending-action: dispatch Todo 1 against authoritative main 5ea2eed9fce0f0ddb314358d57c0b2fc538b9daa
approach: Existing deterministic candidate and safety chains stay intact; add only owner-approved dose, placement, and next-frame rules through the same manifest, integrity, selection, and storage boundaries.
---

# Draft: personalized-prescription-algorithm-v2

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
| id | outcome | status | evidence path |
|---|---|---|---|
| C1 | Initial prescription inputs distinguish target event, evidence record, current training evidence, and typed missingness | active | `app/src/domain/plan-beta-schema.ts`, `impl/src/plan-generator/types.ts` |
| C2 | Versioned formation policy places quality, recovery, rest, MAIN, and allowed second sessions across the 9.5-day frame and 7/9/10 projections | active | `app/src/domain/plan-beta-formation.ts`, `impl/src/plan-generator/candidates.ts` |
| C3 | Approved dose policy makes candidate differences and future-frame adjustments meaningful without uncontrolled intensity, volume, or frequency growth | active | `impl/src/plan-generator/session-builder.ts`, `impl/src/plan-generator/adaptation.ts` |
| C4 | Detailed numeric prescriptions remain event-exact and activate only through the manifest/preflight/binding authority chain | active | `app/src/domain/detailed-prescription-approvals.ts`, `app/src/domain/detailed-prescription-manifest.json` |
| C5 | Accepted next-frame proposals have one integrity-checked transition into the next active plan | active | `app/src/domain/plan-adaptation-store.ts`, `app/src/domain/plan-beta-store.ts` |
| C6 | Athlete-facing comparison explains why candidates differ and browser coverage proves 7/9/10, four events, sparse history, and next-frame continuity | active | `app/src/screens/plan-beta/`, `app/e2e/` |
| C7 | Taper evidence is preserved in an inactive authority matrix; race dates are transient preview-only until retention governance is accepted and remain placement-only until separate numeric authority exists | active | `.omo/reports/personalized-prescription-source-gate-2026-08-23.md`, `reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md` |

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
| assumption | adopted default | rationale | reversible? |
|---|---|---|---|
| Current main baseline | Start from committed `main` `5ea2eed...`; independently classify exact deployment state and preserve the unrelated untracked PR118 follow-up draft | freshness audit found the reviewed plan was 14 commits behind and its local-only claim was stale | yes |
| Existing safety chain | Preserve D9, hold, current-record, hash, atomic pair fallback, and SELF authority behavior | already tested and outside this algorithm decision | no within this plan |
| Youth/division | Keep youth allowed and division display-only until an approved dose rule uses a stronger input than label alone | existing owner decision and spec boundary | yes |
| Automatic increase | Journals, completion, RPE, attendance, streaks, points, and memo text never trigger an increase | existing owner decision | no within this plan |
| Sparse history | Continue providing an RPE-first taste plan; missing evidence lowers specificity instead of blocking | existing product direction | yes |
| Numeric taper | Keep every researched percentage, duration, frequency, and final-session offset inactive | no accepted athlete baseline or owner numeric-taper authority exists | yes, through a later explicit gate |

## Findings (cited - path:lines)
- Both candidates use the same quality-day coordinates, but current main also shortens CONSERVATIVE QUALITY duration; Todo 3 must narrow the difference to support-only while preserving complete QUALITY JSON (`impl/src/plan-generator/candidates.ts`, `impl/src/plan-generator/session-builder.ts:101`, `impl/test/plan-energy-intent.test.ts:48`).
- Journal history changes provenance but not session dose (`app/src/domain/plan-beta-flow.ts:299`).
- Detailed execution has four exact event/intent templates; other intents and evidence states fall back atomically to RPE-only (`app/src/domain/detailed-prescription-approvals.ts:499`).
- Current behavior validates only BALANCED-to-CONSERVATIVE VOLUME reduction. The
  owner's 2026-08-23 approval must first be durably recorded before Todo 7 may add
  CONSERVATIVE-to-BALANCED inside the same immutable pair
  (`impl/src/plan-generator/adaptation.ts:674-704`).
- Accepted pending successor is displayable but has no complete transition to the next active stored plan (`app/src/domain/plan-adaptation-store.ts:208`, `app/src/domain/plan-beta-store.ts:295`).
- Requested 7/9/10 values are projections over one 9.5-day/19-slot frame, not separately optimized schedules (`impl/src/plan-generator/candidates.ts:54`).
- Target middle-distance event is coupled to the selected evidence record; athletes without same-event evidence cannot independently name 800/1500/3000 as the target (`app/src/domain/plan-beta-flow.ts:143`).
- No full browser journey proves 7-day continuity or 10-day completion; shared E2E selects nine days (`app/e2e/plan-flow.ts:3`).
- Main has no current 2026-08-22 handoff; Todo 1 must create a new dated handoff from actual HEAD and observed deployment evidence rather than restore an absent file.
- Generation types mention TEN_K and GENERAL_ENDURANCE while the integrity parser accepts only MIDDLE_DISTANCE and FIVE_K; this boundary must be reconciled before support is claimed (`impl/src/plan-generator/types.ts`, `impl/src/plan-generator/adaptation.ts`).
- The local competition-anchor decision packet remains `NOT_REVIEWED`, the Plan Generator taper issue remains OPEN, and no accepted athlete baseline defines what a percentage reduction would reduce (`reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md`, `specs/active/PLAN_GENERATOR_SPEC.md`).
- Direct 800 m and junior-high 3000 m trials include null performance findings, while two small 1500 m trials disagree about the final faster-than-race-pace stimulus; pooled taper percentages therefore cannot be promoted to exact-event runtime constants (`.omo/reports/personalized-prescription-source-gate-2026-08-23.md`).
- Controlled female running taper evidence and controlled adult flat-3000 m taper evidence were not found in the reviewed set; neither a male default nor a menstrual-cycle rule may fill those gaps (`.omo/reports/personalized-prescription-source-gate-2026-08-23.md`).

## Decisions (with rationale)
- Preserved: 800/1500/3000/5000 youth and adult self-service access.
- Preserved: 9-10 day default, 7-day projection with continuity metadata.
- Preserved: experienced, same-event-evidence doubles only; maximum two sessions per day and one QUALITY session per day.
- Preserved: increase review opens only for explicit athlete/coach request or confirmed same-event PB/SB after active-plan start.
- Owner decision 1A: initial candidates differ only in bounded support duration; QUALITY content and session frequency remain identical. Future-frame restoration requires an explicit request or eligible same-event PB/SB and changes only through one registered VOLUME edge.
- Owner decision 2A: retain the four active detailed templates and target two or three total templates per supported event. Zero additions remains a valid evidence result; catalog presence alone is never runtime authority.
- Owner decision 3A: accept an optional target race date and use it only through a separately approved, source-backed placement policy. Persistence remains blocked by the current retention packet until a named governance receipt exists. Do not invent taper percentages or dose changes. Implement continuity and browser coverage with TDD.
- Owner decision B: exact numeric templates and race-placement rows may activate without another owner prompt only when independent coaching-applicability and sports-science/transfer reviews both approve the same artifact digest under the delegated scope. It does not authorize numeric taper percentages, duration, frequency changes, or final-session offsets.
- Derived bound: do not raise or alter the current QUALITY frequency between initial candidates. The first meaningful candidate difference removes or shortens eligible SUPPORT work in CONSERVATIVE while BALANCED retains the current ceiling.
- Derived bound: structured journal evidence may support display or human review and may reach safety/hold behavior only through its owning contract; it never creates a plan-adaptation edge or numeric delta.
- Derived bound: PB/SB and explicit requests may open a proposal only; they never create a numeric delta outside the already approved candidate/template envelope.
- Derived bound: `기본 보조훈련` and `보조훈련 짧게` are duration preferences, not personalized load, taper, or global safety rankings. Athletes explicitly select detailed-template purpose; the system does not auto-rank an optimal workout.

## Scope IN
- Initial and next-frame prescription policy for 800/1500/3000/5000.
- Target-event/evidence separation, dose and placement rules, and an inactive taper evidence/authority matrix.
- Candidate differentiation, bounded adaptation, accepted-successor activation.
- Runtime/spec/validator/UI/E2E reconciliation at the same behavior version.

## Scope OUT (Must NOT have)
- 100m/200m/400m sprint prescription.
- Medical clearance claims or D9 semantic changes.
- Raw memo or symptom-clause storage/use as a dose input.
- Unreviewed catalog entries becoming runtime authority by implication.
- Automatic increase from journal completion, RPE, attendance, points, badges, streaks, or generic AI inference.
- Cross-event pace conversion or invented training numbers.
- Numeric taper activation, menstrual-cycle dose rules, psychological-state dose rules, or race-date-triggered overload.
- New backend, account sync, payment, or coach-auth implementation.

## Open questions
None. The owner delegated exact template and placement activation to the dual-review gate recorded in `.omo/reports/personalized-prescription-source-gate-2026-08-23.md`; numeric taper remains outside that delegation and explicitly inactive.

## Proposed execution plan

### P0. Freeze and reconcile the actual base
- Start from authoritative `main` `5ea2eed...`, preserve the unrelated untracked PR118 follow-up draft, and classify every newly introduced path by task ownership.
- Record the exact base SHA, diff ownership, test baseline, and observed deployment status before editing; do not repeat the stale local-only assertion.
- Reconcile the TEN_K/GENERAL_ENDURANCE generator/parser mismatch without silently expanding public support.

### P1. Lock policy and authority before numeric code
- Record decisions 1A/2A/3A/B and the approved three-stage race-preparation path, then audit and patch only the owning working specs.
- Define target event separately from evidence record; keep missing evidence explicit and allow an RPE-first plan.
- Keep current-load-driven dose changes deferred because the load and minimum-evidence packets remain non-authoritative. Raw memo text remains excluded.
- Define candidate and adaptation bounds: no higher quality-frequency ceiling than today, one changed dimension per future frame, no automatic increase from journals or rewards.

### P2. Approve a small detailed-template batch
- Review existing catalog candidates by supported event, energy-system purpose, source strength, age scope, exact notation, recovery accounting, and pace anchoring.
- Target two or three total candidates per supported event only where evidence supports them; record youth and female/sex transfer separately and leave unsupported slots unfilled rather than inventing sessions.
- Require the athlete to choose an available detailed purpose; do not silently rank one as optimal.
- Add accepted entries through the existing manifest, fingerprint, preflight, binding, and atomic-pair fallback chain.
- Add mutation tests proving unapproved catalog entries and cross-event records remain inert.

### P3. Make initial candidates meaningfully different
- Replace shared quality-day assignment with one versioned formation policy.
- Preserve identical topology and QUALITY sessions in both candidates. Keep BALANCED support duration at the current ceiling; make CONSERVATIVE use minimum support duration without removing or restoring any session.
- For new runners, sparse availability, missing load evidence, or unsupported detailed evidence, preserve the narrower RPE-first behavior instead of fabricating specificity.
- Show exact candidate differences in athlete language: number of quality sessions, support duration, recovery spacing, and which detailed sessions are evidence-bound.

### P4. Build the taper authority gate, then add placement-only race dates
- Build a source matrix that preserves event, population, baseline, taper component, outcome, transfer, and positive/null/adverse evidence. Keep every numeric row inactive and the owning issue OPEN.
- Accept an optional target race date independently from the performance evidence date, but keep it transient preview-only until a named privacy/governance receipt approves its persistence lifecycle.
- Adopt only exact-event, exact-projection, population-reviewed placement rows that reorder already-approved sessions without crossing a projection visibility boundary; do not change total dose, intensity, or recovery numerically in this wave.
- If no placement row applies, keep the generic cycle and say why. Do not present display-only dates as active personalization or placement-only behavior as a taper.

### P5. Complete bounded next-frame adaptation
- Activate only the existing owner-approved VOLUME sibling transform; keep FREQUENCY and INTENSITY transformations inactive pending separate owner authority.
- Increase review opens only for explicit request or eligible PB/SB, but every change stays within an already approved candidate/template edge; structured adverse evidence can only maintain, reduce, add recovery, or block.
- Add the missing accepted-successor transition into the new active v4 shape while preserving the previous active frame and hashes as immutable history.
- Define premature completion and 7-day continuation rules so athletes cannot archive a frame accidentally.

### P6. Reconcile UI, storage, integrity, and specifications
- Update candidate identity, v4 storage, selection, reload integrity, pending proposal, and parser contracts together while preserving v1/v2/v3 bytes.
- Keep division labels display-only unless a stronger approved input drives a rule.
- Explain RPE, detailed pace notation, candidate differences, missing evidence, and race-date limitations without implying medical or scientific superiority.

### P7. Test and observe the real flow
- Use TDD for each algorithm boundary: candidate frequency, dose dimension, template authority, race placement, successor activation, and fail-safe states.
- Run event matrices for 800/1500/3000/5000 across sparse/current evidence, youth/adult display cohorts, single/double sessions, and 7/9/10 projections.
- Run browser journeys from intake through selection, execution, frame completion, accepted successor, and next active frame.
- Require targeted unit/contract tests, TypeScript, production build, D9 chain, storage mutation tests, and mobile/desktop visual QA before any deployment claim.

## Acceptance boundaries
- BALANCED never exceeds the current quality-frequency ceiling.
- CONSERVATIVE is observably shorter in support duration; the UI states the exact difference without claiming global physiological load.
- No journal, memo, attendance, streak, point, or badge can increase dose.
- Every numeric detailed session is manifest-approved, exact-event anchored, and atomically falls back when evidence is absent or invalid.
- Race date never causes an unsourced taper percentage or hidden dose mutation.
- Race date and placement metadata never persist while the retention governance state remains blocked.
- Every taper-study row remains inactive, includes its baseline/transfer limitations, and preserves null/adverse evidence alongside positive findings.
- Race placement is projection-specific, cannot move sessions across visibility boundaries, and is never described as a personalized taper.
- An accepted next-frame proposal can become the next active v4 plan exactly once with full integrity verification.
- Complete 7-day and 10-day browser journeys pass, not only nine-day fixtures.

## Approval gate
status: awaiting-high-accuracy-review
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
