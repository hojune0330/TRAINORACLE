# Formation Supplemental Security And Youth-Privacy Review

```yaml
review_date: 2026-07-17
review_scope: SUPPLEMENTAL_COMPETITION_PRIVACY_YOUTH_SAFETY_GOVERNANCE
overall_verdict: FAIL
documentation_only_containment: PASS
runtime_approval: BLOCKED_NOT_GRANTED
high_findings: 1
medium_findings: 1
human_participant_reviews: 0
assistive_technology_reviews: 0
human_scientific_attestations: 0
production_code_changed_by_supplement: false
runtime_authority: false
```

## Verdict

The supplemental package is safe to retain as candidate research documentation, but it does not
pass privacy and youth-governance preparation for canonical adoption. The proposed competition
anchor/bout model cannot yet demonstrate data minimization, and the preparation validators do not
bind the candidate schema to a privacy/safeguarding approval gate.

Current runtime containment passes. Private-note zero-signal, user-directed transport, race
self-check isolation, visible shadow behavior, no-clearance semantics, and honest zero-human-review
states remain intact. Nothing in this verdict authorizes runtime, participant enrollment, network
processing, or a shadow pilot.

## Findings

### [HIGH, BLOCKING] PRIV-SUP-01: The competition model lacks a minimized youth-data contract

`reports/research/FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md:49-67` proposes a required
competition name, exact local start, timezone, source/provenance, event code, round/role, planned
start, and per-bout provenance, with optional venue and actual start/end. In a youth account,
competition identity plus exact schedule, round, provenance, and possible venue is personal
location and participation data that can make the athlete readily identifiable in a small field.
The visible scenario also proposes showing each start and actual end
(`reports/review/FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md:38`).

The counting rule only requires a stable anchor/bout identity, event class or role, completion
state, parent-child dedupe, and a bounded contribution. The package does not explain why exact
actual start and end, raw source provenance, venue, or full competition name must be retained or
shown for that purpose. It also defines no field-level purpose, sensitivity, precision, local-only
boundary, recipient/access matrix, retention/deletion rule, age-out rule, share/export behavior,
telemetry prohibition, or restriction on public-results/participant-list ingestion.

The decision packet compounds that gap. Its owned fields include actual start/end but omit the
candidate schema's competition name, timezone, venue, and source/provenance
(`reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md:9-23`). Its only named expert
gate is youth sport science (`:77-83`), and its decision form has owner and sport-science decisions
but no privacy, safeguarding, or data-minimization decision (`:122-130`). The supplement lists
privacy only as a remaining gate
(`reports/research/FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md:120-126`).

Required closure:

1. Define a minimal `CompetitionAnchorRef` and `BoutExposureRef` field inventory. Justify every
   field against scheduling, dedupe, completion, or user correction, and remove or reduce fields
   that do not change those outcomes.
2. Separate coarse scheduling data from sensitive detail. Exact venue, actual timestamps, raw
   source URLs, participant lists, and public-result ingestion must be prohibited by default or
   justified as explicit, local-only, purpose-limited fields.
3. Define storage, access, export/share, telemetry, retention, deletion, correction, provenance,
   guardian boundaries, and athlete-visible controls for each retained field.
4. Add named privacy/safeguarding and youth-data-minimization decisions to the packet. Global
   athlete assent, guardian/privacy review, and assistive-technology review must remain separate
   required gates and cannot be inferred from owner or sport-science approval.
5. Add negative tests proving optional identifying/location fields cannot affect exposure count,
   plan generation, rewards, safety/clearance, telemetry, or recipient access.

### [MEDIUM, BLOCKING BEFORE PACKET ACCEPTANCE] GOV-SUP-02: Validators do not prove the new privacy gate

`specs/test-packages/validate-formation-supplemental-evidence.mjs:8-18` reads the supplemental
candidate/search/identity evidence and canonical source ledger, but not the competition synthesis
or decision packet. Its successful result proves that 18 source candidates remain pending and
`runtime=false`; it does not validate the proposed competition field model.

`specs/test-packages/validate-formation-decision-packets.mjs:25-30` hard-codes the packet's 14
owned competition fields, while `:97-108` checks only `NOT_REVIEWED`, runtime false, owner identity,
field lists, and a generic decision form. It neither compares those fields with the candidate
schema nor requires privacy/safeguarding/data-minimization status. The validator is correctly a
fail-closed preparation validator today, but a green preparation run cannot be treated as evidence
that PRIV-SUP-01 is closed.

Required closure:

1. Put the approved competition schema and field-purpose inventory in a structured, parseable
   contract and validate exact parity between synthesis, decision packet, and future target spec.
2. Require explicit `privacy_safeguarding_decision`, reviewed contract/version/hash, and required
   changes in any future packet-acceptance path. Missing or `NOT_REVIEWED` must fail acceptance.
3. Add mutation tests for an added sensitive field, missing field purpose, broader visibility,
   absent retention/deletion, absent privacy decision, and attempted `runtime_authority: true`.
4. Keep the current preparation validator's `NOT_REVIEWED` and `runtime=false` requirements until
   a separate authenticated acceptance workflow exists.

## Control Trace

| Control | Result | Evidence |
|---|---|---|
| `PRIVATE_SELF_ONLY` content and metadata are zero-signal | `PASS` | Protocol 347-351 excludes content, presence, length, time, frequency, missingness, topic, sentiment, embedding, and index state from analysis, planning, reward, telemetry, and safety. Owner baseline 43-47 repeats the rule. |
| Backup/share is transport, not analysis consent or standing access | `PASS_WITH_CANONICAL_PATCH_GATE` | Protocol 345-351 requires exact recipient, fields, purpose, duration/retention, withdrawal limits, and a separate confirmation. User scenarios U-10/U-11 at 41-42 preserve preview, limited scope, duration, cancellation, and withdrawal. Conflict `FRV2-CONF-007` remains `PATCH_REQUIRED` before UI/runtime. |
| Race self-check future analysis is absent from current runtime input | `PASS` | `RACE_SELFCHECK_FIELDS_DECISION.md:94-112` limits four fields to current collection/display and requires a future provenance/method/uncertainty/owner contract. `app/src/domain/safe-export.ts:15-18,119-132,165-170` excludes them from analysis. Contract tests at `app/src/domain/journal-store.contract.test.ts:154-216` assert the boundary. Conflict `FRV2-CONF-010` blocks future use without the missing contract. |
| Shadow is visible and non-executing | `PASS` | `ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md:7-15` sets runtime false, forbids hidden shadow, and prohibits real calendar/plan/notification writes. Lines 78-99 separate guardian consent and athlete assent and abort hidden enrollment, private-note signals, or automatic network delivery. |
| 72 hours, performance, and no-concern are not clearance | `PASS` | Claim `FRV2-CLAIM-G-002` is `NOT_SUPPORTED/PROHIBITED`; competition supplement 80, 106-118 and packet 24-30, 92-99 forbid elapsed-time, performance, and no-concern clearance. |
| Youth, guardian/privacy, and AT review are not falsely approved | `PASS_NOT_RUN` | `FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md:101-107` records athlete, coach, guardian/privacy, and AT review as `NOT_RUN`, owner acceptance `NOT_REVIEWED`, and runtime false. The reviewer and attestation ledgers contain no approval rows. |
| Competition data collection is minimized and governed | `FAIL` | See PRIV-SUP-01. Candidate fields and user-visible actual timing lack purpose, access, retention, and youth-privacy boundaries. |
| Human screening/extraction/appraisal and runtime remain fail closed | `PASS_STATE_CONTAINMENT` | Prepared validators report 167 pending human records, zero supplemental human screening, `NOT_REVIEWED` packet decisions, and runtime false. All three `--accepted` attempts exit 1 for missing attestations/pending work. Privacy schema coverage still fails under GOV-SUP-02. |

## Blocking Gates

1. Close PRIV-SUP-01 with a minimized competition field contract and a complete data-flow,
   access, retention, deletion, correction, export/share, telemetry, and provenance policy.
2. Obtain named privacy/safeguarding and youth-data-minimization review for that exact contract.
   Athlete assent, guardian/privacy review, coach review, and AT review must be run and recorded,
   not inherited from another approval.
3. Close GOV-SUP-02 with schema-parity and negative privacy tests before any accepted packet or
   canonical patch can pass.
4. Resolve registered conflicts `FRV2-CONF-007`, `009`, `010`, `011`, and `012`; keep current
   coach plan preservation and current self-check isolation intact.
5. Keep human screening, extraction, appraisal, participant recruitment, shadow, and runtime false
   until authenticated review records and a separate activation authority exist.

## Executed Verification

From the exact worktree:

```text
test-package tests: 24 passed, 0 failed
prepared validators: 11 passed
screening --accepted: exit 1
extraction --accepted: exit 1
appraisal --accepted: exit 1
supplemental evidence: candidates=18 human_screening=0 runtime=false
decision packets: competition_fields=14 decisions=NOT_REVIEWED runtime=false
final preparation: reviewers=0/6 manual=0/5 user_scenarios=0/12 runtime=false
```

The targeted app contract test could not be rerun in this worktree because app dependencies are
not installed and `vitest` is unavailable. Source and test inspection confirms the self-check and
private-note projections, and the supplemental worktree has no `app/` changes.

[FINAL_SECURITY_SUPPLEMENTAL_FAIL_RUNTIME_BLOCKED]
