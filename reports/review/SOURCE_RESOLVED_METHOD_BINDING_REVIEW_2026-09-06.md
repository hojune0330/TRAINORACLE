# SOURCE_RESOLVED_METHOD_BINDING_REVIEW_2026-09-06.md

```yaml
doc_id: trainoracle-source-resolved-method-binding-review-2026-09-06
status: IMPLEMENTATION_SELF_REVIEW_VERIFIED_WORKFLOW_INCOMPLETE
base_head: 01f4cae784e4b552049b17f96b6b6e315812ec36
whole_workflow_complete: false
new_template_activations: 0
new_dose_values: 0
new_adjustment_policies: 0
active_plan_storage_changed: false
canonical_promotion: false
```

## 1. 원래 남아 있던 연결 문제

기존 추천 목록은 본운동의 source sequence를 화면 모듈 안에서 만들고 있었다.
저장된 개인 처방의 sequence에는 준비·정리와 개인 anchor 참조가 들어간다.
이 둘을 같은 구성 지문으로 취급하면 선수 기록이 달라질 때 다른 훈련으로
세거나, 개인 값이 source catalogue에 섞이거나, 조정 receipt의 before/after가
서로 다른 표현을 가리킬 수 있다.

이 문제는 2026-09-06 조정 host 자체 리뷰의 후속 1번으로 기록되어 있었다.
이번 변경은 그 구분을 코드로 만들고 기존 추천/후보 생성 경로에 연결한다.

## 2. 구현과 경계

| 구분 | 구현 | 하지 않는 것 |
|---|---|---|
| source definition | 정확한 기존 ref로 공통 본운동 sequence 및 구성 지문 조회 | caller가 새 수치나 source를 승인 목록에 끼워 넣기 |
| 개인 resolution | 저장 스키마 검증 후 원본 구성·개인 처방·anchor·설명 연결 | 거리/시간 환산 또는 새 페이스 공식 생성 |
| 설명 | 버전, 내용 지문, 실제 근거 참조 결속 | 같은 버전이면 내용 변경을 무시하기 |
| 후보 생성 | 연결이 완성될 때만 상세 처방 유지 | 원본/설명이 없는데 숫자만 제공하기 |
| 과거 읽기 | 읽기용 sequence 투영, 입력 불변 | 새 설명/구조를 옛 저장값에 써넣기 |
| 프라이버시 | 로컬 adapter용 데이터, 새 export/서버 필드 없음 | 해시를 익명 공개 허가나 서명으로 해석하기 |

기존 runtime authority와 D9/기록/경험 조건을 대체하지 않는다. source definition은
역사적 구조를 읽는 함수이지 현재 활성화 여부를 결정하는 함수가 아니다.
새 transition provider나 editor 저장 adapter는 아직 이 변경에 포함하지 않는다.

## 3. 공격 검수와 실제 시험

- 대상 3파일 최종 50 PASS: 새 19건 및 기존 상세 후보/추천 목록 회귀.
- 800/1500/3000/5000m의 비정수 경기 기록에서 원본 목표 초를 그대로 보존했다.
- 같은 훈련에 다른 개인 기록을 넣으면 source는 같고 resolved/anchor/binding은 달라진다.
- 설명 버전이 같아도 실제 설명 내용이 바뀌면 지문이 달라진다.
- 반복 수, 회복, 목표 초, source hash를 바꾸고 저장 fingerprint까지 재작성해도 거부한다.
- 메모 추가 필드와 getter 입력은 거부하며 getter를 호출하지 않았다.
- legacy 처방 읽기에서 localStorage 쓰기 0회, 원본 문자열 불변을 확인했다.
- 첫 테스트 실행 1 FAIL은 이미 동결된 sequence 배열에 직접 쓰려던 시험이었다.
  동결 거부와 registry 불변을 명시적으로 검사하도록 고쳤다. 제품 코드의 불변성을
  풀어서 테스트를 통과시키지 않았다.
- 후보 생성의 resolution 검사를 고의로 제거했을 때 missing definition/explanation
  반례 2건이 실제 FAIL했다. 정상 코드로 복원했다.
- 앱 타입 검사와 build PASS. 기존 font/chunk 경고는 유지된다.
- 정상 코드 최종 전체 앱: 285파일 2492 PASS, 실패 0, exit 0.
- 실제 browser: desktop/320px 12 PASS. 800/1500/3000m의 상세 생성·저장·
  새로고침 및 5000m의 공유/A만/B만 target 선택·확인·저장·새로고침을 확인했다.
- app/e2e 타입 검사 PASS. reasoning-tier validator 및 personalized V2 authority
  validator PASS. 기존 네 active template·두 adaptation edge가 유지됨을 확인했다.
- 실제 조정 UI나 신규 방법 제공의 전체 브라우저 시험은 아니다.

추가 자체 검토에서 본운동 총 시간/미계산 사유 검사가 누락됐을 가능성을 살폈다.
`approvalMatchesStoredPrescription`이 원본 notation으로 재계산한 totals 전체를
대조하므로 해당 의심을 뒷받침하지 않는다. 불필요한 스키마 완화나 중복 산술
구현을 추가하지 않았다.

## 4. 장단점과 다음 연결

장점은 추천·조정 준비가 동일한 source를 읽고, 선수별 숫자와 설명이 어떤 원본에서
왔는지 구분된다는 것이다. 새 방법으로 과대 집계하거나 개인 데이터를 공통 정의에
혼합하지 않는다. 기존 저장 형식과 숫자 처방은 바뀌지 않는다.

비용은 후보 생성 때 이미 만든 처방을 한 번 더 검증하는 것이다. 현재 작은 고정
카탈로그 범위에서 중복 해석을 제거한 대신 이 검사를 명시적으로 유지한다.
해시들은 콘텐츠 일관성 수단이지 인증서나 과학 검토 증거가 아니다.

다음에는 실제 허용 source edge에서 개인화된 before/after를 재현하고, 이 binding과
policy/slot/context를 같은 candidate revision에 저장하는 adapter가 필요하다.
현재 하나의 정확한 방법을 두 개로 복제하거나 no-op 전환으로 editor를 노출하지 않는다.
독립 리뷰·정책 수용·전체 여정·병합·배포는 별도 관문이다.

[DRAFT_COMPLETE]
