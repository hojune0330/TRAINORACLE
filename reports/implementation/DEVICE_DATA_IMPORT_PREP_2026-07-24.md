# 외부 기기 데이터 가져오기(가민·WHOOP·스트라바) 준비 기획

```yaml
source_model: FABLE
work_id: FABLE-DEVICE-IMPORT-PREP-2026-07-24
owner_directive: "가민 훕 같은 쌓인 데이터를 가져오는 서비스도 구현할 준비하고
  구현중임을 알리자. 특히 athletedata.health 이걸 제대로 차용하면 좋을 듯"
status: SUPERSEDED_IN_PART (2026-07-25)
superseded_by:
  - reports/implementation/DEVICE_IMPORT_FEASIBILITY_2026-07-25.md
  - reports/implementation/DEVICE_IMPORT_FILE_PATH_2026-07-25.md
note: |
  작성 시점(2026-07-24) 상태는 PREP_ONLY(준비 중 안내까지)였다.
  2026-07-25에 IMP-2(TCX/GPX 파일 업로드)와 IMP-4 일부(출처 배지·중복
  감지)가 실제로 출하되었으므로 이 문서의 status와 §2 난이도·§5 순위는
  더 이상 현재 상태가 아니다. 갱신된 사실은 위 두 문서를 볼 것.
```

## 1. 벤치마크: athletedata.health 분석 (2026-07-24 크롤링)

차용할 핵심 (그들이 잘한 것):
- **"Connect once" OAuth 스택 연결** — Garmin/Strava/WHOOP/Oura 등 22개 앱,
  연결 2분, 이후 자동 수집. 수동 입력·스크린샷 없음.
- **읽기 전용(read-only) 접근** 명시 + "데이터 판매·AI 학습 사용 안 함" 명시
  — 신뢰 카피의 표준. 우리 안내 문구에 그대로 반영.
- **근거 기반 처방 라이브러리** (Daniels VDOT, Seiler 80/20 등 방법론 인용)
  — 우리 훈련 라이브러리 기획(PR #115)과 방향 일치. 검증 사다리 원칙 유지.

차용하지 않을 것 (우리 원칙과 충돌):
- 선제 메시징("texts you first") — 우리는 streak_pressure 금지 원칙.
- 자동 플랜 재작성 — 우리는 자동 강도 상승 금지, 하향 조정만 허용.
- HRV 딥 감지 등 회복 판정 — 의료성 판단 금지 경계에 저촉 소지, 도입 시
  별도 오너 결정 필요.

## 2. 연동 전략 (우선순위)

| 순위 | 소스 | 방식 | 난이도 |
|---|---|---|---|
| 1 | **Strava** | OAuth2 + Webhook. 개인 개발자 무료, 러너 커버리지 최대. 가민→스트라바 자동 중계가 흔해 실질적으로 가민 데이터도 상당 부분 커버 | 낮음 |
| 2 | **Garmin** | 공식 Health/Activity API는 기업 승인 필요. 1차로는 **Garmin Connect 내보내기 파일(FIT/TCX/GPX) 업로드** 지원 | 중간 |
| 3 | **WHOOP** | 공식 OAuth API 공개(회복·수면·스트레인). 저녁 일지(수면/안정시HR)와 자연 매핑 | 중간 |
| 4 | Apple Health / Oura | 후속 | 높음 |

## 3. 데이터 매핑 원칙 (기존 안전 구조 유지)

- 가져온 활동 → `post-session` 일지 초안 (거리·시간·평균 페이스 자동,
  RPE·메모는 **사용자 직접 입력** 유지 — 감각 데이터는 대체 불가)
- 가져온 수면/회복 → `evening` 일지 초안 (수면시간·안정시HR 자동)
- **fieldProvenance에 `imported:<source>` 마킹** — 실측/자동/수기 구분 유지.
  분석·추이 화면에서 출처 배지 표시.
- 가져오기는 항상 **초안 → 사용자 확인 → 저장** 2단계. 무단 자동 저장 없음.
- 계정 연동 필수 (동기화 인프라 위에 얹음) — 이번 PR의 "준비 중" 안내가
  계정 가입 유도와 자연 연결되는 이유.

## 4. 이번 PR에 포함된 것

- 계정 화면에 "데이터 가져오기 — 준비 중" 티저 섹션 (GARMIN·WHOOP·STRAVA,
  읽기 전용 명시). 과장 금지: "곧 가져올 수 있어요" 수준, 날짜 약속 없음.
- 홈에 데이터 안전 상시 안내(DataSafetyNotice): "일지는 이 기기에만 있음 →
  계정 연동으로 지키기". 영구 닫기 없음(소유자 지시), 협박형 카피 금지.

## 5. 후속 PR 로드맵

> 2026-07-25 갱신: 아래 순위는 작성 시점 판단이다. 실제로는 **IMP-2가 먼저
> 출하**되었다. IMP-1(Strava OAuth)을 1순위로 둔 판단이 틀렸기 때문이다 —
> 2026년 Strava API는 개발자 구독 + 인증 앱 10명 한도 + 중개 서비스 금지
> 조항이 있어 오너 계정 결정 없이는 착수할 수 없다. 근거:
> `reports/implementation/DEVICE_IMPORT_FEASIBILITY_2026-07-25.md`

1. ~~IMP-1: Strava OAuth 연결 + 활동 목록 → post-session 초안 흐름~~
   → **BLOCKED (오너 결정 대기: 구독·10명 한도·중개 금지 조항)**
2. ~~IMP-2: FIT/TCX 파일 업로드 파서 (가민 수동 경로)~~
   → **SHIPPED 2026-07-25** (TCX/GPX. FIT는 바이너리라 미포함 — 아래 참고)
3. IMP-3: WHOOP 수면/회복 → evening 초안
   → **BLOCKED (오너 결정 대기: WHOOP 기기 멤버십 필요)**
4. ~~IMP-4: 출처 배지·중복 감지~~
   → **부분 SHIPPED 2026-07-25** (배지·중복 표시 완료. 자동 병합 UI는 미구현
   — 자동 병합은 사용자 확인 없는 데이터 변경이라 원칙상 보류)

### 5.1 FIT 미지원 결정 (2026-07-25)

§5의 원 계획은 "FIT/TCX"였으나 **TCX/GPX만** 구현했다. FIT는 바이너리
프로토콜이라 외부 파서 의존성이 필요하고, 정적 SPA에 파서를 넣으면 번들이
커지는데 비해 실익이 적다 — Garmin Connect는 활동별로 TCX·GPX 내보내기를
함께 제공하므로 사용자가 잃는 것이 없다. FIT 지원은 실사용에서 요구가
확인되면 다시 검토한다.
