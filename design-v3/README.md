# design-v3 — 일지 중심 디자인 재작성 (2026-07-09)

status: DRAFT_FOR_REVIEW
owner: COACH_HOJUNE
rebuilt_on: origin/main (54bae11, SPEC 계층 포함)

---

## 1. 왜 재작성인가

- 기존 v3 작업(PR #1, `genspark_ai_developer` 브랜치)은 SPEC 핸드오프(PR #2 + 후속 커밋) **이전** 시점에서 분기했다.
- 그대로 머지하면 `specs/` 전체와 SPEC 메타 문서 184개 파일이 삭제된다. → **PR #1 폐기.**
- 브랜치 이식 대신, 최신 main 위에서 v3 디자인 철학·토큰·결정 사항을 **처음부터 다시 작성**했다.
- 원본 v3의 철학/결정 기록(`DESIGN_DECISIONS.md`, `HANDOFF_NEXT_CHAT.md`, `colors_and_type_journal.css`)은 폐기된 브랜치에서 참조만 했고, 코드는 전부 새로 썼다.

## 2. 구조

```
design-v3/
├── index.html              # 화면 인덱스
├── tokens/tokens.css       # v2 base + v3 journal 통합 토큰 (단일 파일)
└── screens/
    ├── 01_Home.html        # 오늘 일지 CTA + 어제 요약 + AI 1줄
    ├── 02_LogEntry.html    # 구조화 6문항 입력 + 비영속 메모
    ├── 03_LogDetail.html   # 일지 페이지 (인쇄 가능)
    └── 04_Trends.html      # 스파크라인 + 강도 분포 + 소스 상태
```

모든 화면은 self-contained HTML (외부 의존: Google Fonts + `tokens/tokens.css`).

## 3. 디자인 원칙 (유지되는 것)

v2 규칙 전부 유효 (`PHILOSOPHY.md`, `design-system/DESIGN_TOKENS.md`):

- 직각 — radius 기본 0, 인터랙티브만 ≤4px, 아바타 50%만 예외
- 그라데이션/네온/glow 금지 (highlighter만 예외)
- UI 이모지 금지 — 사용자 입력 영역만 자유
- 모든 숫자 `tabular-nums`
- 에너지 시스템 4-tier: T1 컬러바(세션 카드) / T2 차트 / T3 점+코드+underline / T4 wash
- serif 금지 — 손글씨 폰트(Caveat/Gowun Dodum)는 **사용자 입력 영역 전용**

v3 추가 (일지 미감):

- 종이 톤(`--paper`), dot grid / 줄노트 배경
- 인덱스 카드 헤더 (날짜·요일·날씨·`CYCLE_DAY` 라벨)
- 마스킹 테이프 사진, 잉크 스탬프(PB/SB), 만년필 잉크 손글씨
- mood 5단계 스트립, pain 5단계 도트
- `@media print` — "프린트해서 가지고 싶다"

## 4. SPEC-디자인 바인딩 규칙 (이번 재작성에서 새로 명문화)

이 디자인 계층은 `specs/`의 프론트엔드 표면이다. 화면은 아래 계약을 위반할 수 없다.

| UI 요소 | 바인딩된 SPEC 계약 | 규칙 |
|---|---|---|
| 메모 입력 (`02_LogEntry` Q6) | `DAILY_LOG_AND_CHECKIN_SPEC` §8 | raw memo는 기기 로컬 전용, 서버 영속 금지. UI에 "기기에만 보관" 상시 표기 |
| 통증/컨디션 입력 | `DAILY_LOG_AND_CHECKIN_SPEC` | 구조화 필드만 저장. 자유 서술 증상 문구는 저장 경로 없음 |
| 안전 상태 칩 (`.safety`) | `PLAN_SAFETY_GATE_SPEC` / `RULE_VALIDATION_ENGINE_CONTRACT` | UI는 ACTIVE/UNKNOWN/REVIEW 상태를 **표시만** 한다. 어떤 UI 입력도 D9 위험을 해제하지 못한다 |
| AI 표현 (`.conf`, 각주) | `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC` / `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC` | confidence 항상 표기(100% 금지), source ref 표기, 민감 정보 노출 금지 |
| 데이터 소스 상태 (`04_Trends` §3) | `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT` | missing/stale/conflicting 소스 상태를 시각적으로 숨기지 않는다 |
| `CYCLE_DAY` 라벨 | `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC` | 사이클 라벨은 `CYCLE_DAY.*` 네임스페이스만 사용, D1–D9 규칙 ID와 혼용 금지 |

주의: 위 SPEC들은 아직 DRAFT/RECONSTRUCTED_DRAFT 상태다. 이 바인딩은 source acceptance나 runtime evidence 주장이 아니며, 디자인이 계약 초안과 모순되지 않도록 하는 정렬일 뿐이다.

## 5. 기존 자산과의 관계

| 자산 | 상태 |
|---|---|
| `designs/` (v2 화면 13종) | 유지 — reference. v3가 Home/일지/Trends 흐름을 대체 |
| `design-system/*.md` | 유지 — v2 기준 문서. v3 토큰 통합안은 리뷰 후 반영 |
| PR #1 브랜치의 `ui_kits/trainoracle-app-v3/` (JSX) | 미이식 — 구현 단계에서 이 HTML 정본을 기준으로 재작성 예정 |

## 6. 남은 작업

1. 화면 확장: Calendar(9.5-day cycle), Race day 입력, 설정
2. `designs/README.md`·`HANDOFF.md`에 v3 정본 경로 반영 (리뷰 통과 후)
3. 구현 단계에서 React 컴포넌트화 (구 JSX 킷은 참고만)
