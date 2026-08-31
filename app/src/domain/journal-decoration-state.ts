import {
  MAX_DECORATION_ITEMS_PER_PAGE,
  decorationStateSchema,
  isAvatarDecorationId,
  isInkDecorationId,
  isPlacementDecorationId,
  isThemeDecorationId,
  rememberDecorationUse,
} from "./decorations"
import type {
  DecorationCatalogItem,
  DecorationPage,
  DecorationPageItem,
  DecorationPlacementTransform,
  DecorationState,
  PlacementDecorationId,
} from "./decorations"

/*
 * v3 새 배치 기본 좌표: 페이지 중앙 부근. 연속 배치가 완전히 겹치지 않게
 * 페이지의 현재 아이템 수로 약간의 지터를 준다 (계약 §6).
 */
export function defaultJournalDecorationTransform(state: DecorationState, date: string): DecorationPlacementTransform {
  const count = journalDecorationItems(state, date).length
  const jitter = (count % 5) * 3
  return { xPercent: 44 + jitter, yPercent: 44 + jitter, scale: 1, rotationDeg: 0 }
}

/*
 * 저장 정밀도 계약(마스터 플랜 §2.1): 위치 0.1%, 크기 0.05 스텝, 회전 정수 1°.
 * 제스처 중에는 원시 값으로 부드럽게 움직이고, 커밋 직전에만 라운딩한다.
 */
export function roundJournalDecorationTransform(transform: DecorationPlacementTransform): DecorationPlacementTransform {
  return {
    xPercent: Math.round(transform.xPercent * 10) / 10,
    yPercent: Math.round(transform.yPercent * 10) / 10,
    scale: Math.round(transform.scale * 20) / 20,
    rotationDeg: Math.round(transform.rotationDeg),
  }
}

export function journalDecorationPage(state: DecorationState, date: string): DecorationPage | undefined {
  return state.pages.find((page) => page.date === date)
}

export function journalDecorationItems(state: DecorationState, date: string): readonly DecorationPageItem[] {
  return journalDecorationPage(state, date)?.items ?? []
}

export function canAppendJournalDecoration(state: DecorationState, date: string): boolean {
  return journalDecorationItems(state, date).length < MAX_DECORATION_ITEMS_PER_PAGE
}

/* 페이지의 items 배열을 교체한다. 빈 배열이면 페이지 행 자체를 지운다 (계약 §2 C9). */
function withPageItems(state: DecorationState, date: string, items: readonly DecorationPageItem[]): unknown {
  const others = state.pages.filter((page) => page.date !== date)
  return {
    ...state,
    pages: items.length === 0 ? others : [...others, { date, items }],
  }
}

/*
 * 배열 끝에 추가 = 최상단 렌더 (계약 §2 C2). 24개 상한 초과 시 null.
 */
export function appendJournalDecoration(
  state: DecorationState,
  date: string,
  itemId: PlacementDecorationId,
  transform?: DecorationPlacementTransform,
): DecorationState | null {
  if (!canAppendJournalDecoration(state, date)) return null
  const items = journalDecorationItems(state, date)
  const parsed = decorationStateSchema.safeParse(withPageItems(state, date, [
    ...items,
    { itemId, transform: transform ?? defaultJournalDecorationTransform(state, date) },
  ]))
  return parsed.success ? parsed.data : null
}

/* 캔버스 위 삭제: 해당 인덱스 하나만 제거한다. */
export function removeJournalDecorationAt(
  state: DecorationState,
  date: string,
  index: number,
): DecorationState | null {
  const items = journalDecorationItems(state, date)
  if (index < 0 || index >= items.length) return null
  const parsed = decorationStateSchema.safeParse(
    withPageItems(state, date, items.filter((_, candidate) => candidate !== index)),
  )
  return parsed.success ? parsed.data : null
}

/*
 * 캔버스 위 복제 (계약 §6): v3에서는 전 품목 복제 가능. +4%,+4% 오프셋(96 캡),
 * 복제본은 배열 끝(최상단)에 붙는다. 상한 초과 시 null.
 */
export function duplicateJournalDecorationAt(
  state: DecorationState,
  date: string,
  index: number,
): DecorationState | null {
  const items = journalDecorationItems(state, date)
  const source = items[index]
  if (source === undefined) return null
  if (!canAppendJournalDecoration(state, date)) return null
  const parsed = decorationStateSchema.safeParse(withPageItems(state, date, [
    ...items,
    {
      itemId: source.itemId,
      transform: {
        ...source.transform,
        xPercent: Math.min(96, source.transform.xPercent + 4),
        yPercent: Math.min(96, source.transform.yPercent + 4),
      },
    },
  ]))
  return parsed.success ? parsed.data : null
}

export function updateJournalDecorationTransform(
  state: DecorationState,
  date: string,
  index: number,
  transform: DecorationPlacementTransform,
): DecorationState | null {
  const items = journalDecorationItems(state, date)
  if (items[index] === undefined) return null
  const parsed = decorationStateSchema.safeParse(withPageItems(
    state,
    date,
    items.map((item, candidate) => (candidate === index ? { ...item, transform } : item)),
  ))
  return parsed.success ? parsed.data : null
}

/*
 * z-순서 이동 (계약 §6): from 위치의 아이템을 to 위치로 옮긴다.
 * 맨 앞(0) = 최하단, 맨 뒤(length-1) = 최상단.
 */
export function reorderJournalDecoration(
  state: DecorationState,
  date: string,
  from: number,
  to: number,
): DecorationState | null {
  const items = journalDecorationItems(state, date)
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return null
  if (from === to) return state
  const moved = [...items]
  const [item] = moved.splice(from, 1)
  if (item === undefined) return null
  moved.splice(to, 0, item)
  const parsed = decorationStateSchema.safeParse(withPageItems(state, date, moved))
  return parsed.success ? parsed.data : null
}

function candidateState(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
): DecorationState | unknown | null {
  if (isThemeDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, themeId: item.id } }
  }
  if (isInkDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, inkId: item.id } }
  }
  if (isAvatarDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, avatarId: item.id } }
  }
  if (!isPlacementDecorationId(item.id)) return state
  if (!canAppendJournalDecoration(state, date)) return null
  const items = journalDecorationItems(state, date)
  return withPageItems(state, date, [
    ...items,
    { itemId: item.id, transform: defaultJournalDecorationTransform(state, date) },
  ])
}

export function previewJournalDecoration(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
): DecorationState | null {
  const candidate = candidateState(state, item, date)
  if (candidate === null) return null
  if (isThemeDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, themeId: item.id } }
  }
  if (isInkDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, inkId: item.id } }
  }
  if (isAvatarDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, avatarId: item.id } }
  }
  const parsed = decorationStateSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export function applyJournalDecoration(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
): DecorationState | null {
  if (!state.ownedItemIds.includes(item.id)) return null
  const previewed = previewJournalDecoration(state, item, date)
  if (previewed === null) return null
  return rememberDecorationUse(previewed, item.id)
}

/* 도구 서랍의 "제거": 이 날짜에서 해당 아이템을 전부 뗀다. */
export function removeJournalDecoration(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
): DecorationState | null {
  if (!isPlacementDecorationId(item.id)) return null
  const items = journalDecorationItems(state, date)
  const parsed = decorationStateSchema.safeParse(
    withPageItems(state, date, items.filter((candidate) => candidate.itemId !== item.id)),
  )
  return parsed.success ? parsed.data : null
}
