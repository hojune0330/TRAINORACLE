# ADJUSTED_METHOD_TARGET_RESOLUTION_REVIEW_2026-09-06.md

```yaml
doc_id: adjusted-method-target-resolution-review-2026-09-06
status: LOCAL_VERIFIED_WITH_ACTIVE_SCHEMA_GAP
independent_review: false
whole_workflow_complete: false
new_operating_doses: 0
active_plan_schema_changed: false
```

## 1. 확인한 저장 형식의 간격

현행 `PACE_TARGET`은 동일 거리·반복·세트의 flat 필드와 정확한 승인 manifest를
함께 검사한다. 다른 거리/시간이 섞인 조정안을 이 형식에 그대로 저장하면 원본
manifest·회복·설명이 어긋난다. 기존 검사를 느슨하게 만들지 않고 별도 candidate
projection으로 조정된 구간의 숫자를 계산하는 연결을 구현했다.

## 2. 실제 구현

- 기존 개인 처방을 현재 스키마와 source/resolved binding으로 먼저 검증한다.
- 현재 source policy와 조정 receipt를 재검증하고 원본 구성이 일치해야 한다.
- 개인 기록 ID뿐 아니라 전체 anchor 내용의 지문을 source offer 문맥에 추가했다.
  같은 ID의 기록 수정도 구별한다. 새 target resolver가 실제 원본 anchor로
  지문을 다시 계산해 대조한다.
- 동일 종목 현재 경기 페이스만 `기록 초 × 구간 거리 ÷ 경기 거리`로 계산한다.
  소수 초 원본을 반올림하지 않는다. 시간형은 명시된 운동시간만 유지하며
  이동 거리를 만들지 않는다. effort/sprint target에는 경기 페이스를 대입하지 않는다.
- 본운동의 group·거리/시간·반복·회복 구조를 유지한다. 준비·정리는 기존 원본
  그대로이며 새 component를 끼우려는 입력은 별도 권한 필요 상태로 거부한다.
- 결과는 `CANDIDATE_PROJECTION_ONLY`. 기존 active plan schema에 넣지 않는다.
  바뀐 구성에는 그 구성의 설명이 필요함을 타입/내용에 표시하고 기존 설명을
  사실처럼 재사용하지 않는다. structural totals와 실제 수행/시간 추정은 구분한다.

## 3. 검수

- 대상 3파일 57 PASS. 4종목 소수 초, 시간형, nested mixed, 거리 회복,
  다른 record ID/event/content fingerprint, 만료, receipt 변조, component 변경,
  추가 memo getter를 포함한다.
- 최초 TypeScript/build는 시험 helper가 default 5000m case literal로 좁게
  추론되어 다른 종목을 거부했다. 전체 case union을 명시해 수정했다.
- 전체 앱 288파일 / 2,549 PASS, 실패 0. TypeScript 및 build PASS.
  기존 font runtime-resolution/청크 경고는 유지한다.
- anchor content fingerprint를 resolved context에서 제거한 결함 주입은
  동일 ID/변경 내용 반례에서 1 FAIL(2 PASS, 24건 필터 제외)로 검출되었다.
  정상 코드로 복원했다.
- Chromium 기존 임시 조정 저장/복원/별도 탭/잠금/취소 5항목 재실행 PASS.
  새 구간별 숫자의 운영 화면 검증을 뜻하지 않는다.

새 workout 숫자는 TEST-only 합성 입력이다. 이 결과는 새로운 운영 구성 채택이나
개인에게 그 훈련량을 권하는 과학적 근거가 아니다. formula는 기존 동일종목 RP의
산술을 새 구조에 연결한 것이며 새 I/역치/교차종목 모델을 만들지 않았다.

## 4. 남은 실제 연결

1. 해당 조정 구성의 검토된 설명·근거와 실제 운영 정책 수용.
2. candidate-only projection을 소비하는 별도 typed prescription 저장 형식.
3. 후보 화면의 적용/취소/재개와 전체 후보 재검증.
4. 확정 계획·다음 주기·일지 원본 조회가 새 형식을 함께 읽는 전환.
5. 독립 내용/UX 검수, 병합·공개 배포 및 화면 확인.

[DRAFT_COMPLETE]
