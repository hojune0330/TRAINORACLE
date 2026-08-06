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

### B-01 🔴 UX2 §2~§4 코드 구현 (PR #181) — [완료]
- **출처:** PR #181 `genspark_ai_developer` — UX2 문서 5건만 포함, 코드 0건
- **상태:** ✅ 완료 (2026-08-05) — `main` 통합 `cbeb115` + 후속 결함 수정 `386bc6d`. PR #183은 낡은 main에서 분기해 갈라져 있었으므로 머지하지 않고 체리픽으로 통합 후 닫음
- **⚠️ 통합 시 발견한 것 (2026-08-05 실측 재확인):**
  - **§3-3이 탭바를 죽이는 결함을 만들었다.** 홈 CTA가 `entryType: "post-session"`으로 직행하게 되자, `goTab`의 조기 반환(`tab === v.tab`만 비교)이 폼 안에서 탭바 "기록"을 눌러도 아무 일도 하지 않게 만들었다. → `shouldResetTabView()` 순수 함수로 조건을 좁혀 해결(`app-shell-state.ts`). 그 조기 반환은 `4c6bf90`에서 **일지 탭 재탭 시 주 선택 보존**을 위해 의도적으로 넣은 것이므로 지우지 않고 좁혔고, T-3이 그 보호를 지킨다.
  - **e2e 단정 2건이 애초에 아무것도 확인하지 못했다.** ① `rest-day-copy`가 §151의 "링크 → 버튼 승격"을 `getByText`로만 봐서 승격을 되돌려도 통과했다 → `role=button` + 실제 클릭 도달까지 고정. ② `touch-surfaces`의 `post.energy`가 `/에너지 시스템/`(용어집 설명문에만 있는 말)을 찾아 0건 매칭으로 헛돌았다 → 실제 접근 이름 `"BA BASE"` 등 6개 감사.
  - **§4-1 LogDetail aria-label은 사실상 미완이다** — 실측 `grep -c "aria-label" LogDetail.tsx` = **1건**(되돌리기 버튼만). §4-1이 요구한 수정/삭제/뒤로/메모 열기는 미부여. **B-11로 분리했다.**
- **내용:**
  - §2-1 정직한 홈 브리핑: `home-view-model.ts`에 `briefing` 필드 추가 + 홈 상단 베타 표시 + 통증 4+ 배너 6일 창 → 14일 창 확장
  - §2-2 게이미피케이션 제거: `EngagementStrip.tsx`의 points/Flame/recordingStreak 제거 → "기록 보존" 정보로 교체, 홈에서 `DecorationShop` 진입 제거 (파일 삭제 금지)
  - §2-3 거짓 기본값 제거: `EveningCheckin.tsx` `value={sleep > 0 ? sleep : 7}` → 미기록 상태(손잡이 미노출), 저장 시 `sleepH: 0`
  - §2-4 "가능 일수" 표기 정직화: `PlanIntake.tsx` 카피 + `home-view-model.ts` "9일·10일" → 9.5일 표기 통일
  - §3-1 위저드 답 축적 요약 스트립 / §3-2 페이스 포맷 가이드(`normalizePace`) / §3-3 홈 CTA 1탭 직행(post-session) / §4-1 LogDetail aria / §4-2 저장 토스트 "백업 안내 보기" / §4-3 차단 화면 "상의 후 상태 기록" 스텁
- **완료 조건:** `WORK_ORDER_UX2` §7 검증 (grep + 테스트) 모두 통과

### B-02 🔴 UX2 §8-10 경로 B 확정 ⇒ 별도 엔진 작업지시서 미작성 — [완료]
- **출처:** `WORK_ORDER_UX2` §8-10, §8-11, §8-12 (2026-08-04 오너 확정) · `WORK_ORDER_SLOT_TYPE_EXTENSION_B.md` (작업지시서) · `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` (OD-SLOT, 최신 오너 결정)
- **상태:** ✅ 완료 (2026-08-06) — 브랜치 `codex/slot-type-extension-b` (main `a29e5f2` 리베이스 완료), 보고서 `reports/review/WORK_ORDER_SLOT_TYPE_EXTENSION_B_REPORT.md`, PR 링크는 해당 보고서/PR 본문 참조
- **내용 (승인된 B-02 계획 3요소 + 실측 정정 + C-7 철회):**
  1. **없어진 방어벽(DSB-INV-002) 재설치** — `plan-session-schema.ts` QUALITY 변형에 `refine((s) => s.slot !== "PM")` 추가 (**문 열기와 같은 커밋**). **→ (2026-08-06) C-7 철회:** 오너 결정 OD-SLOT-1(오전 강제 금지, QUALITY는 PM 배치 허용)이 DSB-INV-002를 대체 → **leaf refine 제거**. OD-SLOT-1이 초안 스펙을 이긴다(결정 문서 §3.3).
  2. **"막는지" 보는 테스트 + 결함 주입 비-공허성 증명** — 벽 제거 시 정확히 1건만 실패 → 복원 GREEN 재확인은 **철회 전 유효성 증명으로 기록**. 철회 후 테스트는 `accepts QUALITY PM (OD-SLOT-1)`로 복원됨.
  3. **최신 main 위로 이식** — 딥시크 파일 5개(코드 3 + 테스트 2)만. goTab 탭바 결함은 main `386bc6d`가 `shouldResetTabView`로 **이미 해결** → 내 이전 수정/테스트는 폐기(reset --hard origin/main).
  - **실측 정정 (Opus 보고서 대조):** "저장 관문이 열렸다"는 부정확 — `planBetaStateSchema` superRefine이 **원래부터** PM 세션 검사를 실행(`Invalid PM recovery support.` 등). 열린 건 **leaf 스키마뿐**. Opus가 철회 1 기록으로 정정 인정(결정 문서 §3.2).
  - **현재 저장 관문(C-4/C-5)은 미변경** — PM = EASY+RECOVERY+RPE1-2만, PM+QUALITY 동일 day 금지. 이건 **㉢-b(진행 순서 3단계)에서** "하루 고강도 1회 기본, 2회는 명시 지정"으로 바꾼다(결정 문서 §4.3). 지금 건드리지 않는다.
- **바인딩 4종 실측 (2026-08-05, 이식 대상 — 유지분):**
  - `impl/src/plan-generator/session-types.ts` — QUALITY/REST `slot: "AM"` → `PlanSessionSlot` (EASY는 원래 자유)
  - `impl/src/plan-generator/session-builder.ts` — `restSession(day, slot = "AM")`, `qualityTrainingSession(day, duration, intent, slot = "AM")` (생성 기본 AM 유지)
  - `app/src/domain/plan-session-schema.ts` — REST·QUALITY `slot: sessionSlotSchema.optional().default("AM")` (**방어벽 refine은 OD-SLOT-1에 따라 철회**)
  - `impl/test/plan-beta-selection.test.ts` · `app/src/domain/plan-beta-schema.contract.test.ts` — PM QUALITY 좌표 진행 기록 + 저장 관문 현재 동작 고정(C-4, ㉢-b에서 개정 예정)
- **완료 조건 대비:** §8-12 레지스트리 중 OD-SLOT과 충돌하는 DSB-INV-002·003은 최신 오너 결정이 우선(위반 아님). 앱 141파일/1046건(UTC+KST) + impl 14파일/127건 + **실체 tsc**(`node_modules/.bin/tsc`) 0건. `movePlanSession` 전용 연산·재계획 흐름(V1/V3)은 **후속 UI 작업지시서(㉢ 단계) 소유**로 명시적 비목표 — 본 작업지시서는 타입 확장까지만.
- **후속작:** ㉢-a 생성기(C-1~C-3) → ㉢-b 저장 관문(C-4/C-5) → ㉢-c 문구(C-6) → OD-SLOT-6 수정·확정 플로우(별도 작업지시서) (결정 문서 §5)
- **B-13 분리:** leaf `sessions` 배열의 (day,slot) 유일성 refine 부재 — 아래 B-13 참조 (본 항목과 별개)

### B-03 🟠 PR #182 본문 명시 "안 된 것" 5건 — [부분 완료]
- **출처:** PR #182 `fable/q1-trends-import-disclosure` 본문 (2026-08-04)
- **상태:** ⚠️ 부분 완료 (2026-08-05) — PR #182 main 머지 (`bff68e8`)로 Q3와 **Q4 도메인 층**은 완료. 그러나 **Q4 화면 층은 여전히 미구현**이다.
- **실측 근거 (2026-08-05):** `grep -rn "releaseSyncOwner" app/src` → `sync-local.ts`(정의)와 `sync-owner-release.contract.test.ts`(테스트)에만 존재. **화면 호출 0건.** 즉 PR #182 본문이 지적한 *"사용자가 실제 얻는 개선 아직 0"* 이라는 상태가 그대로다. 이 부분은 **B-12로 분리했다.**
- **내용:**
  1. **Q3 미착수** — "전부 지우기" 후 삭제 기록(tombstone)이 남는다는 사실 공개. 코드 0줄
  2. **Q4 화면 미착수** — `releaseSyncOwner()` 도메인 함수는 존재하나 **어디서도 호출되지 않음**. "다른 계정으로 바꾸기" 버튼 + 백업 권유 → 동의 끄기 → 잠금 해제 → 로그아웃 흐름 미구현. **사용자가 실제 얻는 개선 아직 0**
  3. **e2e 미실행** — Q1이 `Trends.tsx`를 건드렸는데 e2e 미실행
  4. **rebase 미완료** — `origin/main`이 `6457bfc`로 앞서고 `Trends.tsx`·`journal-trash.contract.test.ts` 2개 파일 충돌. 머지 전 해결 필요
  5. **Q2 별건** — 사용자 승인대로 별건 PR 필요
- **완료 조건:** 이 PR 머지 전 rebase 완료 + e2e 통과, Q3·Q4 화면 작업 별도 완료

### B-04 🟠 PR #180 decoration-safety-followup — [완료]
- **출처:** PR #180 `codex/decoration-safety-followup` (OPEN)
- **상태:** ✅ 완료 (2026-08-05) — PR #180 main 머지 (`d670c23`)
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

### B-11 🟠 §4-1 LogDetail 접근성 — B-01이 완료로 표시했지만 실측 1건
- **출처:** `WORK_ORDER_UX2` §4-1 (1) · B-01 통합 시 교차 확인으로 발굴 (2026-08-05)
- **상태:** ❌ 사실상 미완 — B-01 항목은 "§4-1 LogDetail aria" 완료로 적었으나 실측은 다르다
- **실측 근거 (2026-08-05, `main` `386bc6d`):**
  - `grep -c "aria-label" app/src/screens/LogDetail.tsx` → **1** (`LogDetail.tsx:120` 되돌리기 버튼뿐)
  - §4-1이 명시한 대상: 수정·삭제·뒤로·메모 열기 → **부여 0건**
- **주의:** 이 항목을 "완료"로 적은 것은 B-01의 자기보고였다. 문서의 완료 표시를 근거로 삼지 말고 매번 grep으로 확인할 것. 이 발견 자체가 그 이유다.
- **완료 조건:** §4-1 대상 인터랙티브 요소 전부에 접근 이름 부여 + **결함 주입으로 비공허성 확인**(aria-label을 지우면 실패하는 테스트). 접근 이름만 세는 테스트는 금지 — 이름이 실제로 그 버튼을 가리키는지 확인해야 한다(B-01의 `post.energy`가 그 반례다)

### B-12 🟠 Q4 계정 잠금 해제 화면 — 도메인 함수는 있고 부르는 곳이 없다
- **출처:** PR #182 본문 Q4 · B-03에서 분리 (2026-08-05)
- **상태:** ❌ 화면 미구현 — `releaseSyncOwner()`가 어디서도 호출되지 않는다
- **실측 근거 (2026-08-05, `main` `386bc6d`):** `grep -rn "releaseSyncOwner" app/src` → 정의 1건(`domain/account/sync-local.ts:104`) + 계약 테스트. **화면 호출 0건.**
- **왜 중요한가:** 도메인 함수와 계약 테스트가 초록이면 완료처럼 보이지만, 사용자는 이 기능에 **도달할 수 없다**. 기기를 잃은 사용자가 잠금을 못 푸는 상태가 그대로 남아 있다.
- **내용:** "다른 계정으로 바꾸기" 진입 → 백업 권유 → 동의 끄기 → 잠금 해제 → 로그아웃 흐름
- **완료 조건:** e2e로 **사용자 경로 전체**를 통과할 것(도메인 단위 테스트만으로는 불충분 — 이 항목이 그 반례다) + 백업 권유를 건너뛸 수 없음을 고정 + 잠금 해제가 일지 데이터를 지우지 않음을 고정

### B-13 🟠 leaf `sessions` 배열의 (day,slot) 유일성 refine 부재 — B-02에서 분리 (이번 범위 밖)
- **출처:** B-02 구현 중 실측으로 발굴 (2026-08-06) · 승인된 B-02 계획의 "원래부터 있던 구멍 2개는 이번에 건드리지 않는다"
- **상태:** ❌ 미수정 — 이번 B-02 작업 범위 밖
- **실측 근거 (2026-08-06, 브랜치 `codex/slot-type-extension-b` 기준 `fc44f97`):**
  - `app/src/domain/plan-session-schema.ts:160` — `sessions: z.array(planSessionSchema).readonly()` — **배열 refine 0건**
  - `activePlanSchema` **leaf 단독** 검증 시 (day,slot) 유일성(DSB-INV-004)이 **검사되지 않는다**
  - (day,slot) 유일성 검사는 **저장 관문** `planBetaStateSchema` superRefine(`plan-beta-schema.ts:76-82` `"Duplicate plan session slot."`)에만 존재
  - 즉 `loadPlanBetaState`/`savePlanBetaState` 경유(저장 관문)에서는 막히지만, leaf 스키마를 직접 쓰는 다른 경로가 생기면 중복 (day,slot)이 통과할 수 있다
- **왜 B-02와 분리하나:** B-02는 "없어진 방어벽(DSB-INV-002) 복원 + 이식"이 승인 범위. 이 구멍(DSB-INV-004 leaf refin없음)은 승인 계획이 명시적으로 "이번에 건드리지 않는다"고 한 원래 구멍 중 하나. 열린 채로 두지 않고 백로그에 고정해 추후 별도로 수정한다.
- **완료 조건:** `sessions: z.array(planSessionSchema)`에 (day,slot) 반복 refine 추가(저장 관문 superRefine의 중복 검사 로직과 동일 의미) + leaf 단독 사용 시 중복 좌표를 거부하는 계약 테스트 + 결함 주입으로 비공허성 확인(refine 제거 시 실패하는 테스트). 저장 관문 검사는 유지(이중 방어).

### B-18 🔴 ㉢-a0 훈련 시간대 질문 없음 — 생성기가 오후를 고를 근거가 없다 (작업지시서 발행됨)
- **출처:** 오너 승인 2026-08-06 (`"주로 언제 훈련하세요 넣자"`) · `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` §5 단계 2 · 작업지시서 `WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md`
- **상태:** ❌ 미착수 — 작업지시서만 발행 (`cee1445`)
- **왜 필요한가:** OD-SLOT-1이 "오후 고강도를 열어라"인데, **시스템이 선수의 훈련 시간대를 모른다.** 정보가 없으면 생성기는 오후를 고를 수 없고, 근거 없이 고르면 추측이다. B-14를 의미 있게 만들기 위한 선행 작업이다
- **실측 근거 (main `9ca0994`):**
  - `app/src/screens/plan-beta/PlanIntake.tsx:23` — `IntakeStep`이 6개. 시간대 문항 없음
  - `impl/src/plan-generator/types.ts:173-179` — `PlanProfile`에 `availableTrainingDays`·`secondSessionMode`만. 시간대 필드 없음
  - `app/src/domain/plan-beta-schema.ts:35-48` — `planIntakeSchema`에 시간대 필드 없음
- **🔴 최대 위험:** `planIntakeSchema`에 `.optional().default("VARIES")`를 빠뜨리면 `parsePlanBetaState()`가 기존 저장 데이터에 대해 `null`을 돌려준다 → **기존 사용자의 계획이 전부 사라진다.** `trainingFocus`(`:46`)·`secondSessionMode`(`:47`)가 쓴 패턴을 그대로 따를 것
- **함정 2:** `plan-beta-flow.ts:155-190` `completeIntake()`는 모든 필드를 `undefined` 검사한다. 여기서 조용히 기본값을 채우면 문항을 건너뛰어도 티가 안 난다. **필수 검사를 유지**해야 한다
- **완료 조건:** 작업지시서 §6 — T-A~T-G + 각각 결함 주입 비공허성 + 실체 tsc 0건 + **T-D 하위호환 증명** + **T-F 생성 결과 불변 증명**(이 작업만으로는 계획 내용이 달라지면 안 된다)

### B-14 🔴 ㉢-a 생성기 오전 고정 — 오너 결정 미반영 (작업지시서 발행됨, B-18 선행 필요)
- **출처:** `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` OD-SLOT-1·2 · 작업지시서 `WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md` (2026-08-06 발행)
- **상태:** ❌ 미착수 — **B-18 완료 전에는 착수 불가.** `profile.trainingTimePreference`가 없어 타입 오류가 난다
- **실측 근거 (main `e639eae`):**
  - `impl/src/plan-generator/session-builder.ts:205-211` — `qualityTrainingSession(day, ranges.quality, intent)` slot 인자 없음 → 고강도 **항상 AM** (C-1)
  - `impl/src/plan-generator/session-builder.ts:216-221` — PM은 `RECOVERY_INTENT` 고정 (C-2)
  - `impl/src/plan-generator/session-builder.ts:161-164` — `recoverySecondSessionDays()`가 `qualityDays` 제외 → 고강도 날엔 반대 슬롯이 아예 안 생김 (C-3, **OD-SLOT-2 위반**)
- **2026-08-06 개정:** 최초 발행 시 "입력에 시간대 정보가 없으므로 오후를 고를 수 없다"를 전제로 했다. 오너가 시간대 문항을 승인해 **그 전제는 폐기됐다.** `qualitySlotFor()`는 이제 `trainingTimePreference`를 읽어 실제로 슬롯을 결정한다 (`EVENING`→`PM`, `MORNING`/`VARIES`→`AM`)
- **완료 조건:** 개정된 작업지시서 §6 — T-A~T-G 계약 테스트 + 각각 결함 주입 비공허성 증명 + 실체 tsc(`./node_modules/.bin/tsc`) 0건

### B-15 🟠 ㉢-b 저장 관문 — PM 제약이 오너 결정과 충돌
- **출처:** 결정 문서 C-4·C-5 · §4.3 · §5 단계 4
- **상태:** ❌ 미착수 — B-14 완료 후 착수
- **실측 근거 (main `e639eae`):**
  - `app/src/domain/plan-beta-schema.ts:83-91` — PM이 `EASY`+`RECOVERY_INTENT`+RPE 1-2 아니면 거부 (C-4)
  - `app/src/domain/plan-beta-schema.ts:108-113` — 같은 날 PM+QUALITY 공존 거부 (C-5) → **OD-SLOT-2의 주 패턴(오전 고강도+오후 가벼운 훈련)을 막는다**
- **주의:** 검사를 **없애는 것이 아니라 대상을 바꾸는 것**이다. "PM은 회복만" → "PM은 무엇이든 되지만 하루 고강도 2회는 명시 지정 필요" (결정 문서 §4.3)
- **완료 조건:** B-14 생성 결과가 저장 관문을 통과 + 하루 2회 고강도가 명시 지정 없이는 거부됨을 고정 + 결함 주입 비공허성

### B-16 🟠 ㉢-c 화면 문구 — 사용자에게 하는 거짓 약속
- **출처:** 결정 문서 C-6 · §6 · OD-SLOT-7
- **상태:** ❌ 미착수 — **B-15 완료 후에만 착수** (런타임보다 먼저 고치면 거짓말 방향만 바뀐다)
- **실측 근거:** `app/src/screens/plan-beta/PlanIntake.tsx:201` — `detail="오전 기본 훈련과 오후 RPE 1~2 회복 운동만 나눠 보여줘요"`
- **주의:** `secondSessionMode`의 내부 값 `RECOVERY_PM_ALLOWED`는 **개명하지 않는다.** 저장된 사용자 데이터라 마이그레이션 위험. 화면 문구만 고친다
- **완료 조건:** 실제 생성 동작과 문구가 일치 + 권장(휴식/회복운동)이 강제로 읽히지 않는 표현 + e2e 고정

### B-17 🟠 OD-SLOT-6 계획 수정·최종확정 플로우 — 신규 화면
- **출처:** 오너 2차 답변 3번 (2026-08-06) · 결정 문서 OD-SLOT-6 · §5 단계 6
- **상태:** ❌ 미착수 — 별도 작업지시서 필요 (미작성)
- **내용:** 생성된 계획을 사용자가 나중에 수정하거나 최종 결정하는 화면. **하루 2회 고강도의 "직접 지정"이 이뤄지는 유일한 입구**
- **범위 경고:** `WORK_ORDER_SLOT_TYPE_EXTENSION_B.md` §6이 비목표로 뺀 `movePlanSession`, `plan-beta-store.ts` upsert, 캘린더 그리드 UI가 전부 여기 들어온다. ㉢과 묶지 않는다
- **완료 조건:** 미정 — 작업지시서 발행 시 확정

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

### 2.1 B-01 통합 후 재실측 (2026-08-05, `main` `386bc6d`)

문서의 완료 표시를 믿지 않고 다시 grep한 결과다. 두 칸이 어긋났다.

| 실측 항목 | 2026-08-04 | 2026-08-05 재실측 | 판정 |
|---|---|---|---|
| `grep -c "points\|recordingStreak\|Flame" EngagementStrip.tsx` | 6건 | **0건** | §2-2 실제 완료 |
| `grep -n "value={sleep" EveningCheckin.tsx` | `: 7` 거짓 기본값 | `: 4` — 단 `sleep` 초기값 0, 손잡이 `sleep > 0`에서만 노출, 저장 `sleepH: 0` | §2-3 실제 완료 (`4`는 range `min`일 뿐 표시에 쓰이지 않음) |
| `grep -c "briefing" home-view-model.ts` | 0건 | **3건** | §2-1 실제 완료 |
| `grep -rn "9일·10일" app/src` | 존치 | **0건** | §2-4 실제 완료 |
| `grep -c "aria-label" LogDetail.tsx` | 0건 | **1건**(되돌리기뿐) | ⚠️ §4-1 **미완** → B-11 |
| `grep -rn "movePlanSession"` | 0건 | **0건** | B-02·B-05 여전히 미착수 |
| `grep -rln "CycleRail"` | (미기재) | **0건** | B-06 여전히 미착수 |
| `grep -rn "releaseSyncOwner" app/src` (호출부) | 호출 0 | 도메인·테스트에만 존재, **화면 호출 0** | ⚠️ B-03 Q4 화면분 미완 |

**교훈:** B-01은 자기보고로 §4-1을 완료 처리했지만 실측은 1건이었다. `releaseSyncOwner`도 B-03이 완료로 표시됐으나 화면 호출은 여전히 0이다. **이 레지스트리의 `[완료]` 표시는 착수 근거가 될 수 없고, 매번 실코드 grep으로 확인해야 한다.**

---

## 3. 이어서 작업할 때 첫 동작

1. `git fetch origin --prune && git log -1 --oneline origin/main && gh pr list --state open`
2. 이 레지스트리에서 가장 위의 `[완료]` 아닌 항목부터. 항목은 문서 1건(백로그 업데이트) + 구현 + 테스트 + main 통합 PR로 마감.
3. UX2 코드 작업을 시작하는 경우 먼저 `WORK_ORDER_UX2_COACH_HOME_AND_JOURNAL_HONESTY.md` §1~§7 (비목표 §6 포함)을 다시 읽고 `HANDOFF §8` 완료 체크 5종을 실행.
4. 샌드박스 휘발 대비: **작업 분량이 커지기 전에 중간 커밋 + PR 업데이트**를 반복.

---

*이 문서는 계획만 존재하던 작업이 휘발되지 않도록 고정하는 레지스트리다. 각 항목 완료 시 업데이트 후 커밋할 것.*
