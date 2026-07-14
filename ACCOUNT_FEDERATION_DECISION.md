# ACCOUNT_FEDERATION_DECISION.md

```yaml
document_metadata:
  doc_id: trainoracle-account-federation-decision
  title: 계정 구조 확정 — 분리 운영 + 계열사 통합회원 (원클릭 연동)
  version: 1.0
  date: 2026-07-10
  status: DECIDED
  decided_by: 승인권자(사용자)
  decision_verbatim: >
    "통일하기보단 분리하되 연동이 바로 되는 느낌이 좋겠어.
    그냥 동의 한번만 누르면 한방에 바로 간편가입이나 회원 연동이 되는거지.
    두군데를 분리해운영하되 통합 계열사 회원은 맞는 느낌."
  supersedes:
    - ATHLETETIME_INTEGRATION_REVIEW.md §6 Q1 (계정 통일안) — 기각, 본 결정으로 대체
  keeps:
    - ATHLETETIME_INTEGRATION_REVIEW.md §2 (PB/SB API 소비) — 유지
    - 데이터 경계 원칙 전체 (일지·통증·안전 데이터 비유출) — 유지
```

---

> 상태 정렬 (2026-07-13): 제품 결정은 AthleteTime SSO 단일 계정이다. 단 AthleteTime OAuth endpoint, API, 약관, redirect, client registration은 검증·구현되지 않았으며 현재 기능이 아니다. TrainOracle 저장소·안전·코칭 권한은 별도다.

---

## 1. 확정된 모델 — "AthleteTime으로 계속하기" (계열사 SSO)

카카오가 제3자 앱에 로그인 제공자 역할을 하듯, **애슬리트타임이 계열사 서비스(TRAINORACLE)의
로그인 제공자**가 된다. 두 서비스는 각자의 DB·서버·회원 테이블을 가지되, 신원의 뿌리는 하나다.

```
[애슬리트타임]                         [TRAINORACLE]
 users (원본 계정)                      to_users (자체 회원 테이블)
 email, nickname, specialty, region      atUserId(외래 신원), displayName,
 password_hash ← 여기만 보관             specialty/region 복사본, 훈련일지 일체
        │                                      ▲
        │  ① "AthleteTime으로 계속하기" 클릭      │
        │  ② AthleteTime 로그인(이미 로그인 상태면 생략)
        │  ③ 동의 화면 1회: "닉네임·주종목·지역을   │
        │     TRAINORACLE에 제공합니다" [동의]     │
        └──④ 서명된 신원 토큰 발급 ──────────────┘
            ⑤ TRAINORACLE이 토큰 검증 → to_users 자동 생성(= 간편가입 완료)
```

- 사용자 체감: **버튼 1번 + 동의 1번 = 가입 끝.** 비밀번호를 TRAINORACLE에 만들지 않는다.
- 기존 애슬리트타임 회원: 같은 흐름으로 즉시 "회원 연동" (신규 가입과 동일 UX).
- 애슬리트타임 계정이 없는 사람: 같은 화면에서 애슬리트타임 가입 → 곧바로 동의 → 연동.
  추후 애슬리트타임에 카카오 간편가입이 붙으면 **카카오 → 애슬리트타임 → TRAINORACLE**이 한 흐름이 된다.

## 2. 왜 이 구조인가 (통일안 대비)

| 관점 | 통일(단일 회원) | **확정: 분리+연합** |
|---|---|---|
| 브랜드 | TRAINORACLE이 애슬리트타임 부속처럼 보임 | 독립 서비스 + "계열사 계정" 신뢰 |
| 데이터 경계 | 일지가 커뮤니티 DB에 동거 | **물리적으로 다른 DB** — 경계 원칙과 완벽 정합 |
| 장애 격리 | 한쪽 장애 = 양쪽 마비 | 애슬리트타임이 죽어도 일지 열람/작성 가능(세션 유지 시) |
| 확장 | 서비스 늘수록 한 DB 비대화 | 세 번째 계열 서비스도 같은 SSO에 꽂으면 됨 |
| 탈퇴/동의 철회 | 얽혀서 복잡 | 서비스별 독립 처리 가능 |

## 3. 기술 계약 (구현 기준)

### 3.1 신원 토큰 (AthleteTime → TRAINORACLE)

- 방식: **OAuth 2.0 Authorization Code 흐름의 경량판** (자사 간이므로 필수 요소만)
  - `GET  {AT}/oauth/authorize?client_id=trainoracle&redirect_uri=...&state=...` → 로그인+동의 화면
  - `POST {AT}/api/oauth/token` (code 교환) → `id_token`(JWT, 별도 서명키) + 만료
- `id_token` claims: `sub`(AT user id), `nickname`, `specialty`, `region`, `aud: "trainoracle"`, `iss`, `exp`
  — **email·비밀번호 해시는 절대 포함하지 않는다.**
- TRAINORACLE 백엔드는 검증 후 자체 세션(JWT) 발급. 이후 애슬리트타임 호출 불필요(독립 동작).

### 3.2 동의 기록 (양쪽 모두)

- 애슬리트타임: `oauth_consents(user_id, client_id, scopes, granted_at, revoked_at)` — 철회 가능해야 함
- TRAINORACLE: `to_users.linked_at`, `consent_version` 보관
- EXTERNAL_RECORD_INTEGRATION_SPEC의 동의·감사 원칙이 계정 연동에도 동일 적용된다.

### 3.3 데이터 흐름 규칙 (불변)

| 데이터 | 방향 | 비고 |
|---|---|---|
| 신원(닉네임·주종목·지역) | AT → TO (동의 시 1회 + 갱신 조회) | 최소 제공 |
| PB/SB 기록 | AT → TO (읽기 전용 공개 API) | `can_affect_safety_disposition: false` |
| 훈련일지·통증·체크인·메모 | **어느 방향으로도 이동 없음** | TO 전용 DB에만 존재 |
| 14세 미만 | 연동 이전, **애슬리트타임 가입 단계에서 차단/보호자 동의** | 뿌리에서 1회 해결 |

### 3.4 TRAINORACLE 저장소(백엔드) — 분리 확정에 따른 재결정

일지 저장이 애슬리트타임 DB에 못 들어가므로 TRAINORACLE 자체 백엔드가 다시 필요하다.
→ **원안(Cloudflare Workers + D1) 부활** (`wrangler.jsonc` 준비 완료 상태).
→ 🔑 **Cloudflare API 토큰은 다시 필요해짐** (LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md §6.1 재활성).
→ 카카오 키는 계속 보류 (애슬리트타임 쪽 과제로 이관).

## 4. 실행 순서 (갱신)

| # | 작업 | repo | 선행조건 |
|---|---|---|---|
| F0 | PWA + 로컬 저장 — 비로그인 완전 동작 (게스트 모드가 곧 온보딩) | TRAINORACLE | 없음 → **즉시 착수** |
| F1 | AT: OAuth authorize/token 엔드포인트 + 동의 화면 + consents 테이블 | athletetime | 없음 |
| F2 | TO: Workers+D1 백엔드 (to_users, journal 테이블) | TRAINORACLE | 🔑 CF 토큰 |
| F3 | TO: "AthleteTime으로 계속하기" 버튼 + 콜백 + 로컬→서버 데이터 승격 | TRAINORACLE | F1, F2 |
| F4 | PB/SB 위젯 (공개 API 소비 + eventKey 매핑/파서) | TRAINORACLE | F3 (표시상 연동 후 자연스러움) |
| F5 | AT: 카카오 간편가입 (붙는 순간 TO도 자동 혜택) | athletetime | F1 |
| F6 | 스펙 개정: EXTERNAL_RECORD_INTEGRATION_SPEC 1st-party 전제 + 본 결정 반영 | TRAINORACLE | 차기 수용 라운드 |

## 5. 🔑 사용자 액션 (갱신판)

| 시점 | 액션 | 상태 |
|---|---|---|
| F2 전 | Cloudflare API 토큰 발급 → Deploy 패널 입력 (5분) | **재활성** — F0 진행 중 아무 때나 |
| F5 전 | 카카오 개발자 앱 키 | 보류 (애슬리트타임 작업 시) |
| 스토어 출시 전 | Apple $99/년, Google $25 | 대기 |
