# OPERATING_APPROVAL_EXECUTION_REGISTER_2026-09-08.md

```yaml
doc_id: trainoracle-operating-approval-execution-2026-09-08
version: "1.0"
status: OWNER_APPROVED_EXECUTION_REGISTER
canonical_promotion: false
runtime_activation_by_this_file: false
```

## 승인 범위

오너 답변: "권장안 모두 승인. 승인 안 모두 해결하고 검토자료 갖추고 와."
[결정 원본](./OWNER_DECISION_AND_OPERATION_READINESS_CHECKPOINT_2026-09-08.md) §3의 A 8개를 적용한다.
방향 승인 완료와 기능 공개 완료를 분리한다. 이후 작업자는 같은 방향을 재질문하지 않는다.

| 번호 | 승인된 방향 | 실행 관문 | 상태 |
|---|---|---|---|
| 1 | 검토 완료 구성부터 순차 공개 | 정확한 채택·현재 head 검사·실화면 | PREPARING_REVIEW_MATERIAL |
| 2 | 유한 조합 묶음 검토 후 확대, 고정 짝 금지 | 전체 주기 배치 검토, 일반 규칙 전환은 별도 검증 | PREPARING_REVIEW_MATERIAL |
| 3 | COROS 최소 활동 읽기 전용 시험 | 공급자 계약 확인·서버 OAuth·사용자 동의·중복/철회/삭제 시험 | PREPARING_EXTERNAL_PILOT |
| 4 | 최소 행동 통계 | 허용 이벤트·전송값·고지·보관·삭제·도구 비용 명시 | CONTRACT_PREPARATION |
| 5 | 포인트 한 잔액·이유별 원장 | 기존 지급 보존·첫 완독 중복 방지·잔액/구매 회귀 | MASTER_PLAN_PATCHED_RUNTIME_PENDING |
| 6 | 본인이 고른 글 링크 공유 후 팔로워 | 공개 필드 허용 목록·취소/삭제·비밀 전환·기존 글 비공개 | RUNTIME_AUDIT_REQUIRED |
| 7 | Google/이메일 안정화 후 카카오, Apple/AthleteTime 준비 | 공급자별 실제 로그인·계정 중복·철회 검증 | RUNTIME_AUDIT_REQUIRED |
| 8 | 비용·상한 항목별 사전 보고 | 현재 요금·예상량·월 상한·초과 차단 근거 제시 | NO_PAID_CONTRACT_AUTHORIZED |

## 실행 경계와 구현 선택

- COROS 사용자 확인은 원본 출처를 바꾸지 않는다. IMPORTED, USER_CONFIRMED, ANALYSIS_ACCEPTED는 서로 다른 의미다. 사용자가 눌렀다는 이유로 직접 입력으로 승격하지 않는다.
- 행동 통계는 이벤트 이름·성공/실패 분류 등 명시한 허용 목록만 전송한다. 메모, 경기 기록, 훈련 수치, 위치, 사용자 입력 문장, DOM·화면 녹화, 원시 오류 문자열은 제외한다. 도구 선정 전 서버 전송을 켜지 않는다.
- 공개 글은 원본 일지 전체를 업로드하는 방식으로 구현하지 않는다. 승인된 공개 필드의 별도 투영과 해제/삭제가 필요하다. 비밀 전환 시 기존 공개물과 파생물 철회를 검사한다.
- 포인트 잔액을 합친다고 무제한 지급하거나 기존 구매 이력을 초기화하지 않는다. 방문/기록/콘텐츠별 중복 키와 원장을 유지한다. 여러 기기에서 같은 완독이 반복되어도 이중 지급하지 않는다.
- 카카오 로그인 제공이 인증 전체 문제를 해결하지 않는다. 기존 계정과 연결은 소유 확인 후 수행하며 같은 이메일이라는 이유만으로 무조건 합치지 않는다.
- 유료 서비스 가입·문자 발송비·SMTP 비용을 이번 방향 승인으로 자동 결제하지 않는다.

## 구체적인 검토 자료 산출물

1. 정확한 훈련 37개 재계수, 도입 순서, 아직 증거가 부족한 구성: `TRAINING_ADOPTION_READY_PACKET_2026-09-08.md`.
2. 계정·서버 저장·COROS 실제 연결 준비와 부족한 외부 시험: `OPERATING_AUTH_SYNC_COROS_READINESS_2026-09-08.md`.
3. PR #317은 별도 작업 폴더/브랜치에서 검사 경로 수리. 원 작업자의 브랜치를 덮어쓰지 않으며 코드 리뷰 후 이관한다.

두 검토 패킷은 실제 생성되었다. 연구 준비도와 외부 실행의 미확인 경계를 담으며,
문서 존재를 훈련 채택 또는 DB/COROS 연결 완료 증거로 사용하지 않는다.

## 발견한 기술 장애

2026-09-08 GitHub run 33838696095의 실패 로그를 직접 조회했다.
PR #317 contract-tests는 `specs/test-packages/validate-decoration-assets.test.mjs`가
`app/public/decorations/open-license-assets.json`을 읽다가 ENOENT로 실패했다.
새 컬렉션 아키텍처에 맞게 경로와 검증을 대조해야 한다. 없는 파일을 건너뛰거나
라이선스·해시 검사를 삭제해 성공시키지 않는다. 실제 원인 수정과 변조 시험이 완료 조건이다.

## 완료 판정

### 이번 실행에서 확인한 결과

- PR #320 head 7fb7dc1: push 34178434298와 PR 34178437346의 contract-tests,
  app-quality, app-browser 모두 성공. PR은 Draft/미병합이며 deploy-pages는 skip.
  아래 후속 로컬 수정의 CI 결과와 혼동하지 않는다.
- 계획 서버 조회: V3가 V6 최신 행을 읽어 실패하는 경우와 V6만 있는 경우를
  새 시험으로 재현했다(수정 전 2 실패/6 성공). V3 조회에 schema_version=3 조건을
  추가한 뒤 계정 백업·V6 조정·콘텐츠·포인트 4파일 89개 시험이 통과했다.
  실제 Supabase DB 왕복이나 V6 복원 진입 UX 전체 완료를 뜻하지 않는다.
- 꾸미기: 별도 수리 작업 폴더의 새 자산 검사와 일지 계약 시험을 부모가 직접
  재실행해 50/50 통과했다. 새 컬렉션의 누락·라이선스·해시·알 수 없는 자산과
  용량 검사를 유지한다. 원격 PR #317의 기존 실패는 수리 반영/재실행 전까지 남는다.
- 검토 수량 정정: 정확한 37개는 MAIN 31개 + BASE 4개 + REC 1개 + OFF 1개다.
  초기 보고의 "MAIN 37개"는 잘못된 통칭이므로 현재 체크포인트에서 수정했다.

각 행은 승인됨→자료 준비→구현→검사→병합→배포→실제 동작 확인을 구분해 갱신한다.
현재 파일은 승인 기록과 실행 범위를 정리한 것이며 운영 준비 전체 완료 보고가 아니다.
전체 검토가 갖춰진 정확한 훈련 채택만 최종 오너에게 제시한다.

[DRAFT_COMPLETE]
