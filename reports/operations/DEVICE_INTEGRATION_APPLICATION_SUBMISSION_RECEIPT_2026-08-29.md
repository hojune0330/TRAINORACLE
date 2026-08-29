# TrainOracle Garmin·COROS 공식 연동 신청 영수증

```yaml
doc_id: TRAINORACLE-DEVICE-INTEGRATION-APPLICATION-SUBMISSION-RECEIPT-2026-08-29
verified_at_kst: 2026-08-29
app_main_commit: c3abeb7c0314fb381b9fc1e7de87c2e93b94d505
readiness_pr: 273
github_actions_run: 33233919904
status: SUBMITTED_PENDING_PROVIDER_REVIEW
garmin_application: SUBMITTED
coros_application: SUBMITTED
provider_credentials_received: false
public_user_linking: false
canonical_promotion_claimed: false
```

## 1. 실제 제출 결과

2026년 8월 29일 공식 Garmin 개발자 문의 양식과 COROS API Application 양식을
실제 브라우저에서 작성하고 제출했다. 신청 주체는 `Infinite Opportunity`, 서비스는
`TrainOracle`, 대표·개인정보 보호책임자는 장호준으로 입력했다. 연락 이메일은 공개
도움말에 기재된 운영자 주소를 사용했으며 이 영수증에는 반복 기재하지 않는다.

| 제공자 | 결과 | 실제 화면 증거 | 접수 번호 |
|---|---|---|---|
| Garmin | SUBMITTED | `Got it! Your information has been sent successfully.` 표시 | 양식이 별도 번호를 제공하지 않음 |
| COROS | SUBMITTED | `Submitted` 및 월별 신청 대기열 검토 안내 표시 | 양식이 별도 번호를 제공하지 않음 |

Garmin 양식의 invisible reCAPTCHA는 별도 이미지 문제를 표시하지 않았고 성공 화면으로
전환됐다. 동일 신청을 반복 제출하지 않았다. COROS 양식의 첫 제출 시도는 활성 사용자
수 선택값이 실제로 저장되지 않아 필수 항목 검증에서 중단됐고 접수되지 않았다.
`0-150`을 다시 명시적으로 선택한 뒤 한 번 제출해 `Submitted` 화면을 확인했다.

## 2. 요청한 연동 범위

### Garmin

- 사용자가 승인한 활동 요약과 공식 활동 파일을 확인 대기함으로 수신
- 사용자가 검토·확정한 뒤에만 일지·통계·분석·훈련 계획 근거로 사용
- 사용자가 명시적으로 선택한 구조화 훈련 또는 훈련 계획만 기기로 전송
- 원문 메모, 전체 GPS 경로, 제공자 토큰과 전체 payload를 일반 로그에 저장하지 않음

### COROS

| 항목 | 제출값 |
|---|---|
| 활성 사용자 | `0-150` |
| 주 사용 지역 | South Korea |
| 활동 연동 | COROS에서 TrainOracle로 단방향 수신 |
| 훈련 연동 | TrainOracle에서 COROS로 구조화 훈련·계획 전송 |
| OAuth callback domain | `https://texspxlpjungyarkvtkc.supabase.co` |
| workout push endpoint | `/functions/v1/coros-workout-push` |
| status endpoint | `/functions/v1/device-integration-status` |
| 예상 연동일 | 2026-11-01, 계획값이며 승인·보안 검증 전 공개하지 않음 |
| 약관 | COROS Application Terms와 API Agreement에 동의 |

GPX route, Daily Health, Bluetooth, ANT+ 및 일반 양방향 동기화는 이번 신청 범위에
포함하지 않았다.

## 3. COROS 제출 로고

TrainOracle 디자인 스킬의 정본 색상과 기존 공개 앱의 오라클 심볼 형상을 함께
사용했다. 형상은 새로 발명하거나 AI로 다시 그리지 않았다.

- 전경: Deep Teal `#0D5F5A`
- 배경: warm off-white `#FAFAF7`
- 글자 없음: 102px에서도 식별 가능한 정사각형 심볼 유지
- 그라디언트, 그림자, 장식, 임의 색상 추가 없음

| 파일 | 규격 | SHA-256 |
|---|---:|---|
| `trainoracle-coros-logo-102x102.png` | 102×102 | `2b17578339830ca6fe620ff9c8773fd571837c7541994caab5f747cc3d38265a` |
| `trainoracle-coros-logo-120x120.png` | 120×120 | `242bf5f80d7d4eae48659fd80aaa66b3be465ebbcda17a9e00260b08b2e5d85d` |
| `trainoracle-coros-logo-144x144.png` | 144×144 | `1b201fa1687adb3a8093f9c9b0c5896129ae10c01ee3348b7de06ddd1c8080cc` |
| `trainoracle-coros-logo-300x300.png` | 300×300 | `9d0d7b661b54156c18da47612c01faa901ecfe770217c6a08d76263a367901a2` |

파일은 `reports/operations/provider-assets/coros/`에 보존한다.

## 4. 제출 시점의 공개·서버 상태

| 확인 항목 | 결과 |
|---|---|
| 도움말 공개 주소 | 200, Garmin·COROS 연동 신청 준비 상태와 문의 경로 표시 |
| 기기 연동 개인정보 안내 | 200, 데이터 범위·사용 목적·연결 해제 경계 표시 |
| 연동 상태 endpoint | 200, `APPLICATION_PENDING` |
| 서버 operational | `true` |
| 공개 계정 연결 | `false` |
| 데이터 수신 | `FAIL_CLOSED` |
| Garmin 상태 | `APPLICATION_PENDING` |
| COROS 상태 | `APPLICATION_PENDING` |
| 제공자 토큰·API key | 발급·저장되지 않음 |

이번 신청은 제공자 승인을 요청한 외부 절차이며 실제 사용자 연동 공개, 정본 승격,
의료 판단 권한 또는 자동 훈련 처방 승인을 뜻하지 않는다.

## 5. 다음 관문

1. 운영 이메일로 도착하는 Garmin·COROS 답변을 공식 도메인과 신청 맥락으로 확인한다.
2. 발급되는 client ID·secret·token은 브라우저 대화, Git, 보고서, 일반 로그에 넣지 않는다.
3. 승인 뒤에도 비밀값 주입, OAuth state 검증, webhook 인증, 계정별 데이터 격리,
   연결 해제·24시간 삭제 절차와 실패 시 fail-closed를 실제 실행으로 검증한다.
4. 활동은 확인 대기함을 거쳐 사용자가 승인한 뒤에만 일지와 분석에 반영한다.
5. 모든 런타임 증거와 법률·개인정보 최종 점검이 끝나기 전까지
   `public_user_linking: false`를 유지한다.

[DRAFT_COMPLETE]
