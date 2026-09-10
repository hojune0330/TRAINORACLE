import { beforeEach, describe, expect, it } from "vitest"
import { createEmptyDecorationState, isTextStickerPageItem } from "./decorations"
import {
  appendJournalDecoration,
  appendJournalDecorationItem,
  appendJournalTextSticker,
  clearJournalAvatarDecoration,
  journalDecorationItems,
  reorderJournalDecoration,
} from "./journal-decoration-state"
import {
  clearJournalDecorationSessionClipboard,
  copyJournalDecorationToSession,
  readJournalDecorationFromSession,
} from "./journal-decoration-clipboard"

const DATE = "2026-08-31"

beforeEach(() => clearJournalDecorationSessionClipboard())

describe("decoration persona hardening", () => {
  it("uses a different visible spawn point for every slot up to the 24-item page limit", () => {
    let state = createEmptyDecorationState()

    for (let index = 0; index < 24; index += 1) {
      const next = appendJournalDecoration(state, DATE, "EMOJI_FIRE")
      expect(next).not.toBeNull()
      if (next === null) return
      state = next
    }

    const points = journalDecorationItems(state, DATE).map(({ transform }) => `${transform.xPercent}:${transform.yPercent}`)
    expect(points).toHaveLength(24)
    expect(new Set(points).size).toBe(24)
    expect(points.slice(0, 8)).toEqual([
      "18:28", "82:28", "18:82", "82:82", "50:28", "18:50", "82:50", "50:82",
    ])
  })

  it("keeps copied text private to session memory and returns defensive copies", () => {
    const state = appendJournalTextSticker(createEmptyDecorationState(), DATE, "오늘도 완료", "TEXT_INK_NAVY")
    expect(state).not.toBeNull()
    if (state === null) return
    const source = journalDecorationItems(state, DATE)[0]
    expect(source).toBeDefined()
    if (source === undefined) return

    copyJournalDecorationToSession(source)
    const firstRead = readJournalDecorationFromSession()
    expect(firstRead).not.toBeNull()
    if (firstRead === null) return

    const secondRead = readJournalDecorationFromSession()
    expect(secondRead).not.toBe(firstRead)
    expect(secondRead?.transform).not.toBe(firstRead.transform)
    expect(secondRead?.transform.xPercent).toBe(38)
    expect(secondRead !== null && isTextStickerPageItem(secondRead) ? secondRead.text : null).toBe("오늘도 완료")
  })

  it("pastes copied content at the target page spawn point while preserving size and rotation", () => {
    const sourceState = appendJournalDecoration(
      createEmptyDecorationState(),
      DATE,
      "EMOJI_MEDAL",
      { xPercent: 72, yPercent: 64, scale: 1.45, rotationDeg: 20 },
    )
    expect(sourceState).not.toBeNull()
    if (sourceState === null) return
    const source = journalDecorationItems(sourceState, DATE)[0]
    expect(source).toBeDefined()
    if (source === undefined) return

    const pasted = appendJournalDecorationItem(createEmptyDecorationState(), "2026-09-01", source)
    expect(journalDecorationItems(pasted ?? createEmptyDecorationState(), "2026-09-01")[0]).toMatchObject({
      itemId: "EMOJI_MEDAL",
      transform: { xPercent: 18, yPercent: 28, scale: 1.45, rotationDeg: 20 },
    })
  })

  it("moves a selected item backward without changing either item payload", () => {
    const first = appendJournalDecoration(createEmptyDecorationState(), DATE, "EMOJI_FIRE")
    const second = first === null ? null : appendJournalDecoration(first, DATE, "EMOJI_MEDAL")
    expect(second).not.toBeNull()
    if (second === null) return

    const moved = reorderJournalDecoration(second, DATE, 1, 0)
    expect(journalDecorationItems(moved ?? second, DATE).map((item) => item.itemId)).toEqual([
      "EMOJI_MEDAL",
      "EMOJI_FIRE",
    ])
  })

  it("clears only the equipped avatar when the drawer default tile is selected", () => {
    const state = createEmptyDecorationState()
    const equipped = {
      ...state,
      equipped: { ...state.equipped, avatarId: "AVATAR_EASY_JOG" as const },
    }
    const cleared = clearJournalAvatarDecoration(equipped)

    expect(cleared?.equipped).toEqual({
      ...equipped.equipped,
      avatarId: null,
    })
    expect(cleared?.ownedItemIds).toEqual(equipped.ownedItemIds)
    expect(cleared?.pages).toEqual(equipped.pages)
  })
})
