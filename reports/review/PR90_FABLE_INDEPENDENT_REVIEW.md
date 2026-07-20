# PR #90 Fable 독립 검수 기록

```yaml
review_id: TO-FABLE-REVIEW-PR90-2026-07-20
reviewer: FABLE
role: 총책임자·독립 검수자
target_pr: 90
target_head: 0fe22bee3d426f99a62e212d626441ecddfff01c
target_base: 370321f07c61013dc91dec8e9de8d8a7a64d0cca (origin/main, merge-base 일치 — 충돌 없음)
verdict: APPROVE
blocking_findings: 0
non_blocking_findings: 3
runtime_authority: false
formal_privacy_acceptance: false
p1_plans_approved: 0/10
```

## 1. 검수 범위와 방법

코덱스 주장(CI 통과·충돌 없음·app/ 무변경)을 신뢰하지 않고 head를 직접
체크아웃하여 전수 확인했다. 변경 파일 8건(+99 −13) 전체 diff 판독, 테스트·검증기
전체 실행, 권한 경계 grep을 수행했다.

## 2. 코덱스 주장 대조 결과

| 코덱스 주장 | 독립 확인 결과 |
|---|---|
| 충돌 없음 | ✅ merge-base = origin/main@370321f, 단일 커밋 0fe22be, base 최신 |
| `app/` 변경 없음 | ✅ `git diff --name-only` 대상 8건 전부 reports/·specs/, `^(app/|impl/|.github/)` 매치 0건 |
| CI 통과 | ✅ 로컬 재현: `node --test specs/test-packages/*.test.mjs` = **60 pass / 0 fail** (main 대비 신규 테스트 1건 추가 후 통과) |

## 3. 실행 검증

- 준비 검증기 **20/20 exit=0** (validate-latest-owner-decision, validate-formation-spec-reconciliation 포함).
- Fail-closed 유지: screening / extraction / appraisal `--accepted` 모드 **3/3 exit=1** — 승인 우회 불가 상태 그대로.

## 4. 결정 충실도 (소유자 결정 5 + 기준 결정 8·9)

`specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` 신규 `file_transport` 블록을
정본 바인딩 문서(`FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md` 45–50행)와 대조:

| 바인딩 정본 | 스펙 반영 | 일치 |
|---|---|---|
| `sharing_first_delivery: SELECTIVE_EXPORT_AND_OS_SHARE` | `first_delivery: SELECTIVE_EXPORT_AND_OS_SHARE` | ✅ |
| `memo_inclusion_default: false` | 동일 | ✅ |
| `preview_and_confirmation: required` | `exact_field_preview_required: true` + `explicit_memo_inclusion_confirmation_required: true` | ✅ |
| `in_app_recipient_accounts: DEFERRED` | `preselected_recipient_allowed: false`, 수신자 계정 승인 없음 유지 | ✅ |
| 기준 결정 8 (`OWNER_FULL_LOCAL_BACKUP`) | `owner_full_local_backup_allowed: true` | ✅ |

기존의 무단 절대 금지 문구(`export_allowed: false`, `raw_text_export_allowed:
false`, `export_default: excluded`)는 두 메모 목적 모두에서
`default_export_inclusion: false` + `explicit_user_selected_file_inclusion:
allowed_under_file_transport_contract`로 대체됐고 잔존 0건이다. 이는 내가 PR #64
검수에서 지적한 export-drift(무단 권한 축소 상승)의 스펙 층 해소에 해당한다.

## 5. 권한 경계 검증

- diff 추가 라인에서 `runtime_authority: true`, `approved: true`,
  `owner_decision: APPROVE`, `formal_privacy_acceptance: true`,
  `server_share_authorized: true`, `in_app_recipient_sharing_authorized: true`
  매치 **0건**.
- NOTE_SAFETY 미해결 항목: `OI-NSR-EXPORT-DRIFT-001`만 NO /
  `RESOLVED_SPEC_ONLY`로 전환. **QUALIFIED-PRIVACY-001, CRYPTO-BINDING-001,
  RELEASE-PATH-001, RUNTIME-EVIDENCE-001은 모두 YES / OPEN 그대로** — 자격
  개인정보 검토·구현 게이트를 건너뛰지 않는다.
- 신규 결정 문서 `SELECTIVE_EXPORT_SPEC_PATCH_DECISION_2026-07-19.md`는
  `OWNER_DIRECTION_APPLIED_PENDING_INDEPENDENT_REVIEW` + 모든 권한 필드 false —
  스펙 정렬만 하고 구현·개인정보 수용·공유 기능을 승인하지 않음을 명시.
- 파일 전송이 분석 동의·상시 접근·Formation/plan/safety/reward/telemetry 효과로
  변환되는 것을 금지하는 조항이 스펙과 테스트 양쪽에 고정됨.

## 6. 검증기 동기 갱신 검증 (규칙 §4)

CONF-007 상태 전이(`PATCH_REQUIRED` → `PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW`)가
세 곳에서 동기 갱신됐다:

1. `FORMATION_SPEC_CONFLICT_REGISTER.csv` — 상태·서술 갱신, 나머지 11건 불변
2. `validate-latest-owner-decision.mjs` — expectedStatusByConflict 맵 동기
3. `validate-formation-spec-reconciliation.mjs` — 맵 + 개별 assert +
   `patches_applied: 4/12→5/12` 동기
4. 핸드오프 문서 카운트(PATCH_REQUIRED 5→4, APPLIED 4→5)도 산술 일치

신규 계약 테스트(`formation-owner-direction-binding.test.mjs` +23)는 file_transport
10개 키의 정확-1회 존재, 대체 필드의 정확-2회 존재, 금지 문구 부재를 고정한다.

## 7. 지적 사항 (비차단 — 규칙 14에 따라 지적만, 수정하지 않음)

- **n1 (기록 출처)**: 결정 문서의 소유자 원문 인용("메모를 코치에게나 친구나…
  선택하게하면 문제 없어")은 리포 내 기존 어느 기록에도 없는 신규 인용이다
  (코덱스의 소유자 창구에서 유입된 것으로 보임). 반영 내용 자체는 이미 병합된
  기준 결정 8·9와 바인딩 결정 5의 범위를 벗어나지 않아 차단하지 않으나, 앞으로는
  소유자 원문 intake 기록을 구현 PR과 같거나 그보다 먼저 리포에 남겨 검수자가
  인용 출처를 리포 안에서 추적할 수 있게 할 것을 권고한다.
- **n2 (테스트 커버리지)**: 스펙의 `preselected_recipient_allowed: false` 키는
  신규 테스트의 10개 고정 키 목록에 빠져 있다. 다음 테스트 정비 시 추가 권고.
- **n3 (사소)**: `assert.doesNotMatch(..., /…/gmu)`의 `g` 플래그는 불필요하며
  전역 정규식 lastIndex 관례상 제거가 안전하다. 동작에는 문제 없음.

## 8. 판정

**APPROVE.** 소유자 결정 5와 기준 결정 8·9를 스펙 층에서 충실히 반영했고,
검증기·테스트 동기 갱신이 완전하며, 권한 상승·게이트 우회가 없다. 3자 합의
규칙에 따라 사장님 확인 후 병합을 권고한다. 스펙 정렬일 뿐 앱 구현은 별도이며,
구현은 내(Fable) 소관으로 이후 독립 검수를 다시 거친다.

[END_REVIEW]
