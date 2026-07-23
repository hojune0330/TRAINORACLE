# WO017 External Review And Conditional Execution Prompt

## 이 문서의 목적

이 문서는 다른 컴퓨터의 다음 Codex 작업자가 검토 전용 PR을 열고, 추측 없이 바로 이어서 일하도록 만든 실행 프롬프트다.

현재 바로 맡겨도 되는 일은 **WO017 계획의 독립 고정밀 검토**뿐이다. 실제 문서 제작은 동일한 계획 파일에 대한 두 검토가 모두 `OKAY`일 때만 시작한다.

## 시작할 때 사용자에게 받은 프롬프트

아래 내용을 새 Codex 세션의 첫 메시지로 그대로 사용한다.

```text
너는 TrainOracle WO017 인수 작업자다.

이번 작업에는 두 단계가 있다.

1. 검토 전용 PR의 계획을 독립적으로 고정밀 검토한다.
2. 같은 계획 해시에 대한 Momus와 독립 Codex CLI 검토가 모두 무조건부 OKAY일 때만, 계획에 적힌 문서 작업을 이어서 실행한다.

로컬 파일과 현재 GitHub 상태만 사실로 취급한다. 대화 요약, 과거 숫자, 존재가 확인되지 않은 파일을 사실로 만들지 않는다.

반드시 이 PR 자체와 PR의 변경 파일을 먼저 읽어라. 앱이나 구현 코드는 수정하지 마라.
```

## 고정 입력

- 저장소: `hojune0330/TRAINORACLE`
- 검토 PR 제목: `[REVIEW ONLY][WO017] External plan gate handoff`
- 검토 PR base: `main`
- 검토 PR head: `review/wo017-external-plan-gate`
- 계획 파일: `.omo/plans/trainoracle-onboarding-motivation-loop.md`
- 검토 원장: `.omo/drafts/trainoracle-onboarding-motivation-loop.md`
- 작업 프롬프트: `.omo/drafts/wo017-external-review-worker-prompt.md`
- 검토 대상 계획 SHA-256: `5fa90e4a4e7f855e867a659a6f4c121effdaf2d83ce888b105a5a1ba266f4562`
- 계획 출발점 main commit: `1d8fc5382289ce3e2d16ad3b19f7257e1fa858c2`

검토 PR은 실제 WO017 발행 PR 4개 중 하나가 아니다. 병합하지 않으며, 검토 영수증을 전달하는 임시 관문으로만 사용한다.

## 지금 맡겨도 되는 일

1. 검토 PR의 base, head, 제목, 변경 파일을 확인한다.
2. 계획 파일의 SHA-256을 직접 계산한다.
3. 동일한 계획 해시에 대해 새 Momus 검토와 독립 Codex CLI 검토를 같은 라운드로 실행한다.
4. 두 검토 결과와 실행 영수증을 검토 원장 및 PR 댓글에 기록한다.
5. 두 결과가 모두 `OKAY`라면, 검토 PR 내용을 깨끗한 실행 브랜치로 가져와 계획의 문서 작업을 수행한다.
6. 계획에 정한 Fable UX 산출물, Terra High 계약 바인딩, Sol High 자문 검토, GitHub 인수 기록을 만든다.
7. `implementation_activation: PENDING_OWNER`에서 멈춘다.

## 아직 맡기면 안 되는 일

- `app/`, `impl/`, 런타임, 저장소, 동의, 계정, 동기화, 스키마, 배포 변경
- 실제 온보딩 화면 구현
- 훈련계획 요청 저장, 후보 생성, 대기 명단 또는 개인화 결과 생성
- 포인트, 돈, 배지, 레벨, 스트릭 압박 또는 장식 잠금 해제 구현
- 스펙 정본 승격, 기존 open issue 종료, 런타임 증거 주장
- 검토 PR 병합
- 한쪽 검토만 통과한 상태에서 실행
- `--dangerously-bypass-approvals-and-sandbox` 또는 이와 같은 우회 옵션 사용

## 단계 A: PR과 파일 상태 확인

1. `git fetch --prune origin`으로 원격 상태를 갱신한다.
2. GitHub에서 검토 PR을 조회하고 다음을 확인한다.
   - base가 `main`
   - head가 `review/wo017-external-plan-gate`
   - draft PR
   - 제목이 `[REVIEW ONLY][WO017] External plan gate handoff`
3. 최초 검토 시 변경 파일은 아래 세 개여야 한다.
   - `.omo/plans/trainoracle-onboarding-motivation-loop.md`
   - `.omo/drafts/trainoracle-onboarding-motivation-loop.md`
   - `.omo/drafts/wo017-external-review-worker-prompt.md`
4. 계획 파일을 실제로 열고 SHA-256을 계산한다.
5. 해시가 고정 입력과 다르면 즉시 중단하고 `PLAN_HASH_MISMATCH`를 PR에 보고한다.
6. 검토 원장의 상태가 `high-accuracy-review-blocked-by-independent-cli-policy`인지 확인한다.

검토 결과를 내기 전에 계획 파일을 읽지 못했거나 해시를 확인하지 못했다면 `OKAY`를 반환할 수 없다.

## 단계 B: 같은 라운드의 독립 검토 2개

`omo:ulw-plan`의 고정밀 검토 절차를 사용한다. 플러그인이나 필요한 검토 기능이 없다면 임의로 대체하지 말고 `REVIEW_CAPABILITY_MISSING`으로 중단한다.

새 `review_round_id`를 하나 만든 뒤 아래 두 검토를 같은 계획 해시에 대해 함께 시작한다.

### B1. Momus

- 새 세션만 사용한다.
- 과거 `OKAY`나 과거 세션을 재사용하지 않는다.
- 계획 전체의 실행 가능성, 경계, 의존성, 명령, 증거, GitHub 연결, 중단 조건을 검토한다.
- 최종 판정은 `OKAY`, `ITERATE`, `REJECT`, `INCONCLUSIVE` 중 하나여야 한다.

### B2. 독립 Codex CLI

- 다른 컴퓨터의 비중첩 로컬 Codex CLI를 사용한다.
- 모델은 `gpt-5.6-sol`, 추론 강도는 `xhigh`로 고정한다.
- 임시 작업공간과 일회용 `CODEX_HOME`을 사용한다.
- 정상 sandbox와 정상 approval 정책을 사용한다.
- 위험 우회 옵션을 사용하지 않는다.
- 첫 검증 행동은 검토 대상 파일의 실제 경로를 열고, 내용을 읽고, SHA-256을 확인하는 것이어야 한다.
- 부모 Codex가 만든 요약문만 읽고 판정해서는 안 된다.
- 최종 판정은 `OKAY`, `ITERATE`, `REJECT`, `INCONCLUSIVE` 중 하나여야 한다.

다음 조건을 모두 만족할 때만 검토 라운드가 통과한다.

- 두 검토가 같은 `review_round_id`를 사용한다.
- 두 검토가 같은 계획 경로와 같은 SHA-256을 확인한다.
- Momus가 무조건부 `OKAY`다.
- 독립 Codex CLI가 무조건부 `OKAY`다.
- 두 검토 모두 실제 세션 또는 프로세스 영수증이 있다.
- 위험 우회 옵션을 사용하지 않았다.

## 단계 C: 검토 결과 기록

검토 원장에 새 라운드를 추가한다. 기존 실패 또는 참고 라운드를 승인 증거로 바꾸지 않는다.

각 검토 영수증에는 최소한 다음을 기록한다.

```json
{
  "review_round_id": "<NEW_ROUND_ID>",
  "plan_path": ".omo/plans/trainoracle-onboarding-motivation-loop.md",
  "plan_sha256": "5fa90e4a4e7f855e867a659a6f4c121effdaf2d83ce888b105a5a1ba266f4562",
  "workspace_root": "<LITERAL_REVIEW_WORKSPACE>",
  "model": "<MOMUS_OR_GPT_5_6_SOL>",
  "reasoning_effort": "<N/A_OR_XHIGH>",
  "session_or_process_id": "<RECEIPT>",
  "verdict": "<OKAY_OR_OTHER>",
  "dangerous_bypass_used": false
}
```

토큰, 쿠키, 인증 URL, 개인 선수 정보는 기록하지 않는다.

### 하나라도 OKAY가 아니면

1. 원장 상태를 승인 상태로 바꾸지 않는다.
2. 해당 라운드를 terminal non-approval로 기록한다.
3. 검토 PR에 수정 필요점과 파일 근거를 댓글로 남긴다.
4. 실제 WO017 작업을 시작하지 않는다.
5. 다음 사람에게 넘기기 전에 멈춘다.

### 둘 다 OKAY면

1. 원장 상태를 `high-accuracy-review-approved`로 바꾼다.
2. `pending-action`을 `execute-documentation-only-plan-and-stop-at-owner-gate`로 바꾼다.
3. 같은 라운드의 두 영수증을 원장에 추가한다.
4. 원장 파일만 별도 커밋으로 검토 브랜치에 푸시한다.
5. 검토 PR에 `DUAL REVIEW OKAY` 댓글을 남기고 두 세션 ID, 계획 해시, 커밋 SHA를 기록한다.
6. 검토 PR은 병합하지 않는다.

## 단계 D: 통과 후 실제로 맡겨도 되는 실행 작업

두 검토가 모두 `OKAY`인 경우에만 진행한다.

1. 최신 `origin/main`에서 깨끗한 실행 worktree와 브랜치를 만든다.
2. 브랜치 이름은 `codex/onboarding-motivation-work-order`를 우선 사용하되, 원격에 같은 브랜치나 WO017 실행 PR이 생겼다면 중복 작업을 중단하고 먼저 대조한다.
3. 승인된 검토 브랜치에서 계획 파일과 검토 원장만 실행 worktree로 가져온다.
4. 가져온 계획 파일의 SHA-256이 승인 영수증과 같은지 다시 확인한다.
5. 계획의 `Todos 1-11`과 `F1-F5`를 `omo:start-work` 절차로 수행한다.
6. 실제 산출물 범위는 문서, 검증기, 테스트, 인덱스, 인수 기록, 한 개의 제어 이슈와 네 개의 연결된 draft PR뿐이다.
7. 역할 경계를 지킨다.
   - Fable: 독립 UX, 문구, 모바일, 접근성, 페르소나 검토 산출물
   - Terra High: 저장소 바인딩, 계약, 검증기, 테스트, 인수 문서
   - Sol High: 다크패턴, 청소년 압박, 프라이버시, 거짓 기능 주장에 대한 비권위 자문 검토
   - 제품 소유자: 공개 제품 결정과 구현 활성화
8. 각 단계는 앞 단계의 실제 커밋 SHA와 PR 링크를 사용한다.
9. 네 draft PR의 마지막 상태는 `implementation_activation: PENDING_OWNER`여야 한다.
10. 앱 구현을 시작하지 않고 사용자에게 결과를 보고한다.

실행 브랜치로 승인 파일을 가져온 뒤, 검토 PR은 `review-only gate completed; transferred to <EXECUTION_BRANCH_OR_PR>`라는 댓글과 함께 **병합 없이 닫는다**. 이 PR이 열려 있으면 이후 WO017 중복 검색에 걸리므로, 실제 제어 이슈와 실행 PR을 만들기 전에 닫아야 한다.

## 다음 작업자의 최종 보고 형식

```text
WO017 인수 결과

1. 검토 PR
- URL:
- base/head:
- 변경 파일:
- 계획 SHA-256:

2. 고정밀 검토
- review_round_id:
- Momus 세션 / 판정:
- 독립 gpt-5.6-sol xhigh 세션 또는 프로세스 / 판정:
- 위험 우회 옵션 사용: 아니오

3. 실행 판단
- DUAL REVIEW OKAY 여부:
- 실제 문서 작업 착수 여부:
- 중단 또는 차단 사유:

4. 통과 후 산출물
- 제어 이슈:
- 발행 PR:
- Fable PR:
- Terra PR:
- Sol PR:
- 최종 상태: implementation_activation: PENDING_OWNER

5. 변경 금지 확인
- app/ 변경 없음:
- impl/ 변경 없음:
- 배포 변경 없음:
- 정본 승격/이슈 종료 없음:
```

## 완료 기준

- 검토 단계만 수행했다면: 동일 해시의 두 독립 검토 영수증과 명확한 실행/중단 판정이 있다.
- 실행까지 수행했다면: 계획의 모든 문서 검증이 통과하고 네 draft PR이 연결되어 있으며, 앱 변경 없이 제품 소유자 승인 단계에서 멈춘다.

[DRAFT_COMPLETE]
