# V3_SUCCESSOR_SELF_REVIEW_2026-09-07.md

```yaml
doc_id: trainoracle-v3-successor-self-review-2026-09-07
status: SELF_REVIEWED_AWAITING_FULL_CI_AND_BROWSER_REVIEW
independent_review: false
goal_complete: false
operating_activation: false
canonical_promotion: false
```

## 1. 발견과 수정

P1: 원본 archive를 쓴 직후 기준 기록이 사라지거나 검토 기간이 끝나도 active 계획
교체가 진행됐다. 최초 안전/근거 검사만으로는 두 키 쓰기 사이의 변화까지 보장하지 못했다.

- 재현: `app/src/domain/adjusted-plan-successor-v3.contract.test.ts:136`의 record/expiry
  변조가 수정 전 각각 실패했다. 기대 rejected와 달리 실제 saved를 반환했다.
- 수정: `app/src/domain/adjusted-plan-successor-v3.ts:54`의 authorized가 요청/계정,
  새로 읽은 근거의 동일성, 현재 기준 기록, 현재 안전, 정책 유효성을 확인한다.
  같은 파일 71행의 각 쓰기 전후와 최종 확인에 적용했다.
- 재검증: 후속 선택/저장/화면 15 PASS. 실패 후 이전 active bytes와 archive 원상
  복구를 검사한다. 다른 작성자의 변경은 유지하며 복구 불명은 별도 상태다.

## 2. 구현 범위와 증거

- 실제 생성기로 다음 후보를 만들며 합성 독립 검토 근거만 주입한다. 운영 목록은
  변경하지 않았다. 최초 저장 API로 후속 계획을 넣는 우회는 거부한다.
- 다음 주기 2회 전진 후 계보 1→2→3, 이전 원본 두 개 보존, 미기록은 빈 진행 배열,
  AM/PM 유지와 기존 역할/목적 배열 불변을 검사했다.
- 이전/현재 일지 각각의 immutable link로 ARCHIVED/ACTIVE 원본을 조회했다.
- 실제 18개 유효 원본을 만든 뒤 용량 초과 거부와 전체 bytes 보존을 검사했다.
- PlanBeta 화면에서 준비→몸 상태/기준 기록→후보 비교→최종 확인→저장→새 일정
  경로와 중간 취소, 공급자 없음, 다른 작성자의 저장을 검사했다.
- 관련 4파일 55 PASS, 보강 전 전체 316파일 2786 PASS, 보강 후 후속 파일 15 PASS.
  타입 검사 PASS. 보강 후 배포 빌드도 PASS이며 폰트 런타임 경로/큰 청크 경고가 있다.
  실행 단계가 다르므로 위 수치를 단일 최종 전체 검사처럼 합치지 않는다.

## 3. 남은 검수와 한계

1. 새 흐름은 DOM 화면 시험으로 확인했다. 실제 320/375px 브라우저, 200% 글자,
   키보드/스크린리더, 줄인 모션과 스크롤 복귀를 별도 검수해야 한다.
2. 운영 구성 공급자는 아직 없다. 합성 근거 시험을 공개 훈련 채택으로 표시하지 않는다.
   최초 V3 편집 진입, 숫자 조정과 여러 MAIN 독립 선택도 별도 남은 작업이다.
3. localStorage 두 키 쓰기는 DB transaction이 아니다. archive 우선 순서와 확인 실패
   복구를 제공하지만 프로세스 종료/저장장치 손실까지 원자성을 보장하지 않는다.
4. 18개 한도에서 과거 원본을 삭제하지 않는 것은 보존에 유리하지만, 장기 사용자는
   전환이 멈출 수 있다. 서버/장기 원본 정책을 연결하기 전 무제한 사용으로 설명하지 않는다.
5. 새 정책 재검사는 계산 비용을 추가한다. 모바일 실측에서 저장 지연도 확인해야 한다.
6. 최종 CI와 독립 UX 검수 후 PR 병합/배포를 판단한다. 이 자가 검수는 병합 승인이 아니다.

[DRAFT_COMPLETE]
