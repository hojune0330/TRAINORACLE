---
doc_id: PERSONA_ACQUISITION_PLAN_DETAILED_2026-09-04
title: 세 페르소나 모객 상세 기획안 — 실행 단위 · 수용 기준 · 측정 · 리스크
date: 2026-09-04
base_sha: 726cedc
status: PROPOSAL_AWAITING_OWNER_APPROVAL
scope: 요약 기획안(PERSONA_ACQUISITION_PLAN_2026-09-04.md)의 각 항목을 구현 가능한 단위로 분해. 코드 변경 없음. 훈련 영역 수치 결정 없음.
source_audit: reports/review/PERSONA_ACQUISITION_FIT_AUDIT_2026-09-04.md
summary_plan: reports/review/PERSONA_ACQUISITION_PLAN_2026-09-04.md
canonical_promotion: false
---

# 세 페르소나 모객 상세 기획안

## 0. 읽는 법

- 각 실행 단위는 **ID / 목적 / 대상 페르소나·페인 / 변경 위치 / 동작 정의 / 수용 기준(테스트) / 하지 않는 것 / 리스크**로 기술.
- "변경 위치"는 감사에서 확인한 실제 파일. 라인은 `726cedc` 기준.
- 훈련 영역(페이스·반복·강도·주기화)에 닿는 항목은 없다. 닿을 가능성이 생기면 해당 단위는 중단하고 오너 결정 목록(§7)으로 보낸다.
- 모든 예시·캡처는 합성 데이터. 실제 사용자 일지는 홍보물에 쓰지 않는다.

---

## 1. Wave A — 첫인상 (링크를 붙였을 때 맞는 얼굴)

### A-1 (W1) 메타·매니페스트 문구 재작성
- **목적**: 링크 미리보기·설치 화면 첫 문장을 P1 우선·P2 후순으로.
- **대상**: P1 유입 첫인상, P2.
- **변경 위치**: `app/index.html:7` `<meta name="description">`, `:13` `og:description`, `og:title`, `app/public/manifest.webmanifest` `description`.
- **동작 정의**(문안, 오너 검토 요청):
  - description: `가입 없이 내 기기에만 남기는 달리기 일지. 몸 상태를 확인한 뒤 훈련 후보도 받아요.`
  - og:title: `TRAINORACLE — 가입 없는 달리기 일지`
  - og:description: `30초 기록, 자라는 정원, 안전 확인 후 7~10일 훈련 후보. 모든 데이터는 이 기기에만.`
- **수용 기준**: (1) `curl` 결과 HTML에 세 문구 반영 (2) 문구 정직성 체크리스트 6항 통과(감사 §6) (3) "페이스/자동/코치" 단어 없음을 grep으로 확인하는 정적 테스트 추가(`app/src/__tests__/marketing-copy-honesty.test.ts`, index.html·manifest 읽어 금지어 검사).
- **하지 않는 것**: 앱 내부 문구 변경 없음.
- **리스크**: 없음(문구만).

### A-2 (W12) 링크 미리보기 완성
- **목적**: 카톡·인스타 DM·카페 글에서 썸네일이 보이게.
- **변경 위치**: `app/index.html` `<head>`, `app/public/` 정적 이미지, `<title>`(`:5`).
- **동작 정의**: `og:image` 1200×630 PNG(정원 "작은 나무" 단계 + 일지 카드 합성 캡처, 텍스트 최소), `og:image:width/height`, `twitter:card=summary_large_image`, `twitter:title/description`, `<title>TRAINORACLE — 가입 없는 달리기 일지</title>`. 이미지 경로는 `base: "./"`(`vite.config.ts:8`) 때문에 **절대 URL**(`https://hojune0330.github.io/TRAINORACLE/og.png`)로 기재 — og는 상대경로를 못 읽음.
- **수용 기준**: (1) 빌드 후 `dist/og.png` 존재, 100KB 이하 (2) 정적 테스트가 `og:image`가 `https://`로 시작함을 확인 (3) 수동: 카카오 링크 미리보기 디버거 1회 확인(오너 또는 작업자, 결과 캡처를 `reports/evidence/`에).
- **하지 않는 것**: 동적 og(사용자별)는 서버 없어서 안 함.
- **리스크**: GitHub Pages URL이 바뀌면 이미지 깨짐 → README의 공개 URL과 같은 상수를 쓰고 테스트로 묶음.

### A-3 (W2) 페르소나 딥링크 `?start=`
- **목적**: 홍보 링크마다 첫 화면을 다르게. 채널 파라미터로 유입 식별.
- **변경 위치**: `app/src/main.tsx:28-30`(기존 쿼리 플래그 패턴), `app/src/AppShell.tsx:51`(`?account=1` 처리 위치), `App.tsx:15`(`profile` 파싱 위치).
- **동작 정의**:
  - `?start=log` → 홈 대신 빠른 기록 EntryChooser로 진입(뒤로 가면 홈).
  - `?start=plan` → 계획 인테이크 1단계로 진입.
  - `?start=example&kind=hobby|first10k|track` → 해당 예시 일지(C-4 선행 필요; 없으면 민지 예시로 폴백).
  - `?campaign=<slug>`·`?crew=<slug>` → 값은 **로컬에만** 저장(`localStorage` 키 `trainoracle.acquisition`), 서버 전송 없음. W-D 승인 시 집계 이벤트의 속성으로만 쓴다.
  - 알 수 없는 값은 무시하고 홈. 파라미터는 진입 후 `history.replaceState`로 제거(공유 payload가 `url.search = ""`로 지우는 기존 방식과 일관 — `engagement-rewards.ts:66-68`).
- **수용 기준**: vitest — 파서 단위 테스트(허용 값·무시·XSS 문자열 안전); Playwright — `?start=log`에서 첫 화면 제목이 기록 선택 화면, `?start=plan`에서 `1/11` 표시, 320px에서 동일.
- **하지 않는 것**: 딥링크로 안전 단계 건너뛰기 불가(인테이크 순서 불변).
- **리스크**: 쿼리 플래그가 6개로 늘어남 → `app/src/domain/entry-query.ts` 한 곳으로 모아 정리(기존 3개 이관 포함).

### A-4 (W6) 개인 목표 시 부문 단계 생략
- **목적**: 취미 러너에게 "초등부/중등부…" 화면을 보이지 않게.
- **변경 위치**: `app/src/screens/plan-beta/plan-intake-navigation.ts:65-70` `visibleIntakeSteps`, `plan-intake-meta.ts` STEP_META(goal 단계 부제), `PlanIntake.tsx` goal 단계.
- **동작 정의**: 목표(종목) 단계 하단에 토글 두 개 — "대회 출전 준비(부문 있음)" / "개인 목표(부문 없음)". 개인 목표 선택 시 `division = "NOT_PROVIDED"` 자동 채움 + `division` 단계 숨김(현재 하프·마라톤과 같은 규칙으로 통일). 대회 출전 선택 시 기존 그대로. 기본값은 **선택 없음**(강제 X) — 미선택이면 기존처럼 부문 단계 표시.
- **수용 기준**: 기존 `plan-intake-navigation` 테스트 확장 — (개인 목표, 10km) → 10단계; (대회, 10km) → 11단계; (미선택, 10km) → 11단계; 하프·마라톤은 변화 없음. `answeredSummary`에 "개인 목표" 표기.
- **하지 않는 것**: 부문 라벨·의미 변경 없음(계획 구분 표시 전용이라는 기존 설명 유지).
- **리스크(사전 확인 완료)**: `division`은 `plan-beta-flow.ts:362-367`에서 `divisionForGoal(eventGroup) ?? competitionDivision`으로 스키마 필수값만 채우며, 처방·강도 로직(`domain/*prescription*`)에서는 참조하지 않음. 하프·마라톤은 이미 `NOT_PROVIDED` 자동 채움이므로 같은 값을 개인 목표에 넣는 것은 새 경로가 아님. `glossary.ts`의 용어 설명만 추가 확인 필요.

### A-5 (W11) 훈련 목적 카드에 상세 훈련표 유무 배지
- **목적**: 2차 검증 V2-2 — 어떤 목적에 훈련표가 있는지 고르기 전에 알게.
- **변경 위치**: `PlanIntake.tsx` focus 단계 카드, `plan-template-options.ts`(승인 템플릿 조회 함수 재사용).
- **동작 정의**: 현재 종목·경험 조합에서 `DETAILED_PRESCRIPTION_APPROVALS`에 일치하는 템플릿이 있는 목적 카드에 작은 배지 "상세 훈련표 있음", 없으면 "RPE 기준". 배지는 정보만, 선택 강제·정렬 변경 없음.
- **수용 기준**: vitest — (5000m, EXPERIENCED) → VO₂만 "있음", (10km, NEW) → 전부 "RPE 기준"; 스냅샷 없이 텍스트 단언. 접근성: 배지는 `aria-label`에 포함.
- **하지 않는 것**: 템플릿 추가·수정 없음. 승인 목록만 읽음.
- **리스크**: 없음.

### A-6 (W7) 동일 후보 정직화
- **목적**: 후보 A/B 본운동이 같을 때 "두 개"처럼 보이지 않게(북극성 "폴백은 덜 보여준다").
- **변경 위치**: 후보 화면(1차 여정 캡처 "비교할 본운동 구간이 없어요" 표시 컴포넌트).
- **동작 정의**: 두 후보의 본운동 구성이 동일하면 비교 표 상단에 "두 후보의 훈련 내용은 같고 총 시간 범위만 달라요(A 1시간~1시간45분 / B 1시간)" 한 줄 명시. 선택 UI는 유지(사용자가 시간을 고르는 의미는 남음).
- **수용 기준**: 기존 후보 화면 테스트에 동일 구성 케이스 추가; 다른 구성일 때 문구 없음.
- **하지 않는 것**: 후보 생성 로직 변경 없음.
- **리스크**: 없음.

**Wave A 완료 정의**: 6개 단위 1 PR, `./node_modules/.bin/tsc --noEmit` 클린, 관련 vitest 전부 통과, Playwright 320/390px 여정 캡처를 `reports/evidence/`에 저장, 감사 문서 §4의 P1 홍보 인프라 결손 5개 중 4개(문구·og·딥링크·부문) 해소 표기.

---

## 2. Wave B — 퍼짐 (한 명이 한 명을 데려오게)

### B-1 (W3+N2) 공유 이미지 카드
- **목적**: 인스타·크루 채널 기본 형식(이미지)으로 공유.
- **변경 위치**: `app/src/domain/engagement-rewards.ts:59 buildEngagementSharePayload`, `Home.tsx shareEngagement`, 새 `app/src/domain/share-card.ts`(Canvas 렌더).
- **동작 정의**:
  - 카드 1080×1350: 상단 "오늘" — 오늘 일지가 있으면 종류(빠른/운동 후/저녁/경기)·RPE·기분, **거리·시간은 EXPLICIT 출처일 때만** 표시; 중단 정원 그림(현재 단계 + 장착 꾸미기); 하단 "기록한 날 N일 · 정원 단계" + 앱 URL.
  - 절대 넣지 않는 것: 페이스 판정, 훈련 조언, 통증 수치, 메모 원문.
  - `navigator.share({files})` 지원 시 이미지+텍스트, 미지원 시 PNG 다운로드 + 텍스트 클립보드(기존 텍스트 payload 유지).
- **수용 기준**: vitest — 카드 데이터 빌더가 IMPORTED 출처 거리를 제외하는지, 메모 필드를 절대 받지 않는 타입인지; Playwright — 공유 버튼 → 다운로드 이벤트 발생, 파일 크기 <400KB.
- **하지 않는 것**: 서버 렌더·외부 이미지 서비스 없음.
- **리스크**: 꾸미기 이미지 라이선스 — 카드에 들어가는 재료는 `public/legal/open-source.html`에 등재된 것만(레지스트리 필터).

### B-2 (N3) 크루 초대 링크(기기 간 데이터 없음)
- **목적**: 소속감으로 크루 단위 유입. 서버 없이.
- **변경 위치**: A-3 파서, `TrainingHome.tsx`(WELCOME 인사 영역), 배지 시스템(`engagement.ts`).
- **동작 정의**: `?start=log&crew=<slug>` 진입 시 WELCOME 부제에 "○○ 크루에서 왔어요" 표시(slug → 표시명은 앱 내 정적 허용 목록 `crew-registry.ts`; 목록에 없으면 표시 안 함 — 임의 문자열 렌더 방지). 로컬 배지 "크루 첫 기록" 1종(요구 조건: 크루 파라미터 존재 + 첫 일지). 크루 간 데이터 공유·순위 없음.
- **수용 기준**: 허용 목록 외 slug 무시 테스트; XSS 문자열 테스트; 배지 조건 테스트.
- **하지 않는 것**: 크루 등록 UI(운영자가 PR로 목록 추가).
- **리스크**: 크루 목록 관리 부담 → 초기 10개 이내로 한정하고 문의 게시판으로 요청 접수.

### B-3 (W13) 홈 화면 추가 유도 + shortcuts
- **목적**: 재방문 경로 확보(1P/방문 보상의 전제).
- **변경 위치**: `app/src/main.tsx:38` SW 등록부 인근, `manifest.webmanifest`, 홈 EngagementStrip.
- **동작 정의**: 기록 2회 이상 + 미설치(`display-mode: standalone` 아님) + 안내 1회 미노출 → EngagementStrip 아래 1줄 "홈 화면에 추가하면 바로 기록할 수 있어요 [방법 보기] [닫기]". Android는 `beforeinstallprompt` 캐치 후 버튼으로 호출, iOS는 공유 시트 안내 3줄. 닫으면 다시 안 보임(로컬). manifest `shortcuts`: "오늘 기록"(`?start=log`), "계획 보기"(`?start=plan`).
- **수용 기준**: 노출 조건 단위 테스트; standalone에서 미노출; Playwright 320px 레이아웃 깨짐 없음.
- **하지 않는 것**: 푸시 알림 없음.
- **리스크**: 없음.

### B-4 (N1) 캠페인 컬렉션 1종
- **목적**: 기간 한정 꾸미기로 채널 캠페인에 "지금 시작할 이유".
- **변경 위치**: `app/src/domain/decoration-collections.ts`(레지스트리, `SEASON` 취득 `:86-113`), `public/collections/`, `LICENSES` → 생성 스크립트(PR #317 절차).
- **동작 정의**: 컬렉션 `SEASON_2026_AUTUMN_CREW`(가칭) 5~8개 재료, 취득 `SEASON {from, to}` 기간 내 방문·기록으로 무료. 종료 후 retire(삭제 아님, 보유자 유지 — 레지스트리 규칙). 홍보 링크 `?start=log&campaign=autumn2026`는 A-3 파서만 사용, 컬렉션 해제 조건은 **기간**이며 파라미터가 아님(파라미터 없이 와도 받음 — 공정성).
- **수용 기준**: 레지스트리 테스트(기간 경계, retire 후 보유 유지), 생성된 `open-source.html`·`assets.json`에 등재.
- **하지 않는 것**: 포인트 가격·보상 규칙 변경 없음.
- **리스크**: 재료 제작 시간(M). 재료 수를 5개로 시작.

---

## 3. Wave C — 정직한 창구 (기대 관리와 신뢰)

### C-1 (N4+W9) 코치·선수 페이지
- **변경 위치**: `app/public/support.html`(기존 섹션 4개 뒤에 추가) 또는 새 `coach.html`; `More.tsx` 행 추가; FAQ(`EasyFaq.tsx:56,62`) 문구 재사용.
- **동작 정의**: 표 2개 — "지금 열린 것"(경험자 800~5000m 상세 훈련표 + V2-1 캡처, 메모 제외 JSON 내보내기, 4형식 가져오기[보관용 명시]) / "아직 닫힌 것"(코치 연결·계획 제안·팀 뷰·부하/편향 판정 — 상태 한 줄씩, 기한 약속 없음). 하단 "열리면 알려드릴게요" → 문의 게시판 딥링크(`?feedback=1`)에 제목 프리필 "코치·선수 대기".
- **수용 기준**: 정적 HTML lint; 문구 정직성 체크; 320px 확인.
- **리스크**: 문의 게시판 플래그 OFF면 연락 수단이 없음 → OFF 상태에서는 이메일 mailto로 폴백(운영 방향 문서의 문의 채널 사용).

### C-2 (N5) "이렇게 정직해요" 페이지
- **변경 위치**: `app/public/honesty.html`(가칭), `More.tsx` 행, 홍보 링크용.
- **동작 정의**: 북극성 §3 불변식·§4 미완 목록을 사용자 언어 6~8문장으로. 예: "몸 이상이 있으면 계획을 안 만들어요" / "페이스 계산은 경험자 트랙 종목 4개만 해요" / "가져온 워치 기록은 보관만 하고 분석엔 안 넣어요" / "메모는 서버로 안 가요". 미완 항목은 "아직 안 해요"로 표기, 기한 없음.
- **수용 기준**: 문장마다 근거 파일 주석(HTML 코멘트) — 감사 문서 매트릭스와 1:1.
- **리스크**: 북극성이 갱신되면 이 페이지도 갱신 필요 → 북극성 §4 변경 PR 체크리스트에 항목 추가 제안(AGENTS.md 라우팅 행).

### C-3 (N6) 아티클 정적 HTML + robots/sitemap
- **변경 위치**: 빌드 스크립트(`scripts/` 또는 vite 플러그인)로 `training-content-catalog.ts` 5개 아티클을 `dist/articles/<id>.html`로 출력; `public/robots.txt`, 생성 `sitemap.xml`.
- **동작 정의**: 각 페이지 = 제목·본문·기존 경계 문구("이 훈련은 앱에서 처방하지 않아요") + 앱 진입 버튼(`?start=plan` 아님 — `?start=log`; 아티클 독자에게 계획을 바로 팔지 않음). `noindex` 대상: 앱 본체(`index.html`)는 그대로 index.
- **수용 기준**: 빌드 산출물 존재 테스트; 아티클 본문이 카탈로그와 바이트 동일(변형 금지).
- **리스크**: 아티클 내용 자체는 이미 승인된 것만. 새 아티클 추가는 별도 절차.

### C-4 (N7) 채널별 예시 일지 3종
- **변경 위치**: 민지 예시 인프라(`AppShell.tsx:57 utilityView "minji"`, `TrainingHome.tsx:166-171`).
- **동작 정의**: `hobby`(취미: 빠른 기록 위주, 정원 성장) / `first10k`(첫 10km: RPE 기준 후보 + 일지 연결) / `track`(경험자 5000m: VO₂ 상세 훈련표 + 경기 기록). 모두 합성. **`track` 예시의 수치는 현재 승인 템플릿이 실제로 생성하는 값만 사용**(새 수치 창작 금지 — 스냅샷을 템플릿 출력으로부터 생성).
- **수용 기준**: 예시 데이터가 템플릿 출력과 일치하는지 테스트; 3종 모두 320px 확인.
- **오너 검토**: `track` 예시 문안(훈련 영역 표현) 1회 검토 요청.

---

## 4. Wave D — 측정 (O7 승인 후)

### D-1 (W10) 이벤트 설계
- **원칙**: 집계만, 개인 식별자·메모·수치 값 전송 없음. 이벤트 이름과 속성은 아래 표가 전부. 표 밖 속성 추가는 PR 리뷰 필수.

| 이벤트 | 속성 | 답하는 질문 |
|---|---|---|
| `visit` | `start`(log/plan/example/none), `campaign`, `crew`, `standalone`(bool) | 어느 채널·딥링크가 오나 |
| `first_journal_saved` | `seconds_since_first_visit`(구간화: <60/<180/<600/else), `kind` | 첫 기록까지 시간 |
| `intake_step` | `step`(1~11), `left`(bool) | 어디서 이탈하나 |
| `candidate_selected` | `identical_candidates`(bool), `detailed_template`(bool) | 후보가 의미 있었나 |
| `share` | `format`(image/text), `succeeded` | 퍼짐 |
| `install_prompt` | `shown/accepted/dismissed` | 재방문 경로 |
| `coach_waitlist_click` | — | P3 수요 |

- **변경 위치**: `product-features.ts:21 productAnalytics`, CI `TRAINORACLE_FEATURE_PRODUCT_ANALYTICS`(`ci.yml:183-195`), 기존 analytics 어댑터.
- **수용 기준**: 이벤트 스키마 zod 정의 + 표 밖 키 거부 테스트; 플래그 OFF면 어떤 네트워크 호출도 없음(테스트).

### D-2 (N8) 측정 공개
- More 화면 DataSafetyNotice에 "세는 것/안 세는 것" 2줄. 홍보 문구 "버튼 수만 셉니다, 당신을 추적하지 않아요".

### D-3 피드백 게시판 ON
- `feedbackBoard` 플래그 ON 조건: C-1 연락 수단 필요 시점. 운영자 응답 SLA는 운영 문서에.

---

## 5. 개별 판단 항목(Wave 밖)

| ID | 항목 | 착수 조건 | 메모 |
|---|---|---|---|
| W4 | 빠른 기록에 선택형 거리·시간 | UX 검토: 빠른 기록의 "탭만" 정체성과 충돌하는지 | 대안: 저장 직후 "거리도 남길래요?" 1탭 확장(`QuickSessionForm.tsx:365` 문구 위치) |
| W8 | 데스크톱 소개 패널 | Wave A 후 PC 유입 비율 확인(D 없으면 대기 명단 설문) | `App.tsx:23 useIsMobileShell` 분기 |
| W5 | 가져온 값 확인 후 EXPLICIT 승격 | **O6** | 정책 개정안 초안은 작업자가 별도 문서로 작성 가능 |

---

## 6. 채널 실행 캘린더(8주, Wave A 배포일 = D0)

| 주 | 채널 행동 | 필요 산출물 |
|---|---|---|
| D0~D+7 | 러닝 크루 3곳에 `?start=log&crew=` 링크 + 공유 카드 예시 | A 전체, B-1(없으면 텍스트 공유) |
| D+7~14 | 러닝 카페 "첫 10km" 글에 `?start=plan` + "RPE 기준 후보" 캡처 | A-4·A-5·A-6 |
| D+14~28 | 인스타 릴스 3편(30초 기록 / 정원 성장 / 정직 페이지) | B-1, C-2 |
| D+21~35 | 학교·클럽 코치 5명 직접 접촉 → C-1 페이지 + V2-1 캡처 | C-1 |
| D+28~56 | 아티클 SEO 지표 관찰, 캠페인 컬렉션 종료(retire) | C-3, B-4 |

각 채널 글에는 **금지 문구 검사**를 통과한 문안만(감사 §6 체크리스트를 채널 담당이 매번 체크).

---

## 7. 오너 결정 목록과 의존 관계

```
O7 분석 플래그 ON ──→ Wave D 전체
O1 초보자 계획 내용 ──→ P2 전면 홍보 문구 해제, C-4 first10k 예시 확장
O2 10km+ 상세 훈련표 ──→ A-5 배지가 "있음"으로 바뀌는 조합 확대
O3 Order 011 / O4 sharing·planProposals ──→ C-1 "닫힌 것" 표 축소, P3 전면
O6 EXPLICIT 승격 정책 ──→ W5
(검토 요청) A-1 문안, C-4 track 예시 문안, C-2 문장
```

## 8. 리스크 등록

| 리스크 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| 홍보 문구가 제품보다 앞서감 | 중 | 신뢰 손상(북극성 위반) | 금지 문구 정적 테스트(A-1) + 채널 체크리스트 |
| P2 유입이 "페이스 없음"에 실망 | 높음 | 이탈·부정 후기 | A-5 배지로 기대 사전 조정, A-6 정직화, C-2 |
| 코치가 대기 명단 후 소식 없음 | 중 | P3 신뢰 | C-1에 기한 약속 금지, 분기 1회 상태 갱신 규칙 |
| 캠페인 컬렉션 라이선스 누락 | 낮음 | 법적 | PR #317 LICENSES 생성 절차 필수 통과 |
| 측정 없이 8주 진행 | O7 미승인 시 확정 | 학습 불가 | 대기 명단·문의 수·수동 설문으로 대체 |

## 9. 산출물 체크리스트

- [ ] Wave A PR (A-1~A-6) + evidence 캡처
- [ ] Wave B PR(들) (B-1~B-4)
- [ ] Wave C PR (C-1~C-4)
- [ ] Wave D PR (O7 후)
- [ ] 채널 문안 3종(P1/P2/P3) — 금지 문구 검사 통과본, `reports/operations/`에 보관
- [ ] 8주 후 회고: 감사 문서 매트릭스 재판정(변경된 항목만)
