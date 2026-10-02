import React from "react"
import { decorationCatalogItem, isEmojiStickerId, isPlacementDecorationId } from "../domain/decorations"
import type { CalendarDecorationState, CalendarDecorationRegion } from "../domain/calendar-decoration-schema"
import type { DecorationId, DecorationPlacementTransform } from "../domain/decorations"
import "./CalendarDecorationFrame.css"

type CalendarDecorationFrameProps = {
  readonly state: CalendarDecorationState
  readonly children: React.ReactNode
  readonly editable?: boolean
  readonly allowedItemIds?: ReadonlySet<DecorationId>
  readonly selectedPlacementId?: string | null
  readonly onSelectPlacement?: (placementId: string) => void
  readonly onTransformPlacement?: (placementId: string, region: CalendarDecorationRegion, transform: DecorationPlacementTransform) => void
  readonly onDeletePlacement?: (placementId: string) => void
}
const SAFE_INSET_PX = 8
const ART_LONG_EDGE_PX = 40
const BAND_HEIGHT_PX = 72
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** Conservative rotated artwork bounds. Display corrections never rewrite saved coordinates. */
export function safeCalendarTransform(transform: DecorationPlacementTransform, regionWidth = 320): DecorationPlacementTransform {
  const width = Math.max(44 + SAFE_INSET_PX * 2, regionWidth)
  const rotationDeg = clamp(transform.rotationDeg, -180, 180)
  const radians = rotationDeg * Math.PI / 180
  const rotationBound = Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians))
  const maxScale = Math.min(3, (Math.min(width, BAND_HEIGHT_PX) - SAFE_INSET_PX * 2) / (ART_LONG_EDGE_PX * rotationBound))
  const scale = clamp(transform.scale, 0.3, maxScale)
  const inset = Math.max(22, SAFE_INSET_PX + ART_LONG_EDGE_PX * scale * rotationBound / 2)
  return {
    xPercent: clamp(transform.xPercent, Math.max(4, inset / width * 100), Math.min(96, (width - inset) / width * 100)),
    yPercent: clamp(transform.yPercent, Math.max(4, inset / BAND_HEIGHT_PX * 100), Math.min(96, (BAND_HEIGHT_PX - inset) / BAND_HEIGHT_PX * 100)),
    scale, rotationDeg,
  }
}
function assetUrl(assetPath: string): string {
  return (import.meta.env.BASE_URL ?? "/") + assetPath.replace(/^\/+/, "")
}
function CalendarFrameAsset({ item }: { readonly item: NonNullable<ReturnType<typeof decorationCatalogItem>> }) {
  const [failed, setFailed] = React.useState(false)
  if (isEmojiStickerId(item.id)) return <span className="calendar-decoration-frame__emoji" aria-hidden="true">{item.emoji}</span>
  if (failed) return <span className="calendar-decoration-frame__fallback" aria-hidden="true">·</span>
  return <img src={assetUrl(item.assetPath)} alt="" draggable={false} onError={() => setFailed(true)} />
}
export function CalendarDecorationFrame({ state, children, editable = false, allowedItemIds,
  selectedPlacementId = null, onSelectPlacement, onTransformPlacement, onDeletePlacement }: CalendarDecorationFrameProps) {
  const frame = React.useRef<HTMLElement>(null)
  const [regionWidth, setRegionWidth] = React.useState(320)
  const drag = React.useRef<{ placementId: string; region: CalendarDecorationRegion; transform: DecorationPlacementTransform; moved: boolean } | null>(null)
  const [dragPreview, setDragPreview] = React.useState<typeof drag.current>(null)
  React.useLayoutEffect(() => {
    const node = frame.current
    if (!node) return
    const measure = () => { if (node.clientWidth > 0) setRegionWidth(node.clientWidth) }
    measure()
    if (typeof ResizeObserver === "undefined") { window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure) }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const itemsByRegion = React.useMemo(() => ({
    HEADER_MARGIN: state.items.filter(item => item.region === "HEADER_MARGIN" && (allowedItemIds === undefined || allowedItemIds.has(item.itemId))),
    FOOTER_MARGIN: state.items.filter(item => item.region === "FOOTER_MARGIN" && (allowedItemIds === undefined || allowedItemIds.has(item.itemId))),
  }), [state.items, allowedItemIds])
  const theme = state.paperThemeId && (allowedItemIds === undefined || allowedItemIds.has(state.paperThemeId)) ? decorationCatalogItem(state.paperThemeId) : undefined
  const themeStyle = theme?.assetPath ? { "--calendar-paper-art": 'url("' + assetUrl(theme.assetPath) + '")' } as React.CSSProperties : undefined
  const handleKeyDown = (event: React.KeyboardEvent, placementId: string, region: CalendarDecorationRegion, transform: DecorationPlacementTransform) => {
    if (!editable || !onTransformPlacement) return
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); onDeletePlacement?.(placementId); return }
    const step = event.shiftKey ? 2 : 0.5
    const next = { ...transform }
    if (event.key === "+" || event.key === "=") next.scale += event.shiftKey ? 0.2 : 0.1
    else if (event.key === "-") next.scale -= event.shiftKey ? 0.2 : 0.1
    else if (event.key === "]") next.rotationDeg += event.shiftKey ? 15 : 5
    else if (event.key === "[") next.rotationDeg -= event.shiftKey ? 15 : 5
    else if (event.key === "ArrowLeft") next.xPercent -= step
    else if (event.key === "ArrowRight") next.xPercent += step
    else if (event.key === "ArrowUp") next.yPercent -= step
    else if (event.key === "ArrowDown") next.yPercent += step
    else return
    event.preventDefault()
    onSelectPlacement?.(placementId)
    onTransformPlacement(placementId, region, safeCalendarTransform(next, regionWidth))
  }
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, item: typeof state.items[number]) => {
    if (!editable || !onTransformPlacement) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Synthetic/older surfaces still allow selection. */ }
    onSelectPlacement?.(item.placementId)
    drag.current = { placementId: item.placementId, region: item.region, transform: item.transform, moved: false }
  }
  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>, item: typeof state.items[number]) => {
    if (drag.current?.placementId !== item.placementId) return
    const rect = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return
    const transform = safeCalendarTransform({ ...item.transform, xPercent: (event.clientX - rect.left) / rect.width * 100,
      yPercent: (event.clientY - rect.top) / rect.height * 100 }, rect.width)
    drag.current = { placementId: item.placementId, region: item.region, transform, moved: true }
    setDragPreview(drag.current)
  }
  const stopDrag = (placementId: string, cancelled = false) => {
    const current = drag.current
    if (current?.placementId !== placementId) return
    drag.current = null; setDragPreview(null)
    // A completed gesture is one undo step, not one step per pointer pixel.
    if (current.moved && !cancelled) onTransformPlacement?.(placementId, current.region, current.transform)
  }
  const renderBand = (region: CalendarDecorationRegion, label: string) => {
    const items = itemsByRegion[region]
    if (items.length === 0) return null
    return <div role="group" className={"calendar-decoration-frame__band calendar-decoration-frame__band--" + (region === "HEADER_MARGIN" ? "header" : "footer")} aria-label={label}>
      {items.map(item => {
        const catalogItem = decorationCatalogItem(item.itemId)
        if (!catalogItem || !isPlacementDecorationId(item.itemId)) return null
        const selected = editable && selectedPlacementId === item.placementId
        const transform = safeCalendarTransform(dragPreview?.placementId === item.placementId ? dragPreview.transform : item.transform, regionWidth)
        const style = { left: transform.xPercent + "%", top: transform.yPercent + "%" } as React.CSSProperties
        const art = <span className="calendar-decoration-frame__art" style={{ transform: "rotate(" + transform.rotationDeg + "deg) scale(" + transform.scale + ")" }} aria-hidden="true"><CalendarFrameAsset item={catalogItem} /></span>
        if (!editable) return <span key={item.placementId} className="calendar-decoration-frame__item" style={style} aria-hidden="true">{art}</span>
        return <button key={item.placementId} type="button" className={"calendar-decoration-frame__item" + (selected ? " is-selected" : "")} style={style}
          aria-label={catalogItem.name + (selected ? " 선택됨" : " 장식")} aria-pressed={selected}
          onClick={() => onSelectPlacement?.(item.placementId)} onPointerDown={event => startDrag(event, item)}
          onPointerMove={event => moveDrag(event, item)} onPointerUp={() => stopDrag(item.placementId)}
          onPointerCancel={() => stopDrag(item.placementId, true)} onLostPointerCapture={() => stopDrag(item.placementId, true)}
          onKeyDown={event => handleKeyDown(event, item.placementId, item.region, transform)}>{art}</button>
      })}
    </div>
  }
  return <section ref={frame} className="calendar-decoration-frame" data-calendar-decoration="true" data-editable={editable ? "true" : "false"}
    data-has-header={itemsByRegion.HEADER_MARGIN.length > 0} data-has-footer={itemsByRegion.FOOTER_MARGIN.length > 0} data-theme-active={theme ? "true" : "false"} style={themeStyle}>
    <div className="calendar-decoration-frame__paper" aria-hidden="true" />
    {renderBand("HEADER_MARGIN", "달력 상단 여백 장식")}
    <div className="calendar-decoration-frame__content">{children}</div>
    {renderBand("FOOTER_MARGIN", "달력 하단 여백 장식")}
  </section>
}
