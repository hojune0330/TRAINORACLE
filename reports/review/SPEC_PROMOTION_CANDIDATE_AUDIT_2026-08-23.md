# SPEC_PROMOTION_CANDIDATE_AUDIT_2026-08-23.md

Status: NON_CANONICAL_AUDIT

This audit classifies current evidence and working-spec gaps. It does not promote a
canonical specification, close an OPEN issue, or turn research and implementation
receipts into runtime authority.

<!-- MACHINE_DATA:SPEC_PROMOTION_CANDIDATE_AUDIT_V1:START -->
```json
{
  "schemaVersion": 1,
  "kind": "TRAINORACLE_SPEC_PROMOTION_CANDIDATE_AUDIT",
  "status": "NON_CANONICAL_AUDIT",
  "canonicalPromotion": false,
  "issueClosure": false,
  "rows": [
    {
      "family": "YOUTH_ELIGIBILITY",
      "classification": "ALREADY_SPEC_BOUND",
      "evidence": [
        { "path": "reports/review/PERSONALIZED_AUTO_PRESCRIPTION_YOUTH_TRAINING_DECISION_2026-08-17.md", "startLine": 20, "endLine": 59 },
        { "path": "specs/active/PLAN_GENERATOR_SPEC.md", "startLine": 241, "endLine": 295 }
      ]
    },
    {
      "family": "FOUR_ACTIVE_EXACT_TEMPLATES",
      "classification": "WORKING_SPEC_AMENDMENT_REQUIRED",
      "evidence": [
        { "path": "app/src/domain/detailed-prescription-manifest.json", "startLine": 32, "endLine": 598 },
        { "path": "reports/implementation/PERSONALIZED_PRESCRIPTION_RELEASE_2026-08-18.md", "startLine": 19, "endLine": 35 }
      ]
    },
    {
      "family": "TWO_A_DAY_BETA",
      "classification": "ALREADY_SPEC_BOUND",
      "evidence": [
        { "path": "OWNER_DECISION_FULL_TWO_A_DAY_2026_08_12.md", "startLine": 1, "endLine": 49 },
        { "path": "specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md", "startLine": 57, "endLine": 90 }
      ]
    },
    {
      "family": "BOUNDED_ADAPTATION",
      "classification": "ALREADY_SPEC_BOUND",
      "evidence": [
        { "path": "impl/src/plan-generator/adaptation.ts", "startLine": 674, "endLine": 704 },
        { "path": "specs/active/PLAN_GENERATOR_SPEC.md", "startLine": 297, "endLine": 350 }
      ]
    },
    {
      "family": "MIDDLE_DISTANCE_800_1500_3000_SPEC_DRIFT",
      "classification": "WORKING_SPEC_AMENDMENT_REQUIRED",
      "evidence": [
        { "path": "reports/review/MIDDLE_DISTANCE_RUNTIME_ACTIVATION_DECISION_2026-08-17.md", "startLine": 14, "endLine": 34 },
        { "path": "specs/active/PLAN_GENERATOR_SPEC.md", "startLine": 241, "endLine": 350 }
      ]
    },
    {
      "family": "COMPETITION_DIVISION_DISPLAY_ONLY",
      "classification": "WORKING_SPEC_AMENDMENT_REQUIRED",
      "evidence": [
        { "path": "reports/review/ACCOUNT_LEGAL_AND_COMPETITION_DIVISION_REVIEW_2026-08-14.md", "startLine": 3, "endLine": 19 },
        { "path": "reports/review/ACCOUNT_LEGAL_AND_COMPETITION_DIVISION_REVIEW_2026-08-14.md", "startLine": 54, "endLine": 95 }
      ]
    },
    {
      "family": "TAPER_RACE_ANCHORS",
      "classification": "RESEARCH_OR_RECEIPT_ONLY",
      "evidence": [
        { "path": "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md", "startLine": 1, "endLine": 45 },
        { "path": "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md", "startLine": 108, "endLine": 146 },
        { "path": "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md", "startLine": 177, "endLine": 184 }
      ]
    },
    {
      "family": "ACCOUNT_COACH_MODE",
      "classification": "ALREADY_SPEC_BOUND",
      "evidence": [
        { "path": "PRODUCT_NORTH_STAR.md", "startLine": 102, "endLine": 123 },
        { "path": "specs/active/PLAN_GENERATOR_SPEC.md", "startLine": 345, "endLine": 350 }
      ]
    },
    {
      "family": "SPRINT_ATP_PC",
      "classification": "CANONICAL_PROMOTION_BLOCKED",
      "evidence": [
        { "path": "reports/review/MIDDLE_DISTANCE_RUNTIME_ACTIVATION_DECISION_2026-08-17.md", "startLine": 48, "endLine": 52 },
        { "path": "specs/active/PLAN_GENERATOR_SPEC.md", "startLine": 297, "endLine": 343 }
      ]
    },
    {
      "family": "TEN_K_GENERAL_ENDURANCE",
      "classification": "CANONICAL_PROMOTION_BLOCKED",
      "evidence": [
        { "path": "impl/src/plan-generator/types.ts", "startLine": 42, "endLine": 45 },
        { "path": "impl/src/plan-generator/adaptation.ts", "startLine": 280, "endLine": 290 }
      ]
    }
  ]
}
```
<!-- MACHINE_DATA:SPEC_PROMOTION_CANDIDATE_AUDIT_V1:END -->

## Classification notes

| Family | Current fact | Required governance treatment |
| --- | --- | --- |
| Youth eligibility | The owner decision and Plan Generator already bind youth-and-adult eligibility without age-only blocking. | Preserve existing safety, guardian, privacy, account, and sharing boundaries. |
| Four active exact templates | The runtime manifest has four ACTIVE/ELIGIBLE approvals, while the working Plan Generator text does not name all exact runtime identities. | Amend the owning working spec in Todo 9; runtime existence is not canonical authority. |
| Two-a-day beta | The owner decision and reconstructed contract bind explicit `RECOVERY_PM_ALLOWED` behavior. | Preserve the beta safety contract and do not infer a dose ceiling. |
| Bounded adaptation | The working policy and runtime bind only a one-dimension next-frame reduction today. | Preserve the active reduction; the reverse edge remains approved but inactive until Todo 7. |
| 800/1500/3000 drift | The runtime activation record names exact templates absent from the corresponding working-spec section. | Reconcile working-spec observed facts in Todo 9 without closing its OPEN issues. |
| Competition division | The review limits division to local display context. | Add that display-only boundary to its owning working spec; never use it as dose or safety input. |
| Taper/race anchors | The packet is `NOT_REVIEWED` and `runtime_authority: false`. | Keep numeric taper inactive and require the separate three-stage evidence/receipt path. |
| Account/coach mode | Product truth and Plan Generator keep local SELF selection distinct from future authenticated coach acceptance. | Preserve current read-only coach-required behavior. |
| Sprint/ATP-PC | The approved runtime scope excludes sprint plans and ATP-PC activation. | Separate owner/science/spec authority is required; this plan cannot promote it. |
| TEN_K/GENERAL_ENDURANCE | Type vocabulary exists but the personalized/adaptive runtime scope does not support these events. | Fail closed and do not promote from type presence. |

All existing OPEN issues stay OPEN. Relative issue counts are unchanged because this
Todo does not edit an issue table.

[DRAFT_COMPLETE]
