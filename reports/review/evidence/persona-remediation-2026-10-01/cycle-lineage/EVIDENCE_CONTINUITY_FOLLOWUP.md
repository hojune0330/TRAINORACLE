# AM/PM 변경 수행 P2 후속 정적 리뷰

- 날짜: 2026-10-01 KST. 이전 `EVIDENCE_CONTINUITY_REVIEW.md`와 별도로 보존한다.
- 판정: **기존 P2의 코드상 원인은 해소됐다. 이번 수정 범위에서 추가 조치가 필요한 결함을 발견하지 않았다.**
- 범위: 방법 관찰의 슬롯 처리, 실제 슬롯 표시, ACTIVE/ARCHIVED 회귀 소스, 증거 계약 §13의 해당 변경만 다시 읽었다. B06 정책과 다른 제품 영역은 재탐색하지 않았다.
- 검증 경계: 테스트·브라우저 실행 없음, 제품 코드 수정 없음. 이 후속 보고서만 작성했다. 환경·비밀·실사용자 기록·네트워크 접근 없음.

## 기존 P2 해소 근거

1. [plan-method-observations.ts:137](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-method-observations.ts:137>)은 실제 슬롯 불일치 제외를 제거했다. 원본 링크는 [같은 파일:132](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-method-observations.ts:132>)의 정확한 원본 해결을 계속 거치며, 일지 날짜 불일치와 원본 해결 실패는 계속 제외된다. 실제 오후 수행을 허용하기 위해 계획 슬롯·날짜를 덮어쓰는 코드는 추가되지 않았다.
2. [같은 파일:60](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-method-observations.ts:60>)은 `actualSlot`을 입력의 구조화된 값 또는 `null`로 보존한다. [같은 파일:123](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-method-observations.ts:123>)의 충돌 서명과 결과 투영에도 실제 슬롯이 포함되므로, 슬롯이 다른 사본을 동일 결과로 숨기지 않는다. 새 원문 메모·제목 접근이나 실제 슬롯 추정은 없다.
3. [PlanMethodObservationDetails.tsx:9](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanMethodObservationDetails.tsx:9>)는 명시적 AM/PM이 계획 슬롯과 다를 때만 `계획 오전 · 실제 오후`처럼 구분한다. [같은 파일:24](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanMethodObservationDetails.tsx:24>)의 알려진 실제 RPE 표시와 [같은 파일:26](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanMethodObservationDetails.tsx:26>)의 비교 제외 설명이 함께 남는다. 이 경우 방법 관찰이 더 이상 `MISSING`으로 떨어지지 않으므로 이전의 “연결된 일지가 없음” 우선 표시 원인이 제거된다.
4. [계약 §13:188](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/PLAN_CYCLE_RESPONSE_AND_ADAPTATION_CONTRACT.md:188>)은 유효한 원본 계획 슬롯과 다른 실제 슬롯을 미기록으로 취급하지 않는다고 명시한다. 알려진 실제 값 보존, 변경 수행 표시, 동일 처방 RPE 비교 제외, 변조된 계획 링크 거절의 구분은 이번 구현과 일치한다. 새 처방 수치나 successor 권한은 추가하지 않는다.

## 회귀 소스와 잔여 검증 경계

- [plan-cycle-lineage.contract.test.ts:32](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-cycle-lineage.contract.test.ts:32>)는 ACTIVE/ARCHIVED 두 경로 모두 `LINKED`, 실제 슬롯 PM, 실제 RPE 보존, `CHANGED_SESSION`, 연결 1건·비교 0건을 요구한다. 이는 알려진 실제 기록 보존과 비교 제외를 동시에 고정하는 적절한 회귀 조건이다.
- [SessionExplanation.contract.test.tsx:68](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/SessionExplanation.contract.test.tsx:68>)도 두 경로에서 계획/실제 슬롯, 직접 기록한 RPE, 비교 제외 설명을 표시하고 “연결된 일지가 없음”이 없어야 한다고 요구한다. 렌더링 경계를 포함하되, 이 리뷰에서는 실행하지 않았다.
- 수정 전 두 named regression 실패 및 `slot-mismatch-before.json`은 사용자가 전달한 로컬 검증 사실이다. 해당 결과 파일을 독립적으로 읽거나 재현하지 않았으며, 수정 후 통과 여부도 이 보고서의 정적 판정과 별도다.
- 추가 조치 요청 없음. 런타임·브라우저 통과, 배포·사용자 전달, W1 수치 또는 독립적인 과학 승인으로 확대하지 않는다. 요청한 좁은 후속 리뷰를 완료한다.
