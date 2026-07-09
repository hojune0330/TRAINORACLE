# CODEX_WORK_ORDER_003.md

```yaml
doc_id: TRAINORACLE_CODEX_WORK_ORDER_003
title: "Codex 작업지시서 003 — GAP_SPEC 계약 초안 + Round 3 후속 바인딩"
version: "1.0"
issued_by: PROJECT_LEAD_AI
issued_date: "2026-07-09"
prerequisite_state:
  - "PR #14~#17 병합 완료 (ORDER_002 산출물 수용)"
  - "SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md 발행 — 재구성 스펙 8종 전부 ACCEPTED_AS_WORKING_SOURCE"
inputs:
  - SPEC_SCREEN_TRACEABILITY_MATRIX.md   # GAP_SPEC_MISSING 5건의 근거
  - SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md  # 후속 트리거 T1~T5
  - SPEC_DOC_QUALITY_REPORT.md
branch_naming: "codex/work-order-003-task{N}"
pr_target: main
```

---

## 0. 절대 규칙 (ORDER_002 규칙 전면 승계 + 추가)

1. 로컬 파일이 진실이다. 기억 기반 카운트 금지, 모든 수치는 파일에서 재계수.
2. 런타임 증거 없이 이슈 폐쇄 주장 금지. 마크다운 자가 점검은 런타임 증거가 아니다.
3. 안전 불변식 무변경: D9_ACTIVE→BLOCK, D9_UNKNOWN→BLOCK_OR_HUMAN_REVIEW, advisory는 CLEARED 하위 전용(4번째 처분 신설 금지), 평가기 실패→UNKNOWN fail-safe.
4. §8 memo_policy 무변경: raw 자유텍스트/메모/증상 서술의 서버·감사 영속 금지.
5. `RULE_SPEC_D1_D9.D-*` / `LEGACY_PHASE_D.D-*` / `CYCLE_DAY.D-*` 네임스페이스 혼용 금지.
6. 새 초안 문서는 반드시 `status: DRAFT_FOR_REVIEW` + `executed_tests_total: 0` + open-issue 테이블(선언 수치 = 실제 행 수)로 작성.
7. **수용 결정 월권 금지**: 모든 초안은 `PENDING_REVIEW` 상태로 두고, `ACCEPTED_AS_WORKING_SOURCE` 결정은 총책임자 전권이다.
8. **디자인 파일 수정 금지**: `ui_kits/`, `preview/`, `design-v3/`, `designs/`, `colors_and_type*.css`, 루트 `index.html`은 총책임자 전담 영역. 읽기(인용)만 허용.
9. **[신규] `app/` 디렉토리 수정 금지**: `app/`은 총책임자가 Phase 1로 구축하는 서비스 앱 워크스페이스다. 코덱스는 읽기만 허용, 어떤 파일도 생성·수정하지 않는다.
10. **[신규] 다운스트림 패치 시 소스 명시**: Task 4에서 기존 스펙을 패치할 때 반드시 `patched_from: <Round3 수용 문서>` 형태로 소스를 기록하고, 패치 후 해당 문서의 open-issue 테이블을 재계수해 선언 수치를 갱신한다. 단, 이슈 상태를 OPEN→CLOSED로 바꾸는 것은 런타임 증거가 있을 때만이며 이번 지시 범위에서는 금지(문구·소유권 이관 패치만 허용).

---

## 1. Task 1 — MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md 초안 (P1)

**산출물**: `specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md`

화면 매트릭스 GAP_SPEC_MISSING 3건(사진 첨부, 음성 메모, 사진 표시)을 해소하는 미디어·일시 캡처 계약 초안.

필수 포함 내용:
- **사진 첨부**: 저장 위치(로컬 기기 전용 vs 서버), 보존 기간, 삭제 워크플로, EXIF/위치정보 처리(제거 필수 여부), sourceRef 스킴(`media://` 형태 제안), 감사 로그에 파일명/내용 미기록 원칙.
- **음성 메모**: transient 원칙 — 원음성(raw audio)은 raw 자유텍스트와 동급의 민감 매체로 취급. 전사(transcription) 산출물의 취급(전사 텍스트 = raw free text로 간주 → 서버 영속 금지), 구조화 필드 추출만 영속 가능.
- **표시 계약**: LogDetail의 `PHOTO · track_0708.jpg` 같은 표시가 요구하는 최소 메타데이터(파일명 노출 여부 포함 — 파일명 자체가 민감정보일 수 있음을 검토).
- 매트릭스 해당 행 3건(`LogEntry.jsx` photo row, voice memo, `LogDetail.jsx` displayed photos)을 target-surface 표로 인용.
- 외부 업로드/외부 LLM 전송은 본 초안에서 금지 상태로 명시(OI-PORP-EXTERNAL-LLM-POLICY-001과 일관).

## 2. Task 2 — RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md 초안 (P1)

**산출물**: `specs/reconstruct/RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md`

매트릭스 GAP_SPEC_MISSING 잔여 2건 해소:
- **레이스 레코드 서브타입**: `DAILY_LOG_AND_CHECKIN_SPEC.md`(ACCEPTED, Round 2)의 데일리 로그 레코드를 확장하는 race-day quick check 서브타입 정의 — 필드(결과 기록, 주관 컨디션, 레이스 거리/기록), `CYCLE_DAY` 앵커(D-0)와의 관계는 MICROCYCLE 스펙(ACCEPTED, Round 3)을 소스로 인용.
- **과거 회상(historical recall) 텍스트 계약**: Home의 "historical memory row with pain text"가 표시할 수 있는 것을 계약화 — 원문 재표시(로컬 전용) vs 파생 요약 vs 구조화 reason-code 요약 중 어떤 티어를 허용하는지, privacyTier/redactionState 표기(PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC를 소스로 인용).
- 통증 관련 과거 회상이 D9 평가 상태를 우회·암시하지 않도록 명시.

## 3. Task 3 — METRIC_ALGORITHM_CONTRACT.md 초안 (P2)

**산출물**: `specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md`

Round 3 결정 노트 N1(OI-AVD-METRIC-SOURCE-OWNERSHIP-001) 대응:
- CTL/ATL/TSB, HR drift, 부하(load) 등 파생 지표의 산식 후보·입력 필드·결측 처리·불확실성 표기(uncertainty band) 정의.
- **수치 권위 한정**: 본 계약의 어떤 지표도 안전 판정(D9/Gate) 입력으로 직접 쓰이지 않음을 명시 — 표시·트렌드 용도 한정, 안전 체인 입력은 기존 분류기 계약 경유.
- Trends.jsx / design-v3 분석 화면이 표시하는 지표 목록을 실측 인용해 계약 대상 지표를 확정.

## 4. Task 4 — Round 3 후속 바인딩 패치 (P2)

Round 3 결정 트리거 T1/T4 실행:
- **T4**: `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` 메타데이터를 다른 스펙과 동일한 flat YAML 프런트매터로 정규화(내용 무변경, 구조만). 정규화 후 open-issue 재계수해 6/3 유지 확인을 PR 본문에 기록.
- **T1(부분)**: `PLAN_GENERATOR_SPEC.md`의 `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`, `OI-PG-OPTION-RATIONALE-PRIVACY-001` 두 항목에 "패치 소스 존재: (해당 Round 3 수용 문서), 수용일 2026-07-09" 주석을 추가. **이슈 상태는 OPEN 유지**(폐쇄는 런타임 증거 필요). 패치 후 Plan Generator 문서 재계수 결과를 PR 본문에 기록.
- `TRAINORACLE_SPEC_INDEX.md` / `SPEC_WORK_STATUS.md`에 Round 3 수용 상태(8/8 accepted) 반영.

---

## 5. 실행 순서·PR 규칙

- 순서: Task 1 → 2 → 3 → 4 (Task 4는 1~3과 독립적이므로 병렬 가능).
- Task별 개별 브랜치·개별 PR. PR 본문에 재계수 결과 표 필수.
- 완료 보고는 이 지시서를 발행한 GitHub 이슈에 댓글로. 상태는 "PR 업로드, 리뷰/병합 대기"까지만 주장.

## 6. 명시적 범위 제외

- `app/` 및 모든 디자인 파일 수정 (규칙 8·9).
- 어떤 open-issue의 CLOSED 전환.
- canonical 승격, ACCEPTED 판정 자기 부여.
- 외부 LLM 정책 변경, 안전 처분 체계 변경.
