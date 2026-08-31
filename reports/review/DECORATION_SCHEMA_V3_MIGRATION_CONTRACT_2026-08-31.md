# 꾸미기 스키마 v3 마이그레이션 계약 (P4 선행 문서)

- 작성: 페이블 (독립 리뷰어)
- 날짜: 2026-08-31
- 근거: `DECORATION_EDITOR_COMMERCIAL_GRADE_MASTER_PLAN_2026-08-31.md` §3 P4, §5 진행 규칙("P4만 계약 문서 PR → 승인 → 구현 PR 2단계")
- 상태: **구현 착수 전 계약 확정용** — 이 문서가 머지된 뒤 구현 PR이 이 계약을 그대로 따른다.

## 0. 왜 v3인가 (한 줄)

v2는 페이지당 슬롯 7칸(HEADER_TAPE / TOP_CORNER / BODY_MARGIN / PAGE_FOOTER / BODY_STICKER_1..3) 고정이라
"같은 스티커 여러 개", "원하는 만큼 붙이기", "겹침 순서 바꾸기"가 구조적으로 불가능하다.
P3 복제 기능도 이 한계로 이모지(3칸)에만 적용됐다. v3는 슬롯을 버리고 자유 배열로 간다.

## 1. 저장 키와 버전

| 항목 | 값 |
|---|---|
| v2 키 (현행) | `trainoracle.decorations.v2` (계정 스코프 접두 포함) |
| v3 키 (신규) | `trainoracle.decorations.v3` (동일하게 `accountScopedStorageKey` 적용) |
| v2 원본 보존 키 | `trainoracle.decorations.v2-backup` |
| `version` 필드 | `3` (리터럴) |

- v3 키는 v2와 **별도 키**다. v2 키를 덮어쓰지 않는다 — 마이그레이션 실패·롤백 시 원본이 그대로 남는다.
- 로드 우선순위: `v3 → v2(마이그레이션) → v1(레거시 마이그레이션) → 빈 상태`.

## 2. v3 상태 구조

v2에서 바뀌는 부분은 `pagePlacements` 하나다. 나머지 필드(`spentPoints`, `ownedItemIds`, `equipped`,
`library`, `pointMeaning`)와 그 불변식(스타터 보유, 유료 참조는 보유 필수, spentPoints 하한)은 v2 그대로 유지한다.

```ts
type DecorationStateV3 = {
  version: 3
  spentPoints: number            // v2 동일
  ownedItemIds: DecorationId[]   // v2 동일 (이모지 ID 금지 규칙 포함)
  equipped: { themeId; inkId; avatarId }  // v2 동일
  library: { favoriteItemIds; recentItemIds }  // v2 동일
  pages: DecorationPageV3[]      // ← pagePlacements 대체
  pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA"
}

type DecorationPageV3 = {
  date: string                   // ISO YYYY-MM-DD, 페이지당 1행, date 중복 금지
  items: DecorationPageItemV3[]  // 최대 24개, 배열 순서 = 렌더 순서(뒤가 위)
}

type DecorationPageItemV3 = {
  itemId: PlacementDecorationId  // 배치형 카탈로그 ID (v2 동일 집합)
  transform: {                   // v3에서는 필수 (v2의 optional 폐지)
    xPercent: number             // 4 ~ 96, 0.1 단위
    yPercent: number             // 4 ~ 96, 0.1 단위
    scale: number                // 0.3 ~ 3.0, 0.05 단위  ← 범위 확장
    rotationDeg: number          // -180 ~ 180, 정수      ← 범위 확장
  }
}
```

### 계약 항목별 확정 사항

| # | 계약 | 값 | 근거 |
|---|---|---|---|
| C1 | 페이지당 아이템 상한 | **24** | 마스터 플랜 §3-12. 초과분은 로드 시 뒤에서부터 잘라낸다(fail-visible 아님 — 조용히 자르되 저장 시 재검증으로 고정) |
| C2 | z-순서 | **배열 인덱스 = 렌더 순서, 마지막 요소가 최상단** | 별도 zIndex 필드 없음 — 순서 이동은 배열 재배치로 |
| C3 | 같은 아이템 복수 | **허용** (슬롯 점유 검사 삭제) | 복제 기능을 전 품목으로 확장하는 P4 목적 자체 |
| C4 | scale 범위 | **0.3 ~ 3.0** (v2: 0.6~2.0) | §2.1 범위 확장. 스텝 0.05 유지 |
| C5 | rotation 범위 | **-180 ~ 180**, 정수 (v2: ±45) | §2.1. `-180`과 `180`은 동치지만 정규화하지 않고 둘 다 허용(라운드트립 안정성) |
| C6 | 위치 범위 | 4 ~ 96 유지, 0.1 단위 | 경계 마진은 P6(회전 AABB)에서 다룸 — v3 스키마는 v2 범위 유지 |
| C7 | 라운딩 | 저장 직전 `roundJournalDecorationTransform` 그대로 (0.1% / 0.05 / 1°) | 이미 P1에서 구현·검증됨 |
| C8 | transform 필수화 | v3 아이템은 transform **필수** | v2의 "슬롯 기본값" 개념이 사라지므로 optional 유지 불가 |
| C9 | 페이지 행 | `items`가 빈 배열이 된 페이지 행은 저장 시 제거 | 저장 크기 팽창 방어(§4 리스크) |

## 3. v2 → v3 읽기 마이그레이션 규칙

마이그레이션은 **로드 경로에서 1회** 수행한다. 절차:

1. `v3` 키가 있으면 그대로 파싱한다. **v2 키는 보지 않는다.** (끝)
2. `v3` 키가 없고 `v2` 키가 있으면:
   - **(백업 먼저)** `trainoracle.decorations.v2-backup` 키가 아직 없을 때만, v2 **원본 문자열을 그대로** 그 키에 1회 기록한다. 이미 있으면 덮어쓰지 않는다.
   - v2를 기존 `parseStoredDecorationState`(정규화 포함)로 읽는다. 실패하면 v1 → 빈 상태 순서로 폴백한다(현행 동일).
   - 성공한 v2 상태를 아래 **슬롯 → 좌표 변환표**로 v3로 변환한다.
   - 변환 결과를 v3 스키마로 검증한다. 실패 시(이론상 불가하지만) **v3 키를 쓰지 않고** v2 상태를 v3 메모리 형태로만 사용한다 — 다음 저장 성공 시점에 v3 키가 생긴다.
3. 저장은 항상 v3 키에만 쓴다. **v2 키는 마이그레이션 후에도 삭제하지 않는다** (구버전 코드가 남은 탭에서의 데이터 소실 방지 — v2 키는 이후 자연 방치).

### 슬롯 → 좌표 변환표 (기존 DEFAULT_PLACEMENT_TRANSFORMS와 동일)

v2 placement에 `transform`이 **있으면 그 값을 그대로** 사용한다(값 범위가 v3에서 더 넓으므로 항상 유효).
없으면 슬롯 기본 좌표를 사용한다:

| v2 슬롯 | xPercent | yPercent | scale | rotationDeg |
|---|---|---|---|---|
| HEADER_TAPE | 50 | 9 | 1 | 0 |
| TOP_CORNER | 86 | 14 | 1 | 0 |
| BODY_MARGIN | 88 | 48 | 1 | 0 |
| PAGE_FOOTER | 50 | 91 | 1 | 0 |
| BODY_STICKER_1 | 24 | 84 | 1 | -4 |
| BODY_STICKER_2 | 50 | 84 | 1 | 3 |
| BODY_STICKER_3 | 76 | 84 | 1 | -2 |

### v2 → v3 렌더 순서(z-순서) 결정

같은 날짜의 v2 placement들을 **슬롯 고정 순서**(HEADER_TAPE → TOP_CORNER → BODY_MARGIN →
PAGE_FOOTER → BODY_STICKER_1 → 2 → 3)로 배열에 넣는다. v2 렌더가 사실상 이 레이어 순서였으므로
시각 결과가 바뀌지 않는다.

## 4. 다운그레이드 불가 명시

- **v3 → v2 다운그레이드는 제공하지 않는다.** 자유 배열(복수 아이템, 24개, 확장 범위)은 슬롯 7칸으로 무손실 환원이 불가능하다.
- 구버전 앱이 v3 키를 만나면: 구버전은 v3 키를 모르므로 v2 키(마이그레이션 시 보존됨)를 읽는다 → 마이그레이션 시점 이전 상태로 보인다. 데이터 파괴는 없다.
- 사용자 노출 문구: 복원 화면에서 v3 백업 파일을 구버전이 읽지 못하는 경우 "이 백업은 최신 앱에서 만든 형식이에요. 앱을 새로고침한 뒤 다시 시도해 주세요."

## 5. 백업 파일(내보내기/복원) 계약 변경

현행: `trainoracle.journal.full-backup.v2` 형식의 `decorations` 필드에 v2 상태가 그대로 들어간다.

| 항목 | 계약 |
|---|---|
| 새 내보내기 형식 태그 | `trainoracle.journal.full-backup.v3` — `decorations` 필드에 **v3 상태** 수록 |
| v2 백업 파일 복원 | **계속 지원.** `full-backup.v2` / `full-backup.v1`의 v2 decorations를 §3 변환표로 v3화하여 복원 |
| v3 백업 파일 복원 | v3 스키마 검증 통과분만. 실패 시 현행과 동일하게 `INVALID_SKIPPED` |
| 안전 형식(`journal.v1`) | 변경 없음 (decorations 미포함) |
| 복원 시 `.v2-backup` | 백업 파일 복원은 `.v2-backup` 키를 건드리지 않는다 — 그 키는 로컬 자동 마이그레이션 원본 보존 전용 |

## 6. 도메인 API 이행 (구현 PR 범위 예고)

| v2 API | v3 대응 |
|---|---|
| `applyJournalDecoration(state, date, slot, itemId)` | `appendJournalDecoration(state, date, itemId, transform?)` — 배열 끝에 추가(=최상단), 24개 초과 시 거부 반환 |
| `removeJournalDecorationAt(state, date, slot)` | `removeJournalDecorationAt(state, date, index)` |
| `updateJournalDecorationTransform(..., slot, ...)` | `updateJournalDecorationTransform(..., index, ...)` |
| `duplicateJournalDecorationAt(state, date, slot)` (이모지 전용) | `duplicateJournalDecorationAt(state, date, index)` — **전 품목**, +4%/+4% 오프셋(96 캡), 24개 초과 시 거부 |
| `nextFreeEmojiSlot` | 삭제 (상한 검사 `canAppendJournalDecoration`으로 대체) |
| 신규 | `reorderJournalDecoration(state, date, from, to)` — z-순서 이동(맨 앞/뒤로) |
| 슬롯 레일 UI (`JournalDecorationToolbar` 슬롯 선택) | 슬롯 선택 단계 제거 — 아이템 탭 = 페이지 중앙 부근 자동 배치(50±약간의 지터, 겹침 완화) |

선택 상태는 `slot` 대신 `index`로 식별한다. 삭제·복제·재배치 후 인덱스 시프트는 커밋 시점에 재계산한다.

## 7. 검증 계획 (구현 PR 게이트)

1. **마이그레이션 왕복 속성 테스트**: 임의 유효 v2 상태 생성 → v3 변환 → 렌더 좌표가 v2 기본/저장 transform과 일치. `fast-check` 미도입이므로 수동 케이스 그리드(슬롯 7종 × transform 유/무 × 유료/무료)로 대체.
2. **`.v2-backup` 1회성**: 마이그레이션 2회 수행해도 백업 키 내용 불변.
3. **v2 백업 파일 복원 회귀**: 기존 `decoration-backup.contract.test.ts`의 v2 픽스처가 v3 상태로 복원되는지.
4. **24개 상한**: 25번째 추가 거부 + 사용자 안내 문구.
5. **z-순서**: 복수 동일 아이템 배치 후 배열 순서가 DOM 순서와 일치.
6. **범위 확장**: scale 0.3/3.0, rotation ±180 저장·복원 왕복.
7. **기존 v2 로컬 데이터 시나리오 e2e**: v2 키만 있는 상태에서 앱 로드 → 꾸미기 표시 동일 + v3 키 생성 + `.v2-backup` 존재.

## 8. 리스크 재확인

| 리스크 | 방어 (본 계약 반영) |
|---|---|
| 마이그레이션 중 데이터 유실 | v2 키 비파괴 + `.v2-backup` 원본 문자열 1회 보존 (§3) |
| 저장 크기 팽창 | 페이지당 24 상한 + 빈 페이지 행 제거 + 라운딩 (§2 C1/C7/C9) |
| 구버전 혼용 탭 | v2 키 미삭제로 구버전은 구버전대로 동작 (§4) |
| 백업 호환 단절 | v2/v1 백업 복원 경로 유지 (§5) |
