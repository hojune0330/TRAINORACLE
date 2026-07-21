# TrainOracle 프로젝트 상태 스냅샷 2026-07-22

```yaml
snapshot_date: 2026-07-22 Asia/Seoul
repository: hojune0330/TRAINORACLE
main_sha: 6d84e273eacd7aca334b4ee7ccf8d1c29b8f9ed2
purpose: HUMAN_READABLE_HANDOFF_EVIDENCE
canonical_promotion: false
runtime_authority: false
```

## 측정 원칙

이 문서는 GitHub와 해당 SHA의 파일을 직접 확인해 만든 날짜 고정 스냅샷이다.
대화 기억, 과거 ledger의 숫자, 문서 제목으로 추정한 파일은 세지 않았다.

## 저장소와 배포

| 항목 | 값 | 근거 범위 |
|---|---:|---|
| `main` 기준 SHA | `6d84e273eacd7aca334b4ee7ccf8d1c29b8f9ed2` | `origin/main` 직접 조회 |
| 열린 PR | 3개 | GitHub open PR 조회 |
| 검토 준비 PR | 2개 | #93, #97 |
| 초안 PR | 1개 | #98 |
| 열린 이슈 | 0개 | GitHub open issue 조회 |
| 열린 PR의 CI | 3개 모두 성공 | 각 PR `statusCheckRollup` |
| GitHub Pages | `built`, HTTP 200 | Pages API와 공개 URL 응답 |

열린 이슈 0개는 백로그 0개를 뜻하지 않는다. 이 저장소는 작업 카탈로그, PR,
사람 검토 관문을 별도 진행 표면으로 사용한다.

## 문서 자산

| 항목 | 값 | 세는 방법 |
|---|---:|---|
| `specs/active/*.md` | 9개 | 실제 파일 목록 |
| `specs/reconstruct/*.md` | 25개 | `README.md` 제외 실제 파일 목록 |
| 스펙 합계 | 34개 | 9 + 25 |
| `specs/test-packages/` 파일 | 51개 | 디렉터리의 추적 파일 수 |

이 수치는 파일 존재량이다. 수용, 정본 승격, 구현 완료, 런타임 증거의 수가 아니다.

## 실행과 자동 검사

2026-07-22 확인한 PR #98 CI 실행 `29869946277`의 결과:

| 계층 | 결과 | 의미 제한 |
|---|---:|---|
| Reasoning-tier 카탈로그 | 18 tasks / 3 stages / PASS | 카탈로그 구조와 참조 검증 |
| D9 evaluator | 11/11 PASS | 포함된 후보 평가기 사례만 증명 |
| `impl/` 안전 체인 | 7/7 PASS | D9→RVE→Gate 골격의 포함된 사례만 증명 |
| 앱 unit/contract | 87/87 PASS | 13개 테스트 파일 |
| 앱 browser | 74/74 PASS | Playwright 브라우저 흐름 |
| 앱 typecheck/build | PASS | 현재 소스가 타입 검사되고 빌드됨 |

앱 unit 87개와 browser 74개를 합치면 앱 자동 검사는 161개다. 서로 다른 테스트
계층이므로 “161개 기능 완성”으로 읽지 않는다.

## Formation 작업 카탈로그

`reports/work-harness/TRAINORACLE_WORK_CATALOG.json` 직접 집계:

| 상태 | 개수 | 뜻 |
|---|---:|---|
| `DONE` | 2 | 증거와 검사까지 완료 |
| `BLOCKED_OWNER` | 2 | 책임자 결정 필요 |
| `BLOCKED_HUMAN` | 6 | 이름과 자격이 확인된 사람 검토 필요 |
| `WAIT_DEPENDENCY` | 7 | 앞 단계 완료 대기 |
| `DEFERRED_VOLUME` | 1 | 형식적이지만 물량 때문에 보류 |
| 합계 | 18 | 카탈로그 전체 |

완료 비율 `2/18 = 11.1%`는 **Formation 카탈로그 진척도**일 뿐 제품 전체 완성률이
아니다. S1, S2, S3 모두 현재 `NO_READY_TASKS`를 반환한다.

## 제품 상태를 쉬운 말로 분리

| 제품 층 | 현재 판정 |
|---|---|
| 일지 앱 | 공개 URL과 빌드가 있고, 최근 CI에서 unit 87개와 browser 74개 통과 |
| 안전 평가 후보 | D9 11개, impl 7개 테스트 통과. 포함된 범위 밖의 의료적 안전 보장은 아님 |
| 스펙 계층 | 34개 파일과 51개 테스트 패키지 파일 존재. 상태와 권한은 문서별로 다름 |
| 훈련 계획 생성 | `PLAN_GENERATOR_STUB`; 자동 실행과 실제 선수 적용은 아직 0 |
| Formation 승인 | 엄격 수용 `0/6`, 책임자 승인 P1 계획 `0/10`, 전문가 검토 `0/6` |

따라서 “서비스가 전혀 없다”도 아니고 “근거 기반 자동 코칭이 완성됐다”도 아니다.
현재는 **일지 서비스는 작동하고, 훈련 계획의 계약·검증 기반은 크지만 실행 권한은
닫혀 있는 상태**다.

## 재현에 사용한 확인 표면

- `git fetch --prune origin`, `git rev-parse origin/main`
- `gh pr list`, `gh pr view`, `gh issue list`, `gh run list`, `gh run view --log`
- `gh api repos/hojune0330/TRAINORACLE/pages`
- `curl -L https://hojune0330.github.io/TRAINORACLE/`
- 실제 `specs/active`, `specs/reconstruct`, `specs/test-packages` 파일 목록
- `node specs/test-packages/reasoning-tier-harness.mjs validate`
- S1/S2/S3 각각의 `next` 명령
- `reports/review/FORMATION_FORMAL_GATE_STATUS.md`
- `reports/review/FORMATION_LATEST_DECISION_RECONCILIATION_HANDOFF.md`
- `impl/src/plan-generator/generator.ts`

[DRAFT_COMPLETE]
