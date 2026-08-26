# TrainOracle 이메일·Google 계정 실제 검증 영수증

```yaml
doc_id: TRAINORACLE-ACCOUNT-EMAIL-GOOGLE-RUNTIME-RECEIPT-2026-08-26
verified_at_kst: 2026-08-26
app_commit: bac0c82aca0f5f7a20df4f599468d0990ab9277b
app_pr: 248
environment: trainoracle-beta-staging
account_surface: OWNER_APPROVED_PUBLIC_BETA
sync_surface: CLOSED
sharing_surface: CLOSED
legal_clearance_claimed: false
```

## 1. 이번에 실제로 확인한 범위

공개 TrainOracle 앱과 Supabase 프로젝트를 사용해 다음 순서를 실제 화면에서 끝까지
실행했다. 시험에 사용한 소유자 이메일은 보고서에서 `h***@gmail.com`으로 가린다.
확인 링크, access token, refresh token, 사용자 UUID와 OAuth secret은 저장하거나
커밋하지 않았다.

1. 이메일 주소 입력 후 Supabase 확인 메일 수신
2. 메일의 확인 링크로 신규 계정 생성
3. 가입 마무리 화면에서 나이와 필수 약관 재확인
4. 서버 프로필과 법률 문서 버전 저장
5. 로그아웃 후 새 이메일 로그인 링크로 재로그인
6. 로그아웃 후 같은 Google 계정으로 로그인
7. Supabase에서 중복 사용자와 identity 연결 상태 재확인

## 2. 실행 결과

| 항목 | 결과 |
|---|---|
| 신규 이메일 가입 메일 | PASS, `Confirm your email address` 수신 |
| GitHub Pages 복귀 주소 | PASS, `/TRAINORACLE/` 하위 경로 유지 |
| 서버 계정 확정 | PASS, 가입 확인 완료 화면 표시 |
| 필수 법률 동의 저장 | PASS, 개인정보처리방침·이용약관 버전 모두 `2026-08-26` |
| 이메일 재로그인 | PASS, `Your sign-in link` 수신 후 기존 계정 복귀 |
| Google 로그인 | PASS, 같은 Google 이메일로 앱 복귀 |
| Google OAuth 게시 상태 | PASS, 외부 사용자용 `프로덕션 단계` |
| 중복 사용자 방지 | PASS, 해당 이메일의 Supabase 사용자 1명 |
| identity 연결 | PASS, 한 사용자에 `email`, `google` 2개 identity |
| 기기 데이터 자동 업로드 | 발생하지 않음 |
| 동기화 | 계속 닫힘 |
| 공유 | 계속 닫힘 |

메일 발송은 현재 Supabase 기본 SMTP와 기본 영문 템플릿을 사용한다. 운영 Dashboard에서
`Confirm sign up`과 `Magic link or OTP`의 제목·본문 편집이 비활성화되어 있음을 실제로
확인했다. 별도 SMTP 발송 계정을 연결하기 전에는 한글 브랜드 템플릿이 운영 메일에
적용됐다고 주장하지 않는다.

## 3. 실행 중 발견하고 처리한 문제

첫 서버 계정 확정 시 `SERVER_FEATURE_DISABLED_ACCOUNT`가 반환됐다. 앱은 이를 성공으로
오인하지 않고 가입 실패 화면을 표시했으며 동기화를 열지 않았다. 확인 중에는 저장소의
계정 공개 변수를 `false`로 되돌려 새 사용자의 진입점을 먼저 닫았다.

소유자 승인 뒤 서버 기능 제어표에서 `ACCOUNT`만 `true`로 변경하고 감사 이벤트를
남겼다. 재확인 결과는 다음과 같다.

| 서버 기능 | 최종값 |
|---|---|
| `ACCOUNT` | `true`, revision 6 |
| `SYNC` | `false` |
| `SHARING` | `false` |

그 뒤 가입 마무리, 이메일 재로그인, Google 로그인을 다시 실행해 모두 통과했다.
Google Cloud 브랜딩에는 공개 홈페이지·개인정보처리방침·이용약관을 연결했고,
기본 `email profile` 범위만 사용하는 외부 앱을 `프로덕션 단계`로 게시했다.

## 4. 공개 범위와 남은 관문

이번 영수증은 **계정 생성과 로그인만** 공개할 수 있다는 실제 증거다. 로그인만으로
로컬 일지·메모·훈련 계획을 서버에 올리지 않는다. Kakao와 휴대전화 로그인도 계속
숨긴다.

다음 항목은 아직 완료로 바꾸지 않는다.

- 서로 다른 실제 계정 두 개와 서로 다른 브라우저 두 개의 화면 격리
- 두 기기 동기화와 충돌 해결
- 계정 삭제 요청 뒤 30일 이내 실제 정리 작업 영수증
- Kakao, 휴대전화, AthleteTime SSO
- custom SMTP 연결과 한글 가입·로그인 메일 운영 수신 검증
- 법률 전문가의 최종 검토

따라서 `docs/ACCOUNT_PUBLIC_RELEASE_GATE.md`의 G8 전체는 계속 OPEN이고, 동기화와
공유는 별도 승인 전까지 닫힌다.

[DRAFT_COMPLETE]
