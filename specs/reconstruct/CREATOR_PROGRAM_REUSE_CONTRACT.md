# CREATOR_PROGRAM_REUSE_CONTRACT.md

```yaml
doc_id: TO-CREATOR-PROGRAM-REUSE
version: "0.1"
status: OWNER_APPROVED_SCOPED_DEVELOPMENT_CONTRACT
authority: reports/plans/TRAINING_PLAN_PARALLEL_DEVELOPMENT_ORDER_2026-09-20.md
canonical_promotion_allowed: false
new_prescription_activation_authorized: false
production_or_external_api_activation_authorized: false
source_supply: BLOCKED_SOURCE
```

## 1. 승인 범위

오너가 승인한 간편 계획·제작자 프로그램 병렬 개발 중 공개 원본의 **정적 데이터 계약, 순수 검증, 선택 화면, 철회/리콜 판정**만 다룬다. 새 훈련 수치·템플릿·대상·외부 처리·운영 공개의 승인이 아니다. 개인 계획 생성과 계정 저장은 기존 경로를 사용한다.

- 상위 [제품 지침](../../PRODUCT_NORTH_STAR.md), [병렬 작업 지시](../../reports/plans/TRAINING_PLAN_PARALLEL_DEVELOPMENT_ORDER_2026-09-20.md)를 따른다.
- [제품 원문 A](../../reports/plans/TRAINORACLE_INSTANT_PLAN_AND_CREATOR_PROGRAM_PLAN_2026-09-20.md)와 [후속 UX 수정 B](../../reports/plans/TRAINORACLE_INSTANT_PLAN_UX_UI_CRITICAL_REVIEW_2026-09-20.md), [통합 D](../../reports/plans/TRAINING_PLAN_CROSS_SESSION_INTEGRATION_REVIEW_2026-09-20.md)의 C3 역할을 구현한다.
- [기존 공개 요약 카드 계약](./PLAN_BACKUP_PUBLIC_PROFILE_AND_SHARING_SPEC.md)을 확장하지 않는다. 개인 계획·원문 일지·비밀 글·공개 프로필에서 이 DTO를 자동 추출하지 않는다.

공개된 글 또는 계획 요약, 선수 이름, 팔로워 수는 재사용 권한도 개인 적합성도 아니다. 검토된 원본, 권한 자료, 적용 범위가 없는 프로그램은 활성화하지 않는다.

## 2. 공개 ProgramVersion

구현: `app/src/domain/creator-program/schema.ts`의 `creatorProgramVersionSchema`.

모든 객체는 strict schema다. 알 수 없는 필드는 조용히 버리지 않고 전체 입력을 거부한다. 개인 원본을 복사한 뒤 일부 표시만 숨기는 방식은 허용하지 않는다.

| 필드 | 역할 |
|---|---|
| `schemaVersion`, `programId`, `version` | 공개 원본과 정확한 불변 버전의 정체성. 개인 계획 ID와 별개 |
| `title`, `author.authorId/displayName` | 명시적으로 게시한 프로그램·제작자 표기. 계정 UUID, 연락처, 공식 협업 주장을 포함하지 않음 |
| `source.sourceId/publicUrl` | 검토할 수 있는 공개 출처. URL은 HTTPS, 자격증명·쿼리·fragment 제외 |
| `eventDistanceM` | 기존 지원 종목 범위의 원본 종목. 값의 존재로 새 처방 대상이 채택되지 않음 |
| `audienceLabel`, `workloadLabel` | 원본 검토자가 제공한 대상과 실제 부담. 임의 수치·효과·완주 보장 생성 금지 |
| `schedule` | 상대 주기 또는 실제 날짜·시간대. 세션별 용량·개인 달력 아님 |
| `grant` | 정확한 원본 버전에 결합한 권한 자료 참조, 상태, 열람/개인 적용/상업 노출 범위, 기존본 보유 조건 |
| `review` | 정확한 원본 버전의 검토 참조·상태·완료일 |
| `transformations` | 허용 변환 종류와 정책 참조. 변환 자체를 실행하지 않음 |
| `applicability` | 현재 기록/목표만/기록 없음 각각의 채택 참조, 기존 처방 참조와 허용 변환 참조 |
| `lifecycle` | ACTIVE/WITHDRAWN/RECALLED와 별도 공개 안내 |

원본 데이터에는 개인 계정, 기록값, 기준기록 ID, 일지, 증상, 원문, 건강 상태, 후보 JSON, 개인 세션/수치가 없다. `adoptionRef`, `prescriptionRef`, `policyRef`, `evidenceRef`는 승인 자료의 제한된 식별자이며 원문 또는 JSON을 넣는 필드가 아니다. 공개 문구와 URL 경로의 내용까지 스키마가 개인정보 여부를 증명할 수는 없으므로 게시 자료의 수동 검토가 여전히 필요하다.

권한·검토의 누락은 각각 `GRANT_REQUIRED`, `NOT_REVIEWED`로 닫힌다. 검토 완료에는 실제 달력 날짜가 필요하다. 원본과 다른 ID/버전의 grant/review는 schema 위반이다. 참조 문자열이 채워졌다는 사실은 해당 승인 자료가 실제로 존재하거나 유효하다는 증거가 아니다.

## 3. 날짜와 변환 경계

### 상대 주기

`RELATIVE_CYCLE`은 `durationDays`와 `orderedDayOffsets`를 가진다. 상대일은 주기 안에서 중복 없이 증가한다. 이 배열은 공개 원본의 일자 메타데이터이며 모든 훈련·휴식·회복 관계를 검증하는 새 엔진이 아니다.

개인 시작일에 옮기는 계산은 통합 담당자가 기존 달력·처방 계약에 연결한다. 이 도메인은 배치, 수치 변환, 놓친 훈련 보충, 두 계획 결합을 실행하지 않는다. 실제 결과 날짜는 기존 엔진 결과로 표시한다.

### 같은 날짜 일정

`FIXED_DATES`는 `startsOn/endsOn/timeZone/dates`를 별도로 가진다. 날짜는 존재하는 민간력 날짜이며 게시 기간 안에서 증가한다. `durationDays`는 시작일부터 종료일까지의 실제 일수와 같아야 한다. 사용자 로컬 시간대에 맞춰 원본 날짜를 자동 이동하지 않는다.

이 형식의 파싱 성공은 중도 합류·시간대 변환·계획 실행이 구현됐다는 의미가 아니다. 첫 제품은 실제 허용된 상대 주기부터 연결하고, 같은 날짜 일정의 합류 정책은 별도 검토한다.

### 허용 변환

- `SAME_EVENT_PACE`: 현재 기록 경로에서만 해당 정책을 참조할 수 있다. 목표 또는 기록 없음 경로에 현재 기록 페이스 정책을 연결하면 거부한다.
- `RELATIVE_DATE_SHIFT`: 검토된 상대 날짜 이동의 참조.
- `REVIEWED_VARIANT`: 별도로 검토된 변형의 참조. 이름만으로 새 분량·빈도·강도를 허용하지 않는다.

각 진입의 `transformationPolicyRefs`는 원본의 허용 목록 안에 있어야 한다. PB 비율로 엘리트 용량을 곱하는 새 로직, 종목 간 환산, 목표를 현재 능력으로 사용하는 로직은 없다.

## 4. 새 원본 선택과 실제 적용

`evaluateCreatorProgram(input, entry?, expectedIdentity?)`는 순수 메타데이터/권한 판정이다.

| 결과 | 의미와 선택 UI |
|---|---|
| `INVALID_PROGRAM` | 형식·개인 필드·날짜·정체성 결합 오류. 입력/오류 원문을 화면이나 로그로 반환하지 않음 |
| `VERSION_MISMATCH` | 요청한 정확한 원본과 다름. 최신 버전으로 조용히 교체하지 않음 |
| `WITHDRAWN` / `RECALLED` | 신규 적용 불가. 리콜은 권한보다 먼저 적용 |
| `GRANT_REQUIRED` / `NOT_REVIEWED` | 필요한 게시/개인 재사용 권한 또는 검토 없음 |
| `NEEDS_INPUT` | 원본 메타데이터는 통과했으나 사용자의 종목/진입이 없음. `내게 맞춰 보기`로 입력을 시작할 수 있음 |
| `UNSUPPORTED_EVENT` / `UNSUPPORTED_ENTRY` | 다른 종목 또는 검토되지 않은 기록/목표/기록 없음 진입. 시작 버튼 전에 이유 표시 |
| `ELIGIBLE` | 해당 종목·진입의 원본 메타데이터가 맞음. 실제 훈련·안전·기록 현재성·수치·저장은 별도 검증 필요 |

`NEEDS_INPUT`과 `ELIGIBLE`에서 선택 콜백이 반환하는 것은 `{kind:'CREATOR', programId, version}`뿐이다. 개인 계획을 생성·저장·공개하거나 팔로우를 실행하지 않는다. 잘못되었거나 부적합한 원본을 다른 프로그램으로 몰래 바꾸지 않는다.

통합 담당자는 기존 공통 입력 검증을 거친 사실을 사용하고, 원본의 `adoptionRef/prescriptionRef`를 실제 채택 목록에 대조해야 한다. grant의 `commercialListing`은 기록하지만 초기 무료 원본 선택 경로는 이를 필요 조건으로 삼지 않는다. 유료/상업 노출 기능에는 별도 enforcement가 필요하며 현재 구현됐다고 표시하지 않는다.

**저장 직전에는 현재의 신뢰 가능한 원본 목록에서 정확한 버전을 다시 조회**하고 권한·리콜·검토를 재검사한다. 결과 화면에서 통과했던 객체를 계속 신뢰하지 않는다. 이어서 기존 안전·기준기록·개인화·중복 방지·계정 revision 계약을 적용한다. 이 순수 모듈만으로 운영 권한을 보장할 수 없다.

## 5. 개인본과 철회/리콜

원본 ID와 개인 계획 ID는 다르다. 개인 계획은 기존 계정 저장소를 사용하고, 적용 당시 `programId/version/grantId/existingCopyPolicy`를 기존 개인본 provenance에 고정한다. `creatorCopyProvenanceSchema`는 이 참조만 검증하며 별도 계획이나 저장소가 아니다.

`evaluateExistingCreatorCopy(source, provenance)`는 실행 명령이 아닌 후속 상태 판정이다. 반환값의 `preservePerformedHistory: true`는 모든 경우에 유지된다.

| 상태 | 기존 개인본 결과 |
|---|---|
| 같은 버전·같은 grant·활성 상태 | `KEEP_EXISTING`; 원본 편집으로 현재 계획을 덮어쓰지 않음 |
| 배포 철회 | 신규 적용 차단. 적용 당시 보유 조건에 따라 `KEEP_EXISTING` 또는 `HIDE_FUTURE_CONTENT` |
| 안전상 리콜 | `PAUSE_FOR_REVIEW`; 영향을 받는 미래 훈련을 재검토. 과거 수행 삭제 금지 |
| 원본 부재/잘못된 원본 | `SOURCE_UNAVAILABLE`; 부재를 리콜 없음 또는 활성 권한으로 간주하지 않음 |
| 다른 ID/버전 | `IDENTITY_MISMATCH`; 새 원본으로 자동 교체 금지 |
| grant 변경 또는 검토 철회 | `PAUSE_FOR_REVIEW`; 과거 수행은 그대로 |

개인본 provenance는 실제 적용 시 보관한 신뢰 가능한 계정 데이터여야 한다. 사용자 제공 객체를 통해 더 넓은 보유 조건을 주장하게 하지 않는다. 원본 철회, 사용자의 개인 계획 삭제, 계정 탈퇴는 각각 기존 담당 계약에 따른다. 과거 기록의 법적 보유 판단을 이 모듈이 새로 정하지 않는다.

## 6. 공급과 미완료

개발 기준 저장소에서 실제 허용된 제작자 프로그램·grant·원본 검토 자료를 찾지 못했다. 기존 공개 카드와 학습/트렌딩 자료는 재사용 승인 근거가 아니다.

- `CREATOR_PROGRAM_REGISTRY`는 비어 있고 `getCreatorProgramSupplyStatus()`는 `BLOCKED_SOURCE`다.
- 테스트용 `creatorProgramFixture()`는 `example.test`와 명시적인 테스트 제작자를 쓰며 registry에서 import하지 않는다.
- 실제 선수·유명인 협업, 목표-only 프로그램의 존재, 검토 완료를 만들어내지 않는다.
- 제작자×현재 기록과 제작자×목표-only의 실제 프로그램 적용은 공급 미완료다.
- 대표 목표-only 원본 최소 1개의 권한·검토·변환 근거와 기존 엔진 연결이 확보되어야 해당 경로의 완료를 주장할 수 있다.
- 일반 프로그램의 목표-only 처방 채택 여부는 통합 담당자의 현재 승인 범위에 따르며 이 계약이 대신 승인하지 않는다.

## 7. focused 검수

`creator-program.contract.test.ts`는 통과 대조군과 누락 grant/review, 목표-only 미지원, 종목·버전 불일치, 철회/리콜, nested 개인 필드 거부, URL 경계, 실제 날짜/순서, 미허용 변환, 빈 공급 목록, 개인본 보유/리콜을 검사한다.

이 검수는 데이터 경계의 로컬 증거다. 제작자 권한 자료의 진실성, 처방 효과, 서버 권한 강제, 현재 서비스 동작, 실제 사용자 이해를 입증하지 않는다. 계정·개인본 통합과 실제 브라우저 검수는 통합 담당자의 별도 결과를 따른다.

[DRAFT_COMPLETE]
