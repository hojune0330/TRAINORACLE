# TrainOracle 다음 작업 인수인계

> 기준 시각: 2026-07-22 Asia/Seoul
>
> GitHub 기준선: `main@1d8fc5382289ce3e2d16ad3b19f7257e1fa858c2`
>
> 성격: 현재 상태를 찾기 위한 인계 문서. 제품 규칙의 정본, 런타임 증거, 이슈 종결 기록이 아니다.

## 한 줄 요약

TrainOracle 훈련 일지 앱은 **공개 URL이 응답하고 최근 CI의 포함된 단위·브라우저
사례가 통과한 상태**지만, 가장 중요한 **훈련 계획 생성은 아직 실행 금지 상태의
스텁**이다. 이 결과는 제품 전체 검증, 의료적 안전성, 자동 코칭 유효성 또는 계획
런타임 승인을 뜻하지 않는다. 다음 일은 새 기능을 추정해 만드는 것이 아니라, 열린
PR과 사람 관문을 정리한 뒤 승인된 계약만 구현하는 것이다.

## 숫자로 보는 현재 상태

아래 수치는 2026-07-22에 GitHub와 저장소 파일을 직접 다시 확인한 값이다.
전체 근거와 계산 범위는
[`reports/work-harness/PROJECT_STATUS_SNAPSHOT_20260722.md`](./reports/work-harness/PROJECT_STATUS_SNAPSHOT_20260722.md)에 있다.

| 구분 | 확인된 수치 | 쉬운 뜻 |
|---|---:|---|
| 스펙 문서 | active 9개 + reconstruct 25개 = **34개** | 핵심 규칙과 재구성 계약이 파일로 존재한다. 모두 정본 승격됐다는 뜻은 아니다. |
| 스펙 테스트 패키지 파일 | **51개** | 규칙·문서 연결을 검사할 장치가 있다. 파일 수는 PASS 수가 아니다. |
| 앱 자동 검사 | unit **87/87**, browser **74/74** | 일지 앱의 코드·브라우저 흐름은 최근 CI에서 통과했다. |
| 안전 체인 검사 | D9 **11/11**, impl **7/7** | 후보 D9 평가기와 D9→RVE→Gate 골격의 포함된 사례가 통과했다. |
| Formation 작업 목록 | **18개 중 2개 DONE** | 카탈로그 진척도는 11.1%다. 제품 전체 완성률로 해석하면 안 된다. |
| 아직 못 시작하는 작업 | 사람/책임자 대기 8개, 선행 의존 7개, 물량 보류 1개 | 현재 `READY` 작업은 **0개**다. |
| GitHub 작업 큐 | 열린 PR **2개**, 열린 이슈 **0개** | #93은 수정 필요, #98은 초안이다. #97은 승인 후 병합됐다. |
| 공개 페이지 | GitHub Pages `built`, HTTP **200** | 현재 공개 주소가 응답한다. 이것이 훈련 계획 런타임 승인을 뜻하지 않는다. |

공개 주소: <https://hojune0330.github.io/TRAINORACLE/>

## 지금 실제로 되는 것

- 모바일 우선 훈련 일지 앱이 빌드되고 GitHub Pages에서 열린다.
- 일지 저장·열람, 휴식일 경로, 추세, 안전한 내보내기 같은 주요 흐름이 자동 검사에 포함돼 있다.
- 입력하지 않은 값을 임의 기본값으로 분석하지 않는 provenance 계약과 검사가 있다.
- D9 평가기 후보와 RVE/Safety Gate 연결 골격은 포함된 테스트 범위에서 실행된다.
- 문서 작업은 파일 존재, 출처, 승인, 런타임 증거를 분리하도록 검증기를 갖추고 있다.

## 아직 실제로 되지 않는 것

- `impl/src/plan-generator/generator.ts`는 여전히 `PLAN_GENERATOR_STUB`이다.
- Formation 런타임은 `runtime_started: false`, `runtime_authority: false`다.
- 엄격 수용 기록은 `0/6`, 책임자 승인 P1 계획은 `0/10`, 이름 있는 전문가 검토는 `0/6`이다.
- 자동 훈련 처방, 실제 선수 달력 쓰기, 코치 지시 쓰기, 실제 참가자 파일럿은 시작하면 안 된다.
- 스펙 34개가 존재한다는 사실은 34개가 모두 정본·구현·검증 완료됐다는 뜻이 아니다.

## 현재 열린 PR

| PR | 상태 | 내용 | 다음 권한자 |
|---|---|---|---|
| [#93](https://github.com/hojune0330/TRAINORACLE/pull/93) | 검토 준비, CI 성공 | 첫 공개 범위와 미성년 계정 경계 기록 | OWNER / HUMAN_REVIEWER |
| [#98](https://github.com/hojune0330/TRAINORACLE/pull/98) | 초안, CI 성공 | Terra/Sol 공유 라우팅 스킬과 인계 갱신 | OWNER / HUMAN_REVIEWER |

최근 병합: [#97](https://github.com/hojune0330/TRAINORACLE/pull/97) →
`main@1d8fc5382289ce3e2d16ad3b19f7257e1fa858c2`. 병합 뒤 S1/S2/S3를 다시 계산했지만
모두 `NO_READY_TASKS`다.

열린 이슈가 0개라고 해서 남은 일이 0개인 것은 아니다. 현재 남은 일은 작업 카탈로그와
열린 PR, 사람 관문에 기록돼 있다.

## Terra와 Sol 사용 준비

공유 스킬은 `codex-skills/terra-sol-router/`에 있다. 두 모델을 시간이나 대화 횟수로
번갈아 쓰지 않고 **단계와 위험도**로 바꾼다.

1. **Terra**: GitHub 동기화, 파일 인벤토리, 수치 재계산, 승인된 패치, 테스트와 문서 갱신.
2. **Sol**: 안전·개인정보·훈련 논리·권한 충돌에 대한 비권위적 검토 권고안 한 개.
3. **Terra**: 권한 있는 사람이 명시적으로 수용한 권고안만 최소 변경으로 적용하고 검증.

정상 경로는 `Terra -> Sol -> Terra`다. 다만 현재 카탈로그에는 `READY`가 없으므로
지금의 `next_actor`는 Terra나 Sol이 아니라 **OWNER 또는 HUMAN_REVIEWER**다. 모델을
교차 사용한다는 이유로 막힌 일을 임의로 시작하지 않는다.

Sol·Fable·Codex의 검토는 사람 승인이나 책임자 결정을 대신하지 않는다. 수용 기록에는
결정자 신원과 역할, 적용 범위, source/head SHA, 영구 근거 경로가 있어야 한다.

## 두 컴퓨터에서 이어가는 방법

1. 작업을 시작하기 전에 `origin/main`을 fetch하고 전체 SHA를 확인한다.
2. 기존 작업 폴더가 더러우면 별도 worktree와 `codex/*` 브랜치를 사용한다.
3. 인계할 변경만 커밋·푸시하고 PR에 전체 SHA와 아래 캡슐을 남긴다.
4. 다른 컴퓨터는 그 SHA를 fetch한 뒤 `HEAD`가 정확히 일치하는지 확인한다.
5. 로컬 전용 파일과 대화 요약은 공유 증거로 사용하지 않는다.

```yaml
objective: one concrete outcome
authority: allowed and forbidden changes
repository: hojune0330/TRAINORACLE
branch: exact branch
base_sha: full SHA
head_sha: full pushed SHA
changed_paths: exact paths only
verified_evidence: observed commands, CI, or artifact paths
open_decision: one question only
invariants: safety, privacy, compatibility, owner constraints
next_actor: TERRA | SOL | OWNER | HUMAN_REVIEWER
stop_when: observable completion condition
```

## 다음 실행 순서

책임자 제품 결정과 이름 있는 사람 검토의 라우팅 항목은
[`reports/work-harness/OWNER_DECISION_CHECKLIST_20260722.md`](./reports/work-harness/OWNER_DECISION_CHECKLIST_20260722.md)에
분리돼 있다. 이 체크리스트는 비정본 접수·라우팅 색인이며, ID는 요청을 연결하는 데만
사용한다. 승인 효력은 결정자 신원·자격·범위·판단·source/head SHA와 영구 근거가 기존
정식 승인 기록에 남을 때만 발생한다.

1. PR #93의 owner-decision 권한 검증기를 보강하고 이름 있는 개인정보/법률 검토 입력을 준비한다.
2. OWNER와 해당 분야의 이름 있는 HUMAN_REVIEWER가 PR #93과 #98을 각자의 권한 범위에서 검토해 병합·수정·보류를 결정한다.
3. 병합 뒤 Terra가 새 `origin/main`을 기준으로 작업 카탈로그 검증과 상태 재계산을 실행한다.
4. 여전히 `NO_READY_TASKS`이면 책임자 결정 또는 이름 있는 사람 검토를 요청하고 멈춘다.
5. 안전·개인정보·훈련 논리의 충돌이 실제로 생길 때만 Sol에 질문 하나를 넘긴다.
6. 결정이 기록되면 Terra가 허용된 경로만 패치하고 CI·수동 확인 증거를 남긴다.

시작 명령:

```bash
node specs/test-packages/reasoning-tier-harness.mjs validate
node specs/test-packages/reasoning-tier-harness.mjs next --stage S1_DEEP_FRAME
node specs/test-packages/reasoning-tier-harness.mjs next --stage S2_BOUNDED_BUILD
node specs/test-packages/reasoning-tier-harness.mjs next --stage S3_MECHANICAL_BATCH
```

## 절대 유지할 원칙

- 로컬 파일과 GitHub의 실제 상태만 믿는다.
- 문서 제목이나 챕터를 독립 파일로 착각하지 않는다.
- self-check를 런타임 증거로 부르지 않는다.
- 원문 메모·증상 문구·evidence clause를 감사 계약에 저장하지 않는다.
- D9 `ACTIVE`와 `UNKNOWN`은 모두 항상 `planGenerationAllowed: false`로 계획 생성을 차단한다.
- `ACTIVE`는 `BLOCK`과 사람 검토로, `UNKNOWN`은 `BLOCK_OR_HUMAN_REVIEW`와 추가 정보 또는 사람 검토로 보낸다. 사람 검토는 자동 통과 경로가 아니다.
- D9 `CLEARED`도 남은 관문으로 진행할 수 있다는 뜻일 뿐 의료적 허가나 전체 계획 승인이 아니다.
- 좋은 physio 데이터, 템플릿, advisory로 D9 위험을 해제하지 않는다.
- 사람 승인과 의료·법률·제품 책임자의 결정을 AI가 대신하지 않는다.

## 다음 작업자가 먼저 읽을 파일

1. 이 파일
2. [`reports/work-harness/NEXT_WORKER_HANDOFF.md`](./reports/work-harness/NEXT_WORKER_HANDOFF.md)
3. [`reports/work-harness/TRAINORACLE_WORK_CATALOG.json`](./reports/work-harness/TRAINORACLE_WORK_CATALOG.json)
4. [`SPEC_WORK_STATUS.md`](./SPEC_WORK_STATUS.md)
5. [`TRAINORACLE_SPEC_INDEX.md`](./TRAINORACLE_SPEC_INDEX.md)

[DRAFT_COMPLETE]
