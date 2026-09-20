# PLAN_DELETION_AND_RESTORE_IMPLEMENTATION_CONTRACT.md

```yaml
doc_id: TO-PLAN-DELETE-RESTORE
spec_id: PLAN_DELETION_AND_RESTORE_IMPLEMENTATION_CONTRACT
title: 훈련 계획 삭제와 복구 구현 계약
version: "0.2"
round: SERVER_FOUNDATION
status: DRAFT_FOUNDATION_IMPLEMENTED_NOT_CONNECTED
owner: OWNER_AND_INTEGRATOR
open_issues_total: 4
canonical_blocking_count: 4
executed_tests_total: 18
canonical_promotion_allowed: false
production_enabled: false
```

## 1. 목적과 현재 상태

계획을 언제든 삭제할 수 있어야 한다. 다만 현재 코드의 `ARCHIVE`는 보관이며 삭제가 아니다. 이 문서가 생겼다는 이유로 삭제 기능을 제공 중이라고 표시하지 않는다.

현재 실제 구현을 연 다음 확인한 경계:

- `account-plan-service.ts`와 `account-plan-collection-service.ts`는 `SAVE_HISTORY`, `SELECT`, `PROGRESS`, `ARCHIVE`만 받는다.
- `account-plan-document-schema.ts`의 계획 항목은 `planId`, 불변 snapshot, progress, updatedAt, archivedAt으로 구성된다.
- `account-plan-collection-schema.ts`의 업데이트 검사는 기존 항목 제거와 보관 후 내용 변경을 차단한다. 임의로 검사만 제거하면 지연 쓰기로 삭제가 취소되거나 이력이 없어질 수 있다.
- 서버는 `_shared/account-plan-collection-handler.mjs`와 generated validator를 소비한다. 프론트엔드 스키마만 바꾸는 것으로 운영 삭제가 성립하지 않는다.

2026-09-20 추가: 내부 전이 검증 모듈 `supabase/functions/_shared/account-plan-lifecycle.mjs`와 `supabase/tests/account-plan-lifecycle.test.mjs`를 구현하고 18개 검사를 실제 실행했다. 삭제 표식·복구 기한·계정 일치·revision·요청 재사용과 포인터 보존을 검사한다. 실제 DB 트랜잭션이나 서비스 연결 증거는 아니다. 내부 version 1 구조를 공개 wire 규격으로 채택한 것도 아니다. 기존 4개 이슈는 모두 OPEN이다. 자세한 경계와 다음 연결 순서는 [기반 구현 보고서](../../reports/implementation/PLAN_LIFECYCLE_FOUNDATION_2026-09-20.md)에 있다.

## 2. 사용자가 보는 의미

1. 삭제 전에는 계획 이름, 실제 날짜, 삭제 대상이 계획임을 한 번 확인한다.
2. `계획을 지워도 이미 작성한 일지와 경기 기록은 남아요.`를 확인 화면에 표시한다.
3. 서버 응답 전에는 `삭제 요청을 보관했어요. 연결되면 처리해요.` 또는 `삭제를 확인하고 있어요.`라고 표시한다. `삭제 완료`라고 하지 않는다.
4. 확인된 삭제는 현재 계획과 일반 목록에서 제외하고 휴지통에 표시한다.
5. 휴지통 보관 기간은 서버가 삭제를 반영한 시각부터 30일이다. 브라우저 시계를 근거로 영구 삭제하지 않는다.
6. 복구는 보관 목록으로만 한다. 과거 계획을 오늘의 진행 계획으로 자동 재활성화하지 않는다. 다시 수행할 때에는 별도 선택과 기존 안전·유효성 확인이 필요하다.
7. 서버 미적용 또는 구버전 클라이언트에서는 삭제 버튼을 활성화하지 않는다. `현재 계획 보관`을 `삭제`로 이름만 바꾸지 않는다.

## 3. 상태와 동시성

- 원본 계획 ID, 불변 snapshot과 설명·근거 receipt는 유지한다. 삭제 여부는 별도의 버전 있는 lifecycle 정보다.
- 인증된 계정, 계획 ID, 기대 collection revision, operation ID를 한 요청에 묶는다. 다른 계정의 같은 내용 해시는 권한 증거가 아니다.
- 삭제 operation을 멱등 처리하고 서버 삭제 시각·결과 revision을 반환한다. 타임아웃은 실패 확정이 아니라 결과 미확인이다. 같은 operation ID로 결과를 확인한다.
- 삭제와 현재 pointer 해제는 원자적으로 처리한다. 별도 progress 요청이나 구버전 outbox가 삭제된 계획을 재생성하지 못한다.
- 복구는 삭제 상태의 기대 revision을 요구한다. 신규 활성 계획이 있더라도 덮어쓰지 않는다.
- 30일 이후 내용 정리는 서버 작업으로 분리한다. 최소 삭제 표식은 오래된 쓰기 재등장을 막는 별도 수명 정책을 갖는다. 계정 탈퇴와 혼동하지 않는다.
- 복구 대기와 미해결 충돌본을 내용 정리 작업이 지우면 안 된다.

## 4. 호환성과 일지 연결

- 현행 plan V2~V6 payload의 운동 수치·선택 증거·실행 권한은 수정하지 않는다.
- 기존 계정 단일 문서와 collection 저장 모두에서 삭제 표식이 보존되는 명시적 버전 변환을 만든다. 변환 전 원본을 유지한다.
- 일지의 계획 참조는 역사적 참조로 보존한다. 삭제 후 일지 열람이 실패하거나 일지가 함께 지워져서는 안 된다.
- 삭제된 원본에서 다음 계획을 생성하는 동작은 비활성화하되, 이미 만들어진 후속 계획과 그 계보는 지우지 않는다.
- 초안·미전송 작업과 기기 전용 사용자는 계정 삭제 완료와 구분한다. 계정 없는 삭제를 계정 삭제처럼 안내하지 않는다.
- 새 계정 lifecycle을 지원하지 않는 브라우저는 읽기 전용 또는 명시적 업데이트 안내를 적용한다. 데이터 손실을 허용하는 느슨한 파서를 만들지 않는다.

## 5. 구현 순서와 완료 검사

1. 정확한 wire version과 lifecycle shape를 결정하고 client/server validator를 함께 변경한다.
2. 서버 CAS·멱등 receipt·삭제 시각·복구 시각의 원자적 처리를 구현한다. SQL이 필요하면 migration만 작성하며 별도 적용 전에는 공개하지 않는다.
3. 계정 서비스·암호화 outbox·hydrate·history 조회·이전 클라이언트 방어를 구현한다.
4. 삭제 확인·휴지통·복구 UI를 연결하고 원본 일지 보존을 확인한다.
5. 삭제 중 다른 기기의 progress/SELECT, 응답 유실 후 재시도, 계정 전환, 30일 경계, 미래 기기 시각, 삭제된 계획을 포함한 오래된 백업, 복구와 신규 선택의 경합을 결함 주입으로 검사한다.
6. 운영 반영은 오너 개발 완료 확인 후 별도 병합·배포 단계에서 수행한다.

이 목록은 실행 증거가 아니다. 아래 이슈는 코드·테스트·서버 적용 증거 없이 닫지 않는다.

## 6. 미해결 이슈

| ID | 내용 | 상태 | Canonical 차단 |
|---|---|---|---|
| OI-PDR-WIRE-001 | lifecycle wire 및 양쪽 validator 버전 | OPEN | true |
| OI-PDR-SERVER-001 | 서버 시각·CAS·멱등 삭제/복구 처리 | OPEN | true |
| OI-PDR-CLIENT-001 | outbox·조회·휴지통·일지 보존 UI 연결 | OPEN | true |
| OI-PDR-EVIDENCE-001 | 동시성·복구·운영 전환 실행 증거 | OPEN | true |

## 7. 변경 이력

| 버전 | 추가·수정 | 유지·보류 |
|---|---|---|
| 0.2 | 내부 서버 전이 기반과 실행 검사 18개 반영 | 4개 OPEN 유지, wire·실제 저장·UI·운영 적용 보류. 정본 승격 없음 |

[DRAFT_COMPLETE]
