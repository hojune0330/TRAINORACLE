# TrainOracle 베타 기능 운영 기록

이 문서는 기능을 잠시 끄거나 다시 연 이유를 짧게 남기는 기록이다. 문제가 없는 날에는 쓰지 않는다.

## 기록 방법

| 날짜·시간 | 문제 | 닫은 기능 | 사용자에게 보인 영향 | 수정과 확인 | 다시 연 날짜·이유 | 결정자 |
|---|---|---|---|---|---|---|
| 예시 | 동기화 저장 실패 증가 | 동기화 | 로컬 일지는 계속 사용, 서버 동기화만 중단 | 실패 원인 수정 후 시험 계정에서 저장·복원 확인 | 확인 뒤 재개 | 서비스 운영자 |

## 기능별 기본 대응

| 문제 | 즉시 닫는 기능 | 계속 제공하는 기능 |
|---|---|---|
| 개인 메모 또는 다른 사용자 자료 노출 | 공유·동기화 | 로컬 일지 |
| 동기화 또는 서버 자료 손상 | 동기화 | 로컬 일지·파일 백업 |
| 잘못된 계획 제안 | 계획 제안 | 기존 활성 계획·일지 |
| 보호자 확인 우회 | 미성년자 동기화·공유 | 미성년자 로컬 일지 |
| 꾸미기 또는 통계 오류 | 해당 화면 | 일지 작성·조회 |

## 서버 기능 스위치

서버 기능은 `service_feature_controls`에서 각각 따로 닫는다. 새 기능은 모두 꺼진 상태로 시작한다.

| 서버 키 | 닫히는 범위 | GitHub 저장소 변수 | 앱 빌드 변수 |
|---|---|---|---|
| `ACCOUNT` | 로그인 계정의 서버 접근 | `TRAINORACLE_KILL_ACCOUNT=true` | `VITE_KILL_ACCOUNT=true` |
| `SYNC` | 일지·개인 메모 동기화 | `TRAINORACLE_KILL_SYNC=true` | `VITE_KILL_SYNC=true` |
| `SHARING` | 초대·연결·공유 조회 | `TRAINORACLE_KILL_SHARING=true` | `VITE_KILL_SHARING=true` |
| `PLAN_PROPOSALS` | 계획 제안 생성·수정 | `TRAINORACLE_KILL_PLAN_PROPOSALS=true` | `VITE_KILL_PLAN_PROPOSALS=true` |
| `PRODUCT_ANALYTICS` | 선택형 제품 분석 저장 | `TRAINORACLE_KILL_PRODUCT_ANALYTICS=true` | `VITE_KILL_PRODUCT_ANALYTICS=true` |
| `FEEDBACK_BOARD` | 의견 게시글·답변 읽기/쓰기 | `TRAINORACLE_KILL_FEEDBACK_BOARD=true` | `VITE_KILL_FEEDBACK_BOARD=true` |

사고 대응 순서는 다음과 같다.

1. 서버 스위치를 먼저 끄고 이유를 남긴다.
2. 필요하면 같은 앱 스위치도 끈 배포를 진행한다.
3. 로컬 일지 작성과 파일 백업이 계속 되는지 확인한다.
4. 수정 뒤 시험 계정으로 권한·저장·삭제를 확인한다.
5. 서비스 운영자가 확인한 기능만 서버, 앱 순서로 다시 연다.

서버 스위치 변경은 서비스 역할만 실행할 수 있고, 변경 전후 상태와 이유는 `service_feature_control_events`에 남는다. 데이터베이스 변경이 적용되기 전에는 이 표를 실행 절차로 사용하지 않는다.

### 서버 스위치 실행 예시

아래 값은 로컬 터미널 환경 변수로만 넣는다. 서비스 역할 키를 명령 기록, PR, 앱 빌드 변수에 남기지 않는다.

```bash
curl --fail-with-body --silent --show-error \
  --request POST \
  --header "apikey: $TRAINORACLE_SUPABASE_SERVICE_ROLE_KEY" \
  --header "Authorization: Bearer $TRAINORACLE_SUPABASE_SERVICE_ROLE_KEY" \
  --header "Content-Type: application/json" \
  --data '{"feature_key_input":"SYNC","enabled_input":false,"change_reason_input":"INCIDENT_SYNC_WRITE_FAILURE"}' \
  "$TRAINORACLE_SUPABASE_URL/rest/v1/rpc/set_service_feature_state"
```

이유는 공백을 제외하고 8~240자로 적는다. 닫은 뒤 다음 두 가지를 확인한다.

```bash
curl --fail-with-body --silent --show-error \
  --header "apikey: $TRAINORACLE_SUPABASE_SERVICE_ROLE_KEY" \
  --header "Authorization: Bearer $TRAINORACLE_SUPABASE_SERVICE_ROLE_KEY" \
  "$TRAINORACLE_SUPABASE_URL/rest/v1/rpc/get_service_feature_states"

curl --fail-with-body --silent --show-error \
  --header "apikey: $TRAINORACLE_SUPABASE_SERVICE_ROLE_KEY" \
  --header "Authorization: Bearer $TRAINORACLE_SUPABASE_SERVICE_ROLE_KEY" \
  "$TRAINORACLE_SUPABASE_URL/rest/v1/service_feature_control_events?feature_key=eq.SYNC&order=revision.desc&limit=1"
```

첫 응답에서 해당 기능이 `enabled=false`인지, 두 번째 응답에서 이유·이전 상태·새 상태·revision이 남았는지 확인한다. 다시 열 때는 수정 시험을 마친 뒤 서버 RPC를 `enabled_input=true`로 실행하고, 마지막으로 GitHub의 `TRAINORACLE_KILL_*`를 `false`로 바꿔 재배포한다.

## 배포 복구

GitHub Actions의 `TrainOracle Pages rollback`은 과거 `gh-pages` 커밋, 이유, 사고 이슈 번호를 입력받아 새 커밋으로 복구한다. 강제 푸시는 쓰지 않으며 이전 이력을 지우지 않는다. 실제 장애가 아닐 때는 실행하지 않는다.

## 운영 기록

아직 기록 없음.
