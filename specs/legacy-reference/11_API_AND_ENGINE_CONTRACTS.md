---
doc: 11_API_AND_ENGINE_CONTRACTS
version: 2.1
build_timestamp: 2026-05-06
phase: 1-F (정본 기반 재작성)
sources:
  - knowledge_base/03_workflow_engine/C_workflow_engine_v1.3.md (§0.2, §0.4)
  - knowledge_base/03_workflow_engine/phase_classify_v1.3.1.md (§11)
  - knowledge_base/03_workflow_engine/phase_validate_v1.3.1.md (§7)
  - knowledge_base/03_workflow_engine/phase_execute_v1.3.1.md (§5, §6)
authoritative_authors: JANG HOJUNE (장호준 코치)
---


# 11. 엔진 계약 (Phase Output Contracts)

> 본 문서는 Coach Jang Workflow Engine의 입출력 계약을 정의한다.  
> **각 Phase는 다음 Phase가 기대하는 출력 형식을 반드시 준수해야 한다**.

## 0. Namespace Records

```yaml
records:
  legacy_phase_output_record:
    namespace: LEGACY_PHASE_D
    meaning: "Workflow Phase D output contract"
  rule_validation_result_record:
    namespace: RULE_SPEC_D1_D9
    meaning: "Current SPEC layer rule validation result"
```

---

## 1. 명령어 인터페이스 (정본 `C_workflow_engine §0.2`)

### 1.1 정규 명령 5개

| 명령 | 자연어 트리거 | Phase 흐름 |
|---|---|---|
| `CMD-ANALYZE` | "분석해줘" | A→B→C→D→E→F |
| `CMD-DESIGN` | "훈련 짜줘" | A→B→C→D→E→F |
| `CMD-DIAGNOSE` | "왜 못 뛰는지" | A→B→C→D→E→F |
| `CMD-DOCUMENT` | "엑셀" | A→B→**SKIP** C,D,E→F |
| `CMD-REGISTER` | "선수 등록" | A→B→C→D→E→F |

### 1.2 모드 수식어 2개

| 모드 | 효과 |
|---|---|
| `[빠른]` | Phase C 메인만, Phase D 경고만(OK 생략), Phase E 핵심 ≤ 3개 |
| `[상세]` | Phase C 보조 전수, Phase D 계산 과정 공개, Phase E 지식파일 인용 |

### 1.3 기타
- 연속 명령: 이전 Phase 결과 재활용.
- 다수 선수: 선수별 A–F 순차 실행.

---

## 2. Phase A 출력 계약 (`C_workflow_engine §1`)

```
[Phase A 완료]
선수: {이름}
종목: {MD/MLD/LD} ({세부})
훈련 기간: {PERIOD-BASE/BUILD/COMP} {[추정]?}
주간 목표: 총 {N-N}분/주
에너지 비중: BASE {N}% / LT {N}% / GLY {N}% / VO2 {N}% / ATP-PC {N}% / Z1 {N}%
프로파일: {완전/부분/신규}
부족 정보: {목록 또는 "없음"}
```

**필수 필드**: 선수, 종목, PERIOD, 주간 목표, 에너지 비중.

---

## 3. Phase B 출력 계약 (`C_workflow_engine §2`)

```
[Phase B 완료]
기간: {시작} ~ {종료} ({N}일)
훈련 기간: {PERIOD} {[추정]?}
데이터 레벨: {1/2/3}
메인 세션: {N}개
보조: {포함/미포함}
팀 프로그램: {있음/없음}
코멘트: {있음/없음}
HR/가민: {있음/없음}
부족: {목록 또는 "없음"}
```

**필수 필드**: 기간, 데이터 레벨, 메인 세션 수.

---

## 4. Phase C 출력 계약 (`phase_classify §11`)

```
[Phase C 완료]
세션 분류 결과 ({N}개 메인 + {N}개 보조)

메인 세션:
날짜  내용(요약)  intensity  energy_system  state  tags  duration_min  판정근거

보조 세션 요약 (Level 2 이상):
주차  Z1 시간(분)  BASE 시간(분)  기타 시간(분)  주간 보조 합계(분)

[?] 표시 세션: {있으면 목록, 없으면 "없음"}

코치님, 분류 결과를 확인해주세요. 수정할 부분이 있으면 말씀해주세요.
```

**필수**: 메인 세션의 6필드 (intensity, energy_system, state, tags, duration_min, 판정근거).

**다음 Phase 입력**: Phase D는 Phase C의 메인+보조 분류 결과 그대로 받는다 (정본 §0.1 규칙 6).

---

## 5. Phase D 출력 계약 (`phase_validate §7`)

> Namespace notice: 이 Phase D 출력 계약은 `LEGACY_PHASE_D` workflow output contract이다.  
> `RuleValidationResultRecord` 또는 `RULE_SPEC_D1_D9.D-*` 저장 계약과 혼동하지 않는다.

```
[Phase D 완료]
규칙 검증 결과 (기간: {PERIOD})

항목           상태              상세
LEGACY_PHASE_D.D-1 에너지 비중  {OK/WARN/ERROR}  {수치}
LEGACY_PHASE_D.D-2 MAIN 간격   {OK/WARN/ERROR}  {간격 목록}
LEGACY_PHASE_D.D-3 Z1 비중     {OK/WARN/ERROR}  {비중}
LEGACY_PHASE_D.D-4 EPOC 회복   {OK/WARN/ERROR}  {세션}
LEGACY_PHASE_D.D-5 GLY/VO2    {OK/WARN/ERROR}  {횟수}
LEGACY_PHASE_D.D-6 CK 회복     {OK/WARN/ERROR}  {구간}
LEGACY_PHASE_D.D-7 총 시간     {OK/WARN/ERROR}  {실제 vs 목표}
LEGACY_PHASE_D.D-8 세션 미달   {OK/WARN/ERROR/SKIP}  {세션, 시작점}
LEGACY_PHASE_D.D-9 부상 전조   {OK/WARN/ERROR/SKIP}  {키워드, 부위}

종합: ERROR {N}건, WARN {N}건
판정: {즉시 대응 / 주의 관찰 / 양호}
디로딩 트리거: {해당/비해당}
```

**개별 항목 형식** (`LEGACY_PHASE_D.D-X`):
```
[LEGACY_PHASE_D.D-X] 항목명
- 대상: ...
- 결과: OK / WARN / ERROR
- 근거: ...
- 조치: ...
```

---

## 6. Phase E 출력 계약 (`phase_execute §5`)

### 6.1 ANALYZE
```
[Phase E 완료 - 분석]
1. 경고별 원인
2. 패턴 요약
3. 핵심 발견 (1-5개)
```

### 6.2 DESIGN
```
[Phase E 완료 - 설계]
1. 상태 요약 (경고 → 매핑)
2. 옵션 (2-3개) → 코치 선택 대기
3. (선택 후) 계획 상세
4. 검증 결과
```

### 6.3 DIAGNOSE
```
[Phase E 완료 - 진단]
1. 증상 (주관+객관, 시점)
2. 가설 (순위, 근거, 신뢰도)
3. 유력 원인
4. 조치 (즉각/단기/장기)
```

---

## 7. Phase F 출력 계약 (`phase_execute §6`)

### 7.1 형식

| 형식 | 적용 |
|---|---|
| F-1 리포트 | 모든 명령 (기본) |
| F-2 JSONL | CMD-DESIGN |
| F-3 문서 | CMD-DOCUMENT |

### 7.2 리포트 형식 (F-1)

```
[최종 리포트 - {CMD}]

요약 (3줄 이내):
{가장 중요한 결론 먼저}

핵심 수치:
- 기간: {시작} ~ {종료}
- PERIOD: {기간}
- 주간 총 시간: 실제 {N}분 / 목표 {N-N}분
- MAIN 간격: 평균 {N}일 (기준 {N}일)
- ERROR {N}건 / WARN {N}건

주요 발견 (최대 5개):
1. ...
권장 조치:
- 즉각: ... / 단기: ... / 장기: ...
```

### 7.3 종료 메시지

```
[Phase F 완료]
출력 형식: {리포트/JSONL/문서}

(내용)

전체 워크플로우 완료. 추가 질문이나 수정 사항이 있으면 말씀해주세요.
```

---

## 8. 데이터 흐름 계약 (정본 §0.1 규칙 6)

```
Phase A (선수·종목·PERIOD)
   ↓ 컨텍스트
Phase B (기간·데이터 레벨)
   ↓ 컨텍스트
Phase C (분류된 세션 리스트)
   ↓ 입력
Phase D (LEGACY_PHASE_D.D-1~LEGACY_PHASE_D.D-9 결과)
   ↓ 입력
Phase E (분석/설계/진단)
   ↓ 입력
Phase F (리포트/JSONL/문서)
```

**원칙**: 각 Phase는 이전 Phase 출력을 **그대로** 이어받는다. 임의 변형 금지.

---

## 9. 에러 코드 (정본 `A_guide §11.2` 일부)

| 코드 | 의미 |
|---|---|
| `ERR_MAIN_GAP_TOO_SHORT` | MAIN 간격 < 6일 |
| `ERR_DURATION_MISSING` | duration_min 누락 |
| `ERR_MOD_ATP_MIX` | MOD/LOW + ATP-PC 같은 session_index 혼합 |
| `ERR_SESSION_COUNT` | 하루 세션 > 2개 |
| `WARN_Z1_LOW_RECOVERY` | Z1 < 15 % (7일 윈도) |
| `WARN_LT_UNDERLOAD` | LT < 18 % (90일 윈도) |
| `WARN_GLY_VO2_OVERLOAD` | GLY-SHORT 2회+ AND VO2-LONG > 1회 |
| `WARN_WEEKLY_MINUTES_DEVIATION` | 주간 분 ±10 % 벗어남 |
| `WARN_EPOC_RECOVERY_VIOLATION` | EPOC > 90 다음날 Z3 이상 |

---

**Source Lineage**:
- `C_workflow_engine_v1.3.md` v1.3.1 §0.2, §1, §2 → §1, §2, §3
- `phase_classify_v1.3.1.md` §11 → §4
- `phase_validate_v1.3.1.md` §7 → §5
- `phase_execute_v1.3.1.md` §5, §6 → §6, §7
- `A_guide_v5.1_20260201.md` §11.2 → §9
