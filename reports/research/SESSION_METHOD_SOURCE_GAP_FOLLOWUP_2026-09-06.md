# 세션 방법 원문 공백 후속 조사

```yaml
doc_id: trainoracle-session-method-source-gap-followup-2026-09-06
status: BOUNDED_RESEARCH_EVIDENCE_NOT_ADOPTION
access_date: 2026-09-06
timezone: Asia/Seoul
branch_at_start: codex/method-workflow-completion
head_at_inspection: 00aeeb6d509f17062c830ebb7500cc947eacde7f
owned_files: 2
scientific_approvals_created: 0
human_approvals_created: 0
runtime_activations: 0
commit_push_performed: false
all_source_gaps_closed: false
```

## 1. 범위와 결론

[기존 프로토콜 근거](SESSION_METHOD_PROTOCOL_EVIDENCE_2026-09-06.md)의 후속 sidecar다.
[AGENTS](../../AGENTS.md), [North Star](../../PRODUCT_NORTH_STAR.md),
[방법 계약](../../specs/reconstruct/SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md),
[진행표](../implementation/SESSION_METHOD_WORKFLOW_PROGRESS_2026-09-06.md)의 권한 구분을 따른다.
M01~M03의 조사 수행은 승인되어 있다. 전체 기능 승인을 다시 요청하지 않는다.
신규 구성의 적용 판단은 아래 정확한 필드 단위로 남기며 사람 서명은 생성하지 않는다.

- M01: I 세 묶음의 직접 근거를 보강했다. 목표 모델, 종료 경계와 구성별 적용은 미채택이다.
- M02: 12회 웹 예시와 15회 교재 예시를 분리했다. 마지막 roll-on은 누락값이 아니라 명시된 구조다.
- M03: 아래 관련 항목의 공백만 좁혔다. 기존 30행 전체의 접근·대상·회복 검토 완료로 확대하지 않는다.
- 테스트는 출처 전사 fixture의 산술/표현 경계 검증이다. 앱·코어·D9 실행이나 과학적 효과를 검증하지 않는다.

## 2. 실제 접근 기록

아래는 이번 실행의 관측이다. FT-C는 직접 열린 코칭 HTML, FT-R은 출판사 연구 HTML,
PDF-T는 PDF 본문 추출 성공이다. 모두 전문 전체의 독립 심사나 적용 승인이 아니다.
같은 URL도 클라이언트별 접근 결과가 다를 수 있다. 검색 요약만 보고 접근 성공으로 쓰지 않았다.

| 키 | 직접 요청한 1차 URL | 결과 / 위치 |
|---|---|---|
| D1 | [V.O2 Calculator](https://vdoto2.com/calculator/) | FT-C; Interval Pace / Sample Workout, 게시일 미표기 |
| D5 | [How To Effectively Improve Your VO2max](https://news.vdoto2.com/2025/07/how-to-effectively-improve-your-vo2max/) | FT-C; 2025-07-15, 수정표시 07-17; Training Suggestions / Interval to Rest Ratios |
| N1 | [Thompson: How do I use it?](https://www.newintervaltraining.com/how-do-i-use-it.php) | 웹 도구 FT-C; Starting out / Step 4 / less experienced athletes. 별도 PowerShell 요청은 Security Verification 차단; 우회 안 함 |
| N2 | [IAAF Introduction to Coaching](https://indianathletics.in/wp-content/uploads/2021/02/IAAF-Introduction-to-Coaching-1.pdf) | PDF-T, 228쪽; 표제/저작권/저자 및 인쇄 94~96쪽(PDF index 101~103). 인쇄 95/96쪽 screenshot 각각 TimeoutError; 시각 검수 미완 |
| N3 | [IAAF Run! Jump! Throw!](https://indianathletics.in/wp-content/uploads/2021/02/IAAF-Run-Jump-Throw-1.pdf) | 직접 open Internal Error; 이번 본문·쪽·판본 확인 불가. 이전 색인 기록을 이번 성공으로 승격하지 않음 |
| P1 | [Fleckenstein et al., 2025, Frontiers](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1507957/full) | FT-R; Methods 2.1~2.3, Discussion; DOI 10.3389/fspor.2024.1507957 |
| P1-alt | [PMC11743937](https://pmc.ncbi.nlm.nih.gov/articles/PMC11743937/) | browser-check/reCAPTCHA, 본문 접근 불가; P1 출판사 HTML 사용 |
| P2 | [Hov et al., Wiley](https://onlinelibrary.wiley.com/doi/10.1111/sms.14251) | FT-R; Methods 2.1, Table 1, 2.3.2, 2.4~2.4.1; 온라인 2022-11-18, 권호 2023 |
| P2-alt | [PMC10099854](https://pmc.ncbi.nlm.nih.gov/articles/PMC10099854/) | browser-check/reCAPTCHA, 본문 접근 불가; P2 출판사 HTML 사용 |
| W5 | [World Athletics speed training](https://worldathletics.org/personal-best/performance/speed-training-endurance-runners-benefits-limits) | 직접 open Internal Error; GL/LD의 정확한 target·회복 원문 공백을 이번에 닫지 못함 |

N2는 인도육상연맹이 제공하는 IAAF 공식 교재 사본이다. 저자 Peter J L Thompson,
저작권 IAAF 2009를 PDF 텍스트에서 확인했다. World Athletics 서버 원본과의 바이트 동일성은
검증하지 않았다. 교재의 생리 설명은 코칭 설명이며 실험적 검증으로 승격하지 않는다.
N1의 shorthand 다운로드 문구는 보였으나 PDF 링크를 확보하지 못했다. 주소를 추측하지 않았다.

## 3. M01: I의 구조, 목표와 종료 경계

[D1](https://vdoto2.com/calculator/)의 직접 예시는 다음 세 묶음이다. 단위는 초다.

| 연구용 별칭 | reps | workSeconds | betweenRecoverySeconds | recoveryMode | work 합계 | 사이 회복 합계 |
|---|---:|---:|---:|---|---:|---:|
| I-6x2 | 6 | 120 | 60 | JOG | 720 | 300 |
| I-5x3 | 5 | 180 | 120 | JOG | 900 | 480 |
| I-4x4 | 4 | 240 | 180 | JOG | 960 | 540 |

이들은 같은 시간형 방법의 용량 구성이지 세 독립 방법을 증명하지 않는다.
`terminalRecovery=null`은 `NONE`이나 0이 아니다. 사이 회복은 `(N-1)*r`로 계산할 수 있지만,
전체 회복·elapsed는 마지막 회복/정리 정의 없이는 확정하지 않는다. NONE을 별도 채택한다면
work+사이 회복은 각각 1020/1380/1500초이고 준비·정리는 제외된다.

D1의 일반 설명은 3~5분을 이상적으로 기술하면서 2분 예시도 직접 제공한다.
이를 이유로 6x2를 원문 오류로 삭제하지 않는다. I의 산소섭취/심박 비율은 속도 계수가 아니다.
`hard`의 보수적 5K 체감 설명도 현재 5K 평균속도를 I로 바꾸는 등식이 아니다.

[D5](https://news.vdoto2.com/2025/07/how-to-effectively-improve-your-vo2max/)는 같은 세 묶음을
재확인하며 회복을 반복 **사이**로 설명한다. 그 문장은 마지막 회복 존재/부재까지 정하지 않는다.
1~5분 가능/3~5분 이상적, 짧은 반복이라고 더 빠르게 달리지 말라는 설명도 있다.
회복의 가벼운 jog 또는 walk 안내를 D1의 고정 JOG 구성에 자동 덮어쓰지 않는다.
현재 VDOT의 Training 탭으로 I를 정하도록 안내하지만 공개 본문에 수식·계수 버전은 없다.
자동 속도 증가 안내는 TrainOracle의 자동 증량 허가가 아니다.

추가 공백: D5의 주간거리 8% 상한과 예시 30mi/week, 5x800m는 엄밀히 같지 않다.
국제 mile로 30mi=48280.32m, 8%=3862.4256m; 4000m는 약8.285%다.
반올림/운영상 허용오차 설명은 확인되지 않았다. 비율과 예시 중 하나를 조용히 우선하지 않는다.
시간형 I에 거리 상한을 적용하려면 먼저 승인된 I 속도와 주간거리 정의가 필요하다.
실험 표본·세 구성별 종목/경험/주기 배정 규칙은 이 두 코칭 페이지에 없다.

## 4. M02: roll-on 원문과 대상

[N1](https://www.newintervaltraining.com/how-do-i-use-it.php)은 12x400m, 5000m 리듬,
100m roll-on을 제시하고 세트·세션 끝에도 roll-on을 명시한다.
따라서 work=4800m, 사이 roll-on=1100m, terminal roll-on=100m, 총 roll-on=1200m다.
이것은 1200초가 아니다. roll-on은 선수가 조절하는 적극적 달리기이며 고정 JOG 초값이 아니다.
관찰된 100m 시간 예시는 개인별 목표·허용범위·진입조건으로 사용하지 않는다.

저자는 target-time도 가능하다고 쓰지만 체감 리듬을 선호한다. 이를 어떤 현재기록 수치로
고정할지는 별도 모델 결정이다. 5000m 리듬이라는 표시는 5000m 선수 집단의 실험 결과가 아니다.
VO2 동일목적 대체인지, 별도 rhythm/mixed 목적인지 판단은 남는다.

덜 숙련되거나 젊은 선수 도입 예시는 3세트x2회x300m/3000리듬, 매회 뒤100m roll-on,
세트 사이120초 easy다. 2세트x3회로 옮기는 방향은 있지만 그때도120초를 유지한다는
문장은 재명시되지 않는다. E08은 **유지한다는 가정**의 비교이며 자동 progression이 아니다.
두 구조의 work=1800m/roll-on=600m, 세트 사이 easy=240/120초; 순서는 같지 않다.
6회 도입을 12회 구성의 청소년 승인으로 사용하지 않는다. 기존 청소년 정책도 축소하지 않는다.

[N2 인쇄95쪽](https://indianathletics.in/wp-content/uploads/2021/02/IAAF-Introduction-to-Coaching-1.pdf#page=103)은
15x400m/5000리듬/100m roll-on 및 세트형 예시다. 12회의 오기나 대체 출처가 아니다.
인쇄96쪽은 오늘 해당 거리를 달릴 중간 레이스 리듬과 PB/고정 target-time을 구분한다.
이 정의는 현재기록 환산값이 오늘의 체감 리듬과 자동 동일하지 않음을 뒷받침한다.
교재의 경험/발달단계 설명은 숫자 나이 cutoff가 아니다. PDF쪽 이미지 미확인 상태를 보존한다.

## 5. M03: E03/E09/E10의 좁은 근거 경계

[P1 Methods](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1507957/full):
국가 훈련그룹 400/800m 선수12명(남7/여5), 준비기 첫4주다. 검사 vVO2max는 VO2max를
유발하고 최소1분 유지한 최저 속도이며, 5K 기록이나 P2 MAS 회귀와 다르다.
긴 구성의 운동95%/회복50%를 합성5m/s에 곱하면4.75/2.5m/s다.
채혈용30초 수동회복은 Methods의 종료 직후/다음 반복 전 문맥에 있다.
Discussion은 3분 회복 안의30초 passive와2분 active도 기술한다. 따라서 단순히
180초 jog에30초를 더하거나 빼는 확정은 부적절하다. 각 채혈 경계 배치 및 마지막 회복은
여전히 미정이다. E03은 속도만 계산하며 total elapsed는 만들지 않는다.
급성 비교를 5000m 전이·부하 동등성·장기 향상 승인으로 사용하지 않는다.

[P2 Methods 2.4.1](https://onlinelibrary.wiley.com/doi/10.1111/sms.14251):
남성48명 모집, 분석31명(10/12/9), 평균23~24세, 유산소 훈련자이나 전문 달리기 선수가 아니다.
4x4분은 약95% MAS, 각 반복3분 내 HRmax90~95%를 목표로 속도를 조정한다.
MAS는 산소섭취-속도 회귀에서 얻는다. 회복은 HRmax70% 활동3분, 마지막은 같은 강도3분
cooldown으로 명시된다. 운동960초+사이540초+cooldown180초+warmup600초=2280초(38분).
약3도 트레드밀 조건이며 `100*tan(3*pi/180)`은 약5.2408%다. 3%로 라벨만 바꾸면 오류다.
이 단위 환산은 현장 경사 변경 승인이나 VDOT I와 동일 모델임을 뜻하지 않는다.

E10/RE-SUPPORT-05는 과학적 산술이 아닌 **연구 출력의 비승인 경계**다.
REST14분 등 문헌의 휴식 조건을 새 운동·수치 회복·의학적 해제·차단계획 실행 권한으로
변환할 수 없다. 테스트는 합성 ACTIVE/UNKNOWN 상태가 연구 영수증에 그대로 남고
금지 필드가 추가된 영수증을 거부하는지만 검사한다. North Star와
[D9 문서](../../specs/active/RULE_SPEC_D1_D9.md)의 실제 실행을 대체하지 않는다.

## 6. 정확한 결정 대안 패킷

아래 경로는 **검토 의미 필드**이며 새 앱 schema/ID/allowlist 선언이 아니다.
모든 행은 `decision=null, reviewer=null, reviewedAt=null, runtimeAllowed=false`로 남는다.
선택되어도 해당 구성의 완전한 검토·채택 기록과 후속 구현 검증 전에는 실행되지 않는다.

| 담당 / 결정 | 대안과 정확한 필드 | 필요한 완료 증거 |
|---|---|---|
| 오너+모델 검토자 / I 입력 | A `target.kind=VDOT_I`, `target.modelRef/version`, `anchor.kind=CURRENT_RESULT`, `anchor.event/distanceM/timeSeconds/date`, `output.unit=secondsPerKm`; B 코치 검토 I값을 provenance와 함께 명시 입력; C 숫자 목표 잠금 유지 | A 수식/계수/버전·단위·유효범위·기록 유효기간·반올림 정책 및 독립 숫자 대조. B 값·단위·출처·검토자·유효기간. current 5K를 단순 relabel 불가 |
| 코치+오너 / I 종료 | A `terminalRecovery.kind=NONE`, `cooldown.ref` 별도; B `terminalRecovery.kind=JOG`, `seconds`를 고른 묶음의60/120/180으로 명시; C `terminalRecovery=null` 유지 | A/B 모두 원문 확정이 아닌 운영 선택임을 기록. warmup/cooldown 경계·완전한 ordered sequence·구성 버전에 결속 |
| 종목코치+과학 검토자 / 적용 | 각 I 구성에 A `applicability.event=5000`, `purpose=VO2` 적합성 검토; B 3000 범위 별도 검토; C 부적합/보류 | `experienceCriteria`, `trainingPhase`, `recentStructuredTrainingCriteria`, `exclusionCriteria`, `reviewer/qualification/date/rationale`. 5000 결정 복사로3000/청소년 용량을 승인하지 않음 |
| 오너+코치 / 유한 구성 | `preset.bundle`을 I 표의 정확한 한 묶음 또는 명시 subset으로 선택; `defaultPreset=null` 또는 그 subset의 하나를 별도 결정; `adjustment.mode=LOCKED` 또는 `WHOLE_PRESET_ONLY` 검토 | 세 축 곱집합/독립 slider 금지. `weeklyVolume.ruleRef/measurementWindow/distanceBasis/tolerance` 결정 시 D5 비율/예시 불일치 해소. 미해소면 이 원문으로 적격 판정하지 않음 |
| 과학 검토자+종목코치 / NIT 목적 | A `purpose=VO2` 호환성을 별도 입증; B `purpose=RHYTHM_MIXED` 별도 범위로 검토; C 목적 보류 | 해당 목적·대상·한계·근거를 구성 fingerprint에 결속. 명칭 또는 동일거리만으로 VO2 대체 승인 불가 |
| 오너+코치 / NIT 목표 | A `target.kind=PERCEIVED_EVENT_RHYTHM`, `event=5000`, `numericTarget=null`; B `target.kind=CURRENT_SAME_EVENT_REFERENCE`, 기록/모델/표시 의미를 별도 채택; C 숫자 방식만 보류 | B를 N1/N2의 오늘 리듬과 동일한 측정값으로 소개하지 않음. 두 대안 모두 `recovery.kind=ROLL_ON`, `distanceM=100`, `terminal=ROLL_ON_100M` 보존 |
| 코치 / NIT grouping | A 3x2만 검토; B 2x3도 `betweenSet.seconds=120`, `assumptionRef=E08_CARRY_120`로 별도 검토; C 2x3의 회복을 미정 유지 | `sets/repsPerSet/workM/rollOnM/afterEveryRep`, `betweenSet.mode=EASY_RUN`, `transitionCriteria`, `stopCriteria`, `terminalEasyRun`의 명시 결정. 자동 진행·관찰시간의 고정 cutoff 금지 |
| 실험 검토자+코치 / P1 경계 | A 원 실험의 채혈 전후 sequence를 확인; B 채혈 없는 별도 현장변형으로 검토; C 계산 전사만 유지 | `samplingSegments[].position/seconds`, `nominalRecovery.includesSampling`, `activeRecoverySeconds`, `terminalRecovery`를 명시. B는 원 실험 그대로라는 표시 금지 |
| 지원정책 책임자 / E10 | A `support.kind=REST_STATE`; B `support.kind=HOLD_FOR_REVIEW`; C 걷기/운동은 별도 지원 프로토콜로 보류 | A/B `exercise=null`, `numericRecovery=null`, `safetyStatus` 보존. 실제해제는 기존 권한 경로만; 문헌/이 테스트로 해제 불가 |

## 7. 실행 가능한 연구 fixture

다음 JSON은 위 전사의 테스트 입력이다. sourceRef는 근거 연결이지 승인 토큰이 아니다.
가정값은 명시하며 실제 선수 데이터·운영 기본값이 아니다.

```json
{
  "E03": {"sourceRef":"P1","anchor":{"kind":"MEASURED_VVO2MAX","unit":"m/s","value":5},"workFraction":0.95,"recoveryFraction":0.5},
  "E08": {"sourceRef":"N1","workM":300,"rollOnM":100,"groupings":[[3,2],[2,3]],"assumedBetweenSetSeconds":120,"assumptionRef":"E08_CARRY_120"},
  "E09": {"sourceRef":"P2","incline":{"value":3,"unit":"degree"},"reps":4,"workSeconds":240,"betweenSeconds":180,"cooldownSeconds":180,"warmupSeconds":600},
  "E10": {"supportRef":"RE-SUPPORT-05","safetyStates":["ACTIVE","UNKNOWN"],"context":{"role":"RESEARCH_ONLY","sourceRef":"REST14_CONTEXT_NOT_AUTHORITY"}}
}
```

실행: `node --test specs/test-packages/session-method-source-arithmetic.test.mjs`

E03은 잘못된 anchor 모델/단위와 숫자 입력을 거부하며 합성 속도 변경을 검증한다.
E08은 실제 ordered segment를 만들어 합산하고 세트말/마지막 roll-on을 검사한다.
E09는 각도 단위를 변환하고 반복 사이와 마지막 cooldown을 다른 role로 유지한다.
E10은 출력 경계 검증기이므로 실제 안전 게이트 통과를 주장할 수 없다.
상수끼리 같다고 비교하는 테스트나 임의 `eligible=true` 함수를 앱 증거로 사용하지 않는다.

## 8. 검증 기록

작성 전 두 소유 경로는 모두 존재하지 않았고 대상 저장소 status는 clean이었다.
상위 폴더의 별도 Git 상태는 작업 저장소 증거에서 제외했다. 노드 실행기: v24.11.1.
앱/코어 suite와 브라우저는 이 연구 범위에서 실행하지 않았다.

- 최종 `node --test specs/test-packages/session-method-source-arithmetic.test.mjs`: exit 0,
  6 tests / 6 PASS / 0 FAIL / 0 skipped. 기본 연구검사5개와 결함주입 harness1개다.
- 의도적 결함5종 `E03_FACTOR`, `E08_TERMINAL`, `E09_DEGREES`, `E09_COOLDOWN`,
  `E10_AUTHORITY` 모두 하위 실행 exit 1이며 각각 대응하는 **테스트 이름**의 TAP 실패를 확인했다.
  앱 코드를 변이하지 않고 연구 helper의 하위 프로세스 환경만 바꾸었다.
- 최초 실행은 기본5개 PASS, harness FAIL이었다. 부모의 `NODE_TEST_CONTEXT` 상속 때문에
  하위 test runner가 독립 실행되지 않았다. 자식 환경에서 이 항목만 제외한 뒤 재실행했다.
  실패했던 최초 실행을 전체 PASS로 표시하지 않는다.
- 별도 Node 검산: 30mi=48280.32m, 8%=3862.4256m, 4000m 비중=8.284949229831119%.
- 로컬 상대 링크6개 모두 존재, 두 소유 파일의 trailing whitespace 없음, 마지막 표식 확인.
- 작업 도중 다른 담당자의 앱 파일·방법 계약 수정/신규 파일이 나타났다. 해당 파일은 소유하지
  않으며 수정/복원하지 않았다. 전체 dirty diff를 본 작업의 산출물로 주장하지 않는다.
- 공개 원문 읽기와 두 신규 파일 작성만 수행했다. 로그인/보안검증 우회, 선수 데이터 접근,
  외부 게시, 승인 레코드 생성, git add/commit/push는 하지 않았다.

완료는 이 bounded sidecar 조사와 연구 테스트에 한정한다. M01~M03 전체 완료,
신규 구성 채택, 과학 검토 승인 또는 제품 배포를 뜻하지 않는다.

[DRAFT_COMPLETE]
