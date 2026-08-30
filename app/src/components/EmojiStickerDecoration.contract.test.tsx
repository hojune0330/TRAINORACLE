import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  DECORATION_STORAGE_KEY_V2,
  EMOJI_STICKER_IDS,
  EMOJI_STICKER_SLOTS,
  createEmptyDecorationState,
  decorationCatalogItem,
  decorationStateSchema,
  loadDecorationState,
  parseStoredDecorationState,
} from "../domain/decorations"
import {
  applyJournalDecoration,
  resolveJournalDecorationSlot,
} from "../domain/journal-decoration-state"
import { DecoratedJournalPageFrame } from "./DecoratedJournalPageFrame"

afterEach(cleanup)
beforeEach(() => window.localStorage.clear())

/*
 * 이모지 스티커 V1 계약 (검수 계약 2026-08-29):
 * 1) 유니코드 텍스트로만 렌더 — 벤더 아트워크 이미지 로드 금지.
 * 2) 페이지당 최대 3개 — 전용 슬롯 3칸으로 구조적 강제.
 * 3) 빈 칸 자동 배정 — 첫 번째 비어 있는 스티커 칸에 붙는다.
 * 4) 기존 v2 저장 상태도 마이그레이션 없이 48종을 자동 획득한다.
 * 5) 스티커는 날짜(페이지)에 붙는다 — 메모·항목과 무상관.
 */
describe("emoji sticker decoration contract", () => {
  it("renders emoji stickers as unicode text spans, never as image assets", () => {
    const state = decorationStateSchema.parse({
      ...createEmptyDecorationState(),
      pagePlacements: [
        { date: "2026-08-29", slot: "BODY_STICKER_1", itemId: "EMOJI_FIRE" },
      ],
    })

    render(
      <DecoratedJournalPageFrame date="2026-08-29" state={state}>
        <p>오늘 훈련 기록</p>
      </DecoratedJournalPageFrame>,
    )

    const sticker = screen.getByTestId("journal-slot-body-sticker-1")
    expect(sticker.tagName).toBe("SPAN")
    expect(sticker).toHaveTextContent("🔥")
    expect(sticker).not.toHaveAttribute("src")
    // 벤더 이모지 아트워크 파일을 절대 요청하지 않는다.
    expect(document.querySelectorAll("img[src*='emoji']")).toHaveLength(0)
  })

  it("caps emoji stickers at three per page through the three dedicated slots", () => {
    const base = createEmptyDecorationState()
    const full = decorationStateSchema.parse({
      ...base,
      pagePlacements: [
        { date: "2026-08-29", slot: "BODY_STICKER_1", itemId: "EMOJI_SUN" },
        { date: "2026-08-29", slot: "BODY_STICKER_2", itemId: "EMOJI_MEDAL" },
        { date: "2026-08-29", slot: "BODY_STICKER_3", itemId: "EMOJI_RICE" },
      ],
    })

    // 슬롯 중복(같은 날짜·같은 칸)은 스키마가 거부한다.
    const duplicated = decorationStateSchema.safeParse({
      ...base,
      pagePlacements: [
        { date: "2026-08-29", slot: "BODY_STICKER_1", itemId: "EMOJI_SUN" },
        { date: "2026-08-29", slot: "BODY_STICKER_1", itemId: "EMOJI_FIRE" },
      ],
    })
    expect(duplicated.success).toBe(false)

    // 세 칸이 가득 차면 네 번째 이모지는 첫 칸 교체로만 가능하다(자동 배정이 첫 칸을 돌려줌).
    const fourth = decorationCatalogItem("EMOJI_HEART")
    expect(fourth).toBeDefined()
    expect(resolveJournalDecorationSlot(full, fourth!, "2026-08-29")).toBe("BODY_STICKER_1")
    const replaced = applyJournalDecoration(full, fourth!, "2026-08-29")
    expect(replaced).not.toBeNull()
    expect(replaced!.pagePlacements.filter((placement) => placement.date === "2026-08-29")).toHaveLength(3)
  })

  it("assigns the first free sticker slot automatically", () => {
    const item = decorationCatalogItem("EMOJI_SHOE")
    expect(item).toBeDefined()
    const empty = createEmptyDecorationState()

    // 빈 페이지 → 첫 칸.
    expect(resolveJournalDecorationSlot(empty, item!, "2026-08-29")).toBe("BODY_STICKER_1")

    // 첫 칸이 차 있으면 → 둘째 칸. 다른 날짜의 배치는 세지 않는다.
    const oneUsed = decorationStateSchema.parse({
      ...empty,
      pagePlacements: [
        { date: "2026-08-29", slot: "BODY_STICKER_1", itemId: "EMOJI_SUN" },
        { date: "2026-08-28", slot: "BODY_STICKER_2", itemId: "EMOJI_MOON" },
      ],
    })
    const applied = applyJournalDecoration(oneUsed, item!, "2026-08-29")
    expect(applied).not.toBeNull()
    expect(applied!.pagePlacements).toContainEqual({ date: "2026-08-29", slot: "BODY_STICKER_2", itemId: "EMOJI_SHOE" })
  })

  it("auto-grants all 48 emoji stickers to previously stored v2 states without a migration", () => {
    // Given: 이모지 도입 전에 저장된 v2 상태(이모지 미보유).
    const legacyV2 = {
      version: 2,
      spentPoints: 8,
      ownedItemIds: ["THEME_TRACK_NOTEBOOK", "INK_NAVY", "STICKER_WEATHER_SUN", "STAMP_REST_DAY", "TAPE_CHECKER", "STICKER_FINISH_LINE"],
      equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null },
      library: { favoriteItemIds: [], recentItemIds: [] },
      pagePlacements: [],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    }
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, JSON.stringify(legacyV2))

    // When
    const state = loadDecorationState()

    // Then: 무료 스타터인 이모지 48종을 전부 보유하며, 기존 구매(유료)도 유지된다.
    for (const emojiId of EMOJI_STICKER_IDS) {
      expect(state.ownedItemIds).toContain(emojiId)
    }
    expect(state.ownedItemIds).toContain("STICKER_FINISH_LINE")
    expect(state.spentPoints).toBe(8)
    expect(state.version).toBe(2)
  })

  it("attaches stickers to the date only, with no reference to memos or entries", () => {
    // 배치 레코드는 date/slot/itemId 세 필드뿐 — 메모·항목 식별자가 끼어들 수 없다.
    const state = decorationStateSchema.parse({
      ...createEmptyDecorationState(),
      pagePlacements: [
        { date: "2026-08-29", slot: "BODY_STICKER_1", itemId: "EMOJI_CLOVER" },
      ],
    })
    expect(Object.keys(state.pagePlacements[0]!).sort()).toEqual(["date", "itemId", "slot"])

    // 메모 식별자를 끼워 넣은 배치는 스키마가 그대로 통과시키지 않는다(알 수 없는 키 제거 또는 거부).
    const smuggled = decorationStateSchema.safeParse({
      ...createEmptyDecorationState(),
      pagePlacements: [
        { date: "2026-08-29", slot: "BODY_STICKER_1", itemId: "EMOJI_CLOVER", memoId: "secret-1" },
      ],
    })
    if (smuggled.success) {
      expect(Object.keys(smuggled.data.pagePlacements[0]!)).not.toContain("memoId")
    }

    // 전용 슬롯 3칸이 전부이며 이모지 전 품목이 그 3칸만 호환한다.
    expect(EMOJI_STICKER_SLOTS).toHaveLength(3)
  })

  it("keeps legacy slots intact and renders a moved sticker from normalized page coordinates", () => {
    const state = decorationStateSchema.parse({
      ...createEmptyDecorationState(),
      pagePlacements: [{
        date: "2026-08-29",
        slot: "BODY_STICKER_1",
        itemId: "EMOJI_FIRE",
        transform: { xPercent: 72, yPercent: 34, scale: 1.4, rotationDeg: 12 },
      }],
    })

    const { container } = render(
      <DecoratedJournalPageFrame date="2026-08-29" state={state}>
        <p>오늘 훈련 기록</p>
      </DecoratedJournalPageFrame>,
    )

    const freeItem = container.querySelector<HTMLElement>(".decorated-journal-page__free-item")
    expect(freeItem).not.toBeNull()
    expect(freeItem).toHaveStyle({ left: "72%", top: "34%" })
    expect(freeItem?.style.transform).toContain("rotate(12deg)")
    expect(freeItem?.style.transform).toContain("scale(1.4)")
    expect(screen.queryByTestId("journal-sticker-rail")).toBeNull()
  })

  it("drops only an invalid free transform while preserving the saved decoration", () => {
    const base = createEmptyDecorationState()
    const stored = parseStoredDecorationState(JSON.stringify({
      ...base,
      pagePlacements: [{
        date: "2026-08-29",
        slot: "BODY_STICKER_1",
        itemId: "EMOJI_FIRE",
        transform: { xPercent: 999, yPercent: 34, scale: 1, rotationDeg: 0 },
      }],
    }))

    expect(stored?.pagePlacements).toEqual([{ date: "2026-08-29", slot: "BODY_STICKER_1", itemId: "EMOJI_FIRE" }])
  })
})
