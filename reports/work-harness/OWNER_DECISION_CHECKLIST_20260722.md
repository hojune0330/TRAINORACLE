# TrainOracle 책임자 결정 체크리스트

```yaml
checklist_date: 2026-07-22 Asia/Seoul
repository: hojune0330/TRAINORACLE
source_main: 1d8fc5382289ce3e2d16ad3b19f7257e1fa858c2
pr_97_merge_commit: 1d8fc5382289ce3e2d16ad3b19f7257e1fa858c2
owner: COACH_HOJUNE
purpose: OWNER_DECISION_INTAKE_AND_ROUTING
canonical_promotion: false
runtime_authority: false
```

## 이 문서를 쓰는 방법

각 항목의 ID와 답만 남기면 된다. 책임자 결정과 전문가 판단을 분리하기 위해 상태를
다섯 종류로 제한한다.

| 상태 | 뜻 |
|---|---|
| `ALREADY_DECIDED` | 기존 책임자 결정에 있으므로 다시 묻지 않는다. |
| `OWNER_CAN_DECIDE_NOW` | 제품 범위와 운영 사실을 책임자가 지금 정할 수 있다. |
| `OWNER_APPOINTS_REVIEWER` | 책임자는 검토자를 지정하지만 결론을 대신 내리지 않는다. |
| `OWNER_DECIDES_AFTER_REVIEW` | 이름 있는 검토와 근거가 끝난 뒤 개별 승인한다. |
| `SEPARATE_ACTIVATION_DECISION` | 계약·테스트·사람 검토 뒤 실행 여부를 별도로 결정한다. |

이 체크리스트의 답변과 “보수적 제품 기본안”은 의료, 법률, 개인정보, 스포츠과학,
통계, 접근성 또는 보안 검토·승인을 대신하지 않는다. `APPROVE`나 기본안 수용은 해당
행의 제품 사실 또는 패치 순서만 기록하며, 적격 검토 완료·정본 승격·런타임·참가자
모집·계정·서버 기능을 승인하거나 자동으로 켜지 않는다.

## 1. 이미 결정된 것: 다시 만들거나 다시 묻지 않음

| ID | 결정 | 현재 근거 |
|---|---|---|
| FIX-01 | 제품 기본 틀은 `9_5_DAY_FORMATION`이다. | `FORMATION_LATEST_OWNER_DECISION_BASELINE.md` |
| FIX-02 | 적격 입력에는 결정적인 기본 계획 1개를 먼저 고르는 방향이다. | 같은 문서 |
| FIX-03 | 적격 후보가 없으면 새 주기를 발명하지 않고 현재 코치 계획을 유지한다. | 같은 문서 |
| FIX-04 | 7일은 필요할 때 보여 주는 달력 범위이며 Formation 기준 틀을 대체하지 않는다. | `FORMATION_READ_NOW_DECIDE_LATER.md` |
| FIX-05 | `PRIVATE_SELF_ONLY` 메모는 존재 여부까지 분석·계획·보상·telemetry에 쓰지 않는다. | 최신 책임자 기준 |
| FIX-06 | 공유의 첫 구현은 메모 기본 제외, 미리보기와 확인을 거친 선택 내보내기·기기 공유다. 앱 안 수신자 계정과 상시 접근은 별도 개인정보 계약 뒤로 미룬다. | 최신 책임자 기준 |
| FIX-07 | 같은 대회일의 실제 경기 기록은 각각 보존하되 계획 MAIN 배치는 최대 1회로 묶는 방향이다. | 최신 책임자 기준, CA-02/03 정식 기록 대기 |
| FIX-08 | 비처방 내부 QA와 실제 선수 파일럿·상용 처방은 서로 다른 단계다. | 최신 책임자 기준 |
| FIX-09 | 이름 있는 관문 전에는 Plan Generator와 Formation 런타임을 켜지 않는다. | `runtime_authority: false` |

PR #93에는 다음 첫 공개 범위가 책임자 답변으로 기록돼 있지만 아직 main에 병합되지 않았다.

| ID | PR #93에 기록된 방향 | 현재 상태 |
|---|---|---|
| P93-01 | 첫 공개 국가는 한국만 포함한다. | `RECORDED_PENDING_MERGE_AND_QUALIFIED_REVIEW` |
| P93-02 | 첫 공개는 로컬 일지만 제공한다. | 같은 상태 |
| P93-03 | 계정, 서버 동기화, 앱 안 수신자 공유는 첫 공개에서 제외한다. | 같은 상태 |
| P93-04 | 만 14세 미만은 로컬 일지만 사용하고 계정·서버 기능은 별도 검토 전 제외한다. | 같은 상태 |

## 2. 책임자가 지금 답할 수 있는 제품 결정

안전한 기본값은 “첫 공개 로컬 일지 범위를 넓히지 않는다”이다. 이 기본안과 아래 답변은
의료, 법률, 개인정보, 스포츠과학, 통계, 접근성 또는 보안 검토·승인을 대신하지 않는다.

| ID | 사용자가 결정할 질문 | 안전한 기본안 | 답변 형식 | 무엇이 열리는가 |
|---|---|---|---|---|
| NOW-01 | 관할 충돌 시 무엇을 기준으로 서비스 범위를 정할까? | 거주지·현재 위치·스토어·계약 주체가 불명확하면 계정 기능 없이 로컬 일지만 유지 | `ACCEPT_SAFE_DEFAULT / REVISE / DEFER` | PF-LA-02 제품 사실 |
| NOW-02 | 한국 첫 공개의 목표 연령 범위는? | 생년월일을 수집하지 않는 로컬 일지. 미성년 계정·서버 기능은 제외 | 연령 범위와 제외 기능을 문장으로 기록 | PF-LA-03 제품 사실, 법률 검토 입력 |
| NOW-03 | 목표 공개일과 법률·근거 동결일은? | 날짜 미정. 적격 검토와 #93 보강 전에는 `UNSCHEDULED` 유지 | 목표일 또는 `UNSCHEDULED` | PF-LA-07, 출시 검토 일정 |
| NOW-04 | 첫 공개 운영 주체는 누구인가? | 법인이 없으면 `PRE_LAUNCH_INDIVIDUAL_OPERATOR_NO_ACCOUNT_PROCESSING`으로 명시 | 법적 이름·국가·연락처 또는 안전 기본값 | PF-CP-01, 적격 검토 입력 |
| NOW-05 | 첫 공개에서 코치·팀·학교가 앱 안 목적·수신자를 결정하는가? | 아니다. 앱 안 공유와 코치 상시 접근은 제외 | `NO_FIRST_LAUNCH / DESCRIBE_MODEL / DEFER` | PF-CP-03, 수신자 경계 |
| NOW-06 | 첫 공개에서 건강·부상·기분·준비도·생체정보를 결합한 추론을 할까? | 하지 않는다. 구조화 일지의 설명적 추세만 유지 | 포함·제외할 추론을 나열 | PF-FI-06, 분석 계약 범위 |
| NOW-07 | 첫 공개에서 웨어러블·위치·음성·이미지·결제·고유식별자를 받을까? | 전부 제외 | 항목별 `IN / OUT / LATER` | PF-FI-07, 공급자·보안 검토 범위 |
| NOW-08 | 30개 코치 사례 답변을 규칙 레지스트리 검토 기준으로 사용할까? | 답변 기록은 유지하되 청소년 스포츠과학·D9/RVE·개인정보 관문 전 정본 적용 금지 | `ACCEPT_AS_REVIEW_INPUT / REVISE / REJECT` | S1 코치 규칙 검토 지속 |

## 3. 책임자가 지정해야 하지만 대신 결론 내릴 수 없는 검토

| ID | 지정할 사람 또는 역할 | 검토 대상 | 현재 수치 | 책임자가 할 일 |
|---|---|---|---:|---|
| APPT-01 | 한국 개인정보·청소년 서비스 법률에 적격한 개인정보/법률 검토자 | WO011 49개 제품 사실, 미성년, 동의, 보관, 삭제, 공유 | reviewer 0명 | 이름·현재 자격 근거·관할·범위·기한·이해충돌 상태 지정 |
| APPT-02 | 청소년 중·장거리 스포츠과학 검토자 | 9.5일 배치, MAIN 간격, 경기·taper·복합 세션과 훈련부하 근거 | NOT_REVIEWED | 이름·현재 자격 근거·검토 패킷·범위 지정 |
| APPT-03 | 청소년 스포츠의학/의료 안전 검토자 | 부상·증상·금기·복귀·중단·의료 의뢰 경계와 D9 한계 | NOT_REVIEWED | APPT-02와 별도로 이름·현재 자격 근거·검토 패킷·범위 지정 |
| APPT-04 | N-of-1/종단 통계 검토자 | 개인별 최소 근거, 측정오차, 결측, 보편 임계값 금지 | NOT_REVIEWED | 이름·현재 자격 근거·검토 패킷 지정 |
| APPT-05 | 사람 연구 선별 담당자 | 정본 후보 167편 + 보조 후보 18편 | 0/167 + 0/18 | 선별자와 acceptance 기록 방식 지정 |
| APPT-06 | 실제 선수·코치 검토자 | Formation 설명, 계획 확인, 실패·보류 상태 | named review 0건 | 선수·코치 각각 이름과 시나리오 지정 |
| APPT-07 | 접근성·보조기술 검토자 | 모바일 9.5일 표시, 상태 설명, 키보드·스크린리더 | named review 0건 | 이름·환경·기기·완료 기준 지정 |
| APPT-08 | 백엔드 구현 책임자 | 버전, 저장, 동기화, 암호화, 삭제, 장애 복구 구현 | implementation decision 없음 | 구현 책임자 이름과 책임 범위 지정 |
| APPT-09 | 독립 보안 검토자 | 위협 모델, 접근통제, 격리, 암호화, 삭제, 복구 및 구현 증거 | NOT_REVIEWED | APPT-08과 독립된 이름·자격·범위·기한·이해충돌 상태 지정 |
| APPT-10 | 독립 파일럿 검토자 | 참여자 설명, 철회, 숨은 shadow 금지, 미성년이면 보호자 확인 | enrollment false | 실제 모집 전 이름·독립성·검토 범위와 보호자 적용 기준 지정 |
| APPT-11 | 파일럿 안전 판정 책임자 | 중단·재개 기준, 안전 판정, 의료 의뢰 경계 | NOT_REVIEWED | APPT-10과 별도로 이름·권한·중단 권한·기록 방식 지정 |
| APPT-12 | `SafetyBlockRef` 상태를 승인할 안전 책임자 | versioned·expiring·target-bound 참조와 ACTIVE/UNKNOWN/STALE fail-closed 상태 | NOT_REVIEWED | 이름·권한·검토 패킷·결정 기록 방식 지정 |
| APPT-13 | Rule owner | D1/D2 normalized ledger 소비와 namespace 불변 계약 | NOT_REVIEWED | 이름·권한·검토 패킷·서면 adapter 결정 지정 |
| APPT-14 | Classifier owner | 원래 label 보존과 adapter lineage 계약 | NOT_REVIEWED | 이름·권한·검토 패킷·서면 adapter 결정 지정 |

Fable, Codex, Terra, Sol의 검토는 위 이름 있는 사람 검토를 대신하지 않는다.

## 4. 이름 있는 검토 뒤 책임자가 개별 승인할 P1 계획 10건

한 번에 전부 승인할 수 없다. 각 행은 선행 검토가 끝난 뒤 `APPROVE / REVISE / REJECT`를
따로 기록한다. 승인은 해당 문서 패치 순서만 허용한다.

| ID | P1 계획 | 책임자가 나중에 결정할 내용 | 먼저 필요한 것 |
|---|---|---|---|
| P1-01 | Coach Ruleset | 규칙 레지스트리와 패치 순서 | FIX-07, NOW-08, 개인정보, 청소년 스포츠과학, D9/RVE |
| P1-02 | Load Components | 단위, 구성요소 배분, 강도 매핑, 충돌 처리 | 스포츠과학, 스포츠의학/의료 안전, 개인정보, 사람 연구 평가 |
| P1-03 | Minimum Evidence | 임계값 또는 근거 부족 시 완전 억제 | N-of-1 통계, 개인정보, 사람 연구 평가 |
| P1-04 | Plan Version Binding | 계획 버전·멱등성·수명주기 계약 | 개인정보, 코치 규칙, 백엔드 구현 책임자, 독립 보안 검토자 |
| P1-05 | Athlete-Visible Pilot | 기간과 운영 규칙 | WO011~013, 선수·독립 검토, 적격 개인정보/법률, 스포츠과학, 스포츠의학/의료 안전, 접근성, 독립 보안 |
| P1-06 | Calendar Schema Binding | DOUBLE/FLEX와 날짜 경계 의미 | P1-04, 코치 규칙, CA-02/03, 실제 대상 |
| P1-07 | Safety And Privacy Binding | D9/RVE·Safety Gate·privacy 연결 순서 | 적격 개인정보/법률, 스포츠의학/의료 안전, SafetyBlockRef 안전 책임자, 독립 보안 검토 |
| P1-08 | Rule/Classifier/Exposure | Rule·Classifier adapter 계약 | P1-01, Rule owner, Classifier owner, FIX-07 |
| P1-09 | Product Projection | 선수 화면 의미와 설명 | 선수·코치·접근성·개인정보·보조기술 검토 |
| P1-10 | Record Governance | 보관·삭제·암호화·수신자 공유 정책 | 적격 개인정보/법률, 독립 보안 검토, 구현 증거, FIX-07 |

현재 값은 `approved_plans: 0`, `accepted_p1_decisions: 0/10`이다.

## 5. 모든 패치와 검토 뒤에도 별도로 필요한 실행 결정

ACT-01~06은 해당 행의 모든 P1 선행조건과 이름 있는 사람의 자격·범위·판단·근거가
기록되기 전에는 승인할 수 없다. D9 `ACTIVE` 또는 `UNKNOWN`은 항상 계획 생성을 차단한다.
D9 `CLEARED`도 다음 관문으로 진행할 수 있다는 뜻일 뿐 의료적 허가, 계획 승인 또는
런타임 권한이 아니다. 별도의 서명된 ACT 결정과 구현 증거가 수용되기 전까지
`PLAN_GENERATOR_STUB`, `runtime_started: false`, `runtime_authority: false`를 유지한다.

| ID | 마지막 결정 | 지금 상태 | 승인해도 자동으로 포함되지 않는 것 |
|---|---|---|---|
| ACT-01 | 비실행형 Plan Generator 수직 슬라이스 제작 | `PLAN_GENERATOR_STUB`, 선행 P1 대기 | 실제 선수 데이터·달력·처방 |
| ACT-02 | 합성·성인 내부 비처방 shadow QA | 방향만 기록, runtime false | 모집 선수·청소년·실제 계획 변경 |
| ACT-03 | 실제 참가자 파일럿 모집 | `participant_enrollment: false` | 상용 출시·자동 처방 |
| ACT-04 | Formation 실제 계획 생성·달력 쓰기 | `runtime_started: false` | 의료적 안전 보장·코치 권한 대체 |
| ACT-05 | 계정·서버 동기화·앱 안 공유 | 첫 공개 제외 | 원문 메모 전송·상시 수신자 접근 |
| ACT-06 | 한국 첫 공개 출시 | `public_launch_authorized: false` | 해외 출시·미성년 계정 기능 |

## 6. 권장 답변 순서

1. NOW-01~08 중 결정할 수 있는 제품 사실을 답한다.
2. APPT-01~14에서 실제 검토자를 지정하거나 `아직 미지정`으로 명시한다.
3. 지정된 검토자가 패킷별 판단을 기록한다.
4. 그 뒤 P1-01~10을 한 건씩 승인·수정·거절한다.
5. Terra가 승인된 패치만 적용하고 결정적 검사를 실행한다.
6. 모든 증거가 모인 뒤 ACT-01부터 별도 승인한다.

빠른 답변 양식:

```yaml
NOW-01: ACCEPT_SAFE_DEFAULT | REVISE: ... | DEFER
NOW-02: target_age_and_exclusions: ...
NOW-03: target_launch_date: UNSCHEDULED | YYYY-MM-DD
NOW-04: operator_fact: ...
NOW-05: NO_FIRST_LAUNCH | DESCRIBE_MODEL: ... | DEFER
NOW-06: excluded_inferences: ...
NOW-07:
  wearable: OUT | IN | LATER
  location: OUT | IN | LATER
  voice: OUT | IN | LATER
  image: OUT | IN | LATER
  payment: OUT | IN | LATER
  unique_id: OUT | IN | LATER
NOW-08: ACCEPT_AS_REVIEW_INPUT | REVISE: ... | REJECT
APPT-01_to_14: reviewer identity/qualification or UNASSIGNED
```

[DRAFT_COMPLETE]
