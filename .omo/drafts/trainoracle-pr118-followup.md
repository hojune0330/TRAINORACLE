---
slug: trainoracle-pr118-followup
status: drafting
intent: clear
review_required: false
pending-action: write .omo/plans/trainoracle-pr118-followup.md
approach: "Gate PR #118 independently, merge it before rebasing PR #114, preserve the journal edit/add flow during integration, keep account sync disabled until the database and owner/privacy gates are satisfied, then return to training-plan detail work."
---

# Draft: trainoracle-pr118-followup

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
| id | outcome | status | evidence path |
|---|---|---|---|
| C1 | PR #118의 삭제·복원·가져오기·백업·동기화 변경을 독립 검토하고 병합 가능 상태를 판정한다. | active | PR #118 @ `f70de8a`; `reports/review/ADVERSARIAL_AUDIT_2026-07-25.md` |
| C2 | PR #118 병합 뒤 PR #114의 지난 일지 수정·추가 흐름을 손실 없이 재통합한다. | active | PR #114 @ `fc9edd9`; `app/src/screens/LogDetail.tsx` 등 중복 경로 |
| C3 | tombstone DB 마이그레이션과 실제 계정 동기화 왕복을 코드 테스트와 실제 Supabase 증거로 분리한다. | active | `MIGRATION_0002_RUNBOOK.md`; `app/src/domain/account/sync-orchestration.contract.test.ts` |
| C4 | 첫 공개 범위·날짜·문의처·첫 사용자 결정을 한 번에 하나씩 받아 출시 권한을 기록한다. | active | PR #93; `LAUNCH_READINESS_2026-07-25.md` §5 |
| C5 | 출시 하드닝 뒤 훈련계획 상세화 제안의 수용·구현 트랙으로 돌아간다. | deferred | PR #115 @ `83a123f`; `PLAN_WORKOUT_DETAIL_UX_PROPOSAL_2026-07-24.md` |

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
| assumption | adopted default | rationale | reversible? |
|---|---|---|---|
| model routing | Terra high가 재현·통합·테스트를 수행하고, Sol xhigh는 PR #118의 데이터 무결성·개인정보·마이그레이션 최종 게이트 1회만 맡는다. | `terra-sol-router`의 bounded execution / high-risk gate 분리와 일치 | yes |
| defect test strategy | 결함은 실패 재현 테스트를 먼저 고정하고, 통합은 기존 회귀 테스트를 보존한 뒤 추가한다. | 저장·삭제·복원은 회귀 비용이 높고 저장소가 이미 계약 테스트 패턴을 사용 | yes |
| merge order | 독립 검토를 통과한 PR #118을 먼저 병합하고 PR #114를 새 main에 재적용한다. | #118은 48파일 규모 최신 기반이며 #114는 현재 `DIRTY`; 반대 순서는 대형 PR을 다시 충돌시킴 | yes |
| account runtime | 공개 빌드에서 계정·서버 동기화는 계속 OFF로 둔다. | PR #93의 기록된 범위와 실제 DB 0002 미실행 상태 | owner may change |
| native confirmation | Fable이 앱 내 확인 UI를 채택하면 native dialog fixme를 별도로 고치지 않고 접근성 dialog e2e로 교체한다. | 중복 구현 방지 | yes |

## Findings (cited - path:lines)
- PR #118은 `origin/main@5a3aa50` 기반, head `f70de8a`, 48파일 `+6615/-49`, open/mergeable/CLEAN이다. CI의 `contract-tests`, `app-quality`, `app-browser`는 성공했지만 GitHub review는 0건이다.
- `app/e2e/journal-trash.spec.ts:35-42`에서 dialog handler는 이미 삭제 클릭 전에 등록된다. 따라서 "등록 시점을 클릭 앞으로 이동"은 현 코드에 적용할 수 없는 지시다. 재현 뒤 `page.once`와 awaited accept 또는 앱 내 확인 UI 중 하나로 해결해야 한다.
- `app/playwright.config.ts:23-49`에 `desktop-chromium`, `mobile-chromium`, `touch-narrow`, `reduced-motion` 프로젝트가 있다. `TrashBin.tsx:128-175`의 버튼은 `minHeight: 44`만 있고 폭 44px 보장은 코드·e2e에 없다. 모바일 실행만으로는 터치 타깃을 검증했다고 볼 수 없으므로 bounding-box 단언이 필요하다.
- `app/src/domain/account/sync-orchestration.contract.test.ts:13-71`은 메모리 mock 서버다. 삭제 전파 계약은 검증하지만 실제 Supabase/RLS/네트워크 왕복 증거가 아니다.
- `MIGRATION_0002_RUNBOOK.md:72-126`에 컬럼/RLS/정책 검증 쿼리 3개가 준비됐으나 `:155-162`에서 실제 DB 실행은 미완료다.
- PR #114는 Fable APPROVE를 받았지만 open/DIRTY이며 main의 조상이 아니다. `LogDetail.tsx`, `LogEntry.tsx`, `EntryChooser.tsx`, `AppShell.tsx`, `journal-store.ts`가 PR #118과 겹친다. #118을 단순 병합하면 수정·과거 날짜 추가 기능은 배포되지 않고, #114를 단순 재베이스하면 휴지통/가져오기 기능을 덮을 수 있다.
- PR #93은 "한국·로컬 일지만, 계정/서버 제외"라는 owner product fact를 기록하지만 open 상태이고 main의 조상이 아니다. 같은 문서는 `public_launch_authorized: false`, `account_or_server_scope_authorized: false`를 명시한다.
- `LAUNCH_READINESS_2026-07-25.md:30-38,113-115`의 "처리방침 불필요/법적 부담 0/없으면 위법"은 코드 테스트로 입증할 수 없는 법률 단정이다. 2026 PIPC 지침은 단말 내부 처리 사실과 삭제 기준 안내를 권장하고, 서버 개인정보 처리 시 처리방침이 필요하다고 설명하므로, 출시 문서에는 처리 사실과 검토 상태만 기록해야 한다.
- PR #115는 문서 전용 `PROPOSAL_ONLY`, `implementation_authorized: false`다. 현재 출시 하드닝과 섞어 구현하지 않는다.

## Decisions (with rationale)
- 유지: tombstone 상한 500, 휴지통 30일, 복원 시 새 id 부여. 모두 owner 결정 또는 계약 테스트로 고정되어 후속 작업에서 재논의·변경하지 않는다.
- 역할: Codex/Terra는 코드 통합·데이터 무결성·테스트·마이그레이션 증거를 맡고, Fable은 앱 내 확인 UI의 문구·상호작용·접근성·모바일 시각 검토를 맡는다.
- 순서: PR #118 독립 게이트 -> owner 범위 확인 -> PR #118 병합 -> PR #114 재통합 -> 휴지통/수정 흐름 브라우저 회귀 -> DB 0002 및 실제 동기화 증거(계정 범위가 승인된 경우) -> 훈련계획 상세화 트랙.

## Scope IN
- PR #118의 독립 병합 게이트와 남은 fixme 처리 방식
- PR #114와의 충돌 없는 통합 및 지난 일지 수정·추가 보존
- desktop/mobile/touch-narrow의 휴지통·수정·추가 회귀 검증
- 0002 실행 증거와 실제 Supabase 왕복 증거의 명확한 분리
- 출시 결정의 중복 질문 제거 및 main에 남는 권한 기록
- 출시 하드닝 다음 훈련계획 상세화 트랙의 인계 지점

## Scope OUT (Must NOT have)
- tombstone 상한 500, 휴지통 30일, 복원 새 id 변경
- 셀렉터 완화·단언 삭제·skip/fixme 추가로 테스트를 위장 통과
- 계정/서버 범위나 공개 출시를 문서 작성자가 임의 승인
- 실제 로그 없는 Supabase/RLS PASS 주장
- 법률 적합성 또는 의료·훈련 안전 승인을 AI가 대신 선언
- PR #115의 훈련 라이브러리를 출시 하드닝 PR에 혼합 구현
- 사용자 또는 다른 작업자의 기존 worktree/미추적 `.omo` 파일 정리

## Open questions
- Q1. 8월 1일 첫 공개 범위를 기존 기록대로 "한국·로컬 일지+공개 훈련계획 베타, 계정/서버 동기화 OFF"로 확정할지.
- Q2. Q1 확정 뒤 8월 1일을 실제 공개 승인일로 기록할지, 소수 초대 베타 시작일로 기록할지.
- Q3. 일반 사용자의 문의 경로를 GitHub Issues로 둘지, 별도 이메일/폼을 마련할지.
- Q4. 첫 사용자 집단을 성인 지인·코치로 제한할지, 중고교 선수까지 포함할지.
- Q5. 실제 Supabase 0002 실행과 두 세션 왕복 검증에 사용할 프로젝트·테스트 계정 접근을 누가 제공할지.
- Q6. 출시 하드닝 후 PR #115를 과학·코칭 스펙 검토 트랙으로 수용할지.

## Approval gate
status: drafting
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
