# MIDDLE_DISTANCE_RUNTIME_ACTIVATION_DECISION_2026-08-17.md

document_metadata:
  doc_id: MIDDLE_DISTANCE_RUNTIME_ACTIVATION_DECISION_2026-08-17
  version: 1.0
  round: RT1
  status: OWNER_APPROVED_FOR_BETA_RUNTIME
  owner: COACH_HOJUNE
  independent_review_claimed: false
  approved_templates_total: 3

## 1. Owner decision

The product owner approves beta runtime activation of exactly these templates:

- MD-800-01@1.0.0: 10×200m @800m RP · r60″ STAND
- MD-1500-01@1.0.0: 3×500m @1500m RP · r180″ STAND
- MD-3000-01@1.0.0: 4×800m @3000m RP · r180″ WALK

The accepted source and adaptation record is
`reports/review/MIDDLE_DISTANCE_SOURCE_ADOPTION_PACKET_2026-08-17.md`.

## 2. Approved scope

- Event group: MIDDLE_DISTANCE
- Exact target distances: 800m, 1500m and 3000m
- Experience band: EXPERIENCED
- Anchor: athlete-selected CURRENT result from the same event
- Population: youth and adult use identical eligibility criteria and dose
- Age, sex and school division do not alter dose
- Guardian, privacy, account, sync and sharing rules remain separate
- D9_ACTIVE and D9_UNKNOWN block plan generation
- Missing, stale, unsupported or cross-event evidence returns both candidates to RPE-only
- Activation must bind the exact template, component versions, fingerprints and source decision

## 3. Components

The three templates use:

- WU-MD-01@1.0.0
- CD-MD-01@1.0.0
- RPE-ONLY-CONTROLLED-01@1.0.0
- STOP-MD-01@1.0.0

No numeric reduced-repetition variant is approved. Runtime may not silently
change repetition count, distance, recovery time or recovery mode.

## 4. Exclusions

This decision does not activate 100m, 200m or 400m prescriptions. It does not
authorize cross-event conversion, medical clearance, automatic safety release,
coach-only access, or claims that the selected sessions are universally optimal.

## 5. Evidence required before public claim

- trusted manifest hash checks
- exact notation and arithmetic mutation tests
- youth/adult dose identity tests
- stale, unsupported, revoked and D9 fail-closed tests
- storage, reload and start/restart authority tests
- public mobile and desktop browser verification at the deployed main SHA

[DRAFT_COMPLETE]
