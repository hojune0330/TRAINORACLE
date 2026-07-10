# ATHLETETIME_INTEGRATION_REVIEW.md

```yaml
document_metadata:
  doc_id: trainoracle-athletetime-integration-review
  title: 애슬리트타임(자사 서비스) 검토 및 연동 재설계
  version: 0.1
  date: 2026-07-10
  status: REVIEW_COMPLETE_DECISION_PENDING
  owner: COACH_HOJUNE (총책임자 작성)
  reviewed_repo: hojune0330/athletetime @ 6d156cd (main, 2026-07-09 push)
  supersedes_sections:
    - LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md §4 (애슬리트타임 연동 3경로) — 전면 갱신
  affects:
    - specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md — 전제 변경(외부 제3자 → 자사 1st-party)
```

---

## 0. 결정적 사실 (전제 뒤집힘)

이전 계획(§4)은 애슬리트타임을 **외부 제3자 서비스**로 가정하고 "제휴 협의 필요(경로 C)"라고 판단했다.
검토 결과: **애슬리트타임은 동일 소유자(hojune0330)의 자사 서비스**이며, 이미 프로덕션 가동 중이다.

| 확인 항목 | 결과 (2026-07-10 실측) |
|---|---|
| 프론트엔드 | ✅ 라이브 — https://athlete-time.netlify.app (HTTP 200, Netlify) |
| 백엔드 | ✅ 라이브 — https://athletetime-backend.onrender.com (Render, `/health` → healthy v4.0.0, DB connected) |
| 스택 | React 19 + Vite + TS / Express + **PostgreSQL** + WebSocket |
| 회원 시스템 | ✅ **완성되어 가동 중** — 이메일 가입·인증·JWT(access 7d / refresh 30d)·CSRF·비밀번호 재설정 |
| 기록 데이터 | ✅ KAAF 크롤링 대회 결과 **2015–2026년** (`data/results/*.json`), 레거시 .xls 2005–2014 확장 진행 중 |
| 공개 기록 API | ✅ 라이브 동작 확인 (아래 §2) |
| 소셜 로그인(카카오 등) | ❌ 아직 없음 (이메일 가입만) |

→ **"제휴 협의" 단계가 통째로 사라진다.** 연동은 사업 문제가 아니라 순수 기술 작업이 됐다.

---

## 1. 애슬리트타임 회원 시스템 검토

### 1.1 구조 (backend/auth/routes.js, 1,300줄)

- 엔드포인트: `send-verification` → `verify-code` → `register` → `login` → `refresh` / `me` / `profile` / 비밀번호 재설정 일체
- 사용자 스키마: `email, password_hash, nickname, specialty(주종목), region, profile_image_url, instagram, bio, email_verified, is_admin`
- JWT: 운영에서 `JWT_SECRET` 미설정 시 기동 실패(안전), jti 포함, access/refresh 분리 — **설계 건전**
- CSRF 미들웨어 + 공개 라우트 rate limit 존재

### 1.2 TRAINORACLE 관점 평가

- ✅ `specialty`(주종목)·`region` 필드가 이미 있어 육상 선수 프로필로 바로 쓸 수 있다.
- ✅ 이 계정을 TRAINORACLE의 로그인으로 **재사용 가능** — 별도 회원 시스템을 만들 이유가 약해짐.
- ⚠️ CORS 허용 목록에 TRAINORACLE 도메인 없음 (`athlete-time.netlify.app`, `community.athletetime.com`, localhost만) → 연동 시 **1줄 추가 필요** (애슬리트타임 repo 작업).
- ⚠️ 생년/연령 필드 없음 → 14세 미만 보호자 동의 요건은 여전히 미해결 (양쪽 공통 과제).
- ⚠️ 간편가입(카카오)도 아직 없음 → 도입한다면 **애슬리트타임 쪽에 한 번만** 구현하고 TRAINORACLE은 그 계정을 쓰는 게 맞다 (중복 구현 방지).

---

## 2. 기록(PB/SB) API 검토 — 이미 존재하고, 살아있다

`card-studio/routes/publicRoutes.js` 공개 API를 라이브로 실측:

```
GET /api/card-studio/analytics/records/search?q=...      → 선수 검색 (athleteKey, name, team, years, events)
GET /api/card-studio/analytics/athletes/:athleteKey      → 선수 상세: 종목별 best(=PB), recordTrail, records
GET /api/card-studio/analytics/season-records            → 시즌 기록(SB 계열)
```

실측 예: `records/search?q=100m` → 선수 목록 정상 반환. `athletes/9953a6e33d56c587` → 종목 15개, 종목별 `best` 레코드(대회명·날짜·장소 포함) 반환.

### EXTERNAL_RECORD_INTEGRATION_SPEC 매핑 적합성

| 스펙 요구 필드 | 애슬리트타임 API 대응 | 판정 |
|---|---|---|
| `eventCode` | `eventKey` (예: high-jump-combined) | ✅ 매핑 테이블 1개면 됨 |
| `recordKind: PB_OR_SB` | 종목별 `best` = PB, season-records = SB | ✅ |
| `recordValue/Unit` | `record` 문자열 (파싱 필요) | ⚠️ 구조화 변환 계층 필요 |
| `recordDate/competitionName/placeName` | `date/competitionName/venue` | ✅ |
| `sourceRecordId` | 레코드 `id` 존재 | ✅ |
| `freshnessState` | 없음 → `lookupTimestamp` 기준 자체 계산 | ✅ 소비 측 처리 |

→ 스펙의 인바운드 페이로드를 **거의 그대로 충족**한다. 남는 작업은 eventKey↔eventCode 매핑 + record 문자열 파서뿐.

### 스펙 전제 변경 필요

`EXTERNAL_RECORD_INTEGRATION_SPEC.md`는 외부 제3자 가정으로 작성됨(DRAFT_FOR_REVIEW). 전제는 바뀌지만 **데이터 경계 원칙은 그대로 유지**한다:
- 일방향 인바운드(PB/SB만), 훈련일지·통증·메모는 절대 애슬리트타임으로 나가지 않음
- `can_affect_safety_disposition: false` — 기록 데이터는 안전 판정 권한 없음
- 동의·감사 기록 유지 (자사여도 서비스 간 데이터 이동은 동의 대상)

---

## 3. 아키텍처 재설계 — 백엔드 결정 변경 제안

이전 계획: TRAINORACLE 전용 Cloudflare Workers+D1 신설.
새 사실: **이미 가동 중인 Express+PostgreSQL 백엔드(Render)가 있다.**

### 선택지 비교

| | A안: 애슬리트타임 백엔드 확장 | B안: 별도 Cloudflare Workers+D1 |
|---|---|---|
| 계정 | 같은 DB의 users 그대로 | AthleteTime JWT 검증만 차용 |
| 운영 부담 | 서버 1개, DB 1개 (최소) | 서버 2개, DB 2개 |
| 데이터 결합 | 훈련일지가 커뮤니티 DB에 동거 ⚠️ | 완전 분리 ✅ |
| 장애 전파 | 커뮤니티 장애=일지 장애 | 독립 |
| Render 무료 티어 | 콜드스타트 있음 (실측은 빨랐음) | CF는 콜드스타트 없음 |
| 추가 비용 | 0 | 0 (무료 티어) |
| 필요 사용자 액션 | 없음 (기존 배포 파이프라인) | Cloudflare 토큰 1회 |

### 총책임자 권장: **하이브리드 (A안 우선, 경계 유지)**

1. **계정(SSO)**: 애슬리트타임 users를 유일한 계정으로. TRAINORACLE에 "애슬리트타임 계정으로 로그인" 구현. 카카오 간편가입은 추후 애슬리트타임 쪽에 1회 구현 → 양쪽 자동 혜택.
2. **훈련일지 저장**: 애슬리트타임 백엔드에 `trainoracle_*` 전용 테이블 + `/api/trainoracle/*` 라우트로 **네임스페이스 격리** 추가. (테이블 분리로 데이터 경계 유지, 커뮤니티 코드와 무관)
3. **PB/SB**: 기존 공개 analytics API 소비 (읽기 전용, 스펙 원칙 유지).
4. 트래픽·민감도가 커지면 그때 B안(분리)으로 이전 — 스키마를 이식 가능하게 설계.

이 안이면 **Cloudflare 토큰·카카오 키가 당장 필요 없어진다** (기존 §6.1, §6.2 액션 보류).

---

## 4. 필요한 작업 목록 (승인 시 착수 순서)

### 애슬리트타임 repo 쪽 (동일 소유자, 별도 PR)

| # | 작업 | 규모 |
|---|---|---|
| AT-1 | CORS allowlist에 TRAINORACLE 도메인 추가 | 1줄 |
| AT-2 | `/api/trainoracle/journal` 등 전용 라우트 + `trainoracle_*` 테이블 마이그레이션 | 중 |
| AT-3 | (선택) 카카오 간편가입 — 양쪽 공용 | 중 |
| AT-4 | (선택) 생년 필드 + 14세 미만 동의 절차 | 중 |

### TRAINORACLE repo 쪽 (본 저장소)

| # | 작업 | 규모 |
|---|---|---|
| TO-1 | PWA + 로컬 저장 (L1·L2 — 변경 없음, 로그인 없이도 동작해야 하므로 여전히 선행) | 중 |
| TO-2 | 로그인 화면 + AthleteTime JWT 클라이언트 (`/api/auth/login`, `/me`, refresh) | 중 |
| TO-3 | PB/SB 조회 위젯 (records/search → athletes/:key), eventKey 매핑 + record 파서 | 중 |
| TO-4 | 로컬 데이터 → 서버 승격(가입 시 업로드) | 중 |
| TO-5 | EXTERNAL_RECORD_INTEGRATION_SPEC 전제 개정 (1st-party화) — 차기 수용 라운드에 포함 | 문서 |

### 유지되는 원칙 (모든 단계 불변)

- 훈련일지·통증·안전 데이터는 TRAINORACLE 네임스페이스 밖으로 나가지 않음
- PB/SB는 표시·맥락용, 안전 판정 권한 없음
- 매 변경 커밋→PR→링크 공유, 런타임 증거 없이는 완료 처리 없음

---

## 5. 검토 중 발견한 애슬리트타임 참고 사항 (연동과 별개)

1. `src/server.js`의 dev/sandbox CORS 전체 허용 분기(`isDevOrSandbox`) — 운영 환경변수 오설정 시 전 origin 허용 위험. 운영 배포 체크리스트에 확인 항목 권장.
2. `data/identity/athlete-map.json` B안(타기관 person_no 미저장) 원칙 확인 — TRAINORACLE 연동에서도 동일 원칙 준수 예정.
3. 공개 API에 rate limiter 적용 확인(publicLimiter/searchLimiter) — TRAINORACLE 소비 시 캐싱으로 호출 최소화 필요.

---

## 6. 승인 요청 (플레인 요약)

- **Q1. 계정을 애슬리트타임으로 통일**할까요? (TRAINORACLE 자체 회원가입 안 만들고 "애슬리트타임 계정으로 로그인"만 제공. 카카오 간편가입은 나중에 애슬리트타임 쪽에 한 번만 추가)
- **Q2. 훈련일지 저장도 애슬리트타임 백엔드에 전용 공간(별도 테이블)으로** 넣을까요? (서버 하나로 운영 단순화 — 커지면 분리 이전)
- 두 가지 승인되면: Cloudflare 토큰·카카오 키 **당장 불필요** → 사용자 액션 없이 TO-1(PWA+로컬 저장)부터 즉시 착수, 이후 AT-1/AT-2는 애슬리트타임 repo에 별도 PR로 진행.
