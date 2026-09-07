# ADJUSTMENT_WORKSPACE_SESSION_REVIEW_2026-09-06.md

```yaml
doc_id: adjustment-workspace-session-review-2026-09-06
status: LOCAL_VERIFIED_WITH_OPEN_INTEGRATION_GAPS
independent_review: false
whole_workflow_complete: false
active_plan_storage_changed: false
new_runtime_policies: 0
```

## 1. 구현

`adjustment-workspace-session.ts`는 명시적으로 연 조정 편집기의 현재 후보 원본과
최신 적용 결과를 버전 1 envelope로 보관한다. 계정마다 현재 탭의 sessionStorage
한 키만 사용한다. 입력 원본은 저장소가 아닌 현재 후보가 제공해야 한다.

| 동작 | 결과 |
|---|---|
| 첫 열기 | 현재 authority/설명과 원본을 대조한 후 임시 baseline 저장 |
| 적용 | 기존 controller + 실제 lock + 단일 키 CAS로 snapshot 저장 |
| 재열기 | 현재 원본/authority로 정확한 replay 재검증 |
| 중복 요청 | 기존 receipt/내용 그대로 반환, 재작성 없음 |
| 다른 후보/계정 | 기존 초안 자동 덮어쓰기/이전 없음 |
| 손상/새 버전/추가 메모 | 사용 거부, 알 수 없는 원문 보존 |
| 취소 | 열린 snapshot과 일치하는 임시 키만 삭제 |
| 전체 데이터 삭제 | 익명 및 계정별 임시 키를 삭제 대상에 포함 |

새 보관 기간·archive 개수·서버 전송·공개 공유는 추가하지 않았다. sessionStorage는
브라우저의 세션 복원으로 남을 수 있으므로 탭 종료 시 반드시 삭제된다고 보장하지 않는다.
현재 owner는 pending apply 한 건을 보존한다. 후보에 수용한 후 명시적으로 정리하고
새 baseline으로 시작해야 하며, 실행 이력/무한 undo 원장으로 사용하지 않는다.

## 2. 공격 검수와 실패 기록

- 저장된 baseline을 신뢰하는 대신 현재 후보가 제공한 baseline과 전체 비교한다.
- 저장된 authority는 받지 않는다. 처음 상태는 현재 catalogue/설명과 대조하고,
  수정 상태는 기존 commit controller의 정확한 replay 경로만 통과시킨다.
- 글로 된 성공 메시지가 아니라 실제 저장 문자열 재조회로 쓰기를 확인한다.
  실패한 쓰기 뒤 원본을 추측해서 rollback하지 않고 handle을 무효화한다.
- 첫 대상 실행은 4 FAIL/37 PASS였다. 시험 helper가 `input` 이름으로 commit
  입력을 open 입력으로 덮어쓴 문제였다. `openInput`으로 분리한 뒤 모두 통과했다.
  조정 적용 양성 검사 없이 후속 손상 검사를 계속하던 시험 구조도 확인했다.

## 3. 직접 실행

- 대상 4파일: 68 PASS. session 계약 18개 포함.
- 앱 TypeScript: PASS.
- build: PASS. 기존 font runtime-resolution/청크 크기 경고 유지.
- 전체 앱: 287파일 / 2,536 PASS, 실패 0, exit 0.
- 저장 버전 검사를 제거한 결함 주입: 해당 반례 1 FAIL, 17건 필터 제외.
  잘못된 버전이 실제로 열리는 결함을 시험이 검출했으며 정상 코드를 복원했다.
- `node scripts/check-adjustment-workspace-browser.mjs`: Chromium 5항목 PASS.
  native Web Locks + sessionStorage 저장, 새로고침/replay, 별도 탭 격리,
  이미 잡힌 잠금의 거부, 명시적 취소를 실행했다. 실제 네트워크 요청은 허용하지
  않고 로컬 시험 URL/번들만 route interception으로 응답했다.

이는 모형 CAS만의 시험은 아니지만 운영 훈련 화면 시험도 아니다. TEST-only
구성으로 저장 모듈을 브라우저에서 실행한 것이며, 새 처방 활성화 증거가 아니다.

## 4. 남은 것

1. 실제 적격 조정 offer가 있는 후보의 편집기 열기/복원/취소 UI 연결.
2. pending apply를 후보에 수용한 뒤 소비·정리하는 경로와 오류 복구.
3. 조정 원본·receipt를 확정 계획에 영속 보존하는 별도 형식과 일지 투영.
4. 실제 운영 policy 및 검토된 구성 수용. source 자체를 현재 승인으로 해석하지 않음.
5. 전체 사용자 여정, 독립 내용/UX 검수, 병합 및 공개 배포.

[DRAFT_COMPLETE]
