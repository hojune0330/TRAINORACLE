# Formation P1 Target Patch Plans

```yaml
packet_id: TO-FORMATION-P1-TARGET-PLANS-2026-07-16
source_issue_table: specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md#15-open-issues
state: READY_FOR_OWNER_APPROVAL
approved_plans: 0
ready_for_owner_approval: 10
research_reconciliation: 10/10
runtime_authorized: false
```

## Purpose

These plans turn the ten canonical P1 blockers into bounded, reviewable patches. They
do not approve a policy, close an issue, patch the canonical Formation draft, or start
runtime work. `COACH_HOJUNE` must record the Human Decision in each plan after its
named prerequisites and specialist reviews are satisfied.

연구 자료를 10개 계획에 연결한 것은 검토 준비일 뿐, 계획 승인을 뜻하지 않습니다. 각 계획의
이름이 적힌 사람 검토와 책임자 결정이 기록되기 전에는 정본 사양 패치와 런타임 작업을
시작할 수 없습니다.

## Index

| Canonical P1 | Target plan | Current state | Readiness class |
|---|---|---|---|
| `OI-FA-COACH-RULESET-001` | [01 coach ruleset](./01-coach-ruleset.md) | READY_FOR_OWNER_APPROVAL | READY_AFTER_NAMED_APPROVAL |
| `OI-FA-LOAD-COMPONENT-001` | [02 load component](./02-load-component.md) | READY_FOR_OWNER_APPROVAL | REQUIRES_HIGH_ACCURACY_RESEARCH |
| `OI-FA-MINIMUM-EVIDENCE-001` | [03 minimum evidence](./03-minimum-evidence.md) | READY_FOR_OWNER_APPROVAL | REQUIRES_HIGH_ACCURACY_RESEARCH |
| `OI-FA-PLAN-VERSION-BINDING-001` | [04 plan version binding](./04-plan-version-binding.md) | READY_FOR_OWNER_APPROVAL | REQUIRES_RUNTIME_TARGET |
| `OI-FA-PILOT-PROTOCOL-001` | [05 pilot protocol](./05-pilot-protocol.md) | READY_FOR_OWNER_APPROVAL | READY_AFTER_NAMED_APPROVAL |
| `OI-FA-CALENDAR-SCHEMA-BINDING-001` | [06 calendar schema binding](./06-calendar-schema-binding.md) | READY_FOR_OWNER_APPROVAL | REQUIRES_RUNTIME_TARGET |
| `OI-FA-UPSTREAM-SAFETY-PRIVACY-BINDING-001` | [07 safety/privacy binding](./07-upstream-safety-privacy-binding.md) | READY_FOR_OWNER_APPROVAL | REQUIRES_RUNTIME_TARGET |
| `OI-FA-RULE-CLASSIFIER-EXPOSURE-BINDING-001` | [08 classifier exposure binding](./08-rule-classifier-exposure-binding.md) | READY_FOR_OWNER_APPROVAL | REQUIRES_RUNTIME_TARGET |
| `OI-FA-PRODUCT-PROJECTION-001` | [09 product projection](./09-product-projection.md) | READY_FOR_OWNER_APPROVAL | READY_AFTER_NAMED_APPROVAL |
| `OI-FA-RECORD-GOVERNANCE-001` | [10 record governance](./10-record-governance.md) | READY_FOR_OWNER_APPROVAL | READY_AFTER_NAMED_APPROVAL |

## Approval Rule

Approval is per plan, never by packet inference. An approved plan authorizes only its
listed specification patch order. Runtime, migration, participant enrollment, account
sharing, and canonical promotion require later gates and evidence.
