# MAIN_METHOD_SELECTION_AND_DISTANCE_RECOVERY_2026-09-02.md

```yaml
doc_id: trainoracle-main-method-selection-and-distance-recovery-2026-09-02
status: IMPLEMENTED_AND_CODE_REVIEWED_NOT_DEPLOYED
owner: COACH_HOJUNE
base_sha: ed9f63cbe97c0097c5ae052ad6433169edd239eb
branch: codex/prescription-rationale-integration
pull_request: 315
predecessor_pull_request: 314
new_numeric_template_activations: 0
new_scientific_or_owner_dose_approval: false
production_deployed: false
```

## 1. 사용자가 달라지는 점

- 계획 후보 화면의 `훈련 방법 선택`에서 질문을 처음부터 반복하지 않고 안내 방식을 바꾼다.
- 종목·목적·경험·가능일·주기·오전/오후와 시작 날짜는 유지한다.
- 상세 방법으로 바꾸면 이전에 고른 경기 기록은 화면에 남지만, 다시 확인하기 전에는 그 기록의 페이스를 적용하거나 상세 계획을 저장하지 않는다.
- 저장이 기다리는 동안 방법·기록·날짜를 바꾸거나 화면을 떠나면 이전 선택이 나중에 저장되지 않는다. 저장 재시도에도 같은 원칙을 적용한다.
- 회복을 거리로 지정한 구조는 `100m` 그대로 보여준다. 초로 바꾸거나 경기 페이스로 회복 시간을 추정하지 않는다.

**두 개의 새 상세 MAIN이 활성화된 것은 아니다.** 현재 정확한 수치 채택본은
기존 800/1500/3000/5000m의 네 템플릿이며, 각 조건의 상세 방법은 한 개다.
시간·RPE 기준은 두 번째 상세 방법으로 세지 않는다. 미채택 자료를 몰래 후보로 넣지 않았다.

## 2. 스펙과 코어

[처방 계약 §12.2~12.3](../../specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md)에
명시적 방법 변경, 재확인, 저장 직전 revision 검사, 거리 회복과 종료 회복을 추가했다.
기존 정본 지위·이슈 상태·숫자 채택 권한은 바꾸지 않았다.

`sequence` v2는 거리 회복과 명시적 `terminalRecovery`를 받는다. 반복 사이 N-1번과
마지막 본운동 뒤 1번은 별도 항목이다. 거리·시간 혼용 시 미지정 합계는 `null`이며
본운동 거리와 회복 거리를 분리한다. 거리 단위·양·방식도 방법 비교에 반영한다.
v1 직렬화와 합계 객체 모양은 유지한다. **이 구조를 선수용 저장 스키마에서 새 수치
처방으로 활성화하는 작업은 별도이며, 이번에는 표현·검증·표시까지 구현했다.**

## 3. 조사로 확인한 중요한 차이

[두 번째 방법 검토 패킷](../review/SECOND_MAIN_METHOD_SOURCE_REVIEW_PACKET_2026-09-02.md)에
저자 원문, IAAF 검색 추출, 현행 5×1000m 비교를 분리했다. 원문의 12×400m 사례는
마지막에도 회복 달리기를 하므로 반복 사이 11번만 계산하면 원래 구성을 놓친다.
또한 원문이 권하는 당일 경기 리듬을 PB 숫자 처방과 동일시하면 안 된다.

15×400m 코어 시험의 1400m는 `terminalRecovery: NOT_APPLICABLE`을 명시한 합성 입력의
계산값이다. 원문의 전체 회복량을 확정한 증거가 아니다. 12회·15회 출처를 합쳐
새 표준 용량을 만들지 않는다. IAAF 해당 쪽의 시각 검수와 과학적 전이 검토는 미완이다.

## 4. 공격적 리뷰와 반영

| 확인 | 처리 |
|---|---|
| 후보의 긴 JSON 식별자가 HTML 접근성 ID로 사용됨 | `useId` 화면 식별자로 분리. 저장 식별자·내용은 유지 |
| 신규 선택 패널의 존재하지 않는 sr-only 클래스 | 실제 화면에서 발견, scoped 숨김 스타일과 브라우저 높이 검사 추가 |
| `1000m 5회 · 총 5회` 중복 | 한 세트는 한 번만 표기. 여러 세트는 총합 유지 |
| 독립 리뷰가 지적한 unmount·재시도 검증 공백 | 화면 이탈·저장 실패 후 재시도 중 날짜 변경 시험 추가 |
| 재확인 우회 변조가 기존 시험을 통과 | 비활성 카드가 숫자를 숨겨 검사가 놓친 경우. 상단의 '확인한 기록으로 계산' 주장도 없어야 한다는 단언을 추가. 정상 구현을 바꿔 통과시킨 것이 아님 |

별도 코드 리뷰어는 지정 diff에서 재현 가능한 P1/P2를 찾지 못했다. 부모 테스트를
독립 실행으로 재합산하지 않았다. 리뷰어가 보고한 임의 생성 v1 500사례 비교와 v2
500사례 독립 전개 계산은 보조 검토이며, 아래 저장된 자동 시험 증거와 구분한다.
이 결과는 Fable UX 검수, 사람 과학 검수, 새 용량 채택 승인을 대신하지 않는다.

잔여 검증 범위: 실제 AppShell 로그인 계정 전환, 실제 두 브라우저 탭의 동시 변경,
iPhone Safari 실기기 제스처는 이번 신규 브라우저 시험에 포함하지 않았다.
기존 계정 범위 검사와 저장 상태 검사는 삭제하지 않았다.

## 5. 실행 증거

Node 24.11.1에서 직접 실행했다. 이 표는 GitHub CI나 공개 배포 완료를 뜻하지 않는다.

| 실행 | 관측 결과 |
|---|---|
| 최종 앱 전체 UTC | 251파일, 2086/2086 PASS |
| KST | 초기 전체 2084/2084 PASS. 이후 추가된 2개와 문구 변경 관련 4파일 36/36 재실행 PASS. 중복 실행을 더해 새 전체 건수로 보고하지 않음 |
| 최종 impl 전체 | 743/743 PASS. sequence v1/v2 110개 포함 |
| D9 평가기 | 11/11 PASS |
| 출시 환경·기기 계약 | 21/21 PASS |
| 현재 처방 권한 검사 | 활성 템플릿 4개 유지, PASS |
| 앱·impl·e2e 타입 검사 | PASS |
| 프로덕션 빌드 | PASS. PlanBeta-BiFe3F-M.js / index-DHIW--JM.js |
| 실제 브라우저 | 12/12 PASS: 방법 변경·재확인·저장·재로드, 현재/과거 설명 화면. 데스크톱·375px·320px·모션 감소, 200% 글자·키보드·44px 선택 영역 포함 |
| 결함 주입 | 20/20 차단. 지정한 테스트 실패를 확인했으며 원본 SHA-256 복구 일치 |
| 문서·diff | 파일 제목, 독립 최종 표식 1개, 후행 텍스트 없음, diff check PASS |

원본 JSON 3개는 [자동 시험 결과 묶음](evidence/prescription-method-selection-2026-09-02/test-results.zip)에
보존했다. 압축파일을 다시 읽어 2086/36/743 PASS를 대조했다.
[결함 주입 원본](EXPLANATION_METHOD_SELECTION_MUTATION_EVIDENCE_2026-09-02.json)은
각 변조, 실제 실패한 검사명, 원본 소스 SHA를 포함한다. 처음 재확인 우회 변조가
통과했을 때는 성공으로 처리하지 않고 검사 공백을 고친 뒤 20개를 전부 재실행했다.

마지막 전체 검사에서 단일 세트 요약의 중복 제거를 반영하지 않은 intake 문구 단언 1개가
실패했다. 기대 문구를 실제 승인한 간결한 표현에 맞추고 전체 2086개를 다시 통과했다.
의도적 ErrorBoundary 오류 로그는 테스트 실패 건수와 구분했다.

impl 의존성 부재는 lockfile 그대로 `npm ci --ignore-scripts`하여 해결했고 패키지 파일을
바꾸지 않았다. D9는 해당 폴더의 vitest 부재로 첫 `npm test`가 실패하여, 설치된
app의 동일 Vitest 4.1.10을 명시 실행해 11개 통과했다. 빌드의 폰트 경로 경고는 남지만,
실제 Pretendard 파일 2057688 bytes와 로컬 HTTP 200을 별도 확인했다.

재실행 명령:

```text
app: npm run test:unit
app: npm run test:unit:kst
app: npm run typecheck && npm run typecheck:e2e && npm run build
impl: npm run typecheck && npm test
app: npx playwright test e2e/plan-method-switch.spec.ts e2e/session-explanation.spec.ts --workers=1
app: node scripts/verify-explanation-mutations.mjs <new-evidence-file.json>
```

결함 주입은 소스를 일시 변경하므로 다른 편집·테스트·검수와 동시에 실행하지 않는다.

화면을 직접 열어 확인했다: [375px 기본](evidence/prescription-method-selection-2026-09-02/method-picker-375px.png),
[320px·글자 200%](evidence/prescription-method-selection-2026-09-02/method-picker-320px-200pct.png).
확대 화면에서 세로 스크롤은 허용하며 텍스트를 작게 줄여 한 화면에 억지로 넣지 않는다.

## 6. 다음 작업과 병합 순서

1. #314를 먼저 검수·main 병합한다. #315는 그 뒤 main을 대상으로 재지정하고 최신 CI를 확인한다. #315를 선행 작업 브랜치에 병합하지 않는다.
2. 현재 네 템플릿의 설명·선택 변경을 검수한 뒤 배포한다. 본 보고서는 공개 배포 증거가 아니다.
3. 두 번째 실제 방법의 목적 분류·대상·기준 페이스·정확한 운동/회복·주기 배치와 사람 검토를 [패킷](../review/SECOND_MAIN_METHOD_SOURCE_REVIEW_PACKET_2026-09-02.md)에서 확정한다.
4. 확정된 채택본으로 v2 저장·실행·백업·설명 지문을 연결한다. 그때 서로 다른 두 방법을 같은 순서로 비교한다.
5. 10km·하프·마라톤, 초보/발전 단계의 상세 수치 범위는 여전히 확장 대상이다. 이번 표현 확장을 해당 범위의 자동 처방 완료로 보고하지 않는다.

[DRAFT_COMPLETE]
