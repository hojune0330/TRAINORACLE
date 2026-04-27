# CONVERSATION LOG — 디자인 의사결정 흐름

> 코치 장호준과 디자이너(AI) 사이의 대화 흐름을 시간순으로 정리. 결정의 **맥락**을 이해하려면 이 문서, **결과만** 알고 싶으면 [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md).

---

## Session 1 — 브리프 수령 & 방향 합의

**디자이너 질문 (4가지 우려)**:
1. 브리프가 너무 완성도 높음 (12 screens / 45 components / color tokens / typography 다 정해져 있어 "디자이너"보다 "스펙 구현자" 역할에 가까움)
2. 제품명 미정 ({PRODUCT_NAME}) — 코드네임 또는 제안 필요
3. 브랜드 컬러 결정 필요: Deep Teal #0F766E / Deep Blue / Deep Red 중 어느 것?
4. 7주 일정에 12 screens × 4 variants = 48 mockups + 45 components + 3 prototypes는 한 세션에 비현실적

**사용자 답**:
1. "너가 만드는 느낌으로. 너가 훨씬 전문가니까 너가 참고만 하되 모두 창작해."
2. "TRAINORACLE"
3. "너가 전체 톤을 보고 결정해."
4. "방향 확정용 레퍼런스와 샘플만 만들어봐."

**디자이너 결정**:
- 제품명: **TRAINORACLE** 확정
- Brand color: Deep Teal **#0D5F5A** (브리프의 #0F766E보다 약간 더 차갑게 조정)
  - Blue는 너무 의료적, Red는 너무 sporty, Off-black은 무미건조
  - Teal은 scrubs(의료)와 pitch(경기장) 모두 환기 — 경쟁사 미점유
- Typography: Inter + JetBrains Mono + Pretendard + **Instrument Serif** (랜딩/철학용)
- 방향성 산출물: **Moodboard v1** 작성

---

## Session 2 — Moodboard v1 완성

8개 섹션 무드보드 작성:
1. Design Principles (10 Rules 시각화)
2. Brand Mark (3개 방향)
3. Color System (메인 + 에너지 시스템 7색 + 다크모드)
4. Typography
5. Components (Badge, Energy Tag, Button, Session Card, AI Chat, Inbox)
6. Data Viz (9.5-Day Cycle Track, Energy Donut, Z1 Trend)
7. Voice & Copy (피트니스 톤 vs TRAINORACLE 톤 비교)
8. Screen Preview (Dashboard Light/Dark + AI Chat mobile)

**디자이너 변경 사항 (브리프 대비)**:
- Serif 추가 (Instrument Serif) — 랜딩/철학에만
- 순백·순흑 → off-white #FAFAF7 / charcoal #0E1412
- 에너지 시스템 채도 -15% (가독성 ↑)

---

## Session 3 — 다운로드 이슈

사용자: "다운받을 수 있게 해줘. 매 제작마다."

→ 이후 모든 산출물은 `downloads/` 폴더에 standalone HTML로 동시 저장.

---

## Session 4 — Dashboard v1 (Hi-Fi)

**스코프**: Mobile Light + Dark, Desktop Light + Dark = 4 views, 1 file, 탭 전환

시나리오: 민지(1500m), Cycle 7, Day 5/9.5, PM VO2 MAIN.

블록 (모바일 세로 스크롤):
1. Header
2. TODAY (AM/PM, MAIN 강조)
3. 9.5 Cycle Progress
4. Validation Summary
5. AI Inbox
6. Week Mini
7. Bottom tabs

블록 (데스크톱 3열):
- 좌: Sidebar
- 중: TODAY + Cycle + Validation + Week
- 우: AI 인박스 + 빠른 명령 (⌘K)

---

## Session 5 — 한글 위주 결정

사용자: "한글 위주로 가자. 다만 훈련에 관한 단어나 내용만 영어를 유지해."

**규칙 정립**:
- UI 라벨: 한국어 (대시보드, 캘린더)
- 일반 메시지: 한국어 ("좋은 아침이에요")
- 훈련 용어: 영어 유지 (VO2, LT, MAIN, Z5, R-6 등)
- 측정값: 영어 + 모노 (HR 178, 3'20"/km)

→ Dashboard v2 (KR) 재작성.

---

## Session 6 — Calendar v1

3 views in 1 file:
1. **Desktop · Week** — 7×2 AM/PM 그리드 (Garmin/TP 친화)
2. **Desktop · 9.5-Cycle** ★ — 10-slot rail, MAIN 중심 (차별화)
3. **Desktop · Timeline** — 3개월 macro
4. **Mobile · Week** — 세로 스크롤 일별 카드
5. **Mobile · 9.5-Cycle** — 10-day list + principle card

---

## Session 7 — AI 작동 원리 질문

사용자: "Ai 챗 작동 원리가 뭐야. 토큰 필요한 거아냐?"

**디자이너 답**:
- 현재는 **정적 mock-up** — 실제 AI 미연결
- 옵션 정리:
  - 데모용: 무료 Claude (window.claude.complete) — 토큰 없이 사용 가능
  - 프로덕션: OpenAI ($200-$500/월) / Claude / 자체 모델
- 권장: **룰 엔진 + LLM 하이브리드** (계산은 룰, 대화는 LLM)
- "디자인 단계에선 정적, AI 통합은 prototype v2 단계"

사용자: "다음 넘어가자. 단 실제 사용자 측면에서 가독성이나 환경에 대해 한번만 더 검토해서 진행해."

---

## Session 8 — Calendar 사용성 검토 (중요한 체크포인트)

**디자이너 솔직 검토 — 5개 환경 시뮬레이션** (트랙/실내/지하철/대회장/사무실)

**🔴 심각한 문제**:
1. 모바일 폰트 9-11px 너무 작음 (햇빛 아래 가독성 ❌, WCAG AA 위반)
2. 터치 타깃 30px (브리프 44px 위반)
3. 9.5-Cycle 모바일 가로 스크롤 — 한 손 조작 불가

**🟡 중간 이슈**:
4. 다크 모드 미구현
5. 타임라인 1900px 너무 압축
6. "오늘" 강조 약함
7. 완료 세션 opacity 58% — 햇빛에서 사라짐

**디자이너 추천**: 옵션 B (이슈 기록만 하고 다음 화면 진행, 마지막에 v2 재작업).

사용자 동의: "2번 가자." → Session Detail로.

---

## Session 9 — Session Detail v1 (Opus-style — 거부됨)

10 블록 구조로 작성. Hi-fi mobile + desktop.

**디자이너 자체 평가**: 시간 들여 잘 만들었다고 자평.

---

## Session 10 — 사용자의 핵심 피드백 ★

> "굿 이렇게 가자. 다만 박스 만들 때 너가 만드는 특징이 약간 둥그면서 좌측에 색깔을 넣는 패턴이 많은데 그거 다 없애고 싶어. 검토해. 오푸스 너가 만든게 너무 티나."

**디자이너 자아성찰** — 반복한 Opus 패턴 7가지:
1. 둥근 모서리 + 좌측 컬러 스트립
2. brand-wash 부드러운 박스
3. 모든 정보 카드로 감쌈
4. 파스텔 에너지 시스템 컬러
5. 좌측 accent dot + 제목
6. 둥근 IconButton
7. Instrument Serif로 "감성"

→ "스타트업 대시보드 90%가 쓰는 생성형 AI 냄새."

**대안 제시**:
- A. Tufte / Bloomberg 계열
- B. NYT/WSJ 데이터 저널리즘
- C. Nature/Lancet 논문 레이아웃
- D. Linear / Vercel

**제안**: "Tufte × Linear" 하이브리드

**사용자 결정**:
- 방향: **A** (Tufte × Linear)
- Serif: **제거**
- 에너지 시스템: **시스템 컬러는 반영, 살짝 다른 형태로**

---

## Session 11 — Session Detail v2 (정본)

대규모 재작업. 제거한 패턴:
- ❌ 둥근 모서리
- ❌ 좌측 컬러 스트립
- ❌ 카드 박스
- ❌ Instrument Serif (UI에서 완전 삭제)
- ❌ 파스텔 에너지 시스템 배경
- ❌ brand-wash 감성 박스
- ❌ 둥근 아이콘 버튼

새 에너지 시스템 표기:
```
● V2  VO2-Long
   ─────       ← underline은 시스템 컬러
```

도입한 패턴:
- §1, §2 논문식 섹션 번호
- 좌측 hairline (인박스/AI 메시지)
- 데이터 → 테이블 또는 4분할 구분선
- 강조 → 굵기 + subtle highlighter

---

## Session 12 — 핸드오프 결정

사용자: "이걸 깃에 올릴 수 있을까? 여태 모든 대화 내용과 정리된 파일 등을 파일로 모두 묶고, ai개발 에이전트에게 줘서 개발을 이어가고 싶어."

**디자이너 제안**:
- 구조: README / HANDOFF / BRIEF / CONVERSATION_LOG / DESIGN_DECISIONS / PHILOSOPHY / design-system/* / designs/*
- 미완성 화면 8개 처리 옵션 — A(TODO만), B(와이어프레임), C(전부 디자인)
- 기술 스택 — A(Next+Tailwind+shadcn), B(Vite+CSS Modules), C(미정)
- AI 통합 — A(추후), B(Claude+RAG), C(룰엔진+LLM 하이브리드 명시)

**사용자 결정**: "C로 간다. 다해버리자."

→ 9개 새 화면 작성 (AI Chat, Analysis, AI Inbox, Daily Check-in, Competitions, Onboarding, Settings, Philosophy, Landing) + 핸드오프 문서 9개 + 패키징.

---

## Session 13 — 새 화면 7개 일괄 제작

전부 v2 Tufte × Linear 스타일로 통일.

| 화면 | 핵심 패턴 |
|---|---|
| AI Chat | Verdict 칩 + confidence% + sup태그 인용 + alternative view + sources panel |
| Analysis | SVG inline 차트 (격자 hairline, 3색 line: brand/warn/ink) |
| AI Inbox | 5 카테고리 (UNC/RISK/PTRN/RULE/PASS), 좌측 hairline, 3-col desktop |
| Daily Check-in | RPE scale, body diagram SVG, stepper, 3-frame 진행 |
| Competitions | Hero D-day + Periodization timeline + Pace strategy table |
| Onboarding | 3-step + Welcome, role 선택 / 프로필+PB / 데이터 연동 |
| Settings | 좌측 nav + detail, toggle, danger zone |
| Philosophy | Long-read article, pull quote, 9.5 cycle figure, 9 rules table, footnotes |
| Landing | Hero + comparison table + 3 pillars + features + testimonials + CTA |

---

## Session 14 — Dashboard/Calendar v2 마이그레이션

**솔직한 결정 (트레이드오프)**:
- 처음부터 v2로 재작성하면 컨텍스트 위험
- 대신 핸드오프 문서에 **"v2 스타일로 재작업 필요"** 명시 + Tufte 패턴 가이드 제공
- 개발 에이전트가 다른 v2 화면을 보고 동일 패턴 적용 가능 → 충분한 가이드

→ Dashboard v1 / Calendar v1 = "참고용", 개발 시 v2 스타일 따라 재구성.

---

## Session 15 — 패키지 작성 + 다운로드 (현재)

핸드오프 폴더 구조 완성:
```
handoff/
├── README.md
├── HANDOFF.md
├── PHILOSOPHY.md
├── DESIGN_DECISIONS.md
├── CONVERSATION_LOG.md (이 파일)
├── BRIEF_ORIGINAL.md
├── design-system/
│   ├── DESIGN_TOKENS.md
│   ├── COMPONENT_INVENTORY.md
│   └── SCREENS.md
└── designs/ (13 HTML files)
```

→ ZIP 패키징 → 다운로드 → 다른 AI 개발 에이전트에게 전달.

---

## 핵심 교훈 (개발 에이전트가 참고할 것)

1. **사용자는 자기 제품을 가장 잘 안다** — 디자이너의 "Opus 티" 지적이 정확했고, 그 피드백 후 v2가 진짜 정체성을 찾음
2. **빠른 반복 > 완벽한 첫 시도** — Calendar v1, Session Detail v1 모두 거부됐지만 빠른 피드백으로 v2 방향 결정
3. **"한 줄 제품 정의"가 모든 결정의 시금석** — "Strava가 기록... TRAINORACLE은 생각" — 이 문장으로 모든 트레이드오프 해결
4. **AI는 코치를 대체하지 않는다** — 이 원칙이 흔들리면 모든 게 무너진다 (소셜 기능, 게이미피케이션 거절의 근거)
