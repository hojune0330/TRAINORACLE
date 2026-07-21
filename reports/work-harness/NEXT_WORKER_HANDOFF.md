# 다음 작업자 인계서

> GitHub 재확인: 2026-07-22 Asia/Seoul
>
> 기준선: `main@1d8fc5382289ce3e2d16ad3b19f7257e1fa858c2`
>
> 사람용 전체 요약: [`../../HANDOFF_NEXT_CHAT.md`](../../HANDOFF_NEXT_CHAT.md)
>
> 수치 근거: [`PROJECT_STATUS_SNAPSHOT_20260722.md`](./PROJECT_STATUS_SNAPSHOT_20260722.md)
>
> 비정본 결정·검토 라우팅 체크리스트(승인·정본·런타임 권한 없음): [`OWNER_DECISION_CHECKLIST_20260722.md`](./OWNER_DECISION_CHECKLIST_20260722.md)

## 현재 작업 권한과 모델 라우팅

- 현재 S1/S2/S3 모두 `NO_READY_TASKS`다.
- 따라서 현재 `next_actor`는 `OWNER | HUMAN_REVIEWER`이며 Terra나 Sol이 막힌 결정을 대신하지 않는다.
- 사람 관문이 닫힌 뒤의 재계산·문서 동기화·승인된 패치는 Terra가 담당한다.
- 안전, 개인정보, 훈련 논리, 권한 경계의 실제 충돌 한 건만 Sol에 넘긴다.
- Sol은 비권위적 검토 권고안만 기록한다. 권한 있는 OWNER 또는 이름 있는 HUMAN_REVIEWER가 명시적으로 수용한 뒤에만 Terra가 허용 경로에 적용하고 결정적 검사를 실행한다.
- 공유 라우팅 스킬은 `codex-skills/terra-sol-router/`에 있다.

Sol·Fable·Codex의 검토는 사람 승인이나 책임자 결정을 대신하지 않는다. 수용 기록에는
결정자 신원과 역할, 적용 범위, source/head SHA, 영구 근거 경로가 있어야 한다.

정상 전환은 `Terra -> Sol -> Terra`지만, 교차 사용 자체가 목적은 아니다. 현재처럼
실행 가능 작업이 0개이면 OWNER/HUMAN_REVIEWER에서 멈추는 것이 정상 동작이다.

## 현재 GitHub 큐

- PR #93: 검토 준비, CI 성공, owner-decision 권한 검증 보강 필요
- PR #97: 책임자 승인 후 병합, merge commit `1d8fc5382289ce3e2d16ad3b19f7257e1fa858c2`
- PR #98: 초안, CI 성공, Terra/Sol 공유 스킬·인계 갱신
- 열린 이슈: 0개
- 열린 PR: #93과 #98, 총 2개

PR의 최신 head SHA는 인계 시점마다 GitHub에서 다시 확인한다. 이 문서의 기준 SHA를
최신 head로 추정하지 않는다.

## 두 컴퓨터·두 모델 인계 캡슐

PR 댓글이나 다음 작업 기록에는 아래 필드를 모두 채운다.

```yaml
objective: one concrete outcome
authority: allowed and forbidden changes
repository: hojune0330/TRAINORACLE
branch: exact branch
base_sha: full commit SHA
head_sha: full pushed commit SHA
changed_paths: exact paths only
verified_evidence: observed commands, CI, or artifact paths
open_decision: one question only
invariants: safety, privacy, compatibility, owner constraints
next_actor: TERRA | SOL | OWNER | HUMAN_REVIEWER
stop_when: exact observable completion condition
```

받는 컴퓨터는 fetch 뒤 `HEAD == head_sha`를 확인하기 전까지 작업하지 않는다. 로컬
미추적 파일과 `codex://` 대화 링크는 공유 상태로 간주하지 않는다.

## 지금 상태

- 작업 목록의 정본은 `TRAINORACLE_WORK_CATALOG.json`이다.
- 3단계 기계 작업은 `gpt-5.6-terra`의 높은 추론으로 실행한다.
- 정본 연구 자료의 기계적 메타데이터 점검은 2026-07-20에 완료됐다. 결과는 `FORMATION_SOURCE_AUDIT_EXECUTION_20260720.md`에 있다.
- 현재 새로 실행할 3단계 작업은 없다. 승인이나 사람 검토가 필요한 일을 임의로 시작하지 않는다.
- PR #95는 병합됐다. WO012 책임자 답변의 기록은 `reports/review/WO012_COACH_DECISION_RESPONSE_TEMPLATE.md`에, 각 답변의 스펙 연결은 `reports/review/WO012_SPEC_LINKAGE_MATRIX.md`에 있다.
- 이 기록은 규칙 채택·정본 패치·과학 또는 개인정보 검토 완료·런타임 권한을 뜻하지 않는다. 빈 답변이나 미확정 사항을 추정으로 채우지 않는다.
- 자동 처방과 런타임 권한은 계속 `false`다.

## WO012 이후의 안전한 범위

- 지금 가능한 다음 산출물은 **이름 있는 관문이 닫힌 뒤의 정본 패치 제안서**뿐이다. 제안서는 검토 대상이며 스스로 정본을 고치지 않는다.
- 직접 `app/`, `impl/`, 런타임 평가기, 스키마, 실제 달력 쓰기, 실제 계획 쓰기, 알림 쓰기, 코치 지시 쓰기, 실제 참가자 파일럿을 시작하면 안 된다.
- `approved_plans: 0`, 엄격 수용 기록, `runtime_authority: false`를 바꾸지 않는다.
- CR-04는 `EXACTLY_TWO_OR_THREE_MAIN_CANDIDATE_VALIDITY_UNCHANGED`다. MAIN 1회·4회는 `NEEDS_REVIEW_WITH_REASON`만 남기며 `selectable_candidate: false`, `automatic_execution: false`다.
- CR-07은 완료 경기 기록 분리·달력 앵커 0·같은 **현지 시민 대회 날짜**의 계획 MAIN `ZERO_OR_ONE`을 유지한다. "정확히 1회"와 별표 표식 의미는 CA-02·CA-03 정식 검토 전까지 미확정이다.
- CR-18은 개인 메모의 존재와 내용 모두를 분석·telemetry·감사·해시·출처·표시에 쓰지 않는다. 원터치 확인도 신호를 만들지 않는다.

## 다음 작업 전에 닫혀야 하는 관문

1. CA-02·CA-03 대회 기록/MAIN 계산의 정식 책임자 결정
2. Order 011 적격 개인정보·청소년 보호 검토
3. 청소년 중거리 스포츠과학 검토
4. D9/RVE 및 D1/D2 어댑터 근거
5. 이름 있는 제품·접근성 검토
6. 별도의 실제 참가자 파일럿 모집 승인

그림자 비교는 기존 `ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`의 범위를 넘지 않는다.
`participant_enrollment: false`, `hidden_shadow: forbidden`을 유지하며 실제 계획·달력·알림·
코치 지시에는 쓰지 않는다.

## 책임자 지침: 거시적 배치 해석

- 프레임 하나의 MAIN 횟수만으로 기계적 적합·부적합을 판정하지 않는다.
- 기본 틀은 프레임당 MAIN 2~3회지만, 판단은 인접한 2~3개 프레임의 배치 흐름으로 한다.
- 집중 경기·훈련 블록, 프레임 경계 이동, 거의 완전 회복 세션 때문에 어떤 프레임이 MAIN 1회 또는 4회가 될 수 있다.
- 이런 예외는 허용 또는 거부를 자동으로 결정하지 않는다. 앞뒤 프레임의 계획·완료 기록과 사유를 함께 확인한다.
- 이 지침은 WO012 CR-04에 대한 책임자 답변의 해석 기준이다. 과학적 확정값, 자동 처방 규칙, 또는 안전 보장은 아니다.

## 반드시 멈추고 넘길 때

다음 하나라도 생기면 상태를 완료로 바꾸지 말고, 근거와 실패 내용을 남겨 다음 작업자에게 넘긴다.

1. 근거 파일의 확인 문구가 목록과 다를 때
2. 허용된 파일 범위를 넘어 수정해야 할 때
3. 코치·과학·개인정보·법률·사람 승인이 필요할 때
4. 정해진 검사 명령이 실패할 때

## 다음으로 열릴 가능성이 큰 일

- 책임자 결정: CA-02·CA-03 정식 결정과 P1 계획 10건의 개별 승인
- 사람 검토: 연구 167편과 보조 자료 18편의 선별, 전문가 6인 검토, 사용자 확인
- 위 관문이 기록된 뒤에만 정본 패치 **제안서**를 만들 수 있다. 비실행형 Plan Generator도 별도 D9/RVE·권한 검토 없이는 시작하지 않는다.

## 시작 전 확인

```bash
node specs/test-packages/reasoning-tier-harness.mjs validate
node specs/test-packages/reasoning-tier-harness.mjs next --stage S3_MECHANICAL_BATCH
node specs/test-packages/validate-wo012-spec-linkage.mjs
node specs/test-packages/validate-formation-spec-reconciliation.mjs
```

두 번째 명령이 `NO_READY_TASKS`를 출력하면 새 일을 만들지 말고, 막힌 결정 또는 사람 검토를 요청한다.
새 연결표 검증이 실패하면 정본·앱·런타임을 건드리지 말고 실패한 행과 관문을 인계한다.
