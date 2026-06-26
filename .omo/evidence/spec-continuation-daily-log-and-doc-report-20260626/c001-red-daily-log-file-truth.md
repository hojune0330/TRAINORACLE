# C001 RED - Daily Log Exact File Baseline

## Commands

```bash
git status --short
find . -type f \( -name 'DAILY_LOG_AND_CHECKIN_SPEC.md' -o -name 'SPEC_DOCUMENTATION_REPORT.md' -o -name 'PLAN_SAFETY_GATE_SPEC.md' -o -name 'RULE_VALIDATION_ENGINE_CONTRACT.md' \) | sort
rg -n "DAILY_LOG_AND_CHECKIN_SPEC|Daily Check-in|daily check|diary|training journal|일지|체크인|memo|soreness|readiness|RPE|AI Inbox" . --glob '*.md' --glob '!node_modules/**' --glob '!vendor/**'
```

## Git Status Baseline

```text
 M SPEC_WORK_STATUS.md
 M TRAINORACLE_SPEC_INDEX.md
 M specs/reconstruct/README.md
?? .omo/evidence/genspark-legacy-recovery-20260625-code-review.md
?? .omo/evidence/genspark-legacy-recovery-20260625-final-qa.ps1
?? .omo/evidence/genspark-legacy-recovery-20260625-gate-review.md
?? .omo/evidence/genspark-legacy-recovery-20260625-qa-review-raw.json
?? .omo/evidence/genspark-legacy-recovery-20260625-qa-review.md
?? .omo/evidence/genspark-legacy-recovery-20260625/
?? .omo/evidence/genspark-spec-readiness-validation-20260626.md
?? .omo/evidence/spec-continuation-daily-log-and-doc-report-20260626/
?? .omo/evidence/spec-continuation-phantom-doc-guard-20260626/
?? .omo/evidence/spec-continuation-plan-safety-gate-20260626-code-review.md
?? .omo/evidence/spec-continuation-plan-safety-gate-20260626/
?? .omo/plans/genspark-legacy-recovery-run.md
?? .omo_ulw_create_daily.json
?? .omo_ulw_status_daily.json
?? SPEC_FILE_TRUTH_GUARD.md
?? SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md
?? specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md
?? specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md
```

## Exact Target Filenames

```text
./specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md
./specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md
```

## Text Sightings

```text
.\BRIEF_ORIGINAL.md:112:8. AI Inbox
.\CONVERSATION_LOG.md:69:5. AI Inbox
.\CONVERSATION_LOG.md:217:→ 9개 새 화면 작성 (AI Chat, Analysis, AI Inbox, Daily Check-in, Competitions, Onboarding, Settings, Philosophy, Landing) + 핸드오프 문서 9개 + 패키징.
.\CONVERSATION_LOG.md:229:| AI Inbox | 5 카테고리 (UNC/RISK/PTRN/RULE/PASS), 좌측 hairline, 3-col desktop |
.\CONVERSATION_LOG.md:230:| Daily Check-in | RPE scale, body diagram SVG, stepper, 3-frame 진행 |
.\designs\README.md:16:| 07 | `07_AIInbox.html` | AI Inbox | v2 Tufte | ✅ tabs | ✅ |
.\designs\README.md:18:| 09 | `09_DailyCheckin.html` | 일일 체크인 | v2 Tufte | ✅ 3 frames | — |
.\designs\README.md:62:일부 화면 (Onboarding, Daily Check-in, Moodboard)은 **모바일 multi-frame** 형태로 여러 단계를 한 화면에 펼쳐 보여줍니다.
.\designs\README.md:72:- CK +18% (warning), RPE stable
.\HANDOFF.md:79:- [ ] **Daily Check-in** — 5분 안에 끝나는 폼
.\HANDOFF.md:83:- [ ] **AI Inbox** — 알림 큐
.\HANDOFF.md:108:- ✅ AI Inbox
.\HANDOFF.md:109:- ✅ Daily Check-in
.\PHILOSOPHY.md:40:| **중장거리 선수** | 18–35 | 매일 1–2회 | 오늘 세션 확인, 체크인, AI 질문, 기록 추적 |
.\PHILOSOPHY.md:85:훈련 용어는 **영어 원문 유지**. CK, EPOC, TSS, TSB, RPE, HR drift, VO2max, LT, Z1–Z6, MAIN, AUX, BASE, LT, VO2, GLY, ATP, A_guide, 9.5-day cycle 등.
.\PHILOSOPHY.md:123:| R-4 | 주관 신호 우선 | RPE/Sleep > CK/HR drift |
.\PHILOSOPHY.md:257:> However, RPE stable (5.8/10) and HR drift 2.1% (within band).
.\TRAINORACLE_SPEC_INDEX.md:33:- absolute downstream counts must not be copied from memory
.\TRAINORACLE_SPEC_INDEX.md:46:| `.omo/` | Codex handoff, evidence, plans, and readiness reports | PROCESS_EVIDENCE |
.\TRAINORACLE_SPEC_INDEX.md:141:7. Draft daily-log/check-in contracts before implementing diary/check-in storage or using daily notes as safety inputs.
.\TRAINORACLE_SPEC_INDEX.md:142:8. Use `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md` to keep legacy references, current SPEC contracts, and daily-log service flows aligned before drafting diary/check-in productization specs.
.\TRAINORACLE_SPEC_INDEX.md:148:Current handoff, inventory, and readiness evidence lives under `.omo/`.
.\TRAINORACLE_SPEC_INDEX.md:160:- `.omo/reports/trainoracle-reconstruction-readiness.md`
.\TRAINORACLE_SPEC_INDEX.md:161:- `.omo/reports/github-publish-readiness.md`
.\SPEC_WORK_STATUS.md:71:| `DAILY_LOG_AND_CHECKIN_SPEC.md` | Not found as an exact local filename in this repo at the C001 search baseline; defer until the safety core contract pair is present and reviewed |
.\SPEC_WORK_STATUS.md:83:4. Keep `DAILY_LOG_AND_CHECKIN_SPEC.md` deferred until the safety core contract pair is reviewed.
.\SPEC_WORK_STATUS.md:86:7. Before implementing diary/check-in storage or daily brief generation, draft the daily-log contracts described in `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`.
.\SPEC_WORK_STATUS.md:94:- Do not copy absolute downstream counts from memory.
.\SPEC_WORK_STATUS.md:118:- [`.omo/evidence/genspark-spec-readiness-validation-20260626.md`](./.omo/evidence/genspark-spec-readiness-validation-20260626.md)
.\SPEC_WORK_STATUS.md:121:- [`.omo/reports/trainoracle-reconstruction-readiness.md`](./.omo/reports/trainoracle-reconstruction-readiness.md)
.\SPEC_WORK_STATUS.md:140:6. [`.omo/reports/trainoracle-reconstruction-readiness.md`](./.omo/reports/trainoracle-reconstruction-readiness.md)
.\SPEC_FILE_TRUTH_GUARD.md:118:| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `MISSING_AFTER_EXACT_SEARCH` |
.\SPEC_FILE_TRUTH_GUARD.md:129:| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `MISSING_AFTER_EXACT_SEARCH` |
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:102:| `PLAN_GENERATOR_SPEC.md` | `02_AI_STRATEGY.md` Phase E, `06_VALIDATION_AND_SAFEGUARDS.md`, design Session Detail and AI Inbox | Generator is downstream only. It consumes Safety Gate, Template Library, Profile, Classifier, and Physio results without redefining them. | Local file declares `OI-PG-RULE-SAFETY-GATE-BINDING-001` and `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` as canonical blockers. |
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:126:- Daily Check-in and diary-like usage exist in design and glossary docs, but there is no dedicated `DAILY_LOG_AND_CHECKIN_SPEC.md`.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:127:- Daily Check-in currently implies memo/pain input in design docs, while the safety/spec layer forbids raw athlete free-text and raw symptom clause storage in audit contracts. This needs a structured contract before app implementation.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:144:TrainOracle should feel like a daily training journal, but its core value remains training analysis, plan design, and evidence-based coaching.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:149:2. Dashboard opens the day with today's planned session, cycle context, unread AI Inbox items, and today's check-in state.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:150:3. Daily Check-in captures structured fields first: energy, soreness, sleep, mood, RPE, body-area signal, readiness, and optional constrained notes.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:160:13. Session Detail, Analysis, Calendar, and AI Inbox show outcomes with verdict, confidence, citation, and visible uncertainty.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:161:14. Completed sessions and daily check-ins return to the archive and become structured context for the next decision.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:187:3. `DAILY_LOG_AND_CHECKIN_SPEC.md`
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:189:   - Purpose: define daily check-in, diary, structured wellness input, note handling, and storage boundaries.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:191:   - Must reconcile design `Daily Check-in` memo UX with raw free-text storage prohibitions.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:195:   - Purpose: define how daily brief, dashboard prompts, and AI Inbox items are generated from structured facts.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:221:5. Draft `DAILY_LOG_AND_CHECKIN_SPEC.md` before implementing the app's diary/check-in storage model.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:222:6. Draft `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` before wiring daily summaries, push prompts, or AI Inbox generation.
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:252:- How does daily check-in feed training analysis and plan generation?
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:253:- What cannot be stored from diary/check-in input?
.\SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:255:- Which new SPEC should be written before app implementation touches daily diary storage?
.\design-system\COMPONENT_INVENTORY.md:67:- **Used in**: AI Chat, Session Why, AI Inbox
.\design-system\COMPONENT_INVENTORY.md:82:- **Used in**: Daily Check-in (수면 시간)
.\design-system\COMPONENT_INVENTORY.md:86:### 1.8 `Scale` (1-10 RPE)
.\design-system\COMPONENT_INVENTORY.md:87:- **Used in**: Daily Check-in
.\design-system\COMPONENT_INVENTORY.md:198:- **Used in**: AI Chat, Session AI block, Daily Check-in tip
.\design-system\COMPONENT_INVENTORY.md:223:- **Used in**: AI Inbox, Dashboard widget
.\design-system\COMPONENT_INVENTORY.md:244:- **Used in**: Daily Check-in, Onboarding
.\design-system\COMPONENT_INVENTORY.md:272:- **Used in**: Daily Check-in
.\design-system\COMPONENT_INVENTORY.md:300:- **Used in**: Session Detail, Analysis, AI Inbox
.\design-system\COMPONENT_INVENTORY.md:309:- **Used in**: Session Detail, Daily Check-in, Onboarding
.\design-system\COMPONENT_INVENTORY.md:314:- **Used in**: Session Detail, AI Inbox
.\DESIGN_DECISIONS.md:90:| AI Inbox | — | ✅ |
.\DESIGN_DECISIONS.md:91:| Daily Check-in | — | ✅ |
.\DESIGN_DECISIONS.md:126:### 3.3 AI Inbox 카테고리 (5개)
.\DESIGN_DECISIONS.md:229:- AI Inbox에 코치 view 8명 통합
.\design-system\SAFEGUARDS.md:45:- 매일 직접 입력 (RPE, sleep, distance, pace)
.\design-system\SAFEGUARDS.md:121:- 대신 "필요한 데이터" 명시: "RPE 14일 추가 입력 필요"
.\design-system\SAFEGUARDS.md:137:- CK 14d > +25% AND RPE 14d > +1.0
.\design-system\SAFEGUARDS.md:231:- 단 RPE 14d > +1.5, sleep < 6h 14d 평균 등은 알림
.\design-system\SAFEGUARDS.md:331:> > "객관 마커(CK, HR drift)와 주관 신호(RPE, sleep)가 충돌할 때, 주관 신호를 우선한다."
.\design-system\SCREENS.md:23:| 07 | AI Inbox | `07_AIInbox.html` | ✅ v1 (Tufte) | **P2** |
.\design-system\SCREENS.md:25:| 09 | Daily Check-in | `09_DailyCheckin.html` | ✅ v1 (Tufte) | **P1** |
.\design-system\SCREENS.md:72:4. Feature 3개 (Calendar / AI Chat / AI Inbox) — placeholder 자리에 실제 스크린샷 삽입 예정
.\design-system\SCREENS.md:131:5. AI Inbox (3 미확인 미리보기)
.\design-system\SCREENS.md:187:5. **AI Inbox 연동** — 좌측 hairline brand
.\design-system\SCREENS.md:271:- Conversation memory: thread별 last 10 messages만 컨텍스트로
.\design-system\SCREENS.md:279:## 7. AI Inbox (`07_AIInbox.html`) — **P2**
.\design-system\SCREENS.md:312:- 체크인 입력 직후: 결정 함수 → 변화 감지 시 INBOX
.\design-system\SCREENS.md:345:## 9. Daily Check-in (`09_DailyCheckin.html`) — **P1**
.\design-system\SCREENS.md:348:- 매일 5분 이내 체크인. RPE, 수면, 통증, 메모.
.\design-system\SCREENS.md:351:1. § 어제 세션 RPE (1-10 scale)
.\design-system\SCREENS.md:501:| AI Inbox | InboxItem[], Athletes, Sources |
.\design-system\SCREENS.md:503:| Daily Check-in | CheckIn(today), Session(yesterday), AI tip |
.\design-system\SCREENS.md:522:- Daily Check-in
.\design-system\SCREENS.md:536:- AI Inbox
.\design-system\FEATURE_TIERS.md:23:- 매일 체크인
.\design-system\VISUALIZATION_SYSTEM.md:69:  Pain / RPE / Sleep ───→ Pain trend, Mode chip
.\design-system\VISUALIZATION_SYSTEM.md:611:- "필요한 데이터: RPE 14일 추가 입력" 같은 명시적 요청
.\design-system\SYSTEM_FOUNDATIONS.md:44:- ✅ "어제 RPE 6, 수면 7시간. 지난 14일 평균과 같음."
.\design-system\SYSTEM_FOUNDATIONS.md:223:  · 지난 14일 RPE 평균 (5.8/10)
.\design-system\SYSTEM_FOUNDATIONS.md:359:| **2** | 06:32 | 앱 진입, Today | 호명 + memory | session card strong | 어제 결과 confidence | Daily brief |
.\specs\reconstruct\PLAN_SAFETY_GATE_SPEC.md:443:| `OI-PSG-DAILY-LOG-INPUT-BINDING-001` | P2 | NO | OPEN | Daily check-in input may later feed RVE/Safety Gate, but no daily-log contract exists yet. | Draft daily-log/check-in contract before app diary storage or safety-input implementation. |
.\specs\reconstruct\README.md:20:0. Always search first; do not reconstruct from memory.
.\specs\active\PHYSIO_SOURCE_TRUST_SPEC.md:237:| HRV | HRV, readiness proxy | recovery context |
.\specs\active\PHYSIO_SOURCE_TRUST_SPEC.md:240:| RPE_STRUCTURED | structured RPE, structured fatigue rating | coach review context |
.\specs\active\PHYSIO_SOURCE_TRUST_SPEC.md:241:| BODY_STATUS_STRUCTURED | structured soreness, structured wellness score | review context |
.\specs\active\PHYSIO_SOURCE_TRUST_SPEC.md:243:| DERIVED_READINESS | readiness band, recovery band | candidate filtering only |
.\specs\active\PHYSIO_SOURCE_TRUST_SPEC.md:263:  RPE_STRUCTURED:
.\specs\active\PHYSIO_SOURCE_TRUST_SPEC.md:416:| Derived readiness uses stale HRV | INSUFFICIENT_DATA or REVIEW_REQUIRED |
.\specs\active\PHYSIO_SOURCE_TRUST_SPEC.md:666:  | "RPE_STRUCTURED"
.\specs\active\PHYSIO_SOURCE_TRUST_SPEC.md:800:| OI-PST-LONGITUDINAL-TREND-MODEL-001 | OPEN | NO | Longitudinal readiness trend model is not specified. | Trend model policy created after data collection |
.\specs\active\SESSION_CLASSIFIER_SPEC.md:1018:| TC-IC-001 | intensity | Z1 dominant + RPE 2 | LOW | PASS |
.\specs\active\SESSION_CLASSIFIER_SPEC.md:1019:| TC-IC-002 | intensity | Z3 dominant + RPE 5 | MOD | PASS |
.\specs\active\SESSION_CLASSIFIER_SPEC.md:1020:| TC-IC-003 | intensity | Z4 dominant + RPE 7 | HIGH | PASS |
.\specs\active\SESSION_CLASSIFIER_SPEC.md:1021:| TC-IC-004 | intensity | Z5 dominant + RPE 9 | VERY_HIGH | PASS |
.\specs\legacy-reference\GLOSSARY.md:40:| **측정 지표** | 영어 + 모노 + 단위 | 정밀성 | `HR 178`, `TSS 124`, `RPE 7.5` |
.\specs\legacy-reference\GLOSSARY.md:43:| **시스템 고유 명사** | 영어 (대문자 시작) | 제품 정체성 | `Personal Archive`, `PB Trail`, `9.5-Cycle`, `AI Inbox` |
.\specs\legacy-reference\GLOSSARY.md:56:| `Inbox` | **AI Inbox · 받은편지함** | `Inbox` |
.\specs\legacy-reference\GLOSSARY.md:89:- 시각적 동일성: AI Chat Bubble, Daily Brief, AI Inbox 등 컴포넌트는 단계와 무관하게 동일.
.\specs\legacy-reference\GLOSSARY.md:246:| **RPE** | Rate of Perceived Exertion | 자각운동강도 | 1–10 | `RPE 7.5` |
.\specs\legacy-reference\GLOSSARY.md:401:### 2.10 AI Inbox · 받은편지함
.\specs\legacy-reference\GLOSSARY.md:407:- **표기**: `AI Inbox`, 사용자 화면에서는 "받은편지함" 병기 가능
.\specs\legacy-reference\GLOSSARY.md:410:### 2.11 Daily Check-in · 매일 체크인
.\specs\legacy-reference\GLOSSARY.md:412:- **표기**: 한국어 화면 "매일 체크인", 시스템 `Daily Check-in`
.\specs\legacy-reference\GLOSSARY.md:458:| `CheckIn` | 일일 체크인 입력 | date, energy, soreness, sleep, mood |
.\specs\legacy-reference\GLOSSARY.md:573:`ATL` `ATP-PC` `AUX` `BASE` `bpm` `CK` `CTL` `DNF` `DNS` `EPOC` `GLY` `HM` `HR` `HRmax` `ITBS` `km` `LSD` `LT` `LTHR` `MAIN` `pace` `PB` `RPE` `SB` `strain` `taper` `TSB` `TSS` `VO2` `VO2-LONG` `VO2-SHORT`
.\specs\legacy-reference\GLOSSARY.md:598:`9.5-Cycle` · `9 Rules` · `AI Inbox` · `Daily Check-in` · `MIXED` · `PB chip row` · `PB Trail` · `Personal Archive` · `Range Switcher` · `Records` (4 Records: PB / SB / Target / Reference) · `Rule engine` · `Track Record` (제외) · `Cohort` (P3) · `Knowledge base` (P3)
.\specs\legacy-reference\GLOSSARY.md:628:| 2026-04-29 | index.html에 GLOSSARY 카드 추가 | Root docs 섹션에서 진입 가능, readiness check에도 OK 항목 추가 |
```

## Interpretation

- `DAILY_LOG_AND_CHECKIN_SPEC.md` is absent before reconstruction unless it appears in the exact filename block above.
- `SPEC_DOCUMENTATION_REPORT.md` is absent before this reporting pass unless it appears in the exact filename block above.
- Text sightings are context only and do not prove file existence.
