import {
  MAX_DECORATION_ITEMS_PER_PAGE,
  TEXT_STICKER_ITEM_ID,
  decorationCatalogItem,
  decorationStateSchema,
  isAvatarDecorationId,
  isInkDecorationId,
  isPlacementDecorationId,
  isTextStickerPageItem,
  isThemeDecorationId,
  rememberDecorationUse,
  textStickerTextSchema,
} from "./decorations"
import type {
  DecorationCatalogItem,
  DecorationPage,
  DecorationPageItem,
  DecorationPlacementTransform,
  DecorationState,
  PlacementDecorationId,
  TextInkId,
} from "./decorations"

/*
 * v3 새 배치 기본 좌표: 24개 상한까지 서로 다른 지점에 놓는다.
 * 중앙에 3%씩 겹치던 이전 방식은 여섯 번째부터 완전히 같은 자리에 놓여
 * 사용자가 "붙이기 실패"로 오해할 수 있었다. 가장자리부터 채워 본문을
 * 덜 가리고, 붙인 직후 선택된 장식을 바로 찾을 수 있게 한다.
 *
 * 세로 좌표 하한: 상세 페이지 상단은 날짜 카드(≈0–10%) 바로 아래에
 * "일지 더 쓰기 / 수정" 버튼 띠(≈10–20%)가 놓인다. 장식 상자 높이가
 * 프레임의 약 10%이므로 첫 스폰 행은 y≥24로 잡아 버튼을 덮지 않는다.
 */
const JOURNAL_DECORATION_SPAWN_POINTS = [
  [18, 28], [82, 28], [18, 82], [82, 82],
  [50, 28], [18, 50], [82, 50], [50, 82],
  [30, 24], [70, 24], [24, 36], [76, 36],
  [24, 64], [76, 64], [30, 76], [70, 76],
  [42, 26], [58, 26], [26, 44], [74, 44],
  [26, 56], [74, 56], [42, 74], [58, 74],
] as const

const JOURNAL_WIDE_DECORATION_SPAWN_POINTS = [
  [38, 24], [50, 24], [62, 24],
  [38, 34], [50, 34], [62, 34],
  [38, 44], [50, 44], [62, 44],
  [38, 56], [50, 56], [62, 56],
  [38, 66], [50, 66], [62, 66],
  [38, 76], [50, 76], [62, 76],
  [38, 86], [50, 86], [62, 86],
  /* 날짜 카드 위 행은 버튼 띠와 가장 가까워 마지막 순서로 둔다. */
  [38, 6], [50, 6], [62, 6],
] as const

export function defaultJournalDecorationTransform(
  state: DecorationState,
  date: string,
  itemId?: DecorationPageItem["itemId"],
): DecorationPlacementTransform {
  const count = journalDecorationItems(state, date).length
  const catalogItem = itemId === undefined || itemId === TEXT_STICKER_ITEM_ID
    ? undefined
    : decorationCatalogItem(itemId)
  const points = itemId === TEXT_STICKER_ITEM_ID || catalogItem?.category === "TAPE"
    ? JOURNAL_WIDE_DECORATION_SPAWN_POINTS
    : JOURNAL_DECORATION_SPAWN_POINTS
  const point = points[count % points.length] ?? points[0]
  const [xPercent, yPercent] = point
  return { xPercent, yPercent, scale: 1, rotationDeg: 0 }
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
    { itemId, transform: transform ?? defaultJournalDecorationTransform(state, date, itemId) },
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
  /* 텍스트 스티커의 text/inkId까지 통째로 보존해야 한다 (P5 계약 §3 게이트 4). */
  const parsed = decorationStateSchema.safeParse(withPageItems(state, date, [
    ...items,
    {
      ...source,
      transform: {
        ...source.transform,
        xPercent: Math.min(96, source.transform.xPercent + 4),
        yPercent: Math.min(96, source.transform.yPercent + 4),
      },
    },
  ]))
  return parsed.success ? parsed.data : null
}

/*
 * 텍스트 스티커 부착 (P5 계약 §1 T7): 24개 상한을 카탈로그 아이템과 공유한다.
 * 텍스트는 스키마(1~20자, trim 후 비어있지 않음)로 검증 — 실패 시 null.
 */
export function appendJournalTextSticker(
  state: DecorationState,
  date: string,
  text: string,
  inkId: TextInkId,
  transform?: DecorationPlacementTransform,
): DecorationState | null {
  if (!canAppendJournalDecoration(state, date)) return null
  const parsedText = textStickerTextSchema.safeParse(text)
  if (!parsedText.success) return null
  const items = journalDecorationItems(state, date)
  const parsed = decorationStateSchema.safeParse(withPageItems(state, date, [
    ...items,
    {
      itemId: TEXT_STICKER_ITEM_ID,
      text: parsedText.data,
      inkId,
      transform: transform ?? defaultJournalDecorationTransform(state, date, TEXT_STICKER_ITEM_ID),
    },
  ]))
  return parsed.success ? parsed.data : null
}

/*
 * 세션 복사판 붙여넣기: 이모지·장식·글 스티커의 내용과 모양은 보존하되,
 * 대상 날짜의 다음 빈 시작점에 놓는다. OS 클립보드나 영구 저장소에는 쓰지 않는다.
 */
export function appendJournalDecorationItem(
  state: DecorationState,
  date: string,
  source: DecorationPageItem,
): DecorationState | null {
  if (!canAppendJournalDecoration(state, date)) return null
  const items = journalDecorationItems(state, date)
  const spawn = defaultJournalDecorationTransform(state, date, source.itemId)
  const copied = {
    ...source,
    transform: {
      ...spawn,
      scale: source.transform.scale,
      rotationDeg: source.transform.rotationDeg,
    },
  }
  const parsed = decorationStateSchema.safeParse(withPageItems(state, date, [...items, copied]))
  return parsed.success ? parsed.data : null
}

/*
 * 텍스트 스티커 재편집 (P5 계약 §2 U4): 위치·크기·회전은 건드리지 않고
 * text/inkId만 바꾼다. 대상이 텍스트 스티커가 아니면 null.
 */
export function updateJournalTextSticker(
  state: DecorationState,
  date: string,
  index: number,
  text: string,
  inkId: TextInkId,
): DecorationState | null {
  const items = journalDecorationItems(state, date)
  const target = items[index]
  if (target === undefined || !isTextStickerPageItem(target)) return null
  const parsedText = textStickerTextSchema.safeParse(text)
  if (!parsedText.success) return null
  const parsed = decorationStateSchema.safeParse(withPageItems(
    state,
    date,
    items.map((item, candidate) => (candidate === index
      ? { ...target, text: parsedText.data, inkId }
      : item)),
  ))
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
    { itemId: item.id, transform: defaultJournalDecorationTransform(state, date, item.id) },
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

/* 아바타 카테고리의 "기본으로" 선택. 서랍에서 항목을 제거하지 않고
 * 전환형 장식만 명시적으로 비운다. */
export function clearJournalAvatarDecoration(state: DecorationState): DecorationState | null {
  const parsed = decorationStateSchema.safeParse({
    ...state,
    equipped: { ...state.equipped, avatarId: null },
  })
  return parsed.success ? parsed.data : null
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
