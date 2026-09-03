# PRESCRIPTION_RELEASE_FOLLOWUP_2026-09-03.md

```yaml
doc_id: trainoracle-prescription-release-followup-20260903
status: VALIDATION_IN_PROGRESS_NOT_DEPLOYED
owner: COACH_HOJUNE
version: "0.1"
baseline_head: 7caaa911e8c2ce54c2896826d95547848b3e83b0
predecessor_pr: 314
implementation_pr: 315
new_numeric_templates: 0
new_calculation_models: 0
canonical_promotion_allowed: false
```

## 1. 승인된 실행 범위

오너는 2026-09-03 미배포 변경 정리, 실패한 브라우저 검사 수정, 순차 검수와
병합/배포, 후속 MAIN 확장 준비의 진행을 승인했다. 기존 청소년·셀프서비스와
추천 페이스 공식 연구/활용 승인을 유지한다. 정확한 두 번째 MAIN 구성의
채택이나 새로운 스포츠과학 검수 완료로 확대하지 않는다.

## 2. 실제 실패와 수정

- GitHub run 33645105776, app-browser job 100299490411의 실패 두 건은
  personalized-auto-prescription의 375px/1440px 시나리오다.
- 현재 빌드에서도 동일한 테스트 이름과 18x18 입력 두 개로 재현했다.
- 기존 검사는 닫힌 details 내부의 네이티브 radio까지 사각형 크기로 세고,
  실제 선택 영역인 연결 label은 측정하지 않았다.
- 실제 표시 여부와 radio/checkbox에 연결된 네이티브 label을 검사한다.
  일반 button의 기준은 그대로 44x44이며, 43px 영역을 반올림하지 않는다.
- 별도 회귀 테스트는 작은/연결되지 않은 입력과 버튼을 검출하고, 닫힌
  details를 열면 작은 버튼이 다시 검사되는지 확인한다.
- 방법 선택 테스트는 radio 자체의 check() 대신 라벨 문장을 클릭하고
  실제 checked 변경을 확인한다. 런타임 터치 크기를 줄이지 않았다.

최초 재현 시 종료된 과거 미리보기 주소에 연결해 실패한 실행은 환경 준비
실패다. 서버를 새로 띄워 HTTP 200 확인 후 재현한 두 실패만 원인 증거로 쓴다.

## 3. 이번 검증 기록

| 검사 | 현재 직접 확인 |
|---|---|
| Node | v24.11.1 |
| 프로덕션 빌드 | PASS, PlanBeta-BHTFrF_y.js |
| 브라우저 타입 검사 | PASS |
| 관련 데스크톱 브라우저 | 10/10 PASS |
| 모바일/320px/줄인 모션 | 진행 중 |
| 전체 앱 UTC/KST 및 출시·기기 계약 | 진행 중 |
| 최신 원격 CI | 커밋·푸시 후 별도 확인 |
| 독립 코드 검수 | 선행 #314 검수 중. Fable 검수로 대체하지 않음 |
| 병합·배포·공개 화면 | 미실행 |

검사 결과와 리뷰는 최종 SHA에 다시 연결한다. 기존 보고서의 테스트 수를
새 실행으로 옮기지 않는다. 기존 폰트 경로의 빌드 경고는 남아 있다.

## 4. 남은 구현과 전달 순서

1. #314 exact head의 CI·검수 확인 후 main에 병합한다.
2. #315 base를 main으로 전환하고 선행 차이가 중복되지 않는지 확인한다.
3. 추천 기준 표시와 검사 수정의 최신 CI/리뷰 후 병합·배포한다.
4. main SHA, 배포 sourceSha, 공개 화면을 각각 확인해야 출시 완료다.
5. 이후 실제 두 번째 MAIN의 정확한 구성·대상·배치 채택, 범용 시퀀스
   저장/실행/백업 연결, 종목·수준 확대와 제한적 주기 반영을 이어간다.

현재 상세 방법은 네 종목 조건에 각 하나이며, 시간/RPE 표현을 두 번째
방법으로 세지 않는다. 미채택 12x400m를 활성화하지 않았다. 추천 시간은
기존 동일 종목 경기 평균 속도 환산이며 고정 회복을 개인 최적값으로 부르지 않는다.

[DRAFT_COMPLETE]
