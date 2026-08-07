# D-09. 규칙 ID × 기계 검증 매트릭스

```yaml
packet: D-09
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- 패킷: D-09 (`WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md` §6 D-09)
- 감사자: DeepSeek (지시서 v1.1 실행자) / Round 3
- 기준 커밋: b4f5d99 (main HEAD = origin/main)
- pending: 없음

## 1. 개요

**목적:** 어떤 이름공간이 실제로 기계 검증되고, 어떤 것이 문서에만 있는지 한 장으로 만든다. C-9에서 `DSB-INV-*`는 검증 0건으로 확정 — 나머지 21개 이름공간도 미확인이었다.

**방법 (지시서 §6 D-09 명령 그대로):**
- 각 이름공간에 대해 `grep -rl "$ns-"`으로 md 문서 수 / `specs/test-packages/` 검증기 등장 / `app/src impl/src runtime-evidence` 코드 등장 수집
- CI 등록 여부는 `.github/workflows/ci.yml` contract-tests 잡 목록과 교차 확인
- 오탐 정밀 검증: validator>0인 이름공간은 매치 행을 개별 확인 (부분 문자열 vs 실제 규칙ID)

**판정 4개:** `기계검증됨` / 🟡 `검증기 있으나 CI 밖` / 🔴 `문서만 존재` / `판정불가`

## 2. 결과 요약

| 판정 | 건수 | 이름공간 |
|---|---|---|
| 기계검증됨 | **0** | — |
| 🟡 검증기 있으나 CI 밖 | 1 | FRV2-CONF |
| 🔴 문서만 존재 | 21 | FA-TC, DSB-INV, PG-TC, AIB-TC, TC-AP, SC-TL, SC-REB, SC-PST, GATE-BINDING, RUNTIME-EVIDENCE, PHYSIO-SOURCE, SOURCE-CONSUMPTION, TC-EPOC, EVALUATOR-BINDING, RATIONALE-PRIVACY, CALENDAR-MAPPING, BRIDGE-BINDING, VERSION-BINDING, SURFACE-BINDING, GUARDIAN-CONSENT, COACH-RULESET |
| 판정불가 | 0 | — |

**최상위 발견:** 스캔에 포함된 22개 규칙 이름공간 중 **CI에서 기계검증되는 이름공간은 0건**. 검증기가 이름공간을 인지하는 경우는 `FRV2-CONF` 1건뿐인데 그것도 검증기 4종 전부 CI 밖 고아(`🟡`)다. 이는 지시서의 가설("나머지 이름공간은 아무도 확인한 적 없다")을 전수 실측으로 확인한 결과다.

## 3. 매트릭스 표 (지시서 §6 출력 형식)

| 이름공간 | md 문서 수 | 검증기에 등장 | 코드에 등장 | CI가 그 검증기를 부름? | 판정 |
|---|---:|---:|---:|---|---|
| FA-TC | 8 | 0 | 0 | — | 🔴 문서만 존재 |
| DSB-INV | 16 | 0 | 0 | — | 🔴 문서만 존재 (C-9 확정 재현) |
| FRV2-CONF | 25 | 4 | 0 | 아니오 — 4종 전부 CI 0 등록 | 🟡 검증기 있으나 CI 밖 |
| PG-TC | 3 | 0 | 0 | — | 🔴 문서만 존재 |
| AIB-TC | 2 | 0 | 0 | — | 🔴 문서만 존재 |
| TC-AP | 2 | 0 | 0 | — | 🔴 문서만 존재 |
| SC-TL | 2 | 0 | 0 | — | 🔴 문서만 존재 |
| SC-REB | 3 | 0 | 0 | — | 🔴 문서만 존재 |
| SC-PST | 3 | 0 | 0 | — | 🔴 문서만 존재 |
| GATE-BINDING | 28 | 0 | 0 | — | 🔴 문서만 존재 |
| RUNTIME-EVIDENCE | 24 | 0 | 1(README.md) | — | 🔴 문서만 존재 (§4-F4) |
| PHYSIO-SOURCE | 23 | 0 | 0 | — | 🔴 문서만 존재 |
| SOURCE-CONSUMPTION | 23 | 0 | 0 | — | 🔴 문서만 존재 |
| TC-EPOC | 2 | 0 | 0 | — | 🔴 문서만 존재 |
| EVALUATOR-BINDING | 13 | 0 | 0 | — | 🔴 문서만 존재 |
| RATIONALE-PRIVACY | 13 | 0 | 0 | — | 🔴 문서만 존재 |
| CALENDAR-MAPPING | 14 | 0 | 0 | — | 🔴 문서만 존재 |
| BRIDGE-BINDING | 13 | 0 | 0 | — | 🔴 문서만 존재 |
| VERSION-BINDING | 8 | 3(오탐) | 0 | 아니오 (오탐) | 🔴 문서만 존재 (§4-F3) |
| SURFACE-BINDING | 9 | 0 | 0 | — | 🔴 문서만 존재 |
| GUARDIAN-CONSENT | 7 | 0 | 0 | — | 🔴 문서만 존재 |
| COACH-RULESET | 8 | 4(오탐) | 0 | 아니오 (오탐) | 🔴 문서만 존재 (§4-F3) |

※ "검증기에 등장" 수치는 상단 스캔의 부분 문자열 매치 수 — 오탐 2종(§4-F3)은 정밀 확인으로 배제. md 문서 수는 지시서 스캔 그대로(워크오더·본 감사 보고서 자체 포함 상한값, §6 한계 참조).

## 4. 세부 발견

**F1 — 기계검증 이름공간 0건:** CI contract-tests가 실행하는 검증기 9종(reasoning-tier-harness, formal-approval-foundation, p1-target-plans, test-wo016-gate-verifier, detailed-prescription-catalog, advisory-session-recommender, dependency-security-audit, journal-decoration-contract, decoration-assets 테스트)은 내용 마커·계획 구조·카탈로그 항목을 검사하며, 위 22개 규칙 이름공간의 규칙ID를 직접 참조하지 않는다. → 22/22 중 기계검증됨 0건.

**F2 — FRV2-CONF가 유일한 검증기 인지 이름공간, 그러나 전부 CI 밖:** 매칭 검증기 4종(`validate-latest-owner-decision.mjs`, `validate-formation-spec-reconciliation.mjs`, `validate-formation-final-review-preparation.mjs`, `formation-spec-reconciliation.test.mjs`) 모두 `ci.yml` grep 0건. FRV2-CONF 규칙(충돌 레지스터 정합)은 기계 검사 로직이 **실제 존재**하지만 CI에서 아무도 부르지 않음 — F-2/D-08 발견과 일치.

**F3 — VERSION-BINDING / COACH-RULESET의 "validator=3/4"는 오탐:** 매치 행 정밀 확인 결과 전부 `OI-FA-PLAN-VERSION-BINDING-001` / `OI-FA-COACH-RULESET-001` 형식의 **OI-FA 이슈 ID**(`test-wo016-gate-verifier.mjs:29,32`, `validate-formation-p1-target-plans.mjs:10,13`, `wo016-gate-verifier.mjs:32,35`)이며, 규칙ID `VERSION-BINDING-001`·`COACH-RULESET-001` 자체를 검사하는 로직은 없다. `FORMATION_COACH_RULESET_FIXTURES.md` 매치는 픽스처 문서(실행 가능한 검증기 아님). → 이름공간 규칙 수준 검증 0건으로 정정.
- (완화 근거 참고) `OI-FA-*` 계획 파일 `04-plan-version-binding.md`/`01-coach-ruleset.md` 자체는 CI의 p1-target-plans 검증기가 구조 검사하므로, **"규칙을 다루는 계획 문서" 수준까지는 간접 커버**가 존재. 그러나 규칙ID 수준·계약 조항 수준 검증은 아님.

**F4 — RUNTIME-EVIDENCE code=1은 문서, 실코드 아님:** 매치는 `runtime-evidence/d9-evaluator/README.md` 1건뿐. 명명된 규칙ID(`RUNTIME-EVIDENCE-001`)를 참조하는 실행 코드는 `app/src`·`impl/src`·`runtime-evidence` 어디에도 없음 → 🔴.

## 5. OD-REQ

**OD-REQ-D09-001 (사실관계):** 검증기 CI 목록을 기준으로 할 때, 스캔한 22개 규칙 이름공간 중 기계검증되는 이름공간은 0개이고, 유일한 검증기 인지 이름공간(FRV2-CONF)도 검증기 4종 전부 CI 밖(🟡)이다.

- 사실: §3 매트릭스 + §4-F1~F4 (ci.yml 교차 확인, 오탐 정밀 검증 완료)
- 왜 내가 결정하지 않는가: 어느 이름공간에 기계검증 우선순위를 두고 CI에 추가·유지할지는 제품 프로세스 소유자의 커버리지 목표 결정 사항. 또한 `.github/`는 쓰기 금지(T-12)라 이 감사에서 CI를 바꿀 수 없음.
- 선택지 A: 향후 작업에서 "이름공간별 검증 커버리지 우선순위 목록"(예: 안전·권한 계열 GATE-BINDING/PHYSIO-SOURCE 우선)을 별도 제안 문서로 작성하고, CI 추가는 승인 절차를 거친다.
- 선택지 B: 문서로만 남긴다 (현행 유지). 단, 🟡 FRV2-CONF 검증기 4종의 CI 등록 누락은 별도 D-08 OD-REQ-D08-001과 계획 문서에서 이미 다루는 대상.
- 어느 문서를 함께 봐야 하나: `WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md` §6 D-09, `.github/workflows/ci.yml`(읽기 전용 기준), `INCOMPLETE_WORK_BACKLOG.md`(F-2), D-08 보고서.

## 6. 한계

- 이름공간 22종은 지시서가 지정한 목록으로 한정 — D-01 인벤토리의 전체 309개 이름공간 중 일부. 전체 목록의 검증 커버리지는 본 표의 일반화 대상이 아님.
- md 문서 수는 지시서 스캔 그대로인데, `WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md`·본 감사 보고서·과거 리뷰 문서가 이름공간 문자열을 포함해 상한으로 과대계상됨(예: FA-TC md=8의 일부는 감사 산출물). 정밀 필요 시 `specs/`·`reports/target-patch-plans/` 한정 재계산이 가능하나 새 명령이므로 미실시.
- `grep -rl`은 파일 수 기준(발생 빈도 아님). 검증 "강도"(몇 개 규칙을 검사하는지)는 D-07(D-07) 및 D-06 인벤토리에서 보완.
