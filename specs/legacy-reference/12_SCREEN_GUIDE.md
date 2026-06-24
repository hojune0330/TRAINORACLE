---
doc: 12_SCREEN_GUIDE
version: 2.1
build_timestamp: 2026-05-06
phase: 1-F (정본 기반 재작성)
sources:
  - knowledge_base/05_training_doc_guidelines/TrainingDoc_Guideline_v1.1_20260203.md (1차 정본)
  - knowledge_base/04_data_import/E_gsheet_template_spec_v1.1.md (2차)
authoritative_authors: JANG HOJUNE (장호준 코치)
note: |
  v1.0(Phase 1-B)은 가공의 'Hi-Fi 화면' 가이드를 다뤘으나 정본 미존재.
  v2.0(Phase 1-F)은 실제 정본인 TrainingDoc_Guideline + E_gsheet 기반.
---

# 12. 화면 / 출력 가이드 (Screen & Output Guide)

> **현재 운영 가능 화면**: 코치가 실제로 사용하는 인터페이스만 다룬다.  
> Hi-Fi 대시보드 UI는 별도 RFC(planned)에서 다룬다.

---

## 1. 코치 워크플로우 — 4가지 인터페이스

### 1.1 구글 시트 (Tab 1·2 — 코치 입력)

> 출처: `E_gsheet_template_spec_v1.1.md` §3.

**용도**: 월별 훈련 계획 입력.

**구조**: 7열(일~토) × 5–6주.  
각 주간 블록 4행:
- 날짜 (22 px)
- AM (80 px)
- PM (60 px)
- 메모 (22 px)

**시각**: 키워드 자동 색상 (빨강=인터벌, 주황=Tempo, 파랑=Easy, 보라=Hill, 분홍=대회).

**작업 흐름**:
1. 행 1 시트 제목 확인 (예: "2026년 3월 훈련 계획표").
2. 행 2 선수 정보 입력 (이름·종목·주기).
3. 주간 블록에 날짜/AM/PM/메모 직접 입력.
4. (자동) 조건부 서식이 색상 적용.

---

### 1.2 구글 시트 (Tab 3 — 데이터 뷰)

**용도**: Tab 1·2 → Apps Script 자동 변환 결과.

**열 구조** (8개):

| 열 | 헤더 | 비고 |
|---|---|---|
| A | date | YYYY-MM-DD |
| B | day | 요일 |
| C | session | AM / PM |
| D | type | 자동 판별 (REST, RACE, INTERVAL, TEMPO, …) |
| E | content | 원문 |
| F | intensity | LOW / MOD / HIGH / RACE_MAX / REST |
| G | notes | 메모 행 텍스트 |
| H | confidence | HIGH / MED / LOW |

**다음 단계**: CSV 다운로드 → 에이전트 Phase B 투입.

---

### 1.3 구글 시트 (Tab 4 — 검증 대시보드)

> Namespace notice: Tab 4의 D-1~D-7 표기는 기존 구글시트/Phase D 운영 검증 항목이며 `LEGACY_PHASE_D.D-*`에 해당한다.  
> 현재 SPEC 레이어의 `RULE_SPEC_D1_D9.D-*`와 구분한다.
용도: LEGACY_PHASE_D.D-1~LEGACY_PHASE_D.D-7 중 Tab 4 지원 항목 자동 표시.

| 행 | 규칙 | 표시 |
|---|---|---|
| 2 | LEGACY_PHASE_D.D-1 에너지 비율 | 종목 목표 vs 실제 |
| 3 | LEGACY_PHASE_D.D-2 MAIN 간격 | 간격 목록 |
| 4 | LEGACY_PHASE_D.D-3 Z1 비중 | 7일 윈도 % |
| 5 | LEGACY_PHASE_D.D-5 GLY/VO2 | 횟수 |
| 6 | LEGACY_PHASE_D.D-7 주간 볼륨 | 실제 vs 범위 |

**색상**: OK 녹색, WARN 노랑, ERROR 빨강.

---

### 1.4 구글 시트 (Tab 5 — 소통 로그)

**용도**: 코치 ↔ 에이전트 피드백 기록.

| 열 | 헤더 |
|---|---|
| A | 타임스탬프 |
| B | 작성자 (코치/에이전트) |
| C | 유형 (피드백/질문/확인/시스템) |
| D | 내용 |
| E | 관련 날짜 |
| F | 상태 (대기/완료/보류) |

---

## 2. 에이전트 출력 화면 — 채팅 인터페이스

> 출처: `phase_classify §11`, `phase_validate §7`, `phase_execute §5,§6`.

코치는 채팅창에서 에이전트와 자연어로 대화하며, 에이전트는 다음 형식으로 응답한다.

### 2.1 명령 입력 예

```
"황지향 선수 1월 훈련 분석해줘"
"이주니 선수 2월 훈련 짜줘 [상세]"
"이서빈 왜 못 뛰는지 진단해줘"
```

### 2.2 출력 흐름

```
[Phase A 완료] → 코치 확인
[Phase B 완료] → 코치 확인
[Phase C 완료] → 코치가 분류 수정 가능
[Phase D 완료] → ERROR/WARN 종합
[Phase E 완료] → (DESIGN 시) 옵션 2-3개 → 코치 선택
[Phase F 완료] → 최종 리포트
```

각 Phase 출력 형식은 `11_API_AND_ENGINE_CONTRACTS.md` 참조.

---

## 3. 문서 출력 (CMD-DOCUMENT)

> 출처: `TrainingDoc_Guideline_v1.1_20260203.md` (32.9 KB).

코치가 "엑셀로 정리해줘" / "문서로 출력해줘" 요청 시:
- Phase A → B → SKIP C, D, E → F.
- F-3 형식: `TrainingDoc_Guideline v1.1` 표준.

**문서 표준 핵심**:
- 7열 달력 + 4행 주간 블록 (구글 시트와 동일 구조).
- 강도-색상 매핑 (`02_AI_STRATEGY` §1과 일치).
- 메타데이터 frontmatter 필수.

---

## 4. PDF 입력 화면 (보조)

> 출처: `D_calendar_parsing_part_00.md`.

- 코치가 HWP/PDF 달력형 훈련 계획서를 제공.
- 에이전트는 `04b_CALENDAR_PARSING.md` 절차로 파싱.
- 파싱 결과 → YAML → Phase C 입력.

---

## 5. 화면 우선순위 (현재 운영)

| 우선순위 | 화면 | 상태 |
|---|---|---|
| **P1 (필수)** | 채팅 인터페이스 (에이전트 출력) | 운영 중 |
| **P2 (권장)** | 구글 시트 5탭 | E_gsheet v1.1 명세 완료 |
| **P3 (보조)** | HWP/PDF 입력 | D_calendar_parsing v1.0 완료 |
| **P4 (planned)** | TRAINORACLE Hi-Fi UI 대시보드 | RFC 단계 (별도) |

---

## 6. 향후 화면 (planned, 본 문서 외부)

- TRAINORACLE 대시보드 (선수별 종합 뷰).
- 모바일 코치 앱 (실시간 알림).
- Garmin Connect 직접 연동 (FIT 자동 임포트).

---

**Source Lineage**:
- `TrainingDoc_Guideline_v1.1_20260203.md` (32.9 KB) → §3
- `E_gsheet_template_spec_v1.1.md` (10.8 KB) → §1
- `phase_*` v1.3.1 → §2

**v1.0 → v2.0 변경**: 가공의 Hi-Fi 화면 가이드 제거. 실제 운영 인터페이스(구글 시트·채팅·PDF)만 다룸. Hi-Fi UI는 별도 RFC.
