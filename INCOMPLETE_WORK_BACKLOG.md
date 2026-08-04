# 미완수 작업 백로그 레지스트리 (Planned-But-Incomplete Work Backlog)

> **목적:** PR·계획 문서를 되돌아보며 **"계획만 세우고 완수하지 못한 작업"** 을 발굴해,
> 샌드박스 휘발·세션 종료와 무관하게 **나중에 누구든 이어서 수행**할 수 있도록 고정하는 레지스트리.
>
> **작성일:** 2026-08-04 · **작성자:** AI 개발 에이전트 (착수 전 PR 리뷰 결과)
> **규칙:** 이 목록의 항목을 완료하면 완료일·PR 링크를 해당 행에 적고 `[완료]` 로 표시한다.
> **휘발성 대비:** 샌드박스가 클론/리셋되어도 `main` 통합 커밋으로 이 문서가 살아남는다 — 결과물은 반드시 main 통합 PR로 남긴다.

---

## 0. 발굴 방법

- `gh pr list --state open` + 최근 머지 PR 본문 스캔 (`PR #156~#182`)
- 각 PR 본문의 "안 된 것 / 남은 작업 / 이후 / 별도 작업" 마커 수집
- UX2 워크오더(`WORK_ORDER_UX2_COACH_HOME_AND_JOURNAL_HONESTY.md`)의 완료 판정(§7) 항목을 실코드 grep으로 교차 확인
- 발굴 시점 기준 **실코드 상태**: UX2 문서만 있고 코드 구현 0건 (`EngagementStrip` points/Flame/streak 존치, `EveningCheckin` 7h 기본값 존치, `briefing` 필드 0, "9일·10일" 표기 불일치 존치)

---

## 1. 발굴된 미완수 작업 목록 (우선순위순)

### B-01 🔴 UX2 §2~§4 코드 구현 미착수 (PR #181)
- **출처:** PR #181 `genspark_ai_developer` — UX2 문서 5건만 포함, 코드 0건
- **상태:** ❌ 미구현 (발굴 시점 실측)
- **내용:**
  - §2-1 정직한 홈 브리핑: `home-view-model.ts`에 `briefing` 필드 추가 + 홈 상단 베타 표시 + 통증 4+ 배너 6일 창 → 14일 창 확장
  - §2-2 게이미피케이션 제거: `EngagementStrip.tsx`의 points/Flame/recordingStreak 제거 → "기록 보존" 정보로 교체, 홈에서 `DecorationShop` 진입 제거 (파일 삭제 금지)
  - §2-3 거짓 기본값 제거: `EveningCheckin.tsx:75` `value={sleep > 0 ? sleep : 7}` → 미기록 상태(손잡이 미노출), 저장 시 `sleepH: 0`
  - §2-4 "가능 일수" 표기 정직화: `PlanIntake.tsx:75` 카피 + `home-view-model.ts:36` "9일·10일" → 9.5일 표기 통일
  - §3-1 위저드 답 축적 요약 스트립 / §3-2 페이스 포맷 가이드(`normalizePace`) / §3-3 홈 CTA 1탭 직행(post-session) / §4-1 LogDetail aria / §4-2 저장 토스트 "백업 안내 보기" / §4-3 차단 화면 "상의 후 상태 기록" 스텁
- **완료 조건:** `WORK_ORDER_UX2` §7 검증 (grep + 테스트) 모두 통과

### B-02 🔴 UX2 §8-10 경로 B 확정 ⇒ 별도 엔진 작업지시서 미작성
- **출처:** `WORK_ORDER_UX2` §8-10, §8-11, §8-12 (2026-08-04 오너 확정)
- **상태:** ❌ 미작성 — B 확정은 문서로만 반영, **엔진 작업지시서 파일 없음**
- **내용:** QUALITY·REST의 PM/자유 슬롯 이동 허용을 위한 타입 확장. 소유해야 할 바인딩 4종:
  - `impl/src/plan-generator/session-types.ts:24-46` — QUALITY/REST `slot` 리터럴 확장
  - `impl/src/plan-generator/session-builder.ts:150-172` — `recoverySecondSessionDays`(PM ≤2 상한) 재검토 + `makeCandidateSessions` 슬롯 배치
  - `app/src/domain/plan-session-schema.ts:104,114` — `activePlanSchema` 미러
  - `impl/src/plan-generator/progress.ts:18-42` · `app/src/domain/plan-beta-store.ts:73-90` — 허용 좌표 / (day,slot) upsert
- **완료 조건:** §8-12 레지스트리 11종 불변식 위반 0건 + `movePlanSession(activePlan, from, to)` 전용 연산 컨트랙트 테스트 (V1) + 이동 후 재계획 대기→[실행]/[취소] (V3)

### B-03 🟠 PR #182 본문 명시 "안 된 것" 5건
- **출처:** PR #182 `fable/q1-trends-import-disclosure` 본문 (2026-08-04)
- **상태:** ❌ 미착수 (PR open, rebase 미완료)
- **내용:**
  1. **Q3 미착수** — "전부 지우기" 후 삭제 기록(tombstone)이 남는다는 사실 공개. 코드 0줄
  2. **Q4 화면 미착수** — `releaseSyncOwner()` 도메인 함수는 존재하나 **어디서도 호출되지 않음**. "다른 계정으로 바꾸기" 버튼 + 백업 권유 → 동의 끄기 → 잠금 해제 → 로그아웃 흐름 미구현. **사용자가 실제 얻는 개선 아직 0**
  3. **e2e 미실행** — Q1이 `Trends.tsx`를 건드렸는데 e2e 미실행
  4. **rebase 미완료** — `origin/main`이 `6457bfc`로 앞서고 `Trends.tsx`·`journal-trash.contract.test.ts` 2개 파일 충돌. 머지 전 해결 필요
  5. **Q2 별건** — 사용자 승인대로 별건 PR 필요
- **완료 조건:** 이 PR 머지 전 rebase 완료 + e2e 통과, Q3·Q4 화면 작업 별도 완료

### B-04 🟠 PR #180 decoration-safety-followup 미병합
- **출처:** PR #180 `codex/decoration-safety-followup` (OPEN)
- **상태:** ❌ 미병합 — 본문에 검증 완료(전체 853 통과) 명시
- **내용:** 꾸미기 저장 읽기 검증·CAS·롤백, 백업 복원 시 현재 꾸미기 보존, 미지 ID 정규화, 날짜 장식 기록 있는 날짜만 저장, WebP 픽셀 검증, 2026-02-30 같은 가짜 날짜 차단
- **완료 조건:** main 머지

### B-05 🟠 UX2 §8-11 이동 후 재계획 UI (문서만 존재)
- **출처:** `WORK_ORDER_UX2` §8-11 · §8-7 검증 항목
- **상태:** ❌ 미구현 — 화면 흐름(예고 카드 → [재계획 실행]/[취소] → fresh 재생성 트리거 → 후보 무효화) 전부 코드 없음
- **내용:** 이동 드롭 ⇒ "재계획 대기" 상태. `sessions[]`·`StoredPlanProgress` 즉시 변경 금지. 안전 게이트(원자 재확인, D9 차단). 확정 시 append-only 버전 승계. `PREVIOUS_FRAME_CONTEXT_RETAINED` 연속성
- **완료 조건:** §8-7 e2e 10개 (드래그 ①②③④⑤⑥⑦ + 1화면 핏 ⑧ + PM 레인 미노출 ⑨ + 재계획 실행/취소 ⑩)

### B-06 🟡 UX2 §8 달력 그리드 자체 (9.5-Cycle 캘린더)
- **출처:** `WORK_ORDER_UX2` §8-3(1), §8-6 — `CycleRail` 컴포넌트가 스펙만 존재 (app/src 구현 0건)
- **상태:** ❌ 미구현 — DAY 1..10 × AM/PM 2레인 그리드, 5×2 분할행, 좌측 에너지색 strip 4-6px(T1), ※MAIN 마커(포메이션 TRAINING_MAIN 기준)
- **완료 조건:** §8-6 스펙 표 + 1화면 핏(가로 오버플로 0) e2e + 터치 44px

### B-07 🟡 D-01 AI 코치 본체 (별도 대형 작업으로 분리)
- **출처:** 공격 리뷰 D-01 · UX2 §0-B · UX2 §6 · PR #181
- **상태:** ❌ 미착수 — README §"AI 코치 장호준" 약속 vs 구현 화면 0. chat/inbox 전무
- **내용:** AI 채팅/인박스 화면. UX2 §2-1 홈 브리핑 스텁이 한계. 별도 대형 작업
- **완료 조건:** 오너 계획 수립 + UX2 §2-1 머지 후 착수 권장

### B-08 🟡 D-09 잔여 접근성 + D-11 엔진 배선
- **출처:** UX2 §4-1(화면분)은 진행, 잔여는 분리 명시 · UX2 §0-B
- **상태:** ❌ 접근성 검증 도구 스캔(alpine/axe) 미실행, 9 Rules 런타임 평가기 `RVE_RULE_EVALUATOR_BINDING_SPEC.md` 화면 미연동 (app/src grep → 평가기 0건)
- **내용:** 키보드 접근(BodyDiagram 방향키), color-contrast 스캔, RVE 평가기 표면 연동(별도 대형 작업)
- **완료 조건:** §4-1 검증 + 별도 RVE 작업지시서

### B-09 🟡 30개 DRAFT 수치 템플릿 활성화 (오너 결정 대기)
- **출처:** `CURRENT_IMPLEMENTATION_HANDOFF_2026-07-30.md` §4 · UX2 §6
- **상태:** ⛔ 활성화 금지 유지 — `canonical_promotion_allowed: false`, `numeric_template_activation_authorized: false`
- **내용:** 30개 카탈로그는 전부 `DRAFT`·`REVIEW_REQUIRED`. 활성화는 소스 추출·이벤트/경험 범위·청소년 정책·성과 앵커 provenance/freshness·준비 운동·감속·중단 조건·적격 검토 증거·오너 결정 포함 패킷 필요
- **완료 조건:** 오너 명시 결정 + §7.2 패킷 조건 모두 충족

### B-10 🟡 Formation 보호 대상 목록 (게이트 대기)
- **출처:** `FORMATION_DEFERRED_GOALS.md` (10행 전부)
- **상태:** ⛔ 대부분 `*_BLOCKED`/`*_DEFERRED` — 오너·코치·참가자·검토자 승인 대기
- **내용:** 스포츠 과학 증거 검토·규칙 실행·섀도 프로토콜·프라이버시 거버넌스·제품 투영·백엔드 바인딩·선택적 메모 공유 등
- **완료 조건:** 행별 리액티베이션 게이트(단일 결정 패킷, 다른 행 자동 활성화 없음)

---

## 2. 발굴 시점 실측 증거 (2026-08-04)

| 실측 항목 | 결과 |
|---|---|
| `grep -n "points\|recordingStreak\|Flame" EngagementStrip.tsx` | 6건 존치 (points·Flame·recordingStreak) |
| `grep -n "value={sleep" EveningCheckin.tsx` | `value={sleep > 0 ? sleep : 7}` — 7h 거짓 기본값 존치 |
| `grep -n "briefing" home-view-model.ts` | 0건 |
| `grep -rn "9일·10일"` | `home-view-model.ts:36` 존치 |
| `grep -c "aria-label" LogDetail.tsx` | 0건 |
| `grep -rn "movePlanSession"` | 코드 0건 (UX2 문서에만 언급) |
| `grep -c "aria-label" ActivePlan.tsx` | 이동 버튼용 증가분 0 (추후 검증) |

---

## 3. 이어서 작업할 때 첫 동작

1. `git fetch origin --prune && git log -1 --oneline origin/main && gh pr list --state open`
2. 이 레지스트리에서 가장 위의 `[완료]` 아닌 항목부터. 항목은 문서 1건(백로그 업데이트) + 구현 + 테스트 + main 통합 PR로 마감.
3. UX2 코드 작업을 시작하는 경우 먼저 `WORK_ORDER_UX2_COACH_HOME_AND_JOURNAL_HONESTY.md` §1~§7 (비목표 §6 포함)을 다시 읽고 `HANDOFF §8` 완료 체크 5종을 실행.
4. 샌드박스 휘발 대비: **작업 분량이 커지기 전에 중간 커밋 + PR 업데이트**를 반복.

---

*이 문서는 계획만 존재하던 작업이 휘발되지 않도록 고정하는 레지스트리다. 각 항목 완료 시 업데이트 후 커밋할 것.*
