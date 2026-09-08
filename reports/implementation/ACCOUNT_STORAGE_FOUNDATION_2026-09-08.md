# ACCOUNT_STORAGE_FOUNDATION_2026-09-08.md

```yaml
doc_id: TRAINORACLE-ACCOUNT-STORAGE-FOUNDATION-20260908
status: LOCAL_FOUNDATION_TESTED_NOT_RELEASED
baseline_commit: 048f267dc62a7fef94394d4cbede7260e3cb2f45
owner: COACH_HOJUNE
production_database_changed: false
production_feature_enabled: false
browser_flow_connected: false
```

## 1. 이번 완료 범위

- 오너 승인 내용을 North Star와 계정 저장 계획에 반영. 기존 local-first 계약은
  역사적 공개 경로로 보존하고 신규 경로와 구분했다. 기존 4개 이슈는 OPEN 유지.
- SQL0033에 기본 OFF인 ACCOUNT_JOURNAL_V2, 본인 문서 읽기, 직접 쓰기 차단,
  서버 버전 비교, operation 재시도 영수증, 충돌 암호문 보존을 구현했다.
- 새 테이블의 계정 삭제 연쇄, JS 안전 정수 범위, 전체 DDL 트랜잭션을 적용했다.
  기존 journal_entries/saved_training_plans 쓰기 동작은 변경하지 않았다.
- AES-GCM 서버 암호화 하위 모듈에 계정·문서·키 버전 결합, UTF-8 원문 보존,
  변조 차단, 키 오류 처리를 구현했다. 배포용 키를 만들거나 읽지 않았다.
- 순수 전송 상태 코어에 불변 요청, 늦은 응답 격리, 초안 변경 보존, 계정 epoch,
  충돌 중 재전송 차단을 구현했다. IndexedDB 및 화면에 연결하지 않았다.

## 2. 실제 검증

Node v24.11.1, 합성 데이터만 사용했다.

| 명령/범위 | 실제 결과 |
|---|---|
| supabase/tests/local-postgres 에서 npm test | 32 PASS / 0 FAIL / 0 SKIP |
| 위 32개 구성 | 새 SQL15 + 새 암호화10 + 기존 V6 DB7 |
| vitest outbox + sync-async-cancellation + plan-cloud-backup | 52 PASS / 0 FAIL |
| 위 52개 구성 | 새 outbox18 + 기존 관련34 |
| app tsc --noEmit | PASS |

전체 앱 테스트·실제 Supabase 로그인·다중 DB 연결·브라우저 시나리오는 이번에
실행하지 않았다. PGlite는 실제 SQL 의미를 시험하지만 Supabase 운영 실측은 아니다.
SQL은 서버 키로 검증된 진짜 암호문인지 확인하지 않으며, 엄격한 envelope 형식만
검사한다. 실제 복호화와 최종 일지 구조 검증은 endpoint 연결 시 필수다.

## 3. 검수에서 발견하여 수정한 것

1. 부모 검토: FK가 계정 삭제를 막지 않도록 cascade와 A/B 보존 테스트 추가.
2. 부모 검토: DB bigint와 JS 숫자 범위 통일, 마지막 버전·소진 테스트 추가.
3. 부모 검토: DDL 전체 트랜잭션과 중간 실패 시 롤백 테스트 추가.
4. 독립 검토: serverRevision 0인데 ACK가 있는 손상 상태가 저장 완료로 표시됨.
   회귀 테스트를 먼저 실행해 17 PASS / 1 FAIL을 확인한 뒤 수정했다.
5. 독립 검토: 선두 U+FEFF가 있는 유효한 글이 거절됨. 회귀 테스트에서
   9 PASS / 1 FAIL을 확인한 뒤 decoder의 ignoreBOM을 수정했다.

두 독립 지적 수정 후 위 최종 32+52 테스트를 다시 실행했다. 이 결과는 일반 글과
비밀 글의 전체 온라인 저장 승인, Fable UX 승인, 과학적 처방 승인이 아니다.

## 4. 다음 작업자가 반드시 이어갈 것

1. 기기 초안과 outbox의 durable 저장을 연결하고 서버 HTTP 인증·암호화·본문
   검증을 구현한다. 랜덤 nonce 때문에 같은 operation 재시도가 실패하지 않도록
   기존 영수증의 본문/기준 버전과 비교한다. 비밀 원문은 로그로 남기지 않는다.
2. 한 편의 일지 작성→서버 확인→새 기기 조회를 먼저 완성한다. 초안 자동 저장과
   명시적 기록 확정은 구분하고, 정상 저장마다 팝업을 띄우지 않는다.
3. 구형 writer의 계정별 원자적 차단, 실제 원본 이전, 잠긴 금고 처리와 복구 UX.
   아직0033은 구형 writer를 차단하지 않는다. 신규 계정 원본으로 전환하지 말 것.
4. 서버 이전 revision·30일 휴지통·삭제 표식, 미해결 충돌본 보관을 구현한다.
   현재 operations는 보존 전략이 완성되지 않았다. 모든 자동 저장을 장기 이력으로
   쌓는 정책으로 확정하지 말 것. 삭제/키 백업 운영 검수 전 기능을 열지 않는다.
5. 현재 계획 포인터·진행 상태·독립 근거 복원, 텍스트 스티커 UUID, 보상 이벤트와
   계정 소비 원자성을 기존 규칙에 맞춰 연결한다. 포인트 규칙 자체는 바꾸지 않는다.
6. 실제 A/B 계정·두 기기·다중 연결 경합·서버/키 복구·Fable UI 검수 후 공개한다.

0032 운영 적용 대기와0033 신규 기반은 별개다. 이번에는 둘 다 운영에 적용하지
않았다. 기존 검수 패킷은 해당 baseline 증거로 남기고 새 소스 변경에 과거 승인을
재사용하지 않는다. 특히 North Star에 바인딩된 훈련 검토 패킷은 최신 소스와
다시 대조해야 하며, 자동 재생성만으로 채택 근거를 승격하지 않는다.

[DRAFT_COMPLETE]
