# TRAINORACLE 3단계 작업 하네스

이 하네스는 남은 일을 **작업의 위험도와 판단 범위**로 나눕니다.
한 번 정한 규칙을 다음 단계가 다시 해석하지 않게 해서, 뒤로 갈수록 읽을 자료와
지시문을 줄입니다.

| 단계 | 맡기는 일 | 실행 설정 | 자료 제한 | 지시서 제한 |
|---|---|---|---:|---:|
| `S1_DEEP_FRAME` | 정책·훈련 논리·위험·선택지 정리 | 높음 | 10개 | 12,000자 |
| `S2_BOUNDED_BUILD` | 승인된 계약의 문서·코드·테스트 반영 | 중간 | 6개 | 6,000자 |
| `S3_MECHANICAL_BATCH` | 정해진 형식의 검사·옮기기·상태 동기화 | `gpt-5.6-terra` / 높음 | 3개 | 3,000자 |

글자 수와 자료 수는 토크나이저가 달라도 적용되는 제한입니다. 실제 토큰 사용량을
정확히 보장한다는 뜻은 아닙니다.

## 가장 중요한 규칙

- 작업량이 많다고 낮은 단계가 되지 않습니다.
- 코치 결정, 과학적 해석, 법률 판단, 사람 승인, 런타임 활성화는 낮은 단계에 줄 수 없습니다.
- 중간 단계는 결정이 끝난 일만 구현합니다.
- 낮은 단계는 결과를 기계적으로 확인할 명령이 있는 일만 받습니다.
- 3단계는 작업 범위는 작지만, 누락을 줄이기 위해 `gpt-5.6-terra`의 높은 추론으로 실행합니다.
- 근거 불일치, 범위 확대, 사람 권한 필요, 검사 실패가 생기면 멈추고 다음 작업자에게 넘깁니다.
- 167편 사람 선별과 전문가 6인 검토는 반복 작업처럼 보여도 `BLOCKED_HUMAN`입니다.
- 모든 출력은 `runtime_authority: false`를 유지합니다.

## 사용법

추가 설치 없이 저장소 루트에서 실행합니다.

```bash
node specs/test-packages/reasoning-tier-harness.mjs validate
node specs/test-packages/reasoning-tier-harness.mjs next --stage S1_DEEP_FRAME
node specs/test-packages/reasoning-tier-harness.mjs next --stage S2_BOUNDED_BUILD
node specs/test-packages/reasoning-tier-harness.mjs next --stage S3_MECHANICAL_BATCH
```

`next`는 `READY`이고 선행 작업이 모두 `DONE`인 일만 고릅니다. 할 수 있는 일이
없으면 억지로 만들지 않고 `NO_READY_TASKS`를 출력합니다.

## 공유 Codex 스킬

[`codex-skills/terra-sol-router/SKILL.md`](../../codex-skills/terra-sol-router/SKILL.md)는
작업 단계가 바뀔 때 Terra와 Sol을 어떻게 넘겨 쓸지, 두 컴퓨터가 Git 커밋 SHA로
어떻게 이어받을지를 정의합니다. 이 하네스가 **할 일을 선별**한다면 스킬은
**선별된 일을 어떤 모델과 다음 작업자에게 넘길지** 정합니다.

사무실 PC에서 저장소를 받은 뒤 PowerShell로 설치합니다.

```powershell
$source = ".\codex-skills\terra-sol-router"
$target = Join-Path $HOME ".codex\skills\terra-sol-router"
New-Item -ItemType Directory -Force "$target\agents" | Out-Null
Copy-Item "$source\SKILL.md" "$target\SKILL.md" -Force
Copy-Item "$source\agents\openai.yaml" "$target\agents\openai.yaml" -Force
```

설치 후 `$terra-sol-router`로 호출합니다. 저장소 사본은 배포 원본이고, 각 PC의
`$HOME/.codex/skills/terra-sol-router`가 실제 실행 위치입니다.

## 상태 뜻

| 상태 | 뜻 |
|---|---|
| `READY` | 지금 수행 가능 |
| `WAIT_DEPENDENCY` | 앞 단계 결과를 기다림 |
| `BLOCKED_OWNER` | 책임자 결정이 필요함 |
| `BLOCKED_HUMAN` | 이름과 자격이 확인된 사람 검토가 필요함 |
| `DEFERRED_VOLUME` | 단순하지만 양이 많아 낮은 비용 작업 묶음으로 미룸 |
| `DONE` | 증거와 검사가 있는 완료 상태 |

## 현재 선별 결과

- 1단계: 코치 규칙, 부하·최소근거, 개인정보, 파일럿, 화면 검토가 사람 결정을 기다립니다.
- 2단계: 위 결정이 끝나기 전에는 정본 패치나 Plan Generator 작업을 시작하지 않습니다.
- 3단계: 게이트 재검증까지 완료했습니다. 논문 메타데이터와 문서 상태 동기화는
  `DEFERRED_VOLUME`로 보류했으며, 현재 새로 실행할 `READY` 작업은 없습니다.

정본 목록은 `TRAINORACLE_WORK_CATALOG.json`입니다. 상태를 바꿀 때는 근거 파일의
확인 문구도 함께 갱신해야 합니다. 근거가 달라지면 검증기가 오래된 카탈로그를 거부합니다.

다음 작업자가 바로 이어받을 내용은 `NEXT_WORKER_HANDOFF.md`에 있습니다.
