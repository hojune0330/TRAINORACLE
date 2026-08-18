# DoneClaim

Review base: `e18f09998f9f4619a375909e338848c3c9310864`

Source commit: `e6bf8b6c2c110abe9d6329a5fad57f07338f90e5`

Status: `READY_FOR_INDEPENDENT_RE_REVIEW`

## 변경 파일

- 삭제: `app/src/domain/prescription-quality-matrix-cases.ts`
- 추가: `app/src/domain/prescription-quality-matrix.test-fixtures.ts`
- 수정: `app/src/domain/prescription-quality-matrix.contract.test.ts`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/DoneClaim.md`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/cleanup-receipt.log`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/final-git-audit.log`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/manifest.json`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/prescription-quality-matrix.json`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/matrix-green-final.log`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/matrix-day10-removal-mutation.log`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/app-focused-final.log`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/impl-focused-final.log`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/app-typecheck-final.log`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/e2e-typecheck-final.log`
- 재생성: `.omo/evidence/prescription-persona-quality-matrix-20260818/impl-typecheck-final.log`

이번 리뷰에서 production 코드는 추가 변경하지 않았다. 잘못 추가했던 day-10 상세 처방 바인딩 선호 변경은 완전히 제거했으며, `impl/src/plan-generator/candidates.ts`는 review base와 동일하다. `e18f099...`에 이미 포함된 실제 slot-availability 수정은 유지된다.

## 실행 계약

`prescription-quality-matrix.json`은 다음 관찰 결과를 기록한다.

- CURRENT 동일 종목 기록을 사용한 800/1500/3000/5000 실행 케이스 5개와 7/9/10일, daily, single/two-a-day 표본
- 모든 상세 처방의 `scope.population === YOUTH_AND_ADULT`
- 외부 `YOUTH_REVIEW`/`ADULT_REVIEW` 라벨이 런타임 입력에 전달되지 않으며, 동일 런타임 입력의 처방이 동일함
- high-school male/female high/mid/low 6개와 college/open 2개는 sampled review metadata일 뿐 실행 가능한 dose axis나 Cartesian coverage가 아님
- NONE, stored-unselected, DEVELOPING, deferred 100m/400m fallback 후보를 실제 `selectPlanForActivation`으로 선택 가능함
- raw memo가 저장된 fallback 1개를 포함해 직렬화 결과에 `MATRIX_RAW_FREE_TEXT_9f86d081`가 남지 않음
- D9 ACTIVE/UNKNOWN은 후보 생성 전에 차단됨

각 후보는 PACE_TARGET을 정확히 1개 유지한다. 두 daily two-a-day 5000 케이스는 day 10에 정확히 1개의 `AM` `QUALITY` 세션과 선택된 `VO2_INTENT`를 유지한다. 상세 처방을 day 10으로 강제 이동시키지는 않는다.

## Mutation 증거

`impl/src/plan-generator/session-builder.ts`의 조건을 임시로 `qualityDays.has(day) && day !== 10`으로 바꾸고 matrix를 실행했다. exit 1이었고 다음 두 테스트가 이름으로 실패했다.

- `5000-current-10d-daily-double-morning`
- `5000-current-10d-daily-double-evening`

임시 mutation은 즉시 원복했고 최종 matrix 14/14 재통과와 `session-builder.ts` 작업 diff 부재를 확인했다. 증거: `matrix-day10-removal-mutation.log`, `matrix-green-final.log`.

## 정확한 검증 결과

- Matrix: 1 file, 14/14 passed.
- Focused app: 5 files, 60/60 passed.
- Focused impl: 4 files, 78/78 passed.
- App TypeScript: exit 0.
- E2E TypeScript: exit 0.
- Impl TypeScript: exit 0.
- `git diff --check`: passed.

실행 명령:

```text
(app) PRESCRIPTION_MATRIX_REPORT=../.omo/evidence/prescription-persona-quality-matrix-20260818/prescription-quality-matrix.json npm run test:unit -- src/domain/prescription-quality-matrix.contract.test.ts --reporter=verbose
(app) npm run test:unit -- src/domain/prescription-quality-matrix.contract.test.ts src/domain/plan-beta-detailed-candidates.contract.test.ts src/domain/multi-event-prescription.contract.test.ts src/domain/plan-beta-flow.contract.test.ts src/domain/plan-session-schema.contract.test.ts --reporter=verbose
(impl) npm test -- test/plan-beta-generation.test.ts test/plan-beta-selection.test.ts test/prescription-runtime.test.ts test/prescription-pace.test.ts
(app) npm run typecheck
(app) npm run typecheck:e2e
(impl) npm run typecheck
git diff --check
```

Full app/impl suites, production build, Chromium QA는 이번 리뷰에서 재실행하지 않았다. 이번 변경은 테스트/보고서 정정뿐이고, review base의 이미 검토된 production slot fix에는 추가 변경이 없기 때문이다. 이전 실행 결과를 이번 리뷰 결과로 주장하지 않는다.

## 남은 비지원 조합

- 연령/성별 전용 처방: 런타임 dose axis가 아님.
- high/mid/low 성과 등급 전용 처방: 승인된 런타임 매핑이 없으며 sampled review metadata뿐임.
- division 전용 처방: dose axis로 평가하지 않음.
- 100-400m 상세 처방: deferred, RPE fallback 유지.
- `DEVELOPING`/`NEW_TO_RUNNING` 상세 처방: 현재 승인 범위 밖, RPE fallback 유지.
- CURRENT 동일 종목 기준 기록 없음/미선택: RPE fallback 유지.

## 정리

- 무효 stale-fixture QA 파일 4개를 evidence에서 제거했다.
- 임시 mutation을 원복했다.
- push, merge, commit, reset, clean을 수행하지 않았다.
- Code/test commit `e6bf8b6c2c110abe9d6329a5fad57f07338f90e5`에 연결된 evidence provenance commit을 만들 준비가 됐다.
