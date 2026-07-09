# TRAINORACLE — app/ (Phase 1 workspace)

실서비스 앱 워크스페이스. `SERVICE_DEVELOPMENT_MASTER_PLAN.md` Phase 1 산출물.

- **스택**: Vite + React 18 + TypeScript (strict)
- **토큰 단일 소스**: 저장소 루트 `colors_and_type.css` + `colors_and_type_journal.css`를 직접 import (이중 정의 금지)
- **안전 로직**: `impl/`을 `@impl/*` alias로 직접 import (ADR A3 — 이중 구현 금지)

## 매트릭스 반영 (SPEC_SCREEN_TRACEABILITY_MATRIX)
- **C5 수정**: `cycleDay` prop bare string 금지 → `src/domain/display-label.ts`의
  `CycleDayLabel { namespace: "CYCLE_DAY", value, isRuleId: false }` typed object만 허용
- **C1 계열**: LogDetail variant B의 규칙 언급은 `RuleIdLabel`(RULE_SPEC_D1_D9)로 백킹, `RULE R-7` 형태로 렌더
- **GAP_UI**: 통증 4~5 입력 시 `PainReviewBanner`(Review 상태) 노출 — 표시 전용, 안전 판정 해제 없음
- **§8 memo_policy**: 모든 자유 입력 아래 `PrivacyNote` 유지
- `src/safety/memo-safety.ts`: D9 평가기 transient 래퍼 — 원문 비영속, 평가기 실패 → `D9_UNKNOWN` fail-safe

## 명령
```bash
npm ci
npm run dev       # 개발 서버 (5173)
npm run build     # tsc --noEmit + vite build
npm run preview   # 빌드 산출물 프리뷰 (4173)
```

## 규칙
- 이 디렉토리는 **총책임자 전담** (CODEX_WORK_ORDER_003 §0 규칙 9 — Codex 수정 금지)
