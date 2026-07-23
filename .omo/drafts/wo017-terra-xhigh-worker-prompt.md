# WO017 Terra Very High Worker Prompt

## 다음 작업자에게 내릴 명령

아래 프롬프트를 새 작업자의 첫 메시지로 그대로 사용한다.

```text
너는 TrainOracle WO017의 주 작업자다.

모델은 gpt-5.6-terra, 추론 강도는 xhigh(매우 높음)로 고정한다.
이 인수 작업이 끝날 때까지 주 작업자 모델을 바꾸지 마라.

저장소는 hojune0330/TRAINORACLE이다.
먼저 draft PR #99를 열고 변경 파일 세 개를 모두 읽어라.

- .omo/plans/trainoracle-onboarding-motivation-loop.md
- .omo/drafts/trainoracle-onboarding-motivation-loop.md
- .omo/drafts/wo017-terra-xhigh-worker-prompt.md

로컬 파일과 현재 GitHub 상태만 사실로 취급한다.
과거 대화의 파일명, 숫자, 이슈 상태를 사실로 추정하지 마라.

PR head SHA와 계획 파일 SHA-256을 직접 계산해 기록한 뒤,
.omo/plans/trainoracle-onboarding-motivation-loop.md의 Todos 1-11과 F1-F5를 순서대로 수행하라.

새 Momus 또는 독립 Codex CLI 사전 검토는 요구하지 않는다.
대표가 Terra 매우 높음 단일 주 작업자로 진행하도록 승인했다.

Fable과 Sol은 계획에 명시된 제한된 UX 산출물과 자문 검토 역할로만 사용한다.
그 결과를 받더라도 주 작업자 모델은 Terra xhigh로 유지한다.
AI 검토를 대표, 의료, 법률, 개인정보 또는 인간 전문가 승인으로 표시하지 마라.

허용 범위는 문서, 검증기, 테스트, 인덱스, 인수 기록,
제어 이슈 한 개와 연결된 draft PR 네 개뿐이다.

app/, impl/, 런타임, 저장, 동의, 계정, 동기화, 스키마,
배포, 정본 승격, 기존 이슈 종료는 금지한다.

PR #99는 인수용 PR이므로 실제 WO017 실행 중복으로 세지 않는다.
실행 이슈와 PR을 만들기 전에는 PR #99를 제외한 실제 WO017 중복이 없는지 확인하라.

모든 문서와 검증이 통과하면 implementation_activation: PENDING_OWNER에서 멈춰라.
앱 구현을 시작하지 말고, 생성한 이슈·PR·커밋·검증 결과를 쉬운 한국어로 보고하라.
```

## 작업 시작 확인표

- GitHub 저장소: `hojune0330/TRAINORACLE`
- 인수 PR: `#99`
- PR 제목: `[HANDOFF][WO017] Terra xhigh execution order`
- PR base: `main`
- PR head: `review/wo017-external-plan-gate`
- 계획 SHA-256: `39075a3939f84df121179a46c5096bc20480c6fb5cee498c1a6a2b90adc9dd77`
- 주 작업자 모델: `gpt-5.6-terra`
- 추론 강도: `xhigh`
- 실행 방식: `.omo/plans/trainoracle-onboarding-motivation-loop.md`에 따라 `omo:start-work`
- 최종 중단선: `implementation_activation: PENDING_OWNER`

브랜치 이름의 `external-plan-gate`는 과거 이름일 뿐이다. 현재 PR은 별도 외부 검토를 요구하지 않는 Terra xhigh 실행 인수 PR이다.

## 맡겨도 되는 일

1. WO017 문서 검증기와 테스트 작성
2. 대표 결정 기록과 소스 바인딩 문서 작성
3. `CODEX_WORK_ORDER_017.md` 발행
4. 문서 인덱스와 다음 작업자 인수 문서 갱신
5. Fable UX 산출물 수령 및 증거 기록
6. Terra 계약 바인딩과 시나리오 작성
7. Sol의 제한된 사전 자문 수령 및 증거 기록
8. 제어 이슈 한 개와 연결된 draft PR 네 개 생성
9. 전체 변경 경로, 링크, SHA, 검증 결과 대조

## 맡기면 안 되는 일

- 신규 첫 화면 또는 일지 UX 실제 구현
- 훈련계획 요청·후보·출력 생성
- 개인정보, 저장, 동기화 또는 계정 변경
- 포인트, 돈, 배지, 레벨, 스트릭 또는 장식 잠금 해제 구현
- `app/`, `impl/`, 배포 또는 production 설정 변경
- 정본 승격, issue CLOSED 전환 또는 runtime evidence 주장
- 대표 승인 없이 `PENDING_OWNER`를 활성화 상태로 변경

## 완료 보고 형식

```text
WO017 Terra Very High 작업 보고

1. 인수 확인
- PR #99 head SHA:
- 계획 SHA-256:
- 사용 모델: gpt-5.6-terra
- 추론 강도: xhigh

2. 생성 결과
- 제어 이슈:
- 발행 PR:
- Fable PR:
- Terra PR:
- Sol PR:

3. 검증
- 문서 검증기:
- 테스트:
- GitHub 링크/SHA 대조:
- 변경 금지 경로 검사:

4. 최종 상태
- implementation_activation: PENDING_OWNER
- app/ 변경 없음:
- impl/ 변경 없음:
- 배포 변경 없음:
- 정본 승격/이슈 종료 없음:
```

[DRAFT_COMPLETE]
