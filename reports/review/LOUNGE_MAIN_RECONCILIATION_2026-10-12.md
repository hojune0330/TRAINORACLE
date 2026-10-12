# 라운지 PR의 최신 저장 구조 통합

## 범위

- 이전 후보: `b1ae86e7a7c03894ea8a00334b32efb05e09dbbe`.
- 저장 구조 기준: main `aba840b62e72d605c6f19263f852a92dd25d7ff3`.
- 기존 `to-local-journal.*` canonical 저장소, 원본 보존, 삭제/이관 epoch,
  손상 시 쓰기 차단과 UI를 그대로 유지한다.
- 이 PR에서 만들었던 `journal-device-storage` generation adapter와 전용
  단위/브라우저 시험은 이번 후보에서 제외했다. 소스와 당시 검증은 위 이전
  커밋에 보존한다. 이 작업은 실제 브라우저 저장값을 읽거나 지우거나 이관하지 않았다.
- 라운지의 좁은 identity RPC 전송 예외, 0065와 운영 적용 도구는 유지한다.
  기존 본류 UI/기록 기능을 예전 구현으로 되돌리지 않는다.

## 재현 후 최소 보완

main의 비밀 메모 생성/수정/교체는 암호화 전후 journal/vault와 lifecycle
epoch를 비교하지만, 암호화 중 계정 또는 소유권 장부만 바뀐 경우는 구분하지 못했다.
합성 검사에서 차단을 기대한 생성/수정/교체 9건과 키 교체 1건이 실제 성공을
반환했다. 정상 저장/편집 대조군 4건은 통과했다.

소유권 모듈의 작은 guard가 활성 계정, monotonic scope generation과 완전한
장부 원문을 고정한다. 공통 vault 저장 helper가 이를 세션 복구 코드 안정성과
기존 caller guard에 결합한다. 기존 rollback/epoch 검사는 유지한다.
정상 미귀속 글 편집은 자동 계정 귀속으로 바꾸지 않는다.

별도 저장 엔진이나 localStorage 전역 원자성은 주장하지 않는다. 기존
동기적 owner 예약·여러 key 쓰기를 새 분산 transaction으로 대체한 것도 아니다.
복구 코드 교체 API는 next code를 세션에 먼저 저장한 후 old→new 회전을 하므로
인수와 현재 세션 코드의 일괄 동일성 강제는 추가하지 않았다. 원격 private bulk는
기존 `sync-run`의 `recoveryCode = null`로 계속 닫혀 있고, 로컬 백업 복원은 호출
직전에 세션 코드를 읽는다.

## 로컬 검증

Node 24.19.0, 설치된 TypeScript/Vitest, 합성 데이터만 사용했다.

- 저장/회전/경합/읽기 범위 6파일 UTC 33/33.
- 새 미귀속 owner 변경 사례 추가 후 scope/canonical/라운지 전송/계획 연결
  4파일 UTC 150/150. 앞선 14건 중복을 제외하면 9파일 고유 169건이다.
- KST는 7파일 120/120 뒤 2파일의 forks worker가 시작되지 않았다.
  해당 2파일만 threads로 실행해 49/49. 실행기 시작 실패를 PASS로 세지 않는다.
  결과적으로 같은 9파일 169개 단언 사례를 KST에서도 실행했다.
- 앱 및 E2E `tsc --noEmit`: exit 0.
- owner-ledger equality만 실행 메모리에서 제거하자
  `rejects an edit when an unbound record changes owner while encrypting`가
  기대한 `ok=false` 단언에서 실패했다. 제품 소스는 변조하지 않았고 임시
  mutant config는 제거했다. 정상 UTC/KST에서는 해당 사례가 통과했다.
- Luna 독립 소스 검토: lifecycle epoch와 owner-ledger 변화의 차이를 확인했다.
  두 파일의 작은 수정에서 해당 누락은 더 발견되지 않았다. 별도의 실행 증거는 아니다.

이 검사는 hosted CI, main 병합, 공개 배포 또는 실계정 왕복의 증거가 아니다.
Cloudflare CLI 연결/활성 cron 성공과 두 앱의 실제 라운지 연결은 별도 미완료다.
계정 공개 관문과 기존 closed 설정은 이 코드 통합으로 변경하지 않는다.
