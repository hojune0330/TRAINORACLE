# PROGRAMMED_FILE_ANALYSIS_RELEASE_RUNBOOK_2026-09-19.md

```yaml
status: PREPARED_NOT_DEPLOYED
baseline_commit: 27cc6d5705a58f55eb3e07140a7f932d1118269c
production_migration_applied: false
server_deployed: false
public_feature_enabled: false
canonical_promotion_allowed: false
```

## 1. 공개 상태를 나누는 이유

코드를 올리는 것, 서버가 새 저장 형식을 읽는 것, 사용자가 새 분석을 이용하는 것은 다른 단계다.
기존 기록을 먼저 보호하도록 호환 서버를 배포한 뒤 TCX를 먼저 공개한다. CSV, JSON, GPX는 각각 검수 후 공개한다.
로컬 합성 시험 결과를 실제 계정 저장 또는 공개 배포의 증거로 사용하지 않는다.

**현재 main 푸시는 자동 앱 배포로 이어질 수 있으므로 서버보다 먼저 푸시하지 않는다.**
독립 실행에서 새 앱의 일지 요청은 형식별 기능이 꺼져 있어도 `supportedJournalVersions: [2, 3]`을 보냈다.
기준 커밋의 기존 서버는 이 필드를 알지 못해 status/list/read/history/save/delete/restore 요청을 모두
400으로 거절했다. 같은 V2 요청에서 이 필드가 없으면 정상 통과했다. 새 기능을 꺼 두는 것만으로
기존 계정 저장을 보호할 수는 없다. 호환 서버 선배포 증거 전에는 로컬 커밋까지만 허용한다.

## 2. 출시 전 확인

1. 현재 원격 main과 작업 기준을 다시 비교한다. 다른 작업자의 변경을 보존한다.
2. 독립 검수가 승인한 정확한 패치의 파일 목록과 SHA-256을 남긴다. 이후 코드 변경은 다시 검수한다.
3. 앱 타입 검사, UTC/KST 단위 검사, 서버 validator 재생성 검사, 계정 저장/복구 검사, 파일 분석 브라우저 검사를 실행한다.
4. `0038_file_analysis_write_control.sql` 번호가 원격 및 운영 이력과 충돌하지 않는지 확인한다. 다른 PR의 0038을 덮거나 건너뛰지 않는다.
5. 기존 운영 절차의 복구 가능성을 확인한다. 비밀번호, 서비스 키, 원문, 실제 운동 자료를 보고서에 넣지 않는다.

## 3. 서버 적용 순서

1. 검수된 마이그레이션을 운영 DB에 적용한다. `FILE_ANALYSIS_WRITE`의 초기 값은 false이며 기존 설정은 유지한다.
2. V2와 V3을 모두 읽는 `account-journal` 함수 및 동일 커밋의 공유 validator/원계획 조회 모듈을 배포한다.
3. V2 기존 일지 쓰기와 읽기, V3 읽기, 구형 클라이언트의 426 응답 후 초안 보존을 합성 시험 계정에서 확인한다.
   구형 소스 7/7 시험과 실제 공개 배포 번들의 426 보존·재시도·복구 2/2 시험은 로컬 합성 환경에서 완료했다.
   후자는 원본 번들을 수정하지 않고 실행했으며, 서비스워커는 차단했다. 운영 서버·실제 계정·서비스워커 갱신 검증은 별도로 남는다.
4. 현재 운영 설정 변경 절차로 `FILE_ANALYSIS_WRITE`를 켠다. actor, 변경 사유, revision과 감사 이벤트를 확인한다. 사용자 토큰으로 설정을 변경하지 않는다.
5. 아직 화면을 공개하지 않은 상태에서 합성 TCX 저장, 다른 브라우저 조회, 정정, 충돌, 백업 복원을 확인한다.

이 문서는 위 명령을 실행했다는 기록이 아니다. 운영 연결 권한과 변경 창을 확인한 실행자가 실제 결과를 추가해야 한다.

## 4. 화면 공개 설정

현재 `.github/workflows/ci.yml`의 `Build hosted app`에는 아래 8개 변수가 없다. 저장소 변수만 추가해도 빌드에 전달되지 않는다.
에이전트의 워크플로 수정 금지 규칙을 우회하지 않는다. 워크플로 수정 권한을 가진 실행자가 기존 env 블록에 다음 매핑을 추가해야 한다.

```yaml
VITE_FEATURE_FILE_ANALYSIS_TCX: ${{ vars.TRAINORACLE_FEATURE_FILE_ANALYSIS_TCX }}
VITE_KILL_FILE_ANALYSIS_TCX: ${{ vars.TRAINORACLE_KILL_FILE_ANALYSIS_TCX }}
VITE_FEATURE_FILE_ANALYSIS_CSV: ${{ vars.TRAINORACLE_FEATURE_FILE_ANALYSIS_CSV }}
VITE_KILL_FILE_ANALYSIS_CSV: ${{ vars.TRAINORACLE_KILL_FILE_ANALYSIS_CSV }}
VITE_FEATURE_FILE_ANALYSIS_JSON: ${{ vars.TRAINORACLE_FEATURE_FILE_ANALYSIS_JSON }}
VITE_KILL_FILE_ANALYSIS_JSON: ${{ vars.TRAINORACLE_KILL_FILE_ANALYSIS_JSON }}
VITE_FEATURE_FILE_ANALYSIS_GPX: ${{ vars.TRAINORACLE_FEATURE_FILE_ANALYSIS_GPX }}
VITE_KILL_FILE_ANALYSIS_GPX: ${{ vars.TRAINORACLE_KILL_FILE_ANALYSIS_GPX }}
```

R1은 TCX feature=true, kill=false만 적용한다. 나머지는 feature=false로 둔다.
R2에서는 CSV, JSON, GPX를 각각 검수 후 같은 방식으로 켠다. 모든 형식은 기존 ACCOUNT와 ACCOUNT_JOURNAL 기능 및 서버 저장 허용이 필요하다.
기능 기본값을 코드에서 true로 바꾸거나 다른 기능 플래그를 빌려 이 절차를 우회하지 않는다.

## 5. 공개 화면 확인

- 배포 SHA와 실제 로드한 JS 자산을 기록한다. 이전 서비스워커 캐시와 새 브라우저를 구분한다.
- 시험 계정에서 TCX 가져오기, 계정 저장 완료, 새로고침, 다른 브라우저 조회, 분석을 확인한다.
- 실제 저장된 원계획과 구간 대응을 확인하고 저장한 뒤 재열기 한다. 원계획이 없으면 수치 비교가 보류되어야 한다.
- 다음 계획은 기존 입력, 안전 확인, 후보 선택, 계정 저장, 재열기 절차를 거친다. 가져오기만으로 계획이나 운동 완료 상태를 바꾸지 않는다.
- 320/375px, 200% 글자 확대, 키보드, 줄인 모션에서 확인한다. 실패 메시지에 파일명/원문/토큰이 없어야 한다.
- 공개한 형식마다 실제 저장/분석 결과를 따로 남긴다. TCX 통과로 다른 형식까지 통과 처리하지 않는다.

## 6. 중단·복구

분석 표시 결함이면 해당 형식 kill=true로 다시 빌드한다. 저장 호환성 결함이면 서버 `FILE_ANALYSIS_WRITE`도 끈다.
기존 V2/V3 읽기와 일반 일지는 유지한다. 이미 V3 자료가 생긴 뒤 V2-only 서버로 되돌리지 않는다.
원자료 삭제, 초안 삭제, 비교 이력 제거, DB 스키마 강제 축소를 복구 방식으로 사용하지 않는다.

복원한 비교는 실제 소유 계정의 원계획과 구간을 다시 검증한다. 정정 전 내용과 다른 자료에는 옛 비교를 적용하지 않는다.
원래 내용 지문과 해석이 정확히 복원되면 기존 활성 비교를 다시 읽을 수 있으나, 사용자가 해제한 비교는 다시 활성화하지 않는다.
따라서 정정을 '비교의 영구 해제'라고 안내하지 않는다. 현재 원본과의 일치 여부와 해제 상태를 구분한다.

## 7. 인계 증거

실행 기록에는 커밋, validator 생성 검사 결과, 서버 함수 버전, 마이그레이션 적용 결과, 설정 revision,
배포 실행 링크, 공개 화면 결과, 남은 결함을 남긴다. 실제 사용자 건강 자료나 메모를 첨부하지 않는다.
이 체크리스트에서 미실행인 항목은 미실행으로 남기며, 로컬 PASS로 대체하지 않는다.

[DRAFT_COMPLETE]
