import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CalendarDecorationFrame, safeCalendarTransform } from "../../components/CalendarDecorationFrame"
import { DECORATION_CATALOG, isPlacementDecorationId } from "../../domain/decorations"
import type { DecorationCatalogItem } from "../../domain/decorations"
import { createEmptyCalendarDecorationState, calendarDecorationStateSchema } from "../../domain/calendar-decoration-schema"
import type { CalendarDecorationEditorHandle } from "./CalendarDecorationEditor"
import { CalendarDecorationEditor } from "./CalendarDecorationEditor"

afterEach(() => cleanup())

function placementItem(): DecorationCatalogItem {
  const item = DECORATION_CATALOG.find((candidate) => isPlacementDecorationId(candidate.id))
  if (!item) throw new Error("Calendar decoration fixture requires a placement catalog item")
  return item
}

describe("CalendarDecorationEditor", () => {
  it("gives margin selection, reset options, and apply/cancel controls explicit names", () => {
    render(<CalendarDecorationEditor state={createEmptyCalendarDecorationState()} ownedIds={new Set()} onApply={vi.fn(async () => true)} onExit={vi.fn()}><div>달력</div></CalendarDecorationEditor>)

    expect(screen.getByRole("group", { name: "장식할 여백" })).toBeVisible()
    expect(screen.getByText("달력 초기화")).toBeVisible()
    expect(screen.getByRole("group", { name: "달력 변경 적용" })).toBeVisible()
  })

  it("allows explicit retry of an unchanged rejected outbox without treating it as a new dirty edit", async () => {
    const state = createEmptyCalendarDecorationState()
    const onApply = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const ref = React.createRef<CalendarDecorationEditorHandle>()
    render(<CalendarDecorationEditor ref={ref} state={state} ownedIds={new Set()} requiresApply onApply={onApply} onExit={vi.fn()}><div>달력</div></CalendarDecorationEditor>)
    expect(ref.current?.hasDirty()).toBe(false)
    expect(screen.getByRole("button", { name: "모든 달에 적용" })).toBeEnabled()
    await act(async () => { expect(await ref.current?.requestApply()).toBe(false) })
    expect(onApply).toHaveBeenCalledWith(state)
    expect(screen.getByRole("button", { name: "모든 달에 적용" })).toBeEnabled()
    await act(async () => { expect(await ref.current?.requestApply()).toBe(true) })
    expect(onApply).toHaveBeenCalledTimes(2)
    expect(ref.current?.hasDirty()).toBe(false)
  })

  it("keeps catalog preview out of the draft until the material is applied", () => {
    const item = placementItem()
    const ref = React.createRef<CalendarDecorationEditorHandle>()
    const state = createEmptyCalendarDecorationState()
    render(
      <CalendarDecorationEditor ref={ref} state={state} ownedIds={new Set([item.id])} onApply={vi.fn(async () => true)} onExit={vi.fn()}>
        <button type="button">2026년 10월 달력</button>
      </CalendarDecorationEditor>,
    )

    act(() => ref.current?.previewMaterial(item))
    expect(screen.getByRole("button", { name: "2026년 10월 달력" })).toBeVisible()
    expect(ref.current?.hasDirty()).toBe(false)
    expect(screen.getByRole("button", { name: new RegExp(`${item.name}.*장식`) })).toBeVisible()

    act(() => ref.current?.clearPreview())
    expect(ref.current?.hasDirty()).toBe(false)
    expect(screen.queryByRole("button", { name: new RegExp(`${item.name}.*장식`) })).toBeNull()

    act(() => ref.current?.applyMaterial(item))
    expect(ref.current?.hasDirty()).toBe(true)
    expect(screen.getByRole("button", { name: new RegExp(`${item.name}.*선택됨`) })).toBeVisible()
  })

  it("applies a single all-month draft only on request and retains it after a failed save", async () => {
    const item = placementItem()
    const state = createEmptyCalendarDecorationState()
    const onApply = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const ref = React.createRef<CalendarDecorationEditorHandle>()
    const onDirtyChange = vi.fn()
    render(
      <CalendarDecorationEditor ref={ref} state={state} ownedIds={new Set([item.id])} onApply={onApply} onExit={vi.fn()} onDirtyChange={onDirtyChange}>
        <button type="button">2026년 10월 달력</button>
      </CalendarDecorationEditor>,
    )

    act(() => ref.current?.applyMaterial(item))
    expect(onApply).not.toHaveBeenCalled()
    expect(ref.current?.hasDirty()).toBe(true)

    await act(async () => { expect(await ref.current?.requestApply()).toBe(false) })
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply.mock.calls[0]?.[0]).toMatchObject({ version: 1, items: [{ itemId: item.id, region: "HEADER_MARGIN" }] })
    expect(ref.current?.hasDirty()).toBe(true)

    await act(async () => { expect(await ref.current?.requestApply()).toBe(true) })
    expect(onApply).toHaveBeenCalledTimes(2)
    expect(ref.current?.hasDirty()).toBe(false)
    expect(onDirtyChange).toHaveBeenCalledWith(true)
    expect(onDirtyChange).toHaveBeenCalledWith(false)
  })

  it("limits decorative items to three per margin and six overall", () => {
    const item = placementItem()
    const state = createEmptyCalendarDecorationState()
    const fullHeader = calendarDecorationStateSchema.parse({
      ...state,
      items: [1, 2, 3].map((n) => ({ placementId: `f4c50000-0000-4000-8000-${String(n).padStart(12, "0")}`, itemId: item.id, region: "HEADER_MARGIN", transform: { xPercent: 20 + n * 20, yPercent: 50, scale: 1, rotationDeg: 0 } })),
    })
    const ref = React.createRef<CalendarDecorationEditorHandle>()
    render(
      <CalendarDecorationEditor ref={ref} state={fullHeader} ownedIds={new Set([item.id])} onApply={vi.fn(async () => true)} onExit={vi.fn()}>
        <button type="button">달력</button>
      </CalendarDecorationEditor>,
    )
    act(() => ref.current?.applyMaterial(item))
    expect(ref.current?.hasDirty()).toBe(false)
    expect(screen.getByText("한쪽 여백에는 장식을 3개까지 둘 수 있어요.")).toBeVisible()
    expect(screen.getByText(/3\/6 장식/)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "아래쪽 여백 0/3" }))
    for (let index = 0; index < 3; index++) act(() => ref.current?.applyMaterial(item))
    expect(ref.current?.getDraft().items).toHaveLength(6)
    act(() => ref.current?.applyMaterial(item))
    expect(ref.current?.getDraft().items).toHaveLength(6)
    expect(screen.getByText("달력 여백에는 장식을 6개까지 둘 수 있어요.")).toBeVisible()
  })

  it("does not replace a dirty draft when a newer parent state arrives", () => {
    const item = placementItem()
    const ref = React.createRef<CalendarDecorationEditorHandle>()
    const initial = createEmptyCalendarDecorationState()
    const newer = calendarDecorationStateSchema.parse({ ...initial, paperThemeId: "THEME_TRACK_NOTEBOOK" })
    const { rerender } = render(
      <CalendarDecorationEditor ref={ref} state={initial} ownedIds={new Set([item.id])} onApply={vi.fn(async () => false)} onExit={vi.fn()}>
        <button type="button">달력</button>
      </CalendarDecorationEditor>,
    )
    act(() => ref.current?.applyMaterial(item))
    expect(ref.current?.hasDirty()).toBe(true)

    rerender(
      <CalendarDecorationEditor ref={ref} state={newer} ownedIds={new Set([item.id])} onApply={vi.fn(async () => false)} onExit={vi.fn()}>
        <button type="button">달력</button>
      </CalendarDecorationEditor>,
    )

    expect(ref.current?.hasDirty()).toBe(true)
    expect(screen.getByRole("button", { name: new RegExp(`${item.name}.*선택됨`) })).toBeVisible()
    expect(screen.getByRole("button", { name: "모든 달에 적용" })).toBeEnabled()
  })
})

describe("CalendarDecorationFrame", () => {
  it("keeps decorative layers in the reserved margins and leaves calendar controls in the content", () => {
    const item = placementItem()
    const state = calendarDecorationStateSchema.parse({
      version: 1,
      paperThemeId: null,
      items: [{ placementId: "f4c50000-0000-4000-8000-000000000001", itemId: item.id, region: "HEADER_MARGIN", transform: { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 } }],
    })
    render(<CalendarDecorationFrame state={state}><button type="button">10일 · 오전 주요</button></CalendarDecorationFrame>)
    expect(screen.getByRole("button", { name: "10일 · 오전 주요" })).toBeVisible()
    expect(screen.getByRole("group", { name: "달력 상단 여백 장식" })).toBeVisible()
    expect(screen.queryByRole("group", { name: "달력 하단 여백 장식" })).toBeNull()
  })

  it("keeps highly scaled rotated art within the reserved band on both axes", () => {
    const item = placementItem()
    const state = calendarDecorationStateSchema.parse({
      version: 1,
      paperThemeId: null,
      items: [{ placementId: "f4c50000-0000-4000-8000-000000000001", itemId: item.id, region: "HEADER_MARGIN", transform: { xPercent: 4, yPercent: 96, scale: 2, rotationDeg: 45 } }],
    })
    render(<CalendarDecorationFrame state={state} editable><button type="button">달력 셀</button></CalendarDecorationFrame>)
    const decoration = screen.getByRole("button", { name: new RegExp(`${item.name} 장식`) })
    const safe = safeCalendarTransform(state.items[0]!.transform, 320)
    const radians = safe.rotationDeg * Math.PI / 180
    const half = 40 * safe.scale * (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians))) / 2
    expect(safe.xPercent / 100 * 320 - half).toBeGreaterThanOrEqual(8)
    expect(safe.yPercent / 100 * 72 + half).toBeLessThanOrEqual(64)
    expect(Number.parseFloat(decoration.style.left)).toBe(safe.xPercent)
    expect(Number.parseFloat(decoration.style.top)).toBe(safe.yPercent)
    expect(state.items[0]!.transform).toEqual({ xPercent: 4, yPercent: 96, scale: 2, rotationDeg: 45 })
  })

  it("omits empty margins even in the editor", () => {
    const { container } = render(<CalendarDecorationFrame state={createEmptyCalendarDecorationState()} editable><button type="button">달력</button></CalendarDecorationFrame>)
    expect(container.querySelectorAll(".calendar-decoration-frame__band")).toHaveLength(0)
  })
  it("keeps small hit targets and large rotated art inside the margin across widths", () => {
    for (const width of [316, 349, 1000]) for (const scale of [0.3, 1, 3]) for (const rotationDeg of [0, 45, 180]) {
      const safe = safeCalendarTransform({ xPercent: 4, yPercent: 96, scale, rotationDeg }, width)
      const radians = safe.rotationDeg * Math.PI / 180
      const artHalf = 40 * safe.scale * (Math.abs(Math.sin(radians)) + Math.abs(Math.cos(radians))) / 2
      const x = safe.xPercent / 100 * width, y = safe.yPercent / 100 * 72
      expect(x - artHalf).toBeGreaterThanOrEqual(8 - 1e-6)
      expect(y + artHalf).toBeLessThanOrEqual(64 + 1e-6)
      expect(x - 22).toBeGreaterThanOrEqual(-1e-6)
      expect(y + 22).toBeLessThanOrEqual(72 + 1e-6)
    }
  })
})
