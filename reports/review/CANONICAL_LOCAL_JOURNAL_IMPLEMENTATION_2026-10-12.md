# 기기 일지 저장소 분리 — 구현 인수 보고

```yaml
status: IMPLEMENTED_FOCUSED_VALIDATION_PASSED_RELEASE_GATE_PENDING
date: 2026-10-12
baseline: ccf0c00d1a838c72a1bcbb12a057c3a793771a9a
authority: 저장소를 분리해 보호한 뒤 배포 준비
production_deployed: false
```

## 구현 범위

- 일지·암호화 메모·귀속·휴지통·삭제 기록·계정별 동기화 복구를 `to-local-journal.*`로 분리했다. 기존 백업 형식 이름과 계정 문서 식별자는 그대로다.
- 시작 시 옛 원본을 고정 사본으로 보관하고 확인한 후 앱을 연다. 옛 앱의 후속 수정·삭제·새 복구 키는 충돌로 다룬다. 현재 기록과 자동으로 합치지 않는다.
- 명시적인 `현재 기록으로 계속`은 현재 바이트를 덮어쓰지 않고, 옛 변경분 보관과 비교 기준 갱신만 한다. 작성 중인 폼과 포커스를 유지한다.
- 영구 삭제·만료·휴지통 한도·새 ID 복구 이후의 오래된 원본 정리와 기기 전체 삭제를 함께 연결했다. 소유권이 충돌하거나 상태가 달라지면 멈춘다.
- 삭제 중 중단은 고정된 전후 값과 승인된 대상을 재확인해 이어간다. 다른 탭의 새 값은 자동 삭제하지 않는다.
- 비밀 메모 코드 변경의 부분 쓰기 복구는 검증된 원본으로만 되돌린다. 동시 변경된 완전한 문서와 미래 버전은 덮어쓰지 않는다.
- 일시적인 원본 읽기 실패도 빈 목록으로 재저장하지 않는다. 추가·수정·삭제·복원은 `readStatus=complete`를 확인한 뒤에만 진행한다.
- 독립 리뷰에서 발견한 삭제와 실패 복구의 경쟁은 이관/삭제 문서의 동일 revision으로 묶는다. 그 사이 삭제가 진행됐다면 이전 원문을 되돌리지 않는다. 대기 중이던 백업 복원도 삭제 이후 자동 재개하지 않는다.

`localStorage` 주소 분리는 구형 앱 호환성 보호다. 동일 출처의 악성 스크립트, 브라우저의 사이트 데이터 전체 삭제, 완전한 교차 탭 트랜잭션을 막는다고 주장하지 않는다. 복구 코드는 계속 탭 저장소에만 두고 보관 사본·로그에 넣지 않는다.

## 검증 기록

아래 결과는 각각의 실행 묶음에서 관측한 범위다. 전체 검사·전체 E2E 성공을 뜻하지 않으며,
겹치는 재실행을 합산하지 않는다. 실패 이력과 그 뒤의 수정·재실행을 아래에서 구별한다.

| 묶음 | 해당 묶음의 관측 결과 |
|---|---|
| 고정 사본·충돌·이관·명시 확인·삭제 재개 | `canonical-journal-storage.contract` 43/43 통과. 복사 도중 옛 앱 변경의 안전한 재개, 미래 형식 원본 보존, 별도 현재 값 덮어쓰기 거부 포함 |
| 삭제·만료·복구·원본 정리 | `erase-local-data` 23 + `erase-canonical-journal` 7 + `journal-original-retention` 12: 3파일 42/42 통과 |
| 기존 일지·암호화 메모·읽기·폼 fixture | 근접 19파일 161/161 통과. 이후 확대 48파일 배치는 아래의 별도 중간 분류이며 이 결과로 대신하지 않는다 |
| 접근 어댑터·작성 중 입력·미지원 버전 | 접근 6 + 경계 UI 3 + 삭제 revision 경쟁 9 + 대기 중 복원 3: 21/21 통과. 23파일 배치의 복구 fixture 1실패를 아래 근거로 바로잡고 접근 6개를 재실행 |
| 실제 로컬 Chromium | 최종 저장소 보호 6개 관측 통과, pageerror 0. 기존 몸 기록 흐름도 최종 13개 관측 통과, pageerror 0 |
| 타입·production 번들 | 고정 Node 24.19.0의 직접 app/E2E 타입 검사 통과. 최신 main 통합 `8eb3119a`와 순환 참조 보정이 포함된 Vite build exit 0. 릴리스 게시용 빌드·배포 증거는 아님 |

결함 주입: 원본 비교를 제거했을 때 `holds old edits, additions, deletion and namespace-prefix erase without merging into canonical data`가 실제 실패했다(expected conflict / received ready). 소스는 주입 전과 같은 SHA-256으로 복원했다. 이를 모든 테스트 각각의 결함 주입 완료로 확대하지 않는다.

후행 독립 리뷰의 증거:

- Sol 독립 읽기 검토에서 일지·vault·소유권·휴지통·삭제 기록·동기화 복구 접근 경계, 정상 앱의 초기화 후 mount, 계정 A/B 전환 세대, 백업 요청/실패 복구의 저장 revision을 대조했다. 해당 변경 범위에서 추가 P1/P2를 찾지 못했다. 이는 전체 서비스 보안 감사나 실계정 검증 완료라는 뜻이 아니다.
- 첫 vault 쓰기 뒤 삭제 revision 재확인을 제거하자 `stops the dependent journal write when full erasure finishes after the vault write`가 실패했다(삭제 뒤 pending journal 재등장). 해당 파일을 원래 SHA-256 `DC3CA9F7EC99EFE77CEA606843D943DEDE220DE21E56C7A1DEB2EA07F21BC6F1`으로 정확히 복원했다.
- `backup restore binds the storage epoch before waiting for a lock`의 기본 삭제/전체 흔적 삭제 두 재현은 수정 전 `COMMITTED/restored:1`로 실패했고, 같은 revision의 긍정 대조군은 통과했다. 복원 요청 시작 시점을 삭제 revision에 묶도록 수정했다.
- 기존 `keeps both prior records when the journal snapshot cannot be read`는 실제 읽기 실패 후 재저장 결함을 잡았다. 기대값을 변경하지 않고 읽기 완료 필수 조건을 구현했다.
- 새 ID 복구 fixture에는 실제 작성 시 필요한 `painParts: EXPLICIT` 출처를 추가하고 쓰기 파서 통과를 먼저 단언했다. 정리 대상은 옛 ID의 원본이며, 복구한 새 ID의 살아 있는 내용까지 사본에서 사라져야 한다는 잘못된 단언은 옛 ID 부재와 새 ID의 몸 메타데이터 보존으로 바로잡았다. 런타임 복구 관문은 완화하지 않았다.
- guard가 추가하면서 달라진 내부 `getItem` 횟수에 의존하던 동시 쓰기 주입 두 곳은 실제 암호화 await 동안 주입하도록 바꿨다. 동시 값 보존/실패 기대값은 그대로다. 휴지통 205회 연속 쓰기 합성 검사는 그 사례만 15초 한도를 사용하며 개수·보존 단언은 유지한다.

실행 환경에서 Vitest worker가 검사 시작 전에 60초 기동 제한으로 실패한 실행도 있었다. 이는 assertion 통과가 아니며 성공 수치에 포함하지 않는다. 중간 배치의 일부 실패나 중단도 전체 통과로 세지 않는다.

### 확대 48파일 배치 — 최초 실패 이력

아래는 첫 실행의 실제 결과다. 이후 성공으로 소급 수정하지 않으며, 바로 아래 후행 재실행과
함께 읽는다. 이 수치는 완료된 전체 검사 수가 아니다.

| 분류 | 중간 보고 | 현재 경계 |
|---|---|---|
| 통과한 검사 파일 | 38파일, 628 tests 통과 + 2 skip | skip은 통과가 아니며 다른 묶음과 합산하지 않는다 |
| assertion/변환 실패 | 6파일, 9 tests 실패 | 아래 후행 수정·재실행으로 해소 |
| worker 시작 실패 | 4파일 | 검사가 시작되지 않았으므로 assertion 결과나 통과로 세지 않는다 |

영향받은 fixture 5묶음을 보정했다. pace 관련 4검사는 canonical import 이후 실제 순환
참조가 드러난 사례라 production 코드를 별도로 수정했다. 개수는 위 표와 독립적으로
더할 집계가 아니며, 전체 CI 성공을 선언할 근거가 아니다.

후행 worker 실패 4파일 재실행과 fixture 6파일 재실행도 호스트의 worker 시작·종료 timeout이
반복되어 결과를 얻지 못했고, 통합 담당이 두 실행을 중단했다. 따라서 원래 배치의
628 tests 통과·9 tests 실패·4파일 worker 시작 실패 증거를 그대로 유지한다. 마지막
순환참조 보정 후 threads 1 worker 실행에서 `pace-plan-update.test.ts` 112/112는 통과했다.
신규 `plan-beta-schema.import-order.contract.test.ts`는 worker 시작 timeout으로 실행되지 않아
해당 실행 전체는 exit 1이다. 최종 app 타입 검사와 E2E 타입 검사는 각각 exit 0을 확인했다.
수정한 소스가 존재한다는 이유로 실패나 미실행을 통과로 바꾸지 않는다.

실제 순환은 athlete-records → account scope/ownership → canonical storage → journal schema →
comparison relation → plan schema → athlete-records였다. 초기화 전 ID schema를 고정한 alias를
`z.lazy`로 지연 참조하도록 바꿨다. ID 제약·훈련 수치·처방 및 안전 규칙은 바꾸지 않았다.
그 뒤 11파일 배치에서는 8파일 134검사가 통과했고, AppShell archive와 sync orchestration은
worker 시작에 실패했다. 신규 import-order 검사는 잘못된 입력을 production builder가 이미
거절하는데도 다음 단계까지 가도록 만든 fixture 때문에 실패했다. builder의 조기 `null`
거절을 그대로 확인하도록 바로잡았고 guard를 우회하지 않았다.

이 마지막 3파일만 다시 실행해 **3파일 22/22, exit 0**을 확인했다. 유효한 실제 후보의 parse,
athlete-records first import 순서, 잘못된 ID 거절을 유지한다. 따라서 최초 48파일 배치에서
실패하거나 시작하지 못했던 항목은 관련 후행 재실행으로 확인했으며, 38개 통과 파일의
불필요한 전면 재실행은 하지 않았다. 최초 배치의 skip 2개는 여전히 통과로 세지 않는다.

몸 메타데이터의 named mutation script는 **5/5 통과**했다. 정상 코드의 성공과 각 guard를
메모리에서 제거한 코드의 이름 있는 실패를 모두 확인하며, 지원 v1 companion의 후속 저장
누락을 막는 production guard를 실제 initializer와 함께 검사한다.

최신 main을 충돌 없이 통합한 뒤 로컬 production 번들 빌드는 exit 0이었다. 대표 모바일
E2E `private-memo-save`, `journal-trash`, `journal-drop-observability`는 **3파일 9/9, exit 0**이다.
개인 계정이 아닌 격리된 합성 자료로 수행했고, 전체 E2E·CI·운영 배포를 대신하지 않는다.

최신 main의 작성 폼 변경과 맞물린 추가 fixture 네 곳(`QuickSessionForm.contract`,
`QuickSessionForm.duplicate-save.contract`, `ActivePlan.plan-link.contract`,
`account-import.contract`)은 production 초기화를 명시해 **4파일 77/77, exit 0**을 확인했다.
계정 플래그 거부 검사가 저장소 미준비 때문에 공허하게 통과하지 않도록 한 정비이며,
기존 기대값과 보호 규칙은 유지했다.

실제 브라우저 검사는 합성 기록과 격리된 컨텍스트를 사용하고 외부 요청을 차단한다. 옛 탭의 필드 제거·빈 배열·키 삭제, 충돌 중 입력 유지, 명시 확인, 새로고침을 확인한다. 320/375/1280px 및 320px 큰 글씨에서 안내창과 터치 영역을 확인한다. 캡처는 로컬 `app/.codex-calendar-visual-qa/canonical-storage-20261012/`에 있으며 공개·CI 증거가 아니다.

기존 몸 기록 브라우저 검사는 `app/e2e/body-history-flow.browser.mjs`로 수행했다. 부위 확대·기타 이름 재사용·통증 값의 재선택·몸 기록 원문 보기와 뒤로가기·작성 초안 보존·이미지 실패를 포함한다. 출력은 `app/.codex-calendar-visual-qa/body-history-20261012/`이며 개인 기록이 아니다. Vite의 폰트 런타임 해석, 정적/동적 import 혼용, 500kB 초과 chunk 경고는 남아 있다. 이를 오류 없는 번들 또는 전체 성능 검증이라고 표현하지 않는다.

## 검사 자료 소스 정비와 남은 실행 경계

저장 주소가 바뀌므로 현재 클라이언트를 검사하면서 옛 주소를 직접 읽거나 쓰던 fixture도 바뀌어야 한다. 이번 변경의 19개 근접 단위 검사에는 명시적 이관 초기화 helper를 적용했다. 실제 이관을 검사하는 새 core/browser 테스트는 의도적으로 옛 주소를 seed한다.

### 초기 검색 재고와 현재 상태를 구별한다

초기 독립 검색에서 확인한 `app/src` 테스트 **39개**, E2E spec **49개** 및 별도 script/audit
**6개**는 수정 전 리터럴 발견 수다. 현재 미정비 파일 수, 실행 파일 수 또는 통과 수가 아니다.
기본 lane 후보 47개라는 이전 분류도 당시 설정 기준의 후보였으며 실행 증거가 아니다.

- `app/src` 근접 19파일과 후행 확대 48파일은 서로 겹칠 수 있는 실행·정비 묶음이다. 초기 39개 검색 수에서 단순히 빼거나 더해 잔여 수를 만들지 않는다.
- E2E는 초기 49개 spec과 6개 script/audit의 각 맥락을 분류하고, 필요한 저장 주소·독립 bootstrap·호출부를 정비했다. 실제 변경은 **33개 spec + 6개 script/audit + 12개 fixture = 51개 파일**이다.
- 정상 부팅 전의 구형 합성 seed, 백업 형식 이름, 원본 바이트 보존 단언은 옛 주소를 유지한다. 부팅 후 현재 일지·vault·귀속·휴지통 읽기/쓰기만 새 주소로 바꿨다. 옛 리터럴이 남았다는 이유만으로 미정비로 분류하지 않는다.
- 재실행되는 주요 seed는 migration marker가 있을 때 옛 원본을 다시 쓰지 않는다. 부팅 후 직접 합성 데이터를 넣는 경로는 앱 진입을 확인한 다음 새 주소를 사용한다.
- 제품 런타임의 옛 리터럴은 주소 계약·삭제 호환 처리·백업 형식 식별자에만 남는지 별도로 확인했다. 이 소스 정합성 확인은 모든 테스트 통과를 뜻하지 않는다.

### E2E 51파일 소스 정비 내역

수정 담당은 아래 E2E 파일만 정비했으며 테스트·Git·커밋·배포를 실행하지 않았다.
`canonical-journal-storage.browser.mjs`와 `body-history-flow.browser.mjs`는 통합 담당 소유로
이 정비에서 수정하지 않았다. 두 스크립트의 앞선 실제 실행 결과와 이번 소스 정비를 섞지 않는다.

`app/e2e/`의 spec 33개(각 이름의 뒤에 `.spec.ts`):

- `account-decoration-service`, `account-runtime-isolation`, `active-plan-edit`, `athlete-records`, `calendar-decoration-flow`, `calendar-record-details`, `device-import`, `execution-replan`, `free-exploration-followup`
- `journal-decoration`, `journal-drop-observability`, `journal-provenance`, `journal-revisit`, `journal-text-sticker`, `journal-trash`, `launch-ready`, `mobile-save-overlap`, `multi-event-pace-lifecycle`, `navigation-boundary`
- `plan-day-reader`, `plan-journal-linkage`, `plan-journal-return`, `plan-kst-midnight-calendar`, `prescription-lifecycle-followup`, `private-memo-save`, `production-query`, `progressive-choice-journey`, `progressive-information`, `quick-progressive-journal`, `release-readiness`, `session-explanation`, `task-focused-ux`, `youth-flow-motion-and-personas`

`app/e2e/`의 script/audit 6개:

- `account-online-forms.browser.mjs`, `asset-placement-review.browser.mjs`, `body-asset-ux.browser.mjs`, `entry-clarity.browser.mjs`, `catalog-cycle-flow.audit.ts`, `touch-audit.ts`

`app/e2e/fixtures/`의 fixture 12개:

- `canonical-journal-browser.ts` 신규, `account-journal-record-service.ts`, `account-plan-ui.tsx`, `form-input-autosave.tsx`, `historical-lt-first-draw.tsx`, `planned-repetition.tsx`, `catalog-workout.tsx`, `account-decoration-ui.tsx`, `batch4-ancillary.html`, `ux-clarity.html`, `catalog-cycle-reduction.ts`, `catalog-cycle-reduction-loader.ts`

독립 브라우저 fixture와 inline form harness는 공유 helper를 통해 production initializer와
실제 Web Locks를 사용한 뒤 화면·기록 소비자를 연다. fresh JSDOM/CJS loader만 격리된
test-only inline lock runner를 주입하며, fixture/loader를 async로 바꾸고 두 호출부에서
await한다. 제품의 초기화·쓰기 guard를 완화하지 않았다.

`journal-drop-observability`와 `session-explanation`의 초기 손상 입력은 `SOURCE_CORRUPT`
진입 차단, 옛 원문 정확 보존, 현재 일지 미생성으로 맞췄다. 부팅 전에 손상된 구형 목록에서
일부 정상 행만 여는 것은 승인한 이관 계약이 아니다. 이 변경된 E2E는 예전의 행별
`dropped=1 loaded=1` 로그를 더 이상 증명하지 않으며, 초기 전체 목록 보존 경계를 확인한다.
`athlete-records`의 구형 race seed는 완전한 읽기 스키마로 보정하여 일지와 경기 PB의
자동 연계 금지 시나리오가 저장소 진입 차단에 가려지지 않도록 했다.

### 후행 확인과 범위 밖 잔여

E2E 51파일 정비 동결 후 `typecheck:e2e`는 통합 담당이 통과를 확인했다. 타입 통과는
브라우저 행동 성공, 전체 E2E 또는 운영 증거가 아니다. 대표 후행 실행 후보는
`private-memo-save.spec.ts`(새 journal/vault 저장), `journal-trash.spec.ts`(삭제·undo·복원·영구
삭제·만료), `journal-drop-observability.spec.ts`(초기 손상 원본 보존)이다.
해당 대표 묶음은 이후 통합 담당 실행에서 9/9 통과했다. 위 후행 검증 기록을 따른다.

E2E 소유 범위 밖 `app/scripts/body-part-metadata-mutation.test.mjs`의 기존 old-key Map와
manifest 없는 fixture는 새 guard에서 공허하게 거절될 가능성을 통합 담당에게 보고했다.
E2E 정비 담당은 이 파일을 수정하거나 검사를 실행하지 않았다. 별도 담당이 지원 v1
메타데이터의 후속 저장 누락 사례로 정비했고 통합 담당이 named mutation 5/5를 확인했다.

따라서 전체 CI나 모든 E2E가 통과했다고 보고하지 않는다. 이번에 확인한 영향 범위의 fixture
정비는 완료했다. 실제 공개 전 최종 릴리스 SHA에서 필수 릴리스 검사를 한 번 수행해야 한다.

## 인수·배포 경계

- 몸 기록의 입력·확대·기타 재사용·날짜별 이력은 앞선 `BODY_HISTORY_IMPLEMENTATION_2026-10-12.md`의 구현이다. 이 보고서는 그때 발견한 구형 기기 저장소 P1을 다룬다.
- 이번 작업은 운영 배포, DB 변경, 실계정 왕복을 하지 않는다. 이전 계정 JOURNAL v4 지원의 서버 반영도 별도 증거가 필요하다.
- 저장소 규칙의 main 커밋·푸시와 운영 공개를 구분한다. 자동 게시를 막는 `[skip ci]` 커밋은 CI 통과가 아니다.
- 보호 구현 커밋은 `dbfabaac`, 다른 작업자의 최신 main 통합은 `8eb3119a`다. 후행 검증 결과와
  fixture 보완은 별도 `[skip ci]` 인수 커밋으로 보존한다. 통합 및 마지막 fixture 보완 후 app
  `tsc --noEmit`도 exit 0을 확인했다. 실제 게시용 최종 SHA 검증은 아직 실행하지 않았다.
- 문제 발생 시 새 저장소를 옛 주소로 복사하거나 원본/구매 내역/DB를 삭제하지 않는다. 새 읽기 지원은 유지하고 새 쓰기를 보수적으로 막는다.
- 이번 작업자가 PR #354/#355/#356를 병합하거나 수정하지 않았다. 최종 원격 재확인에서 다른
  작업자가 PR #354 등을 반영해 main이 `6194f3f5`로 전진한 것을 확인했다. 최신 main 통합은
  기존 변경을 보존해서 진행하며, 기존 미추적 에셋·캡처는 이 변경에 포함하지 않는다.
