# 기기 데이터 연동 실현가능성 판정 — 무엇을 지금 끝낼 수 있고 무엇이 막혀 있는가

```yaml
source_model: FABLE
work_id: FABLE-DEVICE-IMPORT-FEASIBILITY-2026-07-25
owner_question: "직접 너가 모든 부분에서 일임해서 구현 가능할지까지 체크"
verdict: PARTIAL — 파일 업로드 경로만 자체 완결 가능. OAuth 3사 경로는 오너 계정·승인 없이는 불가.
evidence_date: 2026-07-25 (1차 출처 크롤링)
```

## 0. 한 줄 답

**파일 업로드(TCX/GPX) 경로는 제가 끝까지 구현·검증할 수 있습니다.
Garmin / Strava / WHOOP OAuth 연동은 제가 완결할 수 없습니다** — 코드가 어려워서가
아니라, 세 곳 모두 **사람(사업자·구독자·기기 소유자) 명의의 계정 등록과 승인**을
요구하기 때문입니다. 이건 기술 장벽이 아니라 계약 장벽입니다.

## 1. 경로별 판정

| 경로 | 자체 완결 | 막는 것 | 근거 |
|---|---|---|---|
| **파일 업로드 (TCX/GPX)** | ✅ 가능 | 없음 | 브라우저 내 파싱, 외부 의존 0, 시크릿 0 |
| **Garmin Activity API** | ❌ 불가 | **기업 전용** | Program FAQ: "available for enterprise use… it is only for business use" |
| **Strava API** | ⚠️ 오너 개입 필수 | 개발자 **유료 구독** + 10명 한도 | 2026-06-01 Developer Program 개정 |
| **WHOOP API** | ⚠️ 오너 개입 필수 | **WHOOP 기기·멤버십** 보유자만 | Support 문서: API는 무료, 단 기기 멤버십 필요 |

## 2. 근거 상세 (2026-07-25 확인)

### 2.1 Garmin Activity API — 기업 전용 (가장 강한 블로커)

- 출처: `developer.garmin.com/gc-developer-program/program-faq/`
- 인용: *"The Garmin Connect Developer Program is available for enterprise use…
  There are no licensing or maintenance fees for access…, **but it is only for
  business use**."*
- 절차: 신청서 제출 → Garmin 심사(영업일 2일) → **통합 콜(integration call)** →
  평가 환경 승인 → 프로덕션 자동 검증.
- 기능적으로는 매력적: Ping/Pull 또는 Push(webhook) 선택, FIT/GPX/TCX 원본 접근,
  과거 데이터 백필(backfill) 지원.
- **판정**: 사업자 명의 신청과 Garmin과의 통화가 필요. 제가 대행 불가.
- **대안 확보됨**: 사용자가 Garmin Connect에서 활동을 TCX/GPX로 내보내
  업로드하는 경로는 승인 없이 지금 동작한다. 이번 구현이 그 경로다.

### 2.2 Strava — 2026년 정책이 급격히 조여짐

- 출처: `communityhub.strava.com` 「An Update To Our Developer Program」
- 배경(그들의 설명): AI 스크래핑·중개 플랫폼 남용으로 신청 448% 폭증 → 심사 개편.
- **2026-06-01 발효**: Standard / Extended Access 2개 티어 신설.
  Standard는 심사 없이 즉시 발급되지만 **최대 10명(athletes)**,
  그리고 **신규 Standard 개발자는 Strava 구독이 필수**.
- **2026-06-30 발효**: 기존 Standard 개발자도 구독 필수(활성 개발자 3개월 무료 코드).
- **중개 플랫폼 경유 금지**: 서드파티 intermediary를 통한 데이터 라우팅 차단.
  → **Terra·Spike 등 애그리게이터로 우회하는 설계는 정책 위반**이다.
  (참고: 우리 PLAN_BETA에 Terra 언급이 있으므로 이 조항은 별도 확인 필요.)
- 2027-06-01: 토큰은 헤더 전송 강제, base URL이 `api-v3.strava.com`으로 이전.
- **판정**: 오너가 Strava 앱을 등록하고 client secret을 발급해야 하며,
  10명 한도 때문에 **공개 베타에 그대로 쓸 수 없다**. Extended Access는 별도 심사.

### 2.3 WHOOP — 가장 열려 있으나 기기 보유가 전제

- 출처: `developer.whoop.com/docs/developing/support/`
- 인용: *"Access to the WHOOP Developer Platform and API is currently free.
  However, **you must have a WHOOP device, which requires a membership**."*
- OAuth 2.0 표준(RFC-6749), Developer Dashboard에서 앱 생성, redirect URL 등록.
- **판정**: 앱 등록에 WHOOP 멤버십 계정이 필요. 제가 대행 불가.

### 2.4 공통 기술 블로커 — client secret은 브라우저에 둘 수 없다

OAuth 3사 모두 authorization code 교환에 client secret이 필요하다.
현재 TRAINORACLE 앱은 **정적 배포(Cloudflare Pages) + Supabase**다.
따라서 OAuth를 붙이려면:

1. 토큰 교환·refresh를 대행할 **서버 함수**(Supabase Edge Function 등) 신설
2. **오너 소유의 시크릿** 보관·회전 체계
3. 토큰 저장소 스키마 + RLS(사용자별 격리)
4. Strava webhook 수신 엔드포인트(공개 URL·검증 토큰)

즉 OAuth 경로는 "코드 작성"이 아니라 **오너 계정·시크릿·서버 인프라 결정**이
선행 조건이다. 이건 제가 임의로 만들 수 없고, 만들어서도 안 된다.

## 3. 그래서 이번에 무엇을 하는가

### 지금 완결하는 것 (승인·시크릿 0)

- Garmin Connect / Strava / 대부분 워치 앱이 공통으로 내보내는
  **TCX·GPX 파일 업로드 → 일지 초안 → 사용자 확인 → 저장**
- 파일에 있는 사실만 읽고, **RPE·감각은 자동 생성하지 않음**
- 같은 날 비슷한 활동 **중복 감지**(자동 병합 없음 — 판단은 사용자)
- 가져온 값은 **출처 표기 후 통계·추이·훈련계획에서 제외** (아래 4절)

### 오너 결정을 기다리는 것

| 결정 필요 | 내용 |
|---|---|
| D-1 | Garmin 기업 신청을 진행할지 (사업자 등록 필요) |
| D-2 | Strava 앱 등록 + 개발자 구독 결제 여부, 10명 한도 수용 여부 |
| D-3 | WHOOP 앱 등록 (오너의 WHOOP 멤버십 사용) |
| D-4 | OAuth용 서버 함수 신설 승인 (Supabase Edge Function + 시크릿 보관) |
| D-5 | **Strava 중개 플랫폼 금지 조항과 기존 Terra 언급의 충돌 검토** |
| D-6 | 가져온 값을 분석·훈련계획 입력으로 승격할지 (현재는 전면 제외) |

## 4. 안전 경계 — 가져온 값은 분석에 넣지 않는다

`DATA_PROVENANCE_RUNTIME_ADOPTION_DECISION.md`는 EXPLICIT만 분석 대상으로 두고,
등록된 파생 규칙이 없으므로 모든 DERIVED를 분석에서 제외한다. 이번 구현은 그
경계를 **그대로 지킨다**:

- 가져온 값은 `DERIVED` + `derivedFrom: ["import:activity-file"]`로 표기
- 해당 토큰이 섞인 값은 규칙이 등록되어도 분석에서 제외(이중 차단)
- 따라서 가져온 일지는 **일지에서는 보이지만** 주간 통계·추이·훈련계획
  입력에는 들어가지 않는다. 화면에는 "가져옴" 배지를 붙여 출처를 숨기지 않는다.
- 승격을 원하면 D-6 결정이 필요하다. 코드가 조용히 열지 않는다.

## 5. 정직성 메모 — 계정 화면 티저 문구

기존 티저는 "가민 · WHOOP · 스트라바에 쌓인 기록, 곧 가져올 수 있어요"였다.
2절 근거를 보면 **자동 연동은 오너 결정과 외부 승인에 달려 있어 날짜를 약속할 수
없다**. 반면 파일 업로드는 지금 된다. 그래서 문구를 다음 기준으로 고친다:

- 지금 되는 것(파일 업로드)은 **된다고** 말하고 바로 쓰게 한다.
- 자동 연동은 "**준비 중 · 시점 미정**"으로 남기고, 되는 척하지 않는다.
- 읽기 전용 원칙은 유지 표기한다.
