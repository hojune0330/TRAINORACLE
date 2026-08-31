import { beforeEach, describe, expect, it } from "vitest"
import {
  DECORATION_STORAGE_KEY_V3,
  MAX_DECORATION_ITEMS_PER_PAGE,
  createEmptyDecorationState,
  decorationStateSchema,
  isTextStickerPageItem,
  loadDecorationState,
  parseStoredDecorationState,
  saveDecorationState,
} from "./decorations"
import type { DecorationState, TextInkId } from "./decorations"
import {
  appendJournalDecoration,
  appendJournalTextSticker,
  duplicateJournalDecorationAt,
  journalDecorationItems,
  updateJournalTextSticker,
} from "./journal-decoration-state"
import { readBackupFile } from "./restore/backup-file"

const DATE = "2026-08-02"
const TRANSFORM = { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 }

function withTextSticker(text = "오늘도 완주", inkId: TextInkId = "TEXT_INK_RED"): DecorationState {
  const next = appendJournalTextSticker(createEmptyDecorationState(), DATE, text, inkId, TRANSFORM)
  if (next === null) throw new Error("text sticker fixture failed")
  return next
}

beforeEach(() => {
  window.localStorage.clear()
})

/* P5 계약 §3 게이트 1 — 스키마 왕복과 오염 거부. */
describe("text sticker schema roundtrip (P5 contract §1)", () => {
  it("keeps a text sticker identical across save → load → save", () => {
    // Given
    const state = withTextSticker()

    // When
    expect(saveDecorationState(state).ok).toBe(true)
    const loaded = loadDecorationState()

    // Then
    const items = journalDecorationItems(loaded, DATE)
    expect(items).toHaveLength(1)
    const item = items[0]
    if (item === undefined || !isTextStickerPageItem(item)) throw new Error("expected text sticker")
    expect(item).toEqual({ itemId: "TEXT_STICKER", text: "오늘도 완주", inkId: "TEXT_INK_RED", transform: TRANSFORM })
    expect(JSON.parse(JSON.stringify(loaded))).toEqual(JSON.parse(JSON.stringify(state)))
  })

  it.each([
    ["missing text", { itemId: "TEXT_STICKER", inkId: "TEXT_INK_NAVY", transform: TRANSFORM }],
    ["missing inkId", { itemId: "TEXT_STICKER", text: "안녕", transform: TRANSFORM }],
    ["unknown inkId", { itemId: "TEXT_STICKER", text: "안녕", inkId: "INK_NAVY", transform: TRANSFORM }],
    ["empty text", { itemId: "TEXT_STICKER", text: "", inkId: "TEXT_INK_NAVY", transform: TRANSFORM }],
    ["blank text", { itemId: "TEXT_STICKER", text: "   ", inkId: "TEXT_INK_NAVY", transform: TRANSFORM }],
    ["21-char text", { itemId: "TEXT_STICKER", text: "가".repeat(21), inkId: "TEXT_INK_NAVY", transform: TRANSFORM }],
    ["text on catalog item (T10)", { itemId: "STICKER_WEATHER_SUN", text: "오염", inkId: "TEXT_INK_NAVY", transform: TRANSFORM }],
  ])("rejects %s at the strict schema", (_label, item) => {
    // Given
    const candidate = { ...createEmptyDecorationState(), pages: [{ date: DATE, items: [item] }] }

    // When / Then
    expect(decorationStateSchema.safeParse(candidate).success).toBe(false)
  })

  it("drops only the broken text sticker from stored raw data, keeping valid neighbors", () => {
    // Given — 저장 원본 정규화 경로 (strict 파서와 달리 아이템 단위 제외)
    const base = createEmptyDecorationState()
    const raw = JSON.stringify({
      ...base,
      pages: [{
        date: DATE,
        items: [
          { itemId: "TEXT_STICKER", text: "가".repeat(21), inkId: "TEXT_INK_NAVY", transform: TRANSFORM },
          { itemId: "TEXT_STICKER", text: "유효한 글", inkId: "TEXT_INK_GREEN", transform: TRANSFORM },
          { itemId: "STICKER_WEATHER_SUN", transform: TRANSFORM },
        ],
      }],
    })

    // When
    const parsed = parseStoredDecorationState(raw)

    // Then
    expect(parsed).not.toBeNull()
    const items = journalDecorationItems(parsed as DecorationState, DATE)
    expect(items).toHaveLength(2)
    expect(items.map((item) => item.itemId)).toEqual(["TEXT_STICKER", "STICKER_WEATHER_SUN"])
  })
})

/* P5 계약 §3 게이트 2 — 20자 경계. */
describe("text sticker length boundary (P5 contract T2)", () => {
  it("accepts exactly 20 characters", () => {
    // Given / When
    const next = appendJournalTextSticker(createEmptyDecorationState(), DATE, "가".repeat(20), "TEXT_INK_NAVY")

    // Then
    expect(next).not.toBeNull()
  })

  it("rejects 21 characters and blank input", () => {
    // Given
    const base = createEmptyDecorationState()

    // When / Then
    expect(appendJournalTextSticker(base, DATE, "가".repeat(21), "TEXT_INK_NAVY")).toBeNull()
    expect(appendJournalTextSticker(base, DATE, "   ", "TEXT_INK_NAVY")).toBeNull()
    expect(appendJournalTextSticker(base, DATE, "", "TEXT_INK_NAVY")).toBeNull()
  })
})

/* P5 계약 §3 게이트 3 — 재편집 도메인 경로 (시트 UI는 e2e). */
describe("text sticker re-edit (P5 contract U4)", () => {
  it("updates text and ink without touching the transform", () => {
    // Given
    const state = withTextSticker()

    // When
    const next = updateJournalTextSticker(state, DATE, 0, "고친 글", "TEXT_INK_VIOLET")

    // Then
    expect(next).not.toBeNull()
    const item = journalDecorationItems(next as DecorationState, DATE)[0]
    if (item === undefined || !isTextStickerPageItem(item)) throw new Error("expected text sticker")
    expect(item.text).toBe("고친 글")
    expect(item.inkId).toBe("TEXT_INK_VIOLET")
    expect(item.transform).toEqual(TRANSFORM)
  })

  it("refuses to re-edit a catalog item or an out-of-range index", () => {
    // Given
    const catalogOnly = appendJournalDecoration(createEmptyDecorationState(), DATE, "STICKER_WEATHER_SUN", TRANSFORM)
    if (catalogOnly === null) throw new Error("catalog fixture failed")

    // When / Then
    expect(updateJournalTextSticker(catalogOnly, DATE, 0, "오염", "TEXT_INK_NAVY")).toBeNull()
    expect(updateJournalTextSticker(withTextSticker(), DATE, 5, "없음", "TEXT_INK_NAVY")).toBeNull()
  })
})

/* P5 계약 §3 게이트 4 — 복제가 텍스트·잉크를 보존한다 (T8). */
describe("text sticker duplication (P5 contract T8)", () => {
  it("copies text and ink with the +4/+4 offset", () => {
    // Given
    const state = withTextSticker()

    // When
    const next = duplicateJournalDecorationAt(state, DATE, 0)

    // Then
    expect(next).not.toBeNull()
    const items = journalDecorationItems(next as DecorationState, DATE)
    expect(items).toHaveLength(2)
    const copy = items[1]
    if (copy === undefined || !isTextStickerPageItem(copy)) throw new Error("expected duplicated text sticker")
    expect(copy.text).toBe("오늘도 완주")
    expect(copy.inkId).toBe("TEXT_INK_RED")
    expect(copy.transform).toEqual({ ...TRANSFORM, xPercent: 54, yPercent: 54 })
  })

  it("counts toward the shared 24-item cap (T7)", () => {
    // Given — 상한까지 채운다
    let state: DecorationState | null = createEmptyDecorationState()
    for (let index = 0; index < MAX_DECORATION_ITEMS_PER_PAGE - 1; index += 1) {
      state = appendJournalDecoration(state as DecorationState, DATE, "STICKER_WEATHER_SUN", TRANSFORM)
      if (state === null) throw new Error("cap fixture failed")
    }
    state = appendJournalTextSticker(state, DATE, "마지막 한 장", "TEXT_INK_ORANGE", TRANSFORM)
    expect(state).not.toBeNull()

    // When / Then — 24개째 이후에는 텍스트도 카탈로그도 못 붙는다
    expect(appendJournalTextSticker(state as DecorationState, DATE, "초과", "TEXT_INK_NAVY")).toBeNull()
    expect(duplicateJournalDecorationAt(state as DecorationState, DATE, 0)).toBeNull()
  })
})

/* P5 계약 §3 게이트 5 — full-backup.v3 왕복 보존. */
describe("text sticker backup roundtrip (P5 contract §1 backward-compat)", () => {
  it("survives a full-backup.v3 export → read cycle", () => {
    // Given
    const state = withTextSticker("백업 왕복", "TEXT_INK_BLACK")
    const backup = JSON.stringify({
      app: "TRAINORACLE",
      format: "trainoracle.journal.full-backup.v3",
      exportedAt: "2026-08-31T00:00:00.000Z",
      entries: [],
      decorations: state,
    })

    // When
    const read = readBackupFile(backup)

    // Then
    expect(read.recognized).toBe(true)
    expect(read.decorationStatus).toBe("included")
    expect(read.decorations).not.toBeNull()
    const items = journalDecorationItems(read.decorations as DecorationState, DATE)
    expect(items).toHaveLength(1)
    const item = items[0]
    if (item === undefined || !isTextStickerPageItem(item)) throw new Error("expected text sticker in backup")
    expect(item.text).toBe("백업 왕복")
    expect(item.inkId).toBe("TEXT_INK_BLACK")
  })

  it("keeps the v3 storage payload strict-parseable after a text sticker save", () => {
    // Given
    expect(saveDecorationState(withTextSticker()).ok).toBe(true)

    // When
    const raw = window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)

    // Then — 저장 원본이 strict 스키마도 그대로 통과해야 한다 (정규화 의존 금지)
    expect(raw).not.toBeNull()
    expect(decorationStateSchema.safeParse(JSON.parse(raw as string)).success).toBe(true)
  })
})
