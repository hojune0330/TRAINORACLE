# Formation Latest Decision And User Gap Audit V2

```yaml
audit_id: TO-FORMATION-LATEST-GAP-AUDIT-2026-07-17-02
status: SUPPLEMENTAL_RESEARCH_PREPARED_HUMAN_REVIEW_REQUIRED
decision_precedence: LATEST_EXPLICIT_OWNER_DECISION_GOVERNS
product_identity: 9_5_DAY_FORMATION
target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
runtime_authority: false
scientific_superiority: UNKNOWN
scientific_safety_of_whole_architecture: UNKNOWN
```

## 한 줄 판정

최신 선택은 연구 패키지의 제품 방향과 대체로 맞는다. 다만 정본 스펙에는 과거의
`코치만 최종 선택`과 `메모 절대 내보내기 금지`가 남아 있고, 대회 앵커는 날짜 고정과
노출 계산만 자세하며 **대회 전후 훈련을 어떻게 줄이거나 옮기고, 사용자에게 어떤 상태로
설명하는지**가 아직 결정 패킷으로 닫히지 않았다.

## 최신 기준

1. 적격 입력에서는 시스템이 9.5일 기본 계획 하나를 결정적으로 고른다.
2. 코치는 검토·수정·예외 처리와 초기 청소년 실제 실행 확인을 맡는다.
3. 적격 계획을 만들 수 없으면 새 예외 계획이나 다른 주기를 지어내지 않고 현재 코치
   계획을 유지한다.
4. 9.5일, 2-3 MAIN, 약 72시간은 제품 정책값이다. 과학적 최적성·우월성·안전성을
   뜻하지 않는다.
5. 대회는 움직이지 않는 앵커이며 완료된 `COMPETITION` 한 건은 MAIN 노출 한 번으로만
   계산한다.
6. `PRIVATE_SELF_ONLY`는 내용과 메타데이터 모두 분석·계획·보상·telemetry·안전에서
   무신호다. 사용자가 직접 선택한 백업·공유는 별도 파일 이동이다.
7. 경기 자기점검 네 필드는 현재 표시 전용이고, 향후 승인된 분석 계약 뒤 선수 본인의
   분석에 사용할 방향이다.

## 요구사항별 재감사

| 영역 | 현재 판정 | 이미 있는 근거·계약 | 남은 빈틈 |
|---|---|---|---|
| 9.5일 제품 정체성 | `FIXED_PRODUCT_DECISION` | 최신 책임자 기준, protocol, owner brief | 정본의 과거 coach-only 문구 패치 |
| 고정 7일의 한계 | `CONDITIONALLY_SUPPORTED` | `FRV2-CLAIM-A-001` | 주자 직접 비교시험 없음; 7일 자체를 나쁘다고 말할 수 없음 |
| 9일·10일 실제 사용 | `SUPPORTED_FOR_USE_ONLY` | `FRV2-CLAIM-A-002` | 효능·보급률·청소년 직접성 없음 |
| 정확한 9.5일의 우월성 | `UNKNOWN_PROHIBITED_CLAIM` | `FRV2-CLAIM-A-004` | 제품 정체성과 연구 사실을 계속 분리 |
| 72시간 | `TARGET_AND_ELAPSED_ONLY` | `FRV2-CLAIM-B-001/002` | 세션별 지표를 전체 회복·허가로 바꾸지 않기 |
| 복합훈련 | `CONDITIONAL_STRUCTURE_RULE` | `FRV2-CLAIM-C-001..003` | 청소년 중거리의 범용 순서·간격 없음 |
| 대회 앵커 | `PRODUCT_RULE_STRONG; EVIDENCE_PARTIAL` | race fixed, one exposure, no catch-up fixtures, Competition Anchor packet | 다중 bout·priority·taper·대회 후 재배치는 책임자/전문가 검토 전 |
| 부하 구성요소 | `PREPARED_NOT_REVIEWED` | Load Component packet | 책임자·전문가 승인 전 |
| 개인내 최소근거 | `PREPARED_NOT_REVIEWED` | Minimum Evidence packet | 보편 최소 n 없음; 지표별 방법 승인 전 |
| 청소년 전이 | `PARTIAL` | RQ-F/G synthesis | 실제 800/1500 청소년 검토와 선수 이해도 시험 없음 |
| 메모 보안·이동권 | `OWNER_DIRECTION_FIXED` | zero-signal, explicit backup/share | Daily Log 절대 금지와 수신자 공유 정본 부재 |
| 설명·접근성 | `DRAFT_STRONG; HUMAN_EVIDENCE_ABSENT` | 다섯 설명 수준, 320/375px, AT test package | 실제 중학생·코치·NVDA/키보드 검토 0건 |
| 경기 자기점검 분석 | `FUTURE_ANALYSIS_INTENDED` | 최신 기준과 conflict 010 | provenance·결측·방법·불확실성·설명 계약 부재 |

## 새로 확인한 근거 후보

아래 자료는 2026-07-17 보충 검색에서 발견했다. 아직 정본 source ledger의 인간 선별·
이중 추출·평가를 통과하지 않았으므로 **후보**다.

| 후보 | 직접성 | 현재 허용되는 해석 | 금지되는 해석 |
|---|---|---|---|
| [Mujika et al. 2002, PMID 12165889](https://pubmed.ncbi.nlm.nih.gov/12165889/) | 성인 남자 중거리 9명, 6일 taper | 대회 전 훈련 빈도·감량 방식이 결과에 영향을 줄 수 있음 | 6일 또는 특정 감량률의 보편 규칙 |
| [Spilsbury et al. 2015, PMID 25189116](https://pubmed.ncbi.nlm.nih.gov/25189116/) | 엘리트 영국 800/1500 포함 관찰 | taper가 종목과 평소 훈련에 따라 달랐음 | 하나의 taper 기간·비율 자동화 |
| [Yang et al. 2026, PMID 41994354](https://pubmed.ncbi.nlm.nih.gov/41994354/) | 젊은 성인 남자 중거리 33명 crossover | RST와 다른 HIIT의 24-48시간 반응이 달랐음 | 48시간 또는 72시간의 회복 허가 |
| [Oliva-Lozano et al. 2022, PMID 35309541](https://pubmed.ncbi.nlm.nih.gov/35309541/) | 성인 프로 축구 관찰 | 경기 간격이 훈련 배치와 부하를 바꾸는 맥락임 | 8-9일 주기가 5-7일보다 원인적으로 우월함 |
| [Birdsey et al. 2026, PMID 41667403](https://pubmed.ncbi.nlm.nih.gov/41667403/) | 성인 국가급 중거리 12명 | 24시간 뒤 수행 유지와 더 큰 주관적 노력 가능성이 함께 존재 | 수행 유지가 완전 회복·안전 허가라는 주장 |

보충 PubMed 검색은 대회·taper·중거리 직접성 조합 17건, 중거리/장거리 taper 세부 조합
8건, 중거리 HIIT 잔류피로 조합 1건, 800/1500 대회 라운드·연속일 조합 28건을 반환했다.
정확한 식과 선별 결과는 보충 search log에 옮긴 뒤 정본 반영 여부를 결정한다.

## 대회 앵커에서 새로 분리해야 할 결정

### 바로 고정 가능한 구조

- 대회 날짜·시간·시간대·종목·우선순위 출처를 먼저 고정한다.
- 대회는 `COMPETITION`으로 남고 계획·완료 보기에서 각각 한 번만 계산한다.
- 대회와 유연한 MAIN이 충돌하면 대회를 보존한다.
- 놓친 MAIN은 빚이 아니며 대회 뒤에 몰아넣지 않는다.
- 최근 대회와 경과시간은 맥락이지 회복·준비·안전 허가가 아니다.
- 자동 후보가 막히면 현재 코치 계획과 일지는 그대로 유지한다.

### 책임자·코치가 별도로 승인해야 할 것

- 대회를 A/B/C 또는 준비대회/주요대회로 나눌지와 그 의미.
- 한 9.5일 프레임에 대회가 둘 이상일 때 MAIN 목표 수와 지원 세션 처리.
- 종목·시즌·선수별 taper template의 정확한 구성요소·단위·슬롯.
- 대회 취소·연기·시간대 변경 때 어떤 세션을 유지·이동·취소할지.
- 대회 후 첫 MAIN을 제안할 수 있는 입력과 금지 입력.

이 값들은 연구 평균에서 바로 뽑지 않는다. 버전이 있는 코치 template과 테스트로
고정하며, template이 없으면 `NO_AUTOMATED_PLAN -> KEEP_CURRENT_COACH_AUTHORED_PLAN`이다.

## 사용자에게 보여줄 상태 제안

기존 다섯 authority class에는 최신 기본 자동 선택을 정확히 말하는 중간 상태가 없다.
다음 상태를 정본 패치 후보로 둔다.

| 상태 | 쉬운 기본 문구 | 사용자가 할 수 있는 일 |
|---|---|---|
| `SYSTEM_PRIMARY_SELECTED_NOT_EXECUTING` | “TRAINORACLE이 9.5일 기본 계획을 골랐어요. 아직 실행 계획은 아니에요.” | 이유 보기, 자기 기록 정정 요청 |
| `COACH_REVIEW_OR_EDIT` | “코치가 기본 계획을 확인하고 있어요. 지금 계획은 그대로예요.” | 현재 계획 보기 |
| `EXECUTION_CONFIRMED_REAL_PLAN` | “이 계획으로 진행하기로 확인했어요.” | 오늘 할 일과 변경 이력 보기 |
| `NO_AUTOMATED_PLAN_CURRENT_PLAN_PRESERVED` | “자동 계획을 만들지 못했어요. 지금 코치 계획을 그대로 유지해요.” | 부족한 정보와 해결 담당자 보기 |
| `SHADOW_COMPARISON_ONLY` | “비교 연습 중이에요. 실제 훈련에는 적용되지 않아요.” | 일시정지·나가기, 진행 횟수 보기 |

모든 화면은 `누가 선택했는지`, `지금 실행되는지`, `현재 유지되는 계획`, `다음 행동`,
`해결 담당자`를 텍스트로 보여준다. 색·아이콘·스티커만으로 상태를 전달하지 않는다.

## 사용자 관점의 우선 개선

1. 첫 화면은 기본안 하나, 오늘 할 일, 다음 대회, 확인 필요 사항만 보여준다.
2. 9.5일의 마지막 반나절을 실제 시작·종료 시각과 함께 보인다.
3. 대회가 들어오면 “무엇을 지켰고 무엇을 옮겼는지”를 이전 계획과 비교한다.
4. 계획을 만들지 못해도 막다른 화면을 만들지 않고 현재 계획을 먼저 보여준다.
5. 복합훈련은 한 가지 색으로 뭉개지 않고 전체 피로 강도와 펼쳐보는 구성요소를 함께 쓴다.
6. 스티커·체크는 기록, 휴식, 통증·부상 알림을 동등하게 인정하며 훈련량·속도·무통증·
   동의·shadow 참여를 보상하지 않는다.
7. `PRIVATE_SELF_ONLY`는 분석에서 보이지 않지만 사용자가 직접 선택한 백업·공유에서는
   범위를 미리 보고 포함할 수 있다.

## 새 충돌

`FRV2-CONF-011`을 등록했다. Coach Ruleset과 fixture는 taper template 부재, 대회 충돌,
알 수 없는 예외를 `NEEDS_COACH_CLARIFICATION`으로만 끝낸다. 최신 기준에 맞추려면 이유와
결과를 분리해, 자동 후보는 멈추되 현재 코치 계획과 일지는 보존된다고 명시해야 한다.

`FRV2-CONF-012`도 등록했다. 최신 기준의 “완료 `COMPETITION` 기록 1개 = 노출 1회”는
유지하지만, 예선·결승·복수 종목에서 기록 경계가 없다. 앵커 1개와 실제 bout N개 분리는
권고안이며 책임자가 CA-02/03을 결정하기 전에는 정본 counting을 바꾸지 않는다.

## 다음 산출물

1. 보충 검색·후보 원장: 준비 완료, 인간 선별 대기.
2. competition-anchor synthesis와 별도 결정 패킷: 준비 완료, 결정 대기.
3. 대회 앵커·보편 taper/elapsed clearance 금지 claim 후보: 보충 synthesis에 분리 완료.
4. 기본안 선택·실행 확인·현재 계획 보존을 분리하는 정본 patch plan: 충돌 원장에 준비,
   정본 변경은 별도 승인 전 보류.
5. 중학생·코치·보호자·보조기술 사용자 시나리오와 teach-back: 문서 준비 완료,
   실제 참여자 검토 0건.

이 감사는 제품 방향과 누락을 정리한다. 자동 처방 런타임, 실제 shadow 운영, 실제 선수
모집, 의학 판단을 승인하지 않는다.
