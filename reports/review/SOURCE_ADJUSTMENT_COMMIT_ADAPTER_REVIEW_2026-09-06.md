# SOURCE_ADJUSTMENT_COMMIT_ADAPTER_REVIEW_2026-09-06.md

```yaml
doc_id: source-adjustment-commit-adapter-review-2026-09-06
status: LOCAL_IMPLEMENTATION_REVIEW_COMPLETE_WITH_INTEGRATION_GAPS
independent_review: false
whole_workflow_complete: false
runtime_policy_added: false
canonical_promotion: false
```

## 1. 구현 범위

원본 구성의 정확한 허용 전환을 현재 후보/슬롯/record anchor 문맥으로 투영하고,
기존 조정 controller/host가 사용하는 저장 adapter로 연결한다. 실제 운영 정책을
추가하거나 개인 훈련 수치를 새로 계산하는 변경이 아니다.

| 경계 | 구현 |
|---|---|
| 원본 선택 | 현재 구성에서 직접 연결된 모든 허용 target. 고정 A/B 짝 아님 |
| 전환 방향 | A→B와 B→C만으로 A→C 또는 B→A를 만들지 않음 |
| 개인 문맥 | 같은 종목의 빈 RACE_PACE anchor만 연결. 기존 개인 anchor 재사용 거부 |
| 숫자 | 원본 work/recovery 그대로. 알 수 없는 시간은 null 유지 |
| 설명 | source configuration의 정확한 설명 1개를 resolved configuration에 연결 |
| 적용 | source policy와 resolved receipt를 현재 authority로 다시 확인 |
| 저장 | owner의 실제 CAS/lock에서 재검사. 숫자·설명·receipt를 한 snapshot으로 전달 |
| 재시도 | 기존 controller를 재사용해 동일 intent 한 번 저장 |

## 2. 자체 공격 검수에서 보완한 점

1. 원본 정책에 알 수 없는 필드가 포함될 여지를 없앴다. 추가 메모 필드는
   복사해서 버리는 방식이 아니라 원본 입력 단계에서 거부한다. getter도 실행하지 않는다.
2. source policy가 유효한 것과 현재 계정/안전/후보가 허용된 것은 별개다.
   owner의 `isAllowed`를 필수 입력으로 추가하고 환경 조회와 잠금 내부에서 확인한다.
3. lock 획득 대기 중 만료·철회·revision·허용 상태 변경을 실제 controller와
   합성 CAS로 시험했다. 모두 쓰기 0건, 기존 snapshot 불변이다.

## 3. 실행 증거

- 연결 대상 3파일: 50 PASS, 실패 0.
- 앱 TypeScript: PASS.
- 전체 앱 회귀: 286파일 / 2,518 PASS, 실패 0, exit 0.
- build: PASS. 기존 font runtime-resolution 및 500kB 청크 경고는 남아 있다.
- 후보 revision을 상수로 바꾸는 결함 주입: 재사용/잠금 대기 시험 2 FAIL,
  1 PASS, 23건 필터 제외. 후보 변경 뒤 잘못 적용되는 실제 결함을 검출했다.
  정상 코드로 복원한 뒤 연결 대상 3파일 50 PASS를 다시 확인했다.
- 문서 완료 표식 검사 첫 시도는 metadata의 표식 설명까지 중복으로 세어 실패했다.
  실제 standalone 최종 표식과 후행 비공백 문자를 검사하도록 검사식을 교정했다.

모든 새 조정 구성과 정책은 TEST-only 합성 입력이다. 실제 사용자 데이터나
정확한 신규 훈련 처방을 운영 registry에 넣지 않았다. 브라우저 저장/CAS가 아니라
메모리 CAS 연결 시험이며 기존 host의 DOM 시험을 함께 실행한 범위다.

## 4. 남은 연결과 검수

- 실제 운영 정책 공급자 및 적격한 non-self 전환 등록.
- 실제 후보의 versioned 조정 원본/receipt 저장과 새로고침 복원.
- 숫자 계산 binding과 source anchor binding의 정확한 계획 투영.
- 사용자 조정→선택→저장→수행→일지 비교 종단 시험.
- 별도 코어/과학적 내용 검수와 Fable UX 검수, PR 병합·공개 배포 확인.

이번 산출물은 M08/M09/M10의 연결 진척이며 전체 계획 완료가 아니다.

[DRAFT_COMPLETE]
