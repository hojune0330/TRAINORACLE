# 페이스 기준 갱신 릴리스 검토

검토일: 2026-10-03 KST. 대상은 `TRAINORACLE-multi-event-pace-release-20261002`의 현재 미커밋 트리다.
기준 HEAD: `64774e30bae96e9cda41368a190eadc7386f5661`. 이 HEAD 자체가 아래 기능의 릴리스 커밋이라는 뜻은 아니다.
범위: source snapshot, 과거·일지·진행 보호, 실제/목표 구분, 정확한 undo, Node 24 prebuild. 코드 수정·커밋·배포 없음.

## P1 서버가 배치의 후속 슬롯 일지 보호를 검사하지 않음

- 위치: `app/src/domain/account/active-plan-edit-journal-guard.ts:25-30`, `:34-39`.
- `projectActivePlanEditJournal`은 `receipt.source`와 `receipt.target`만 검사한다. `PACE_REFERENCE`는 `target: null`이고 실제 변경 대상은 여러 `replacements`다. 두 번째 이후 교체 슬롯의 일지는 보호 대상으로 판정되지 않는다. 같은 배치 구조를 사용하는 undo도 해당한다.
- 서버 소비 경로: `supabase/functions/_shared/account-plan-collection-handler.mjs:289-299`는 이 두 보호 플래그와 evidence fingerprint만 검사한다. `account-plan-document-schema.ts:209-213`은 진행 상태와 과거 날짜를 검증하지만, 서버 일지에서 후속 슬롯의 보호 집합을 재구성하지 않는다. 정확한 journal revision guard는 내용 변경 경쟁을 막을 뿐 이 의미 검사를 대신하지 않는다.
- 영향: 클라이언트가 후속 일지 슬롯을 `protectedSlots`에서 누락하고 현재 일지와 일치하는 evidence fingerprint를 제출하면, 이 서버 일지 관문이 해당 슬롯의 변경을 막지 못한다. 정상 UI가 현재 보호하는 것과 서버의 독립적인 강제는 별개다.

### 실행 재현

파일을 만들거나 수정하지 않은 Node 인메모리 호출로, 현재 생성된 `account-plan-collection-validator.mjs`의 공개 `projectActivePlanEditJournal`과 `validateActivePlanEditJournalFacts`를 실행했다. 실제 일지가 아닌 합성 완료 일지를 사용했다. 증거 지문은 저장소의 `canonicalJsonFingerprint`로 계산했다.

```text
startDate=2026-10-05, source=day1/AM, target=null
replacements=[day1/AM, day3/AM]
journal=2026-10-07 AM, COMPLETED
protectsSource=false, protectsTarget=false, journalGateAccepted=true
대조군: 동일 일지의 day3/AM을 source로 지정 -> protectsSource=true, gateAccepted=false
```

이는 실행된 서버 의미 검증 함수의 누락 재현이다. 전체 HTTP 요청 성공이나 운영 데이터 변경을 재현했다는 주장은 아니다. 원격 서버·실제 계정은 사용하지 않았다.

수정 요청: 기존 단일 편집 동작을 유지하면서 PACE_REFERENCE의 모든 교체 주소에 동일한 `protectsSlot` 검사를 적용하고, 서버가 사용하는 생성 validator를 재생성한다. 첫 슬롯은 비보호/후속 슬롯만 일지 보호인 forward·undo 회귀를 추가한다. 명시 AM/PM, 미지정 슬롯, 이동한 일지의 원래 연결 주소와 비보호 대조군을 포함해 handler에서도 거부되는지 확인한다.

## 나머지 검토와 실행 결과

- 적용 직전 선택 기록 전체 지문·계정 소유자/서버 revision·계획/일지 지문·날짜를 확인하고 proposal을 다시 구성한다: `active-plan-edit-store.ts:134-203`. 보호된 과거 슬롯의 원본 기록까지 재선택하지 않는다. 추가 P1은 입증하지 못했다.
- 실제/목표 전환은 같은 표시 숫자여도 별도 변경으로 취급한다: `pace-plan-update.ts:15-32`. undo는 최신 forward receipt와 현재 계획 정체성을 확인하고 정확한 원본 스냅샷만 복원한다: `active-plan-edit.ts:97-103`, `pace-plan-update.ts:127-147`.
- `pace-plan-update.test.ts`에서 범위에 맞는 19건만 선택: 최초 18 통과, 1건은 기본 5초 timeout. 해당 `restores exact previous bindings once in one save and retains both archives`만 `--testTimeout=20000`으로 재실행하여 통과했다. 최초 실행의 timeout은 숨기지 않는다. 나머지 92건은 실행하지 않았다.
- 지정 런타임 실측: Windows `v24.19.0`. `buildRuntimeIssue(process.platform, process.version)`은 `null`; `node --test scripts/check-build-runtime.test.mjs`는 2/2 통과.
- `app/package.json:8`의 prebuild 연결은 적절하다. `check-build-runtime.mjs:3-12`는 Windows 24.11.1만 차단하고 24.19.0을 허용한다. Node 24 전체를 차단하지 않는다. 이는 특정 재현 실패에 대한 차단이지 일반적인 Node 버전 고정/호환성 보증이 아니다.

## 검증 공백과 릴리스 경계

P1 수정 전 서버의 배치 일지 보호 완료로 보고하지 않는다. 이 검토는 전체 테스트, 타입 검사, production build, HTTP/DB 통합, 브라우저, 실제 계정, 운영 SQL 0046 적용 여부를 검증하지 않았다. prebuild 테스트 2건은 이번에 직접 실행했으며 기본 `npm test` 스크립트에는 명시적으로 연결돼 있지 않다. 이전 exploration 체크아웃의 통과 결과를 현재 릴리스 증거로 재사용하지 않았다.
