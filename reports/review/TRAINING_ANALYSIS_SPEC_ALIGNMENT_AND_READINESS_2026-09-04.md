# TRAINING_ANALYSIS_SPEC_ALIGNMENT_AND_READINESS_2026-09-04.md

```yaml
doc_id: trainoracle-training-analysis-spec-alignment-20260904
title: TrainOracle 훈련 분석 정합성 검토와 개선 준비
version: "1.0"
status: REVIEW_AND_IMPLEMENTATION_READINESS_DRAFT
owner: COACH_HOJUNE
reviewed_at: "2026-09-04"
reviewed_branch: main
reviewed_head: 296a84533a9f1f9c7247110dfb08f57331023689
remote_main_observed: 296a84533a9f1f9c7247110dfb08f57331023689
scope: training_analysis_and_official_COROS_integration_readiness
full_spec_corpus_audit: false
runtime_modified: false
spec_authority_changed: false
issue_closure: false
canonical_promotion: false
provider_account_accessed: false
production_verification: false
```

## 1. 먼저 읽을 결론

**기초 집계와 설명은 구현되어 있지만, 워치의 실제 수행을 개인 맞춤 훈련 설계에
연결하는 과정은 아직 충분하지 않다.** COROS의 새 MCP 경로는 이 공백을 줄일
기회다. 연결 버튼만 추가하기보다 데이터 정밀도·출처·중복·분석 활용을 함께
완성해야 한다.

권장 순서는 다음과 같다.

1. 외부값 추가 시 원래 직접 입력한 분석 근거까지 사라지는 문제, 충돌 처리,
   부분 집계 표시를 먼저 바로잡는다.
2. 가져온 거리·시간을 정확히 보존하고, 어떤 분석에 사용할지 계약을 채택한다.
3. COROS 사용자별 조회와 간편 일지 보완을 연결한다.
4. 계획한 반복·회복과 실제 랩을 비교한다.
5. 그 근거를 다음 주기 후보의 설명·유지·제외·요청된 변경에 연결한다.

즉, **기록을 받음 -> 분석에 사용함 -> 수행을 비교함 -> 다음 선택에 활용함**은
서로 다른 완료 조건이다. 현재 수용되지 않은 종합 부하 공식이나 자동 증량을
슬쩍 끼워 넣는 순서가 아니다. 기존 청소년·자가 훈련·일 2회 사용 범위는 유지한다.

COROS 조사와 미발송 질문 초안은
[COROS 연동 준비서](../research/COROS_MCP_INTEGRATION_READINESS_2026-09-04.md)에 분리했다.

## 2. 검토 범위와 권위

전체 스펙을 다시 모두 완독했다고 주장하지 않는다. 이번에는 훈련 분석에 직접
연결되는 계약·결정·코드와 이전 감사의 해당 부분을 우선 대조했다. 다른 기능의
완성률이나 전체 이슈 수를 과거 대화에서 가져오지 않았다.

| 실제 확인한 문서 | 역할과 주의점 |
|---|---|
| `PRODUCT_NORTH_STAR.md`, `AGENTS.md` | 현재 제품 방향과 변경 금지 경계 |
| `DATA_PROVENANCE_RUNTIME_ADOPTION_DECISION.md` | 필드별 EXPLICIT/DERIVED/MISSING 분석 자격. 과거 UNMERGED 표기를 현재 Git 상태로 오인하지 않음 |
| `SPEC_QUICK_PROGRESSIVE_JOURNAL_V2_DECISION.md` §5~6 | 간편 일지 보완, 혼합 출처 보존, 원문 없는 분석 사본 |
| `EXTERNAL_RECORD_INTEGRATION_SPEC.md` v0.2 | DRAFT. 공식 제공자 확인함·동의·분석 제외 및 운영 경계 |
| `PHYSIO_SOURCE_TRUST_SPEC.md` v1.0 | DRAFT. 출처·품질·동의·충돌·신선도와 사용 목적을 구분 |
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` v0.1 | DRAFT. 출처 기반 표시 계약, 계산식 자체의 최종 권위 아님 |
| `METRIC_ALGORITHM_CONTRACT.md` v0.1 + Round 4 결정 N2 | 봉투/경계 수용과 CTL/ATL/TSB 등 수식 수용은 별개 |
| `CUMULATIVE_DISTANCE_ANALYSIS_CONTRACT.md` v0.1 | DRAFT지만 `CUMULATIVE_DISTANCE_V1_ONLY`의 좁은 구현 바인딩 명시 |
| `ENERGY_SYSTEM_ACCUMULATION_CONTRACT.md` §4/6/10 | 직접 선택 목적 누적, 동일 ID 충돌, 제외 수 표시 |
| `PERSONAL_ORACLE_EXPLANATION_CONTRACT.md` v1.0 | 설명 V1, 근거·미확인 정보 구분. 성과 예측/자동 처방 권한 아님 |
| `TRAINING_SESSION_PRESCRIPTION_CONTRACT.md` v0.7 | 구조화된 실제 처방, 방법/근거/주기 기록 연결. 새 템플릿 자동 승인 아님 |
| `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` v0.2 | 실제 사용한 구조화 입력만 설명, 개인 원문과 공개 공유 분리 |
| `docs/UX_UI_VISUAL_STANDARD.md` | 부분 집계·미기록·접근성·모션·폰트 표시 기준 |

초안의 모든 문장을 이미 승인된 런타임 의무로 취급하지 않는다. 아래에서도
**재현된 동작 결함**, **현재 의도된 제한**, **후속 수용이 필요한 설계 공백**을 구분한다.
과거 [9월 2일 감사](SPEC_TO_IMPLEMENTATION_GAP_AUDIT_2026-09-02.md)의 미병합/배포 수치는
현재 상태가 아니다. 현재 본문은 #316 병합 이후의 main을 기준으로 한다.

## 3. 우선 발견 사항

### A07. 워치값을 붙이면 원래 직접 고른 에너지 기록까지 사라진다

**우선순위 P1, 첫 수정 대상 / 주 담당과 Terra가 각각 합성 실행으로 확인.**
추가 검토에서 발견해 A07 ID를 유지하되 실제 처리 순서는 맨 앞이다.

`journal-observation.ts:185`~`:202`는 외부 파생 필드가 하나라도 있으면 관측
전체의 trust를 `SOURCE_NOT_VERIFIED`로 바꾼다. 에너지 원장 `:86`과 개인 오라클
`:40`은 관측 전체가 ACCEPTED여야 사용한다. 결과적으로 import하지 않은 직접
선택 목적/RPE도 함께 빠진다.

같은 합성 일지의 목적 BASE와 RPE 6을 유지하고 거리/시간만 파일 출처로 보완했다.
주 담당이 실제 투영 함수와 에너지 원장/오라클 함수를 메모리에서 실행한 결과:

| 단계 | 목적/RPE | 전체 trust | BASE 누적 | 오라클 구조화 근거 수 |
|---|---|---|---:|---:|
| 보완 전 | BASE/6, 각각 EXPLICIT | ACCEPTED | 1회 | 1건 |
| 보완 후 | BASE/6, 각각 그대로 EXPLICIT | SOURCE_NOT_VERIFIED | 0회 | 0건 |

**저장된 목적/RPE 원본이 삭제된 것은 아니다. 분석에서 빠지는 문제다.** 가져온
객관값을 아직 분석하지 않는 정책은 유지하더라도, 관계없는 직접값까지 제외하는
것은 부분 기록의 필드별 수용 원칙과 맞지 않는다. 다른 집계 경로는 필드별
EXPLICIT를 읽기 때문에 화면별 분석 근거가 달라질 여지도 함께 검증해야 한다.

**개선:** 객체 전체의 출처와 필드별 분석 자격을 분리한다. 외부 거리·시간은 현행
규칙에 따라 제외하되, 기존 직접 목적/RPE는 같은 값을 같은 근거로 유지한다.
객체 전체를 ACCEPTED로 바꾸는 해결책은 외부값까지 개방하므로 사용하지 않는다.
이는 공급자 데이터 개방 승인과 분리해서 처리할 수 있는 기존 동작 정합성 수리다.

### A01. 동일 기록의 출처 충돌을 놓치는 에너지 원장

**우선순위 P1 / 합성 실행으로 재현 / 현재 데이터 무결성 결함.**

- 계약: `specs/reconstruct/ENERGY_SYSTEM_ACCUMULATION_CONTRACT.md:117`은 같은
  source kind + source ID의 signature가 다르면 해당 ID 전체를 제외하도록 정한다.
- 코드: `app/src/domain/energy-system-ledger.ts:163`은 적격 관측만 먼저 골라
  그룹화한다. 같은 ID의 legacy/untrusted 사본은 이후 충돌 비교에 들어가지 않는다.
- 재현: 같은 ID로 BASE/EXPLICIT/ACCEPTED 사본과 BASE/legacy 사본을 넣으면
  반영 1건, BASE 1회가 남고 `CONFLICTING_SOURCE_ID`가 나오지 않는다.
- 경로: `personal-oracle.ts:99`도 이 원장을 사용한다. 일지 목록 파서는 각 행을
  읽되 동일 ID를 제거하지 않는다(`journal-schema.ts:432`). 다만 실제 고객 데이터에
  이 충돌이 발생했다는 운영 증거를 이번에 수집한 것은 아니다.

**개선:** 기간 안의 같은 ID를 먼저 모으고, 출처/값 충돌 판정을 마친 뒤 필드별
자격을 적용한다. 동일 사본, 다른 값, 다른 provenance, 다른 trust, 기간 밖 사본을
구분한다. 제외된 원본 행 수와 충돌 ID 수를 섞어 더하지 않도록 수치 단위도 고정한다.
현재 정상 기록의 수치를 바꾸는 새 생리학적 공식은 필요 없다.

### A02. 짧은 운동의 초 단위 정보가 가져오기에서 사라진다

**우선순위 P1 / 실제 파서 실행으로 재현 / 외부값 분석 개방 전 선행 수정.**

`app/src/domain/import/activity-file.ts:7`의 중간 형식은 날짜·이름·종목·거리 문자열·
정수 분·평균 페이스만 보유한다. TCX 랩은 합산되고 원래 구간은 남지 않는다
(`activity-file.ts:97`). JSON/CSV도 저장 형식에 맞춰 분을 반올림한다
(`structured-activity-file.ts:43`).

| 합성 원본 | 파서 결과 | 문제 |
|---|---|---|
| 400m / 1.33분 = 79.8초 | 0.40km / 1분 / 3:20/km | 평균 페이스는 원래 시간으로 계산, 시간은 반올림되어 같은 정밀도의 값이 아님 |
| 100m / 0.4분 = 24초 | 0.10km / 0분 / 4:00/km | 실제로 운동한 시간이 0분으로 남음 |

현재 가져온 값이 분석에서 제외되므로 이것을 현행 분석 결과의 오계산으로
과장하지 않는다. 그러나 이 형식 그대로 COROS 값을 분석에 넣으면 상세 반복·
회복 비교와 짧은 에너지 시스템 세션을 제대로 다룰 수 없다.

**개선:** 수신 원본의 구조화된 초·미터·시각/시간대·운동 종목·시간의 의미를
보존하고, 화면에서만 분/초를 포맷한다. 이동시간/총경과시간/타이머시간은 별개다.
기존 일지 읽기는 유지하며, 이미 잃은 초를 평균 페이스에서 역산해 복구했다고
하지 않는다. 가능한 자료는 다시 가져오고 나머지는 원래 정밀도 한계를 표시한다.

### A03. 홈 요약에서는 일부 기록이 빠졌다는 사실을 알기 어렵다

**우선순위 P2 / 코드 확인 / 표시 정합성 개선.**

- `CumulativeDistancePanel.tsx:55`의 compact 분기는 주·월·연간 합계를 보여주지만
  부분 집계 여부와 제외/중복 정보를 보여주지 않는다.
- `EnergySystemLedgerPanel.tsx:55`의 compact 분기도 같은 문제가 있다.
- 전체 분석 화면에는 더 자세한 설명이 있다. 따라서 앱 전체에 안내가 없다는
  문제가 아니라, 사용자가 가장 먼저 보는 홈에서 전체 값으로 오해할 수 있다는 문제다.
- UX 시각 기준 §4와 누적 거리/에너지 계약은 차트 가까이에 집계 범위를 요구한다.

**개선:** 숫자 바로 아래에 `분석에 사용한 기록 N건 · 확인 필요 N건` 같은 짧은
표시를 둔다. 누르면 원인을 읽고 가져온 운동 확인함으로 이동한다. 기간이 서로
겹치는 주/월/연간의 제외 수를 합쳐 하나의 총 제외 건수로 만들지 않는다.

### A04. 오라클의 두 기간 비교에 이전 기간의 자료 범위가 빠진다

**우선순위 P2 / 코드 확인 / 설명 근거 개선.**

`personal-oracle.ts:60`과 `:66`은 두 기간을 같은 엔진으로 계산한다. 그러나
`:83`~`:91`의 표시 정보는 현재 4주의 반영/제외 수만 포함한다. 이전 기간에
가져온 값이나 충돌 기록만 있는 경우, 단순히 비교할 기록이 없다고 설명한다.

**개선:** 두 기간 각각 거리·반영 수·제외 수·기간 경계·중복 수를 보존하고,
`기록 자체 없음`과 `기록은 있지만 분석 기준을 충족하지 않음`을 구분한다.
지난 기간이 부분 집계라는 이유로 상대 증감률이나 개선 판정을 강하게 내리지 않는다.

### A05. 기기 연동과 분석 반영은 아직 서로 다른 미완료 단계다

**우선순위 P1 / 의도된 제한 / 무작정 풀면 안 되는 수용 공백.**

- `field-provenance.ts:94`의 파생 규칙 목록은 비어 있다. `:140`~`:143`은
  외부 import 토큰을 별도로 거부하므로 규칙 이름만 등록해도 열리는 구조가 아니다.
- `EXTERNAL_RECORD_INTEGRATION_SPEC.md:142`와 간편 일지 결정 `:126`도 확인된
  외부값을 분석에 쓰려면 별도 출처 수용 규칙이 필요하다고 명시한다.
- `coros-oauth-callback/index.ts:1`은 안내 페이지이며 실제 OAuth 교환을 하지 않는다.
  `coros-workout-push`는 파트너 방식의 수신 준비이지 MCP 조회/계획 전송 구현이 아니다.

**개선:** 공식 MCP 조회 경로를 새 transport로 정의하고, 사용자 확인·제공자 출처·
필드별 활용 범위를 묶은 수용 계약을 먼저 만든다. 직접 입력값과 외부값을 구분하되
검증한 거리·시간까지 영구 배제하지 않는다. 첫 목표는 **정확한 사실 집계에 사용**하는
것이며, 제공자의 회복 점수나 예상 기록까지 자동 처방 권한으로 넘기는 것은 아니다.

### A06. 상세 처방에 비해 실제 수행 비교의 입력이 얕다

**우선순위 P1 / 제품 확장 공백 / 현재 비교가 전혀 없다는 뜻은 아님.**

- `plan-journal-evidence.ts:12`의 비교 행은 날짜/슬롯/역할/계획 RPE/실제 RPE를
  담는다. 반복별 실제 초·회복 초·세트 수행량은 없다.
- `plan-cycle-response.ts:25`는 연결 일지의 RPE 비교를 모아 유지/검토 방향을 낸다.
  이미 연결된 실제 기능이며, 단순 완료 버튼만 읽는 것으로 설명하면 틀린다.
- `plan-beta-flow.ts:438`의 최근 일지 문맥은 최근 14일 세션 개수를 전달한다.
  그 개수 자체가 실제 훈련량·회복 반응·에너지 노출을 세밀하게 반영한 설계 근거는 아니다.

**개선:** 현재 RPE 비교를 유지하고 실제 랩·회복·세트 대응을 추가한다. 계획한 값,
측정한 값, 선수가 수정한 값, 비교 불가를 분리한다. 자동 랩 1km를 계획 반복 1km와
곧바로 동일시하지 않는다. 준비/본운동/회복/정리 매칭과 운동 변경 확인이 필요하다.
향상의 원인이나 다음 대회 성과를 확정하는 문구는 만들지 않는다.

## 4. 잘 지켜진 부분과 그대로 둘 제한

- 직접 선택한 에너지 목적을 누적하는 V1과 실제 대사 기여율 측정은 다르다.
  MIX 미배분을 유지하고, 기록이 적다는 이유로 해당계 능력이 부족하다고 진단하지 않는다.
- 계획 예정, 완료 표시, 실제 일지 기록을 분리하는 구조가 있다.
- 평균/거리의 미기록을 0으로 만들어 비교하지 않는 계약과 테스트가 있다.
- 메모 없이 구조화 관측을 만드는 공통 투영이 있다. COROS 전체 payload를
  그 객체에 끼워 넣거나 메모 원문을 외부 LLM에 보내는 방식으로 우회하지 않는다.
- `personal-oracle.ts:111`의 최빈 시스템 동률 표시는 이미 동률을 명시한다.
  과거 Fable 관찰을 아직 미해결인 것처럼 다시 발주하지 않는다.
- 현재 계획 기간의 누적 거리는 정확한 9.5일 시간 경계 계산이 아님을 표시한다.
- CTL/ATL/TSB·부하 변화율 등은 문서에 식이 있다는 사실만으로 승인된 공식이 아니다.
  `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md:55`의 제한을 존중한다.

## 5. 개발 전에 패치할 스펙과 소유권

| 순서 | 대상 | 패치 범위 | 하지 않을 일 |
|---|---|---|---|
| S1 | 에너지 누적·누적 거리·개인 오라클 계약 | 동일 ID 충돌 순서, 필드별 출처, 두 기간 포함/제외 수, compact 표시 | 새 대사 비율이나 피로 공식 추가 |
| S2 | 외부 기록 계약 + 데이터 provenance 수용 결정 | COROS MCP/Partner 경로 분리, 초/미터 정밀도, 외부값의 분석 사용 목적 | 모든 외부값을 EXPLICIT로 바꾸기 |
| S3 | Physio Source Trust + 분석 표시 계약 | 측정값/제공자 추정치/사용자 주관값의 개별 근거와 품질 | 공식 장비라는 이유만으로 정확도·안전 보장 |
| S4 | 상세 처방 + 계획 근거/프라이버시 계약 | 계획-실제 구간 대응, 비교 불가, 입력/공식/템플릿 버전 추적 | 과거 계획에 새 근거를 소급 생성 |
| S5 | 분류기·Formation·Plan Generator의 해당 조항 | 수행 이력을 후보 설명·제외에 쓰는 좁은 바인딩 정의 | 적은 횟수를 약점으로 진단, 강도·양·빈도 자동 증가 |

실제 존재하는 기존 문서를 우선 패치한다. 새 계약이 필요하면 이 표에서
`NEW_PROPOSED`로 구분한 뒤 생성한다. 본문 소제목을 존재하는 별도 스펙으로
등록하지 않는다. 원본 이슈 표를 열지 않은 상태에서 전체 수를 정하지 않는다.
초안 패치는 기존 정본 지위, 미수용 공식, 실제 실행 증거와 분리해서 검수한다.

## 6. 단계별 구현 준비

모든 구현 단계의 현재 상태는 **NOT_STARTED_IN_THIS_TASK**다. 이번 작업은
검토와 준비 문서 작성이며, 아래 작업이 이미 개발/배포됐다는 의미가 아니다.

| 단계 | 개발 결과물 | 완료 기준 | 담당 권장 |
|---|---|---|---|
| D1 분석 신뢰성 수리 | A07 먼저, 이어 A01/A03/A04 수정 | 결함 주입이 수정 전 실패, 수정 후 통과. 홈/분석/오라클 같은 근거 | Terra high, 최종 코드 리뷰 |
| D2 정밀 원본/출처 | 초·미터·시간 의미·종목·identity의 공통 형식 | 24초/79.8초/자정/AMPM/사이클링/부분 누락/수정 이력 보존 | Sol high 계약 정리 후 Terra high |
| D3 COROS 읽기 연결 | 서버 OAuth/MCP, 확인함, 해제, 사용자 확인 | 합성 계정 격리 후 승인된 시험 계정 왕복. 원문/토큰 누출 없음 | Terra high, 보안 검수 분리 |
| D4 분석에 반영 | 수용된 외부 거리·시간과 직접값의 필드별 합산 | 재수신·파일/API 중복·수정·철회에서 이중 합산 없음 | Terra high, 수치 독립 재계산 |
| D5 실제 수행 비교 | 계획 구간과 랩/회복의 대응, RPE 함께 표시 | 복합 세트·회복 포함/제외·중도 종료·변경 세션 비교 불가 처리 | Sol high 설계, Terra high 구현 |
| D6 주기 활용 | 수용된 근거가 있는 후보 설명/유지/제외 | PB/SB/명시 요청의 기존 변화 조건, 안전 경계, 버전 계보 유지 | 코어/과학 검수와 Fable UX 검수 분리 |

COROS 계획 전송은 위 읽기·분석 완료와 분리한다. 실제 쓰기 도구와 provider schema를
확인하고 `선택한 계획 미리보기 -> 전송 확인 -> 제공자 저장/표시 확인`을 별도 구현한다.
파트너 웹훅 승인을 기다리는 동안 D1/D2와 합성 D3 개발을 미룰 필요는 없다.

## 7. 사용자 흐름과 페르소나

공통 흐름은 `오늘 운동 확인 -> 몸 상태/RPE 선택 또는 건너뛰기 -> 완료`를 유지한다.
워치가 있으면 이후 정확한 수치를 채우고, 자세히 쓰고 싶은 사용자는 같은 일지를
확장한다. 모든 사람에게 랩/심박/일지 본문을 쓰게 하지 않는다.

| 사용자 관점 | 필요한 경험 | 놓치면 안 되는 것 |
|---|---|---|
| 워치만 켜는 바쁜 러너 | 새 기록 한 번에 확인, 수치가 채워진 요약, 직접 선택은 최소 | 연결=분석 완료로 표시 금지, 확인 전 외부값을 합산하지 않음 |
| 고등부 중거리 선수 | 200/400m 실제 초, 반복·회복 비교, 계획 목적 설명 | 초 손실·정수 페이스 강제 금지, 성별/부별 임의 배율 금지 |
| 하루 두 번 훈련하는 선수 | 같은 날짜 AM/PM 기록을 구분해 선택 | 날짜만으로 합치지 않음, 두 활동을 한 세션으로 중복 계산하지 않음 |
| 마라톤 러너 | 주·월 거리와 실제 수행 추이, 짧은 훈련도 정확히 보존 | 사이클/걷기를 달리기 마일리지에 무조건 포함하지 않음 |
| 워치 없는 사용자 | 간편 기록과 수동 입력만으로 계속 이용 | 연결 강제, 상세 입력 강제, 미기록을 열등 평가하는 문구 금지 |
| 자세히 쓰는 다이어리 사용자 | 기존 글·꾸미기·비밀 메모 그대로, 수치만 보완 | 가져온 값으로 원문을 덮거나 분석/공개 공유에 원문 유출 금지 |
| 코치/전문 보기 | 출처·시간 의미·랩·신뢰 상태를 더 자세히 열람 | 선수 OAuth를 코치 권한으로 대체하지 않음, 기본 보기의 수행 정보 축소 금지 |

화면은 아래 원칙으로 정리한다.

- 첫 화면에는 수치와 다음 행동, 출처 한 줄. 긴 기술/생리학 설명은 상세 화면.
- `가져옴`, `확인함`, `분석에 사용함` 상태를 구분하고 부분 성공도 정확히 안내.
- 완료된 단계만 짧은 전환 모션으로 이동. 네트워크 요청 중에 미리 성공 표시하지 않음.
- 모바일 뒤로 가기, 요청 취소, 다른 앱에서 OAuth 복귀, 연결 실패 후 재시도에서
  원래 선택/일지/스크롤 위치를 보존.
- 320/375px, 글자 200%, 키보드, 스크린리더, reduced motion을 검증한다.
  긴 source ID나 JSON을 일반 화면에 노출하지 않는다.
- 누적 횟수/거리는 기록 설명이다. 월간 목표 달성을 위해 휴식이나 통증 확인을
  무시하도록 포인트·스트릭을 결합하지 않는다.

## 8. 장단점과 대안 평가

| 방안 | 장점 | 단점/비용 | 판단 |
|---|---|---|---|
| 분석 제외를 한 번에 해제 | 화면 수치는 빨리 채워짐 | 출처 세탁, 시간 오차, 이중 합산, 계획 근거 오류 | 채택하지 않음 |
| 모든 워치 연동을 Partner 승인까지 대기 | 경로가 하나여서 운영 단순 | 공식 self-service 기회를 놓치고 기록 부담 지속 | MCP 조회 준비는 별도로 진행 |
| COROS 결과를 LLM에 통째 전달 | 대화형 설명을 빨리 만들 수 있음 | 프라이버시·재현성·비용·숫자 환각 문제, 기존 계약 불일치 | 구조화 수치와 검토된 설명 우선 |
| 필드별 수용 후 조회→비교→적응 | 기능을 단계적으로 공개하고 근거 추적 가능 | 스키마·마이그레이션·부분 상태 UX 구현 필요 | 권장 |
| 정확한 랩만 있으면 자동 에너지 분류 | 입력 부담 감소 가능 | 자동 랩/운동 변경/회복 맥락을 오인할 위험 | 검토된 분류기와 불확실성 표시를 후속으로 연결 |

## 9. 공격적 테스트 목록

아래는 후속 개발의 완료 기준이며, 이번에 새로 모두 실행했다는 목록이 아니다.

| ID | 결함을 만들 입력 | 반드시 확인할 결과 |
|---|---|---|
| T01 | 동일 ID, 서로 다른 provenance/trust/값 | 임의 한 사본 선택 금지, 충돌과 집계 제외 명시 |
| T02 | 직접 선택 목적/RPE에 워치 거리·시간만 추가 | 원래 직접값 자격 유지 여부, 외부값과 분리 판정 |
| T03 | 24초·79.8초·400m·분과 초 혼합 | 원본 정밀도 보존, 0분 저장 금지, 단위 의미 일치 |
| T04 | GPS 없는 실내 달리기·사이클링·걷기 | 활동 종목 보존, 달리기 거리 정책 적용 |
| T05 | 같은 날 두 활동·자정 통과·시간대 변경 | 날짜/슬롯/identity 보존, 잘못된 자동 합치기 없음 |
| T06 | 재수신·재연결·파일과 API 동일 활동 | 합계 한 번, 원본 수정/삭제 반영 정책 명시 |
| T07 | 현재/이전 기간의 다른 제외 사유 | 두 기간 자료 범위 표시, 결측을 0/성과 하락으로 설명 금지 |
| T08 | 2세트 반복, 회복 랩 누락, 중도 종료 | 실제 수행/계획/모름 분리, 유리한 페이스만 골라 성공 판정 금지 |
| T09 | 계정 A 응답이 B 로그인 뒤 도착 | 저장/표시 금지, 토큰·계정·job 범위 일치 |
| T10 | 연결 해제 중 응답, 권한 축소, 토큰 만료 | 후속 처리 중단, 실패/재인증 상태 명시 |
| T11 | payload에 메모·GPS·개인 프로필·도구 지시문 | 필요한 필드 외 폐기, 실행 지시로 해석 금지, 로그/공유 무유출 |
| T12 | RPE 낮음/출석 많음/제공자 회복률 높음 | 자동 증량/안전 해제 없음, 이미 승인된 변경 조건만 사용 |

## 10. 이번 실행 증거와 한계

| 확인 | 이번 결과 |
|---|---|
| 로컬/원격 main | `git ls-remote origin refs/heads/main`과 HEAD 일치 |
| 출처/파일 import/일지 보완/주기 RPE 테스트 | 5개 파일 77/77 PASS, Node 24.11.1 / Vitest 4.1.10 |
| 기기 연동 준비 테스트 | 10/10 PASS. 제공자 실제 인증/수신 증거 아님 |
| 숫자/에너지/오라클 독립 검토 | Terra high 읽기 전용 범위 검토. 관련 6개 파일 UTC 29/29, KST 29/29 보고 |
| 짧은 시간 파서 | 실제 `parseActivityFile`에 합성 JSON을 메모리 번들로 넣어 A02 재현. 저장/건강 데이터 조회 없음 |
| 혼합 출처 전후 | 주 담당이 투영→원장→오라클을 실제 실행, 직접 목적/RPE 유지에도 근거 1→0 재현 |
| 공개 COROS | 인증 없는 metadata GET 3개. 실제 등록/OAuth/tool 호출 안 함 |
| 앱 코드·스펙 의미·운영 | 변경 없음 |
| 실제 기기/계정/브라우저 전면 시험 | 이번에 하지 않음. 페르소나는 코드 기반 검토이지 실제 사용자 인터뷰 아님 |

10개의 준비 테스트 중 일부는 예전 `신청 대기` 문구를 정규식으로 잠그고 있다.
따라서 PASS 자체로 새 COROS 정책과 문구가 최신이라는 증거가 되지 않는다.
테스트와 문서를 함께 갱신해야 한다. 새 메일만으로 원래 승인 영수증이나 과거
런타임 증거를 고쳐 쓰지는 않는다.

직접 실행한 집중 테스트:

```text
cd app
node node_modules/vitest/vitest.mjs run src/domain/field-provenance.contract.test.ts src/domain/import/activity-file.contract.test.ts src/domain/import/import-draft.contract.test.ts src/domain/import/progressive-reconciliation.contract.test.ts src/domain/plan-cycle-response.contract.test.ts --maxWorkers=2
node --test scripts/validate-device-integration.test.mjs
```

Terra의 읽기 전용 검토 실행 파일은 다음 6개다. 기본 설정에서 9건/20건으로
나누어 실행했고 KST 설정에서 29건을 함께 실행했다. 같은 사례의 시간대 재실행을
서로 다른 기능 58개로 보고하지 않는다.

```text
src/domain/cumulative-distance.contract.test.ts
src/domain/energy-system-ledger.contract.test.ts
src/domain/personal-oracle.contract.test.ts
src/screens/trends/CumulativeDistancePanel.contract.test.tsx
src/screens/trends/EnergySystemLedgerPanel.contract.test.tsx
src/screens/trends/PersonalOraclePanel.contract.test.tsx

node node_modules/vitest/vitest.mjs run <above-files>
node node_modules/vitest/vitest.mjs run -c vitest.config.kst.ts <above-files>
```

Terra 검토 세션 `01a06ac5-cc73-7fc2-bb31-a3f5f5b4f2ac`는 결과 통합 후 종료했다.
AI 검토 결과이지 Fable 또는 사람 전문가의 승인으로 기록하지 않는다. 주 담당의
첫 혼합 출처 재현 명령은 PowerShell 인용부호 오류로 실행되지 않았고, stdin 방식의
재실행에서 위 결과를 얻었다. 실행 전 오류를 테스트 PASS에 포함하지 않는다.

## 11. 다음 작업자 인계

```yaml
base_sha: 296a84533a9f1f9c7247110dfb08f57331023689
next_actor: OWNER
decision_to_review: analysis_fixes_and_COROS_read_only_adoption_scope
recommended_execution: Terra_high_after_bounded_contract_review
first_implementation: D1_analysis_integrity_and_coverage
implementation_started_by_this_document: false
remote_ref: NOT_PUSHED
delete_authority: NONE
protected_paths:
  - app_runtime
  - impl_runtime
  - historical_evidence
  - existing_spec_status_and_issue_tables
stop_when: review_and_readiness_documents_are_verified_and_locally_checkpointed
```

다음 구현은 기존 기능의 정합성 수리와 합성 데이터 준비부터 가능하다. 실제 계정
연결/건강 데이터 수신·보관/공개 활성화는 그 작업 범위와 사용자 동의를 별도로
확인한다. 사용자가 이번에 공유한 COROS 메일은 그 실행 동의를 대신하지 않는다.

[DRAFT_COMPLETE]
