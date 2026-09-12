# DS01_MUTATION_EVIDENCE.md

## 실행 조건

- 실행일: 2026-09-12, Windows, Node v24.11.1, Vitest v4.1.10.
- 검사 코드: `302e130`의 `app/src/styles/visual-system.contract.test.ts`.
- 별도 detached 작업 복사본: `.scratch/design-ds01-mutation-20260912`.
- 시험 입력: DS-01의 수정 전 소스 `00ca7c5e2e7f70d7c0f18e3e351c2392c51af23f`에서 루트 일지 CSS, AppChrome, app/plan/content/lexicon CSS 및 AccountPlanStorage CSS를 복사본에만 복원했다.
- 실제 작업 브랜치와 기존 검토 증거에는 수정 전 코드를 덮어쓰지 않았다.

## 실행 명령

```text
node node_modules/vitest/vitest.mjs run src/styles/visual-system.contract.test.ts --pool=threads --maxWorkers=1 --reporter=verbose
```

## 실제 결과

시작 09:40:15 KST, 29.20초. 종료 코드1, 8개 중 3개 통과·5개 실패.
아래 이름의 실패는 수정 전 결함을 잡은 기대된 실패다.

| 실패한 검사 | 관측한 원인 |
|---|---|
| does not bring decorative left stripes or card shadows back | 루트 `.tape`의 `0 1px 2px rgba(0,0,0,0.08)` 그림자 탐지 |
| maps the audited DS-01 colors to defined semantic tokens | 기존 `var(--accent)` 참조 탐지 |
| keeps plan legends touch-safe, two-column at phone widths, and reflowable under zoom | 수정 전 범례의 확대 대응 규칙 미충족 |
| keeps receipt toasts clear of decoration controls without suppressing review alerts | 수정 전 receipt/review 표현 분리 규칙 부재 |
| uses readable semantic type tokens for DS-01 status and explanation text | 기존 8.5px 글자 선언 탐지 |

첫 JSON reporter 실행은 테스트0개·success false로 종료하여 검증 근거에서 제외했다. 추가 시도의 지원되지 않는 `--minWorkers` 옵션도 검사 실행으로 세지 않는다. 위 verbose 단일 worker 실행에서 실제 이름이 있는 8개 검사가 실행됨을 확인했다.

이 결과는 수정 전 소스를 새 검사로 구별할 수 있다는 증거다. CSS 소스 검사가 실제 레이아웃·가림·포커스 동작까지 검증했다는 의미가 아니며, 통합 렌더링 검수는 별도로 수행한다.

[DRAFT_COMPLETE]
