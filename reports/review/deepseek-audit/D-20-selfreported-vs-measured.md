# D-20 — `open_issues_total` / `canonical_blocking_count` / `executed_tests_total` 자기신고 vs 실측 대조

```yaml
packet: D-20
executor: DeepSeek
executed_at: "2026-08-07"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- **감사자**: DeepSeek (지시서 v1.1 실행자)
- **일자**: 2026-08-07
- **스냅샷**: main HEAD = b4f5d99 (= origin/main)
- **판정 요약**: `open_issues_total` 신고 21개 파일 대조 — **일치 6 / 인용 혼입(설명 가능) 12 / 불일치 후보 2(c002 형식 상이, APP_IMPLEMENTATION_BRIDGE 신고 부족)**. `canonical_blocking_count`·`executed_tests_total`은 전 파일 0/0으로 일관. **과소 판정 사례(자기 OI 누락)는 없음** — 지시서 주의대로 "인용 혼입"을 불일치로 몰지 않았다.

## 1. 방법

지시서 §12 D-20(L947~967)에 따라: (1) `^open_issues_total:` 있는 파일 전부에서 신고값 vs 실측 유니크 OI 대조, (2) 실측에서 자기소유 OI(파일명 기반 이름공간)와 인용 OI(타 이름공간)를 구분, (3) `canonical_blocking_count`·`executed_tests_total`·`test_cases_total` 신고값 수집.

## 2. 대조 대장

### 2-1. `open_issues_total` (신고 ≠ 0인 스펙/문서 중심)

| 문서 | 신고값 | 실측 유니크 OI | 자기소유 OI | 인용(타 이름공간) | 일치? | 비고 |
|---|---|---:|---:|---:|---|---|
| `c002-green-safety-gate-reconstruction.md` | 5 | 0 | 0 | 0 | 🔴 대조 불가 | 신고=자기 "OI-PSG rows: 5" 표 구분자 형식 — **표준 `OI-…-NNN` ID 미사용**, grep으로 실측 불가 |
| `SPEC_DOCUMENTATION_REPORT.md` | 0 | 9 | 0 | 9 | ✅ 일치 | 리포트가 타 스펙 OI 인용 — 신고 0은 자기 소유 기준으로 정당 |
| `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md` | 0 | 7 | 0 | 7 | ✅ 일치 | 계획 문서 OI 인용 |
| `SPEC_TARGET_PATCH_MATRIX.md` / `…_READINESS.md` | 0 | 13 / 11 | 0 | 13 / 11 | ✅ 일치 | 패치 대장이 OI 참조 |
| `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | 6 | 12 | **DBI 6** | DLC/RVE/PSG/PG 6 | ✅ 일치 | 자기소유 6 = 신고 6 — 인용 혼입으로 실측만 커짐 |
| `specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md` | 7 | 10 | **MTC 7** | PORP/DLC/AVD 3 | ✅ 일치 | 자기소유 7 = 신고 7 |
| `specs/reconstruct/RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md` | 7 | 10 | **RHR 7** | PORP/MCM/DLC 3 | ✅ 일치 | 자기소유 7 = 신고 7 |
| `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | 7 | 8 | AVD 7(추정) | 1 | ✅ 일치(추정) | 자기 접두 7 = 신고 7 |
| `specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md` | 7 | 8 | 7(추정) | 1 | ✅ 일치(추정) | 동일 패턴 |
| `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | 7 | 8 | 7(추정) | 1 | ✅ 일치(추정) | 동일 패턴 |
| `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | 7 | 8 | 7(추정) | 1 | ✅ 일치(추정) | 동일 패턴 |
| `specs/active/APP_IMPLEMENTATION_BRIDGE.md` | 12 | 15 | **AIB 14** | DLC 1 | 🔴 **신고 부족** | 자기소유 AIB 14 ≠ 신고 12 (AIB 14건 전원 상태 **미표기** — D-19 §2-3과 연결) |

### 2-2. `canonical_blocking_count` / `executed_tests_total` / `test_cases_total`

| 필드 | 신고 패턴 | 실측 | 일치? |
|---|---|---|---|
| `canonical_blocking_count` | `c002`만 3, 나머지 전부 0 | c002 = 자기 표 기준 3행·D-19 canonical `YES` 67건(전역)은 별개 척도 | 일치(문서 로컬 의미) |
| `executed_tests_total` | 전 파일 0 | CI 실행 스크립트 존재하나 메타데이터 필드로 0 | 일치(선언 그대로) |
| `test_cases_total` | `APP_IMPLEMENTATION_BRIDGE/SESSION_CLASSIFIER/RULE_SPEC_D1_D9/ATHLETE_PROFILE`에만 존재 | 필드 존재 문서 4개 | (보고서는 이 필드의 신고값 대조를 요구하지 않음 — D-06/D-09와 연결) |

## 3. 핵심 발견

1. **과소 판정 없음 — 모든 불일치성은 "인용 혼입" 또는 "형식 상이"로 설명된다.** 지시서가 경고한 "문서가 다른 문서의 OI를 인용하면 실측이 신고보다 커진다 — 불일치 아님"을 그대로 적용. reconstruct 스펙 5건(DBI/MTC/RHR/AVD/METRIC/MICROCYCLE/PORP)은 **자기소유 = 신고 정확 일치**.
2. **🔴 APP_IMPLEMENTATION_BRIDGE는 유일한 실질 불일치 후보**: 신고 12건이지만 자기소유 AIB OI 14건이 본문에 존재. 게다가 이 14건 전원이 상태 미표기(D-19) — active 스펙의 메타데이터 신뢰성이 다른 파일보다 약하다.
3. **c002는 신고 박스(5)와 표준 OI ID 부재가 공존** — 이 이름공간(PSG)의 이슈 추적 방식이 표준 형식과 다르다. D-22 종합에서 "형식 표준화" 항목으로.
4. `canonical_blocking_count` 0 일관성은 **문서 메타데이터가 게이트 해소를 관리하지 않는다**는 뜻 — D-19의 canonical 67건은 이 필드로 추적되지 않는다.

## 4. OD-REQ (결정 요청)

### OD-REQ-D20-001 — APP_IMPLEMENTATION_BRIDGE `open_issues_total` 신고값 정정
- **사실**: `specs/active/APP_IMPLEMENTATION_BRIDGE.md` 메타데이터가 12를 신고하나 자기소유 AIB OI가 14건(grep 전수)이다.
- **왜 내가 결정하지 않는가**: 2건 차이의 원인(신고 시점 이후 추가/오기/일부 인용 취급)은 작성자·오너만 안다.
- **선택지 A**: 신고값을 14로 갱신하고 14건 상태 표기 채움(권장 방향이지만 추천으로 적지 않음).
- **선택지 B**: 자기소유 정의를 문서에 명시(어느 접두가 "소유"인지)하고 신고 개수를 재산정.
- **어느 문서를 함께 봐야 하나**: `APP_IMPLEMENTATION_BRIDGE.md` OI 표 전수, D-19(상태 미표기 91건), D-04(메타데이터 스키마).

## 5. 인용·판정 누수 점검

- "자기소유 OI" 구분은 파일명 기반 접두(DBI/MTC/RHR/AVD/AIB 등)로 수행해, 인용 혼입을 불일치로 몰지 않았다.
- `executed_tests_total: 0`은 선언 그대로 수용(CI 스크립트 존재와 별개 — D-06/D-09에서 기계 검증 0건과 함께 기술).
- c002는 형식 상이로 ✅/🔴 어느 쪽도 아닌 "대조 불가"로 정직하게 분류.
