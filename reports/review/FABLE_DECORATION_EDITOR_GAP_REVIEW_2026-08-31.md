# 꾸미기 편집기(#291~#293 기준) 리뷰 + 다음 단계 준비 보고서

```yaml
doc_id: fable-decoration-editor-gap-review-2026-08-31
status: REVIEW_AND_IMPLEMENTATION_PLAN
reviewer: fable (independent)
base_commit: 2a3b122 (#293)
scope: journal_decoration_fullscreen_editor
runtime_authority: false
```

## 1. 리뷰 결론 요약

#291 전체화면 편집기는 "상점 → 편집기" 전환이라는 방향 전환을 정확하게 해냈다.
아키텍처(비율 좌표 저장, v2 하위호환, Zod 경계 검증, 낙관적 잠금 커밋)는 견고하다.
다만 이미지 편집 앱의 표준 조작 문법과 비교하면 **6개의 구체적 격차**가 있고,
그중 1건은 **기존 44px 터치 계약 위반**이다.

## 2. 좋은 점 (유지할 것)

| # | 항목 | 근거 |
|---|---|---|
| G1 | 비율 좌표(`xPercent/yPercent` 4–96, `scale` 0.6–2, `rotationDeg` ±45)를 Zod로 경계 검증 | `decoration-schema.ts:40-45` — 화면 크기가 달라도 같은 자리, 손상 값 차단 |
| G2 | 좌표 없는 v2 저장 자료를 슬롯 기본값으로 폴백 | `defaultJournalDecorationTransform` — 마이그레이션 없이 하위호환 |
| G3 | 낙관적 잠금 커밋(`saveDecorationStateIfCurrent` + STALE_STATE 복구) | `JournalDecorationSurface.tsx:74-83` — 다중 화면 동시 편집 데이터 유실 방지 |
| G4 | 제스처마다 `setPointerCapture` + `pointerId` 검증 + `startTransform` 기준 계산 | `DecoratedJournalPageFrame.tsx:115-169` — 드리프트 없는 안정적 드래그 |
| G5 | 키보드 화살표/`+`/`-`가 포인터와 같은 clamp 계약 사용 | 접근성과 데이터 규칙이 한 곳 |
| G6 | 이모지 텍스트 렌더 전용(벤더 아트워크 없음), 원문 일지 비변경 | 법무 검수 계약 2026-08-29 준수 |
| G7 | 적용 즉시 도구 서랍 자동 닫힘 + 방금 배치한 항목 자동 선택 | 편집기다운 흐름 |

## 3. 격차 (이미지 편집 앱 표준 대비)

| # | 격차 | 심각도 | 현재 코드 |
|---|---|---|---|
| B1 | **변환 핸들 36px** — 프로젝트 44px 터치 계약 위반. 게다가 `--rotate`가 top-right, `--resize`가 bottom-right 모서리에 몰려 있어 작은 스티커에서 오터치 | **높음(계약 위반)** | `journal-decoration.css:204-221` |
| B2 | **두 손가락 핀치/회전 없음** — 제스처가 단일 `pointerId`만 추적. 모바일 사진앱 사용자의 1차 본능인 핀치가 무반응 | 높음 | `DecoratedJournalPageFrame.tsx:75-84` (PointerGesture가 단일 포인터 구조) |
| B3 | **Undo 1단계뿐, Redo 없음** — `undoState`가 단일 값. 두 번 이상 실수하면 복구 불가 | 중간 | `JournalDecorationSurface.tsx:48` |
| B4 | **빈 캔버스 탭으로 선택 해제 불가** — 선택 해제 경로가 닫기/서랍 열기뿐. 편집앱 표준(빈 곳 탭 = deselect) 미지원 | 중간 | free-layer에 배경 탭 핸들러 없음 |
| B5 | **선택 상태에서 캔버스 위 삭제 없음** — 제거하려면 서랍을 다시 열어 목록에서 그 항목을 찾아야 함. 선택 테두리에 삭제 버튼이 있는 게 표준 | 중간 | 삭제는 `JournalDecorationToolbar` 서랍 내부에만 존재 |
| B6 | **레이어 순서(z-order) 없음** — 겹친 스티커의 앞뒤를 바꿀 수 없음. 스키마에 zIndex 부재 | 낮음(스티커 3개 상한이라 당장 충돌 드묾) | `decoration-schema.ts` transform에 z 없음 |

## 4. 레퍼런스·웹 컴포넌트 수집 평가

오너 지시대로 "이미 있는 것 수집"을 먼저 검토했다.

### 4.1 후보 라이브러리

| 후보 | 제공 기능 | 크기(min+gzip 추정) | 판정 |
|---|---|---|---|
| `react-moveable` (daybrush) | drag/resize/rotate/pinch/group/snap 전부 | 수십 KB급, 의존 트리 큼 | **부적합** — 필요 기능의 80%가 이미 자체 구현돼 있고, 스냅/그룹은 미사용. DOM 구조를 자체 관리해 44px 계약·디자인 계약(선·색 대비, 그림자 금지) 강제 불가 |
| `interact.js` | drag/resize/멀티터치 제스처 | ~40KB급 | **부적합** — React 외부 명령형 API, 기존 포인터 계약과 이중 관리 |
| `@use-gesture/react` | pinch/drag 훅 (렌더 없음) | ~7–10KB | **차선** — 훅만 제공해 디자인 계약과 충돌 없음. 다만 아래 4.2처럼 필요한 건 "두 포인터 거리·각도 계산" 30줄 정도라 자체 확장이 더 싸다 |
| `re-resizable`, `react-rnd` | resize/drag | 10–20KB | 부적합 — 회전 없음, 비율 좌표 모델과 불일치 |

### 4.2 수집 대신 차용 결정 (패턴 수집)

TrainOracle의 실제 결핍은 라이브러리가 아니라 **두 포인터 수학 패턴**이다.
기존 `PointerGesture`를 `Map<pointerId, {x,y}>`로 확장하고,
포인터 2개일 때 `Math.hypot` 거리비 → scale, `Math.atan2` 각도차 → rotation을
기존 clamp(0.6–2, ±45) 계약에 그대로 태우면 된다. 이는 use-gesture 내부 구현과
동일한 수학이며(공식 문서 pinch 섹션), 의존성 0개로 끝난다.

**결정: 신규 런타임 의존성 0개 유지.**
근거: ① 현재 deps 5개( supabase/lucide/react/react-dom/zod ) 최소 유지 기조,
② 이미 G4의 포인터 인프라가 있음, ③ 라이브러리들이 강제하는 DOM/스타일이
프로젝트 디자인 계약(그림자 금지 등, #291 검증에서 그림자 5곳 제거 이력)과 충돌.

### 4.3 UX 패턴 레퍼런스 (기존 조사 보완)

- 기존 조사 2건을 재사용한다(중복 조사 배제):
  - `reports/research/DIARY_DECORATION_UX_REFERENCE_RESEARCH_2026-08-30.md` (하루콩·MOODA·ZEPETO·PIGG PARTY·Livly·Pokecolo)
  - `reports/review/FULLSCREEN_DIARY_DECORATION_EDITOR_REFERENCE_2026-08-31.md` (Canva·LINE Camera·Google Photos·Apple HIG)
- 이번 격차에 해당하는 표준 문법 추가 확인:
  - LINE Camera·Instagram Stories: 스티커 선택 시 테두리에 **삭제(×)·복제 버튼**, 빈 곳 탭 = 선택 해제
  - Canva 모바일: **두 손가락 핀치 = 크기, 두 손가락 비틀기 = 회전** (핸들과 병행 제공)
  - Google Photos 마크업: **Undo/Redo 쌍** 제공
  - Apple HIG Undo/Redo: 파괴적 행동 앞 복구 경로 보장

## 5. 구현 계획 (다음 PR 순서)

### P1 — 계약 위반 즉시 수정 + 저비용 표준 문법 (이번에 준비)
1. **B1**: 핸들 44×44px로 확대(시각 지름은 36 유지 가능 — 히트영역만 `::before` 확장), 회전은 top-center·크기는 bottom-right로 분리
2. **B4**: free-layer 배경 탭/Escape로 선택 해제
3. **B5**: 선택 테두리에 삭제 버튼(44px) — 기존 `onRemove` 재사용
4. e2e: 선택→빈곳 탭 해제, 선택→삭제 시나리오 추가

### P2 — 핀치 제스처 (의존성 0)
5. **B2**: `PointerGesture`를 2-포인터 Map으로 확장, 거리비→scale·각도차→rotation, 기존 clamp 재사용. reduced-motion 무관(모션 아님), 터치 e2e는 Playwright `touchscreen` 2포인터로 검증

### P3 — 이력 (도메인 선행)
6. **B3**: `undoState: DecorationState | null` → `past/future` 스택(상한 20)으로 교체하는 순수 함수 `decoration-history.ts` 신설, Redo 버튼 추가. localStorage에는 최종 상태만 저장(이력은 세션 메모리) — 스키마 변경 없음
7. **B6**(보류 가능): zIndex는 스키마 확장이 필요하므로 P3에서 별도 계약 리뷰 후 진행. 스티커 3개 상한 동안은 "선택한 항목을 맨 앞으로" 렌더 순서 규칙만으로 충분할 수 있음

### 검증 관문 (전 단계 공통)
- 기존 꾸미기 계약 테스트 전량 + 신규 테스트, KST 포함
- 320×568 / 375×667 가로 넘침 0
- 새 그림자·새 의존성 0 (디자인·의존성 계약)
- v2(transform 없는) 저장 자료 폴백 회귀 확인

## 6. 범위 경계

일지 원문·비밀 메모·분석 입력·D9 안전 상태는 건드리지 않는다.
포인트/구매 로직 변경 없음. 스키마 변경은 P3 zIndex 논의 전까지 없음.
