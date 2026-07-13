# CODEX_WORK_ORDER_009 — Task R 후속: D9 연결 계약·문서 정렬·마커 정리

```yaml
work_order_metadata:
  order_id: CODEX_WORK_ORDER_009
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  issue_date: "2026-07-13"
  decision_basis:
    - reports/review/ORDER_007_R_SUMMARY.md (Task R, PR #50 병합 — S2 13건)
    - PLAN_F0F_TASKR_HARDENING.md (본 지시서와 동시 병합되는 기획 정본)
  branch_pattern: codex/work-order-009-task{a|b|c}
  report_channel: 본 지시서를 발행한 GitHub 이슈(#42) 댓글
  prerequisite_status: >
    선행 조건 없음. 단 ORDER_008(Task A/B/C)이 우선순위가 높다 —
    008 산출물 PR을 먼저 올리고, 009는 그 다음 또는 병행하라.
  amendment_v2: >
    2026-07-13 개정. Task A는 ORDER_008 Task A(quick_log_contract +
    data_provenance_contract, amendment_v3로 확장됨)가 병합된 뒤
    같은 DAILY_LOG_AND_CHECKIN_SPEC 기준으로 작성하라 — 퀵 로그·
    데이터 출처·D9 transient 세 계약이 한 문서에서 충돌 없이 정렬돼야
    한다. Task B·C는 이 순서와 무관하게 즉시 착수 가능.
  relation_to_app_work: >
    총책임자가 F0-f 앱 하드닝(PLAN §2)을 병행 구현한다. 이 지시서의 Task A가
    병합되어야 총책임자가 F0-f-7(D9 연결 구현)에 착수한다.
```

---

## 0. 불변 규칙 (ORDER_006 규칙 1–13 + ORDER_007 규칙 14 전부 계승)

특히 재확인:
- **규칙 9**: `app/` 디렉토리 수정 금지 — 본 지시서 산출물은 전부 스펙 패치·조사 보고서다.
- **규칙 3 (§8 memo_policy)**: 자유 텍스트 서버 영속 금지. Task A는 이 정책을
  구현 계약으로 구체화하는 것이지 완화하는 것이 아니다.
- **규칙 10**: 기존 스펙 패치 시 `patched_from:` 주석 + open-issue 재계수.
- **규칙 14**: 조사 결과 발견한 문제를 스스로 고치지 않는다 (Task C는 보고서만).

---

## Task A — free-text D9 transient 연결 계약 패치 (P1)

**대상**: `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`
**근거**: R-safety-001 — `assessMemoTransient`(app/src/safety/memo-safety.ts)가
UNKNOWN fail-safe까지 갖추고도 저장 흐름 어디에서도 호출되지 않는다.

새 섹션 `memo_transient_assessment_contract`를 추가하라. 반드시 포함할 것:

1. **평가 시점**: saveEntry 호출 직전, memo/note/한줄 등 자유 텍스트 필드가
   비어 있지 않을 때만 `assessMemoTransient(rawText)` 실행.
2. **보존 규칙**: 반환값 중 `reasonCodes`(비민감 코드 배열)와 `disposition`만
   entry에 부착 가능. **원문·요약·파생문 저장 금지** (transient 원칙).
   reasonCodes가 원문을 재구성할 수 없어야 한다는 불변식 명문화.
3. **UNKNOWN fail-safe UI 동작**: 평가 실패(D9_UNKNOWN) 시에도 **저장은 막지 않는다**.
   단 해당 entry는 review 대상 표시(비차단 배너)가 붙는다. 퀵 로그 모드에서도 동일.
4. **blocksPlanGeneration 소비처**: 현재 Plan Generator 미구현이므로
   "미래 소비처" 절로 분리해 표기 — UI가 실행 능력을 앞서는 문구를 쓰지 않도록
   (R-safety-002의 교훈) 현행 표시 문구 상한을 함께 계약.
5. **콘솔 마커 계약**: `[D9MEMO] disposition=<v> codes=<n>` (원문·코드 내용 출력 금지,
   개수만).
6. 스키마 영향: JournalEntry에 선택 필드 추가가 필요하면 필드명·타입·하위호환
   (기존 entry에 없을 때의 판독 규칙)을 명시하라. 필드 추가 여부 자체는 제안으로
   두고 대안(별도 review 목록 저장)과 장단 비교를 포함하라 — 채택은 총책임자.

`patched_from: PLAN_F0F_TASKR_HARDENING.md + ORDER_007_R_safety.md` 주석 필수.
open-issue 재계수 필수.

## Task B — SSO/계정 문서 상태 정렬 (P2)

**근거**: R-privacy-003 — 세 문서가 AthleteTime OAuth의 가능/미가능 상태를
서로 다르게 서술한다.

**대상 3파일**: `ACCOUNT_FEDERATION_DECISION.md`, `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md`,
`specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md`

각 문서 상단(메타데이터 직후)에 **동일한 상태 문장 블록** 1개를 삽입하라:

> 상태 정렬 (2026-07-13): 제품 결정은 AthleteTime SSO 단일 계정이다.
> 그러나 구현 가능성은 AthleteTime 측 인증 서버(OAuth provider) 작업이
> 완료되기 전까지 미확정이다. 본 문서의 OAuth 흐름 서술은 결정된 목표이지
> 현재 동작하는 기능이 아니다.

문구는 위 취지를 유지하는 선에서 각 문서 문체에 맞게 다듬어도 되나,
"결정 = SSO / 가능성 = 미확정" 두 사실이 세 문서에서 동일하게 읽혀야 한다.
기존 본문 서술은 수정하지 않는다 (상단 정렬 블록만 추가).

## Task C — [DRAFT_COMPLETE] 마커 사용처 전수 조사 (P3)

**산출물**: `reports/review/DRAFT_MARKER_AUDIT.md`
**근거**: Task R next-order 후보 6 — final marker 자동화 혼동.

1. 저장소 전체에서 `DRAFT_COMPLETE`, `DRAFT_FOR_REVIEW`, `ACCEPTED` 등
   상태 마커의 사용처를 grep 전수 조사 (파일:라인 증거).
2. literal 문자열로 코드/문서 로직에 쓰이는 곳과 순수 표기용을 분류.
3. 혼동 가능 지점(예: boolean이어야 할 곳에 literal 비교)을 열거하고
   정리 방안을 제안 — **수정은 하지 않는다** (규칙 14).

---

## 완료 보고 형식

Task별 개별 PR (base=main). 보고는 "PR 업로드, 리뷰/병합 대기"까지만.
S1급 발견(안전 불변식 위반 등) 시 즉시 이슈 댓글로 보고 후 해당 Task 중단.
