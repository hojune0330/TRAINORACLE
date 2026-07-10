# CODEX_WORK_ORDER_004.md

```yaml
work_order_metadata:
  order_id: CODEX_WORK_ORDER_004
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  issue_date: "2026-07-10"
  supersedes: CODEX_WORK_ORDER_003 (완료)
  decision_basis: SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md
  branch_pattern: codex/work-order-004-task{N}
  report_channel: 본 지시서를 발행한 GitHub 이슈 댓글
```

---

## 0. 불변 규칙 (전 지시서 계승 + 유지)

1. 로컬 파일이 진실이다. 존재하지 않는 파일 내용을 추정해 작성하지 않는다.
2. 안전 불변식 변경 금지: D9_ACTIVE→BLOCK, D9_UNKNOWN→BLOCK_OR_HUMAN_REVIEW, CLEARED 하 advisory only(제4처분 신설 금지), 평가기 실패→UNKNOWN fail-safe.
3. §8 memo_policy: 원문 자유텍스트 서버/감사 영속 금지.
4. namespace 규율: `CYCLE_DAY.D-*` / `RULE_SPEC_D1_D9.D-*` / `LEGACY_PHASE_D.D-*` 혼용 금지.
5. 런타임 증거 없이 어떤 open-issue도 OPEN→CLOSED 전환 금지.
6. canonical 승격, ACCEPTED 판정 자기 부여 금지.
7. 완료 보고는 "PR 업로드, 리뷰/병합 대기"까지만 주장.
8. 모든 디자인 파일 수정 금지.
9. **`app/` 디렉토리 수정 금지** (총책임자 전담).
10. 기존 스펙 패치 시 `patched_from: <소스 문서>` 주석 필수 + 패치 후 해당 문서 open-issue 테이블 재계수·선언 수치 갱신.
11. **[신규] 수식 구현 금지**: `METRIC_ALGORITHM_CONTRACT.md` §6 Draft Formula Set은 Round 4에서 수용 유보(N2). 이번 지시에서 수식을 코드·타 문서로 전파하지 않는다.

---

## 1. Task 1 — MEDIA 스펙에 전사→D9 평가 경로 명문화 (P1, 트리거 T1/N1)

**대상**: `specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md`

Round 4 결정 노트 N1 이행. §7 voice memo 계약에 다음을 추가 명문화:

- 전사 텍스트는 구조화 필드 추출·reason-code 생성 **이전에** raw 자유텍스트와 동일하게 D9 구어체 계층 평가를 통과해야 한다 (소스: `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md`의 free-text 처리 경로 인용).
- 평가 결과 disposition만 파이프라인에 전달되며 전사 원문·evidence 절은 즉시 폐기 (기존 transient 원칙과 일관).
- 전사 실패 시 `insufficient_source` 유지 + **D9 평가 자체가 불가한 경우 disposition은 `D9_UNKNOWN`** (fail-safe 방향 명시).
- `patched_from: SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md (N1/T1)` 주석 기록.
- 패치 후 open-issue 테이블 재계수. 필요 시 `OI-MTC-VOICE-TRANSIENT-REDACTION-001` 비고에 본 패치 반영 사실 추가 (상태는 OPEN 유지).

## 2. Task 2 — 수용 소스 하류 바인딩 주석 2건 (P1, 트리거 T2/T3)

**대상 1**: `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`
- 데일리 로그 레코드 정의부에 race-day quick check 서브타입이 `RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md`에 정의되어 있음을 바인딩 주석으로 기록 (`patched_from: RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md; accepted 2026-07-10 by SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md`).
- 서브타입 필드를 이 문서로 **복제하지 않는다** — 참조만.

**대상 2**: `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`
- 파생 지표 소비부에 METRIC envelope(sourceRef/confidence/uncertaintyState 봉투 계약)가 `METRIC_ALGORITHM_CONTRACT.md`에 정의되어 있음을 바인딩 주석으로 기록 (동일 patched_from 형식).
- 규칙 11 준수: §6 수식은 인용하지 않는다. 봉투·경계 계약만 참조.

두 문서 모두 패치 후 open-issue 테이블 재계수·선언 수치 갱신 (CLOSED 전환 없음).

## 3. Task 3 — 구(舊) `trainoracle-app/*` 킷 처분 제안서 (P2, 트리거 Round3-T6 후속)

**산출물**: `reports/LEGACY_V1_KIT_DISPOSITION_PROPOSAL.md` (신규)

매트릭스 CONFLICT C1–C4는 전부 구 킷(`ui_kits/trainoracle-app/Dashboard|Inbox|Calendar|Primitives.jsx`) 대상이다. C5(v3)는 Phase 1 `app/`에서 수정 완료. 구 킷의 처분을 결정하기 위한 **제안서**를 작성하라 (결정은 총책임자):

- 구 킷 각 화면이 v3/app에 대응물이 있는지 대조표 (있음/없음/부분).
- 대응물 없는 화면(예: Inbox, AIChat, Calendar 등)의 제품 가치·안전 리스크 평가 — 특히 `R-2 위반`/`9/9 pass` 표기의 안전 오인 위험, AIChat free-text의 §8 리스크 (매트릭스 해당 행 인용).
- 처분 옵션 3안 제시: (A) 아카이브 격리(`archive/` 이동 + 참조 금지 헤더), (B) 현상 유지 + 매트릭스 경고 유지, (C) v3 스타일로 재설계 후 app/ 이관 대상 목록화. 각 안의 비용·리스크 비교.
- **어떤 파일도 이동·수정·삭제하지 않는다.** 순수 제안 문서만.
- 권고안 1개를 명시하되 "권고"임을 분명히 한다 (결정 권한 없음).

## 4. Task 4 — 매트릭스·인덱스·현황 재계수 (P2, 트리거 T4)

**대상**: `SPEC_SCREEN_TRACEABILITY_MATRIX.md`, `TRAINORACLE_SPEC_INDEX.md`, `SPEC_WORK_STATUS.md`

- 매트릭스 `GAP_SPEC_MISSING` 5행: 상태를 `RESOLVED_BY_SOURCE(ROUND4)`로 갱신하고 해소 소스 문서·수용 결정문을 행에 인용. **행 삭제·CLOSED 표기 금지** — 소스 계약 확보와 구현 완료는 다르다.
- `GAP_UI_MISSING` 중 v3 LogEntry 통증 Review 행(매트릭스 90행): Phase 1 `app/src/screens/LogEntry.tsx`의 PainReviewBanner로 **app측 선반영**되었음을 비고로 기록 (PR #20 인용). 상태 전환은 하지 않는다 — app/ 검증 증거는 총책임자 소관.
- 요약 카운트 테이블(§ 상태별 계수) 재계수·갱신.
- 인덱스·현황 문서에 Round 4 결정문, ORDER_004, PR #22–25 병합 사실 반영. PR 상태 표기는 `MERGED`로 갱신.

---

## 5. 실행·보고 절차

- 순서: Task 1 → 2 → 3 → 4 (Task 3은 1·2와 독립적이므로 병렬 가능. Task 4는 1·2 완료 후).
- Task별 개별 브랜치(`codex/work-order-004-task{N}`)·개별 PR. PR 본문에 재계수 결과 표 필수 (Task 3은 신규 문서이므로 대조표 요약으로 대체).
- 완료 보고는 이 지시서를 발행한 GitHub 이슈에 댓글로. 상태는 "PR 업로드, 리뷰/병합 대기"까지만 주장.

## 6. 명시적 범위 제외

- `app/` 및 모든 디자인 파일 수정 (규칙 8·9).
- `ui_kits/trainoracle-app/*` 파일의 이동·수정·삭제 (Task 3은 제안서만).
- METRIC §6 수식의 코드·문서 전파 (규칙 11).
- 어떤 open-issue의 CLOSED 전환, canonical 승격, ACCEPTED 자기 부여.
- 외부 LLM 정책 변경, 안전 처분 체계 변경.

[ORDER_COMPLETE]
