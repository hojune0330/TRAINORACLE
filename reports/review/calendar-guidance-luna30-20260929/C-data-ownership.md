# 독립 공격 리뷰 C: 데이터 소유권과 준비 상태

**검토일:** 2026-09-29  
**범위:** C01 공용기기 계정교체, C02 느린 서버, C03 오프라인 복귀, C04 삭제/복구, C05 동기화 도중 읽기. `useCalendarEntries`, `AppShell`, account-scoped journal projection의 readiness, owner epoch, 역순 응답만 검토했다.

## 결론

**상태: 보완 후 진행 권고.** 제안된 준비 상태 adapter는 현재 코드에서 작은 읽기 경계로 구현 가능하다. 새 router, 서버 schema, 별도 sync 계층은 필요하지 않다. 다만 `loadEntries(): JournalEntry[]`만 adapter로 감싸서는 충분하지 않다. journal storage의 read status, ownership manifest의 확실성, account projection의 상태와 cache freshness를 함께 읽어야 빈 상태를 확정할 수 있다. 현재 UI는 이 구분을 받지 않는다.

분류 표기: **확인된 코드**는 현재 checkout에서 읽은 구현/테스트 사실, **미검증 위험**은 이 소스만으로 발생을 입증하지 못한 설계 공격이다. 부모 모델 공격이 제안·추가한 same-owner generation guard는 앱 구현 증거로 취급하지 않았다. 런타임·브라우저·사용자 저장소 검증은 수행하지 않았다. 실제 사용자 데이터, env 및 인증 파일은 열지 않았다.

## 우선 발견

### P1: 빈 목록을 준비 완료로 판정할 수 없음

**확인된 코드:** `useCalendarEntries()`는 변경 이벤트를 받아 `loadEntries()`를 다시 부를 뿐, owner, read status, sync status, cache freshness를 반환하지 않는다 (`app/src/hooks/useCalendarEntries.ts:6-23`). `AppShell`도 `JournalArchive`에 배열만 전달한다 (`app/src/AppShell.tsx:625-635`). `JournalArchive`는 archive 월이 없으면 첫 일지 작성 안내를 렌더한다 (`app/src/screens/JournalArchive.tsx:165-171`). account 기록이 LOADING/FAILED이고 현재 기기에 확인된 기록이 없을 때 반환 배열이 빈 경우에도 이 empty UI 경로가 존재한다. 전역 `AccountJournalStorageStatus`가 로딩/실패를 별도로 알리지만, archive 자체의 empty 조건을 막지는 않는다 (`app/src/components/AccountJournalStorageStatus.tsx:25-39`).

**추가 확인:** account projection은 `LOADING`, `READY`, `PENDING`, `REJECTED`, `FAILED`, `CONFLICT` 상태를 보유한다. LOADING/FAILED 시 current-confirmation map은 비우지만 acknowledged cache는 유지하고, `readAccountJournalProjection()`은 status와 별개로 그 cache를 반환한다 (`app/src/domain/account/account-journal-projection.ts:4-23, 56-82`). 반면 `accountJournalProjectionStatus()`는 projection scope와 active account가 다르면 `IDLE`을 돌려준다 (`app/src/domain/account/account-journal-projection.ts:21-22`). 따라서 상태만 `IDLE/READY`로 검사하거나 배열 길이만 검사해도 account 준비 여부를 확정할 수 없다.

**추가 차단 조건:** local journal JSON의 `readStatus`는 complete/uncertain으로 제공되지만 ownership manifest 상태는 내부에만 있다. manifest 읽기/파싱 실패는 `journalOwner()`에서 `undefined`, `isJournalVisible()`에서 숨김 처리로 바뀐다 (`app/src/domain/account/local-journal-ownership.ts:48-60, 97-108`). `loadEntriesForPlanSafety()`의 기존 precedent는 journal snapshot과 account status를 검사하지만 ownership manifest의 확실성은 검사하지 않는다 (`app/src/domain/journal-store.ts:96-110`). 그러므로 손상된 ownership index 때문에 모든 후보가 숨겨진 경우도 adapter가 관측하지 않으면 빈 결과처럼 보일 수 있다.

**권고:** 빈 상태/예시는 `readiness === READY && entries.length === 0`에서만 허용한다. READY에는 journal snapshot complete, ownership manifest complete, owner scope 안정, 그리고 계정 sync를 쓰는 계정이면 해당 owner의 list hydrate 완료가 필요하다. cache가 있지만 서버 확인이 아직이면 STALE로 탐색은 허용하되 서버 최신이라고 말하지 않는다. cache가 없고 로딩 중이면 LOADING, 필수 read 실패면 ERROR로 두고 빈 일지/예시를 노출하지 않는다.

### P2: AppShell의 계정 epoch가 날짜 복원 상태까지 격리하지 않음

**확인된 코드:** local scope 변경 handler는 pending reward, Oracle 입력 intent, toast, analysis context를 비우지만 `calendarDraftReturn`이나 AppShell의 `v`는 초기화하지 않는다 (`app/src/AppShell.tsx:238-242`). 달력에서 작성 화면으로 갈 때 return ref에는 account ID와 이전 view만 저장된다 (`app/src/AppShell.tsx:113, 639-648`). popstate 복원도 `calendarOrigin.owner === activeLocalAccount()`만 검사한다 (`app/src/AppShell.tsx:180-189`). 화면 자식의 key에는 `accountScopeRevision`이 포함되어 remount되지만 AppShell 상위 state/ref의 owner epoch는 아니다 (`app/src/AppShell.tsx:100-114, 740-744`).

**공격 결과:** A→B에서는 `loadEntries()`의 소유권 filter와 account service의 current 검사로 A 소유 기록이 B projection에 섞이는 경로를 확인하지 못했다. 그러나 A에서 보관한 달력 작성 복귀점은 ref에 남는다. A→B→A 뒤 Back이면 account ID가 다시 일치해 이전 view를 복원할 수 있다. 이는 관측된 원문 유출이 아니라 계획의 “전환 즉시 날짜 컨텍스트와 pending transition 폐기”와 어긋나는 탐색 상태 잔존이다.

**권고:** scope change에서 calendar return ref와 owner 종속 view context를 즉시 폐기하거나, 반환 토큰에 단조 증가 owner epoch를 포함해 ID가 다시 같아져도 이전 epoch는 거절한다. 기존 AppShell history를 확장하면 되며 router 교체는 과하다.

### P2: 공용기기에서 unbound 기록은 계정 간 공유되는 기존 동작

**확인된 코드/계약:** `isJournalVisible()`은 owner가 `null`인 기기 기록을 모든 active account에서 보이게 하고, 현재 account 소유 기록도 보이게 한다 (`app/src/domain/account/local-journal-ownership.ts:97-108`). 기존 isolation contract는 A와 B가 각각 로그인해도 unbound 기록은 양쪽 `loadEntries()`에 포함된다고 명시한다 (`app/src/domain/account/local-journal-isolation.contract.test.ts:57-70`). North Star는 기존 기기 기록을 대상 계정 확인 없이 자동 귀속시키지 말라고 하지만, 이 문장만으로 로그인한 다른 사용자가 기기-local unbound 글을 읽을 수 있는지까지 확정되지는 않는다 (`PRODUCT_NORTH_STAR.md:113-120`).

이 동작은 명시된 테스트와 일치하므로 이번 리뷰에서 구현 버그라고 단정하지 않는다. 다만 C01을 엄격한 공유기기 격리로 받아들인다면 unbound는 별도 device scope/명시 확인 전 숨김 중 무엇인지 오너 결정이 필요하다. 현재 설계의 `ownerId`만으로 모든 사용자 데이터가 격리된다고 설명하면 안 된다.

## 상태 adapter의 실제 구현 가능성

**장점:** 필요한 기반은 이미 있다. `loadJournalEntriesSnapshot()`은 local read completeness를 제공하고, account projection은 cache와 sync status를 분리 보유하며, hook은 같은 탭 scope/change/storage/focus 이벤트를 구독한다 (`app/src/domain/journal-store.ts:96-131`; `app/src/domain/account/account-journal-projection.ts:4-82`; `app/src/hooks/useCalendarEntries.ts:9-23`). `loadEntriesForPlanSafety()`도 여러 read 신호를 합치는 기존 선례다 (`app/src/domain/journal-store.ts:103-110`). account record service는 한 owner의 hydrate/mutation을 직렬화하고, owner 전환·dispose 때 generation을 갱신하며, 응답 뒤 current 여부를 검사한다 (`app/src/domain/account/account-journal-record-service.ts:17-54, 63-73, 550-629`). 이는 작은 adapter와 순수 calendar resolver를 뒷받침한다.

**부족점:** `loadEntries()`는 readiness가 없는 전체 `JournalEntry[]`이고 ownership index certainty가 외부에 없다. account projection status의 IDLE은 guest/비활성뿐 아니라 projection owner mismatch도 뜻할 수 있다. 4-state `LOADING/READY/STALE/ERROR`만으로 기존 `PENDING/REJECTED/CONFLICT`를 덮으면 미확인 쓰기 상태가 사라진다. 이를 전부 별도 서버 상태 머신으로 승격하는 것은 과도하지만, readiness와 sync detail은 분리해야 한다.

**최소 권고 shape:** 얇은 read adapter가 한 번의 snapshot에서 `{ ownerId, ownerEpoch, requestEpoch, readiness, syncStatus, entries }`를 반환한다. `entries`는 달력에 필요한 최소 필드(예: id/date/kind와 필요 시 표시용 sync marker)만 투영하고 원문 메모는 전달하지 않는다. 기존 account service가 sync/hydrate의 단일 소유자가 되며 달력 hook이 별도 fetch/서버 캐시를 만들지 않는다. ownership module에는 complete/uncertain을 반환하는 작은 읽기 accessor가 필요하다. 테스트는 LOADING→READY empty, LOADING/FAILED + stale cache, ownership uncertain, scope switch, 그리고 same-owner 이전 request completion을 분리해 검증한다.

### owner epoch와 request generation은 별개

**확인된 코드:** record service의 `generation`은 context owner 변경과 dispose에서 증가하며 `ctx.current()`는 generation과 현재 owner를 함께 검사한다 (`app/src/domain/account/account-journal-record-service.ts:19, 36-54`). hydrate는 동시에 한 promise를 공유하고 service work queue를 사용한다 (`app/src/domain/account/account-journal-record-service.ts:63-73, 550-559`). 현재 `useCalendarEntries()` 자체는 동기 read라 자체 비동기 응답 경쟁은 없다.

**부모 공격에서 온 미검증 위험:** 같은 owner 내에서 먼저 시작된 calendar read가 나중 read보다 늦게 완료되어 최신 값을 덮는 시나리오와 model-level generation guard 추가가 보고됐다. 이 변경은 이 repo의 app code/test에 반영된 증거가 아니다. 현행 owner generation은 계정 수명주기 guard이지 일반적인 per-request sequence token은 아니다. 또한 service의 serialize/revision 검사가 현재 hydrate 경로를 보호하는 사실은 미래 calendar adapter나 별도 async reader에 같은 보호가 자동 적용된다는 뜻이 아니다.

**권고:** scope epoch만으로 C05를 닫지 않는다. 비동기 calendar 요청을 새로 만들 경우 시작 때 `requestEpoch`를 증가시키고 결과 commit 직전 owner epoch와 최신 request epoch를 모두 비교한다. 서버 revision이 있는 응답은 per-entry revision도 단조 증가 검증한다. 모델 테스트의 pass는 앱 구현 증거로 보고하지 않는다.

## 5 페르소나 공격 순서

아래 10개는 seed로 생성한 제약 이벤트 순서이며, **현재 앱에 주입 실행한 테스트가 아니라 정적 코드 추적**이다. `resolve`는 이미 발행된 요청의 완료를 뜻한다. 기대 결과는 확인된 코드 동작과 미검증 모델 위험을 구분했다.

### C01 공용기기 계정교체

- `0x5a17`: `select(A-date) → switch(B) → start(B-read) → switch(A) → resolve(B-new) → resolve(A-old) → popstate(A-return)`. 서비스의 owner generation은 전환 후 B/A의 이전 응답을 stale로 만들 수 있다. 반면 `calendarDraftReturn`은 A ID만 비교하므로 A로 돌아온 뒤 이전 반환점이 유효해질 수 있다.
- `0xc300`: `select(A-date) → switch(B) → start(B-read) → resolve(A-old) → resolve(B-new) → switch(A) → popstate(A-return)`. A-old 응답은 B에서 거절되어야 하고 B 응답은 A로 돌아간 뒤 거절되어야 한다. 날짜 복귀 ref는 여전히 A ID만으로 복원 여부를 판단한다.

### C02 느린 서버

- `0x5a78`: `select(date) → month(+1) → online-while-pending → first-timeout → online-after-timeout → retry-start → retry-resolve(empty)`. 첫 요청이 pending일 때 online refresh는 기존 `hydration` promise를 공유한다. 실패한 promise의 in-flight handle이 정리된 뒤 online refresh가 새 hydrate를 시작할 수 있다. 성공적으로 완료된 empty list 전에도 archive는 배열만 보고 empty 안내를 렌더할 수 있다.
- `0xc371`: `select(date) → online-while-pending → first-timeout → online-after-timeout → retry-start → retry-resolve(nonempty) → month(+1)`. 늦은 데이터의 상태를 구별할 adapter가 없으므로, 전역 저장 안내와 archive empty/records UI가 동시에 서로 다른 준비 인상을 줄 수 있다. 시간 경과만으로 READY를 만들지 않는 계획은 적절하다.

### C03 오프라인 복귀

- `0x5ad9`: `select(date) → load-fails-offline → online → retry-starts → retry-resolves-current → storage-notification-late`. failure 이후 online retry와 late storage notification은 현재 hook의 재읽기와 잘 맞는다. 이전 acknowledged cache가 있었다면 LOADING/FAILED 중에도 일반 entries로 반환되므로 STALE 표기가 빠진다.
- `0xc3e2`: `select(date) → storage-notification-late → load-fails-offline → online → retry-starts → retry-resolves-current`. storage 이벤트는 현재 snapshot을 다시 읽지 과거 배열을 전달하지 않는다. 그래도 cache가 없는 실패 상태는 `[]`와 ERROR를 hook에서 구별할 수 없다.

### C04 삭제/복구

- `0x5b3a`: `list-old-resolves → delete-starts → delete-tombstone → storage-notification-late → restore-starts → restore-new-revision → select(date) → back`.
- `0xc453`: `list-old-resolves → delete-starts → delete-tombstone → select(date) → storage-notification-late → back → restore-starts → restore-new-revision`.

두 순서 모두 account service의 직렬 queue 때문에 list 완료 뒤 삭제/복구가 진행된다. tombstone은 live document import보다 먼저 적용되고, 복구는 revision을 확인해 reconcile한다 (`app/src/domain/account/account-journal-record-service.ts:121-159, 643-707`). local storage notification은 현재 상태 재읽기를 유도한다. 마지막 기록 삭제 시 날짜를 유지하는 계획은 이 동작과 양립한다. 남은 결함은 읽는 쪽이 sync/readiness를 표현하지 않는 점이지, 이 소스에서 확인된 tombstone 역전은 아니다.

### C05 동기화 도중 읽기

- `0x5b9b`: `read1-start(old) → select(date) → sync-update(new) → read2-start(new) → read2-resolve(new) → read1-resolve(old)`.
- `0xc4c5`: `read1-start(old) → sync-update(new) → select(date) → read2-start(new) → read1-resolve(old) → read2-resolve(new)`.

두 순서는 부모 모델 공격의 same-owner 오래된 응답 위험을 직접 겨냥한다. 현재 hook은 요청/응답을 만들지 않고 동기 `loadEntries()`를 호출하므로 이 경쟁은 현행 hook에서 재현된 결함이 아니다. 현행 account record service의 queue/revision 경계도 고려해야 한다. 결론은 **앱에서 해결됐다는 증거 없음, 현재 경로에서 발생했다는 증거도 없음**이다. 새 adapter가 비동기 결과를 도입하면 request epoch 없이 owner epoch만 확인하는 것으로는 안전성을 입증하지 못한다.

## 장단점과 권고 우선순위

- **장점:** 현행 owner filter, account projection, lifecycle generation, revision, serialization을 재사용할 수 있다. calendar용 얇은 metadata snapshot과 pure context resolver면 충분하며 새 router/sync backend는 불필요하다.
- **단점:** ownership manifest certainty와 active account의 projection scope를 읽는 작은 API가 추가로 필요하다. 기존 sync 상태 6종을 사용자용 readiness 4종에 단순 압축하면 정확성 손실이 난다.
- **P1 선행:** LOADING/STALE/ERROR/READY를 실제 archive empty 상태까지 전달하고, READY-empty의 전제에 ownership certainty 포함.
- **P2 선행:** AppShell account change에서 날짜/복귀 ref를 owner epoch로 폐기. 공용기기 unbound 표시 정책을 별도 확정.
- **구현 관문:** same-owner request generation은 부모 모델 변경과 분리해 app adapter/service 경계에서 테스트. 현재 보고서는 정적 코드 리뷰이며 앱 구현·테스트·배포 확인을 주장하지 않는다.

[DRAFT_COMPLETE]
