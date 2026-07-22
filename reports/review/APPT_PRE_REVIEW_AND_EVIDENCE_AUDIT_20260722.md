# APPT 사전검토 및 기존 증거 감사

```yaml
audit_date: 2026-07-22 Asia/Seoul
repository: hojune0330/TRAINORACLE
service_name: TrainOracle
provisional_service_provider_name: aaclub
legal_service_provider_identity: UNCONFIRMED
source_main: 1d8fc5382289ce3e2d16ad3b19f7257e1fa858c2
source_branch_head_before_edit: b60cbae85e0be3449f44ff03f5b3cffe96ee9136
scope: APPT-01_to_14
named_human_reviews_found: 0
ai_or_automated_work_reusable: true
owner_authorized_agent_pre_review: true
review_packets_assembled: 14/14
human_review_replaced_by_ai: false
canonical_promotion: false
runtime_authority: false
```

## 한 줄 결론

기억하신 대로 스펙, 연구표, 검증기, 페르소나 리뷰, 보안·접근성 준비 문서는 많이
만들어져 있다. 이 자료는 버릴 것이 아니라 검토자에게 줄 **사전 패킷**으로 재사용한다.
하지만 현재 저장소에는 APPT-01~14 중 어느 항목에도 이름, 현재 자격, 이해충돌,
검토 범위, 대상 head SHA와 서명된 판단을 갖춘 실제 사람 검토 기록이 없다.

따라서 올바른 상태는 `PRE_REVIEW_MATERIAL_AVAILABLE / NAMED_HUMAN_REVIEW_PENDING`이다.
Fable, Codex, Terra, Sol, 자동검사와 페르소나 역할극은 사람 검토를 준비하고 오류를 찾을
수 있지만 그 사람의 법률·의료·과학·보안·사용자 판단을 대신하지 않는다.

실제 담당자에게 전달할 역할별 한 장 패킷 14개는
[`appt-packets/README.md`](./appt-packets/README.md)에서 시작한다.

## 실제 파일 대조 결과

- `reports/review/FORMATION_FORMAL_APPROVAL_ROSTER.md`는 모든 검토자 identity를
  `UNASSIGNED`, 응답을 `NOT_REVIEWED`로 기록한다.
- `reports/research/evidence/FORMATION_HUMAN_REVIEW_ATTESTATIONS.csv`는 헤더만 있고
  사람 검토 행이 0개다.
- `reports/review/FORMATION_RESEARCH_REVIEWER_LEDGER.csv`의 6개 역할도 모두
  `UNASSIGNED / NOT_VERIFIED / NOT_REVIEWED`다.
- `reports/review/FORMATION_ACCESSIBILITY_AND_DESIGN_REVIEW.md`는 이름 있는 선수·코치
  피드백과 사람·보조기술 확인이 없다고 명시한다.
- `reports/review/FORMATION_RUNTIME_SECURITY_AND_PRIVACY_AUDIT.md`는 런타임 보안 감사를
  시작하지 않았고 적격 개인정보 검토자가 미지정이라고 명시한다.

이 대조는 문서 제목이나 챕터명을 사람 검토 완료로 세지 않았고, markdown의 `PASS`,
AI 리뷰, 자동검사, 프로토타입 스크린샷도 사람 서명으로 세지 않았다.

## APPT별 재사용 가능 범위

| ID | 이미 있는 재사용 자료 | 에이전트가 지금 맡을 수 있는 일 | 여전히 필요한 실제 사람 기록 |
|---|---|---|---|
| APPT-01 | `PRIVACY_YOUTH_QUALIFIED_REVIEW_PACKET.md`, `WO011_QUALIFIED_PRIVACY_REVIEW_HANDOFF.md`, `FORMATION_PRIVACY_GOVERNANCE_DECISION.md` | 법령·지침 갱신 확인, 데이터 항목표와 질문표 작성 | 한국 개인정보·청소년 서비스 적격 검토자의 관할·자격·범위·판단 |
| APPT-02 | `FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md`, `FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md`, 연구 ledger | 연구 검색, 근거 등급·반례·공백 정리 | 청소년 중·장거리 스포츠과학 검토자의 적용 범위와 판단 |
| APPT-03 | `RULE_SPEC_D1_D9.md`, `RVE_RULE_EVALUATOR_BINDING_SPEC.md`, `PLAN_SAFETY_GATE_SPEC.md` | 가이드라인 검색, red flag·중단·의뢰 질문표 작성 | 청소년 스포츠의학/의료안전 검토자의 현지화된 판단 |
| APPT-04 | `FORMATION_MINIMUM_EVIDENCE_METHODS_REVIEW.md`, `FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md` | 결측·측정오차·N-of-1 가정 감사와 시뮬레이션 | 이름 있는 통계 검토자의 임계값·억제 규칙 판단 |
| APPT-05 | source/screening/appraisal ledger와 검증기 | 중복 제거, 메타데이터 검사, 후보 우선순위 제안 | 사람 선별자의 논문별 포함·제외·추출 수용 기록 |
| APPT-06 | `FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md`, `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md` | 인터뷰 시나리오·질문·관찰표 준비 | 실제 선수와 실제 코치의 이름 있는 사용성 검토 |
| APPT-07 | `FORMATION_ACCESSIBILITY_AND_DESIGN_REVIEW.md`, projection 스크린샷·자동검사 | 자동 접근성·키보드·화면 크기 검사 | 보조기술을 사용한 이름 있는 사람의 확인 |
| APPT-08 | `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md`, `LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md`, `CALENDAR_VERSION_AND_SYNC_CONTRACT.md` | 구현안·마이그레이션·장애 시나리오 작성과 테스트 | 책임 범위를 수락한 백엔드 구현 책임자 |
| APPT-09 | `FORMATION_RUNTIME_SECURITY_AND_PRIVACY_AUDIT.md`, governance fixtures | 위협모델·정적분석·침투시험 계획과 발견 정리 | 구현 책임자와 독립된 보안 검토자의 판단 |
| APPT-10 | `ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`, `WO014_ATHLETE_PARTICIPANT_MATERIALS.md` | 모집·동의·철회·시나리오 패킷 점검 | 실제 모집 전 독립 파일럿 검토자의 승인 또는 수정 요구 |
| APPT-11 | pilot protocol과 D9/Safety Gate 계약 | 중단·재개·에스컬레이션 표의 모순 검사 | 중단 권한을 가진 파일럿 안전 판정 책임자 |
| APPT-12 | `PLAN_SAFETY_GATE_SPEC.md`, `FORMATION_RECORD_GOVERNANCE_CONTRACT.md` | `SafetyBlockRef` 수명·만료·대상·fail-closed 테스트 | 해당 상태에 책임을 지는 이름 있는 안전 책임자 |
| APPT-13 | `RULE_SPEC_D1_D9.md`, rule/classifier target patch plan | namespace·adapter·ledger 연결의 기계 검증 | Rule owner의 서면 adapter 결정 |
| APPT-14 | `SESSION_CLASSIFIER_SPEC.md`, rule/classifier target patch plan | 원래 label·lineage 보존 테스트 | Classifier owner의 서면 adapter 결정 |

## APPT-01~03 에이전트 사전조사 결과

이 절은 2026-07-22에 실행한 Terra 사전조사를 사람이 검토하기 좋은 크기로 줄인 것이다.
법률·의료·스포츠과학 승인이 아니며, 실제 검토자는 원문과 현재 적용 가능성을 다시
확인해야 한다.

### APPT-01: 한국 개인정보·청소년 서비스

확인한 1차 출처:

- [개인정보 보호법 현행본](https://www.law.go.kr/LSW/lsInfoP.do?lsId=011357)
- [개인정보 보호법 제22조의2 아동의 개인정보 보호](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1029334873)
- [개인정보보호위원회 2026 개인정보 처리방침 작성지침 안내](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&mCode=&nttId=12021)

사전 결론은 로컬 일지 공개가 계정·서버·코치 공유보다 노출이 작다는 것이다. 만 14세
미만 동의, 건강·부상 추론의 민감정보 여부, 코치가 제3자인지, 해외 클라우드 이전,
`aaclub`을 임시 서비스 제공자명으로 사용할 때의 표시와 실제 개인정보처리자 법적
정체는 적격 한국 검토자가 결정해야 한다. 서비스명은 `TrainOracle`로 유지한다.

### APPT-02: 청소년 중·장거리 스포츠과학

확인한 주요 근거:

- [Youth running consensus statement](https://bjsm.bmj.com/content/55/6/305)
- [Junior-high 7-day taper study](https://www.jstage.jst.go.jp/article/rjsp/15/0/15_2243/_article/-char/en)
- [Endurance taper meta-analysis](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0282838)
- [Adolescent training-load systematic review](https://doi.org/10.1007/s40279-023-01844-x)

근거는 7일 taper나 9~10일 주기를 모든 선수에게 적용할 보편 안전 규칙으로 승인하지
않는다. 7일과 9~10일은 달력·계획 틀로 사용할 수 있지만, 종목·훈련연령·성숙도·경기
우선순위·현재 부하에 따라 간격과 구성을 개별화해야 한다. 고정 ACWR 구간, 보편 증가율,
보편 48시간 규칙을 안전 임계값으로 만들지 않는다.

### APPT-03: 청소년 스포츠의학·의료안전

확인한 주요 지침:

- [CDC sports-related concussion response](https://www.cdc.gov/heads-up/response/index.html)
- [CDC return-to-sports progression](https://www.cdc.gov/heads-up/guidelines/returning-to-sports.html)
- [IOC youth athlete development consensus](https://bjsm.bmj.com/content/49/13/843)
- [Adolescent load-monitoring systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10356657/)

통증·기분·준비도는 함께 볼 수 있지만 평균 점수로 `SAFE_TO_TRAIN`을 만들지 않는다.
하나의 응급·중단 신호가 긍정적인 기분이나 준비도보다 우선하고, 모호하거나 빠진 값은
`UNKNOWN`으로 남긴다. 앱은 진단, 복귀 허가, 의료적 clearance를 하지 않는다. 한국의
응급·의뢰 경로와 한국어 증상 포착은 별도 현지 전문가 검토가 필요하다.

## 다음 실행 순서

1. APPT-01~14별 기존 자료를 짧은 검토 패킷 14개로 조립했다.
2. 책임자는 각 APPT에 실제 사람을 지정하거나 `UNASSIGNED`를 유지한다.
3. 지정된 사람은 패킷에 신원·자격·관할·범위·이해충돌·대상 head SHA와 판단을 남긴다.
4. 그 결과가 수용된 행만 관련 P1 계획의 책임자 결정으로 이동한다.
5. P1 수용과 구현 증거 뒤에도 ACT-01~06은 별도로 승인한다.

에이전트 사전조사가 끝났다는 이유만으로 APPT 상태, `approved_plans: 0`,
`runtime_started: false`, `participant_enrollment: false`, `runtime_authority: false`를
변경하지 않는다.

[DRAFT_COMPLETE]
