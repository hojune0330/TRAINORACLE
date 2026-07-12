# CODEX_WORK_ORDER_008 — 탭 퍼스트 일지(퀵 로그) 스펙·검증 패키지

```yaml
work_order_metadata:
  order_id: CODEX_WORK_ORDER_008
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  issue_date: "2026-07-12"
  decision_basis:
    - 사용자(사장님) 지시 2026-07-12: "모든 부분이 토스처럼 간단해야 돼.
      일지도 터치 몇 번으로 작성이 끝나기도 하자. 전방위적으로 구현
      가능한 부분은 모두 그렇게 할 수 있을지 검토하고 코덱스에게 시킬 준비까지."
    - SPEC_TAP_FIRST_LOGGING.md (본 지시서와 동시 병합되는 기획 정본)
  branch_pattern: codex/work-order-008-task{N}
  report_channel: 본 지시서를 발행한 GitHub 이슈 댓글
  prerequisite_status: 선행 조건 없음 — 즉시 착수 가능 (ORDER_007 잔여와 병행 허용)
  amendment_v2: >
    2026-07-12 개정. 기획 정본이 v2로 갱신되었다 (페르소나 리뷰
    reports/review/TAP_FIRST_V1_PERSONA_REVIEW.md에서 v1의 "한 화면 한 질문"
    구조가 반려됨). Task A·B는 반드시 v2 정본(§2.1~2.5)을 기준으로 작성하라.
    핵심 변경: ① "한 화면 한 맥락" + 전환 예산(훈련 후 ≤2전환·마무리 ≤2전환·
    경기 직전 ≤1전환) ② 잉크 스택 캔버스(누적 답 상시 표시·종이 줄 탭으로 제자리
    수정·파생값 자동 기입) ③ 마이크로인터랙션 계약 M1~M6("느낌 예산").
    Task B에는 다음 검증 항목을 추가하라: 전환 수 계수 시나리오, 잉크 스택
    불변(전환 후 누적 답 표시 유지), M1~M6 각각의 수동 확인 절차,
    prefers-reduced-motion 동작.
```

---

## 0. 불변 규칙 (ORDER_006 규칙 1–13 + ORDER_007 규칙 14 전부 계승)

특히 재확인:
- **규칙 9: `app/` 디렉토리 수정 금지** — 퀵 로그의 앱 코드 구현은 총책임자 전담이다.
  본 지시서의 산출물은 전부 **스펙 패치·테스트 패키지·조사 보고서**다.
- 규칙 2: 안전 불변식 변경 금지 (통증 REVIEW 배너, D9 계열).
- 규칙 3: §8 memo_policy — 자유 텍스트 서버 영속 금지. 퀵 로그는 메모를 "선택"으로
  강등할 뿐 정책을 바꾸지 않는다. 이를 약화시키는 어떤 문구도 쓰지 않는다.
- 규칙 10: 기존 스펙 패치 시 `patched_from:` 주석 + open-issue 재계수.

---

## Task A — DAILY_LOG_AND_CHECKIN_SPEC quick-log 계약 패치 (P1)

**대상**: `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`
**패치 소스**: `SPEC_TAP_FIRST_LOGGING.md` (§1 감사표, §2 플로우, §3 불변식)

새 섹션 `quick_log_contract`를 추가하라. 반드시 포함할 것:

1. **모드 정의**: quick(기본 진입) / detail(현행 풀 폼). 두 모드는 동일한
   JournalEntry 스키마·동일 saveEntry() 경로를 쓴다. 스키마 필드 추가·삭제 금지.
2. **터치 예산 표** (수치는 기획 정본 그대로):
   - post-session quick ≤ 5탭 (지난 훈련 그대로 경로는 ≤ 3탭)
   - evening quick ≤ 7탭 (통증 없음 경로 4탭)
   - race pre quick ≤ 4탭
   - "탭"의 계수 규칙 정의 포함: 화면 전환 자동(선택 즉시 다음)은 탭으로 세지 않는다.
3. **프리셋 값 표준**: 거리 칩 {3,5,8,10,12}km · 시간 칩 {20,30,40,60,90}min ·
   수면 칩 {6,6.5,7,7.5,8,9}h · 스테퍼 증분(거리 0.5 / 시간 5 / 체중 0.1 / 심박 1).
   Task C 조사 결과로 값 조정을 제안할 수 있으나, 제안은 보고서로만 하고
   스펙에는 본 표준을 기입한다 (조정 결정은 총책임자).
4. **자동 계산 규칙**: 평균 페이스 = duration/distance, quick 모드에서 입력 표면 제거.
   0 나눗셈·단일 필드만 있는 경우 페이스 미표기 규칙 명시.
5. **프리필 규칙**: "지난 훈련 그대로" = 동일 kind의 최근 entry에서
   system/distanceKm/durationMin 복사. memo·rpe는 복사 금지 (그날의 것).
6. **완료 화면 계약**: 주간 작성일 도트(사실 표시), 금지 문구 규칙은 Task B 목록 참조.
7. **안전 불변**: 통증 quick 화면에도 painLevelsRequireReview 배너 동일 노출.
   quick 모드가 어떤 안전 판정도 우회하지 않음을 명문화.

`patched_from: SPEC_TAP_FIRST_LOGGING.md` 주석 필수. open-issue 재계수 필수.

## Task B — 퀵 로그 테스트 패키지 (P1)

**산출물**: `specs/test-packages/QUICK_LOG_TAP_BUDGET_TEST_PACKAGE.md`

1. **터치 예산 시나리오**: 각 플로우(§Task A-2)별로 "행복 경로 탭 시퀀스"를
   표로 나열하고 예산 준수 여부를 판정 가능한 형태로 기술
   (예: post-session 지난훈련그대로: 탭1 진입점 → 탭2 프리필 카드 → 탭3 RPE = 3탭 ✅).
2. **콘솔 마커 계약**: `[QUICKLOG] step=<id> taps=<n>` 및 기존 `[JSAVE]` 유지 검증 절차.
3. **금지 문구 목록** (완료 화면·프리셋 정렬 심사용): "더 뛰", "늘려", "채워야",
   "연속 N일", "스트릭", "내일도 꼭" + 훈련량 상향을 기본값으로 유도하는 칩 정렬
   (직전 값이 아닌 최대값 중심 정렬) 금지. 목록은 확장 가능하게 구조화.
4. **회귀 확인 항목**: detail 모드(현행 폼) 무손상, JournalEntry 스키마 diff 0,
   PrivacyNote 전 자유 입력 유지, REVIEW 배너 quick/detail 양쪽 노출.
5. 각 항목에 수동 검증 절차(뷰포트 375×667 포함)와 통과 판정 기준을 명기.

## Task C — 프리셋 값 근거 조사 보고서 (P2)

**산출물**: `reports/review/QUICK_LOG_PRESET_RESEARCH.md`

중·고·대학생 중장거리 러너의 일상 훈련 분포(거리·시간·수면) 관점에서
Task A-3 프리셋 표준값의 적절성을 검토하라.
- 근거 없는 수치 창작 금지 — 저장소 내 문서(PHILOSOPHY, 스펙, 민지 정본)와
  일반적으로 알려진 훈련 원칙 수준에서 논증하고, 확신 없는 부분은 UNKNOWN으로 표기.
- 결론은 "유지 / 조정 제안(값과 이유)" 형식. **스펙 수정은 하지 않는다** (규칙 14 계열).

---

## 완료 보고 형식

Task별 개별 PR (base=main). 보고는 "PR 업로드, 리뷰/병합 대기"까지만.
Task A 병합 후 총책임자가 app/ 구현(P1: post-session quick)에 착수한다.
