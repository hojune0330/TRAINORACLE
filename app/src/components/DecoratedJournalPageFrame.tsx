import { Maximize2, RotateCw } from "lucide-react"
import React from "react"
import { DECORATION_SLOTS, decorationCatalogItem } from "../domain/decorations"
import type {
  DecorationCatalogItem,
  DecorationPlacementTransform,
  DecorationSlot,
  DecorationState,
} from "../domain/decorations"
import { defaultJournalDecorationTransform } from "../domain/journal-decoration-state"

type DecoratedJournalPageFrameProps = {
  readonly date: string
  readonly state: DecorationState
  readonly children: React.ReactNode
  readonly pageTopRef?: React.Ref<HTMLDivElement>
  readonly frameTopRef?: React.Ref<HTMLElement>
  readonly editable?: boolean
  readonly selectedSlot?: DecorationSlot | null
  readonly onSelectPlacement?: (slot: DecorationSlot) => void
  readonly onTransformPlacement?: (slot: DecorationSlot, transform: DecorationPlacementTransform) => void
}

const SLOT_TEST_IDS = {
  HEADER_TAPE: "journal-slot-header-tape",
  TOP_CORNER: "journal-slot-top-corner",
  BODY_MARGIN: "journal-slot-body-margin",
  PAGE_FOOTER: "journal-slot-page-footer",
  BODY_STICKER_1: "journal-slot-body-sticker-1",
  BODY_STICKER_2: "journal-slot-body-sticker-2",
  BODY_STICKER_3: "journal-slot-body-sticker-3",
} as const satisfies Record<DecorationSlot, string>

function DecorationAsset({
  item,
  className,
  testId,
}: {
  readonly item: DecorationCatalogItem
  readonly className: string
  readonly testId: string
}) {
  const [failed, setFailed] = React.useState(false)
  if (item.category === "EMOJI_STICKER") {
    /*
     * 이모지 스티커는 유니코드 텍스트로만 렌더한다(플랫폼 이모지 폰트 위임).
     * 벤더 아트워크 파일을 절대 로드하지 않는다 — 검수 계약 2026-08-29 §3.
     */
    return (
      <span className={`${className} decorated-journal-page__emoji`} data-testid={testId} aria-hidden="true">
        {item.emoji}
      </span>
    )
  }
  if (failed) {
    return (
      <span className={`${className} decorated-journal-page__asset-fallback`} data-testid={testId} aria-hidden="true">
        {item.fallbackLabel}
      </span>
    )
  }
  return (
    <img
      className={className}
      data-testid={testId}
      src={`${import.meta.env.BASE_URL}${item.assetPath}`}
      alt=""
      onError={() => setFailed(true)}
    />
  )
}

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value))

type PointerGesture = {
  readonly kind: "MOVE" | "RESIZE" | "ROTATE"
  readonly pointerId: number
  readonly pageRect: DOMRect
  readonly startClientX: number
  readonly startClientY: number
  readonly startTransform: DecorationPlacementTransform
  readonly startDistance: number
  readonly startAngle: number
}

function EditableDecorationPlacement({
  item,
  slot,
  transform,
  selected,
  onSelect,
  onTransform,
}: {
  readonly item: DecorationCatalogItem
  readonly slot: DecorationSlot
  readonly transform: DecorationPlacementTransform
  readonly selected: boolean
  readonly onSelect: () => void
  readonly onTransform: (transform: DecorationPlacementTransform) => void
}) {
  const [draft, setDraft] = React.useState(transform)
  const draftRef = React.useRef(transform)
  const gestureRef = React.useRef<PointerGesture | null>(null)

  React.useEffect(() => {
    setDraft(transform)
    draftRef.current = transform
  }, [transform])

  const updateDraft = (next: DecorationPlacementTransform) => {
    draftRef.current = next
    setDraft(next)
  }

  const beginGesture = (kind: PointerGesture["kind"], event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const page = event.currentTarget.closest<HTMLElement>(".decorated-journal-page")
    if (page === null) return
    event.preventDefault()
    event.stopPropagation()
    onSelect()
    event.currentTarget.setPointerCapture(event.pointerId)
    const pageRect = page.getBoundingClientRect()
    const centerX = pageRect.left + (draftRef.current.xPercent / 100) * pageRect.width
    const centerY = pageRect.top + (draftRef.current.yPercent / 100) * pageRect.height
    gestureRef.current = {
      kind,
      pointerId: event.pointerId,
      pageRect,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTransform: draftRef.current,
      startDistance: Math.max(16, Math.hypot(event.clientX - centerX, event.clientY - centerY)),
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI,
    }
  }

  const moveGesture = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current
    if (gesture === null || gesture.pointerId !== event.pointerId) return
    event.preventDefault()
    const { pageRect, startTransform } = gesture
    if (gesture.kind === "MOVE") {
      updateDraft({
        ...startTransform,
        xPercent: clamp(startTransform.xPercent + ((event.clientX - gesture.startClientX) / pageRect.width) * 100, 4, 96),
        yPercent: clamp(startTransform.yPercent + ((event.clientY - gesture.startClientY) / pageRect.height) * 100, 4, 96),
      })
      return
    }
    const centerX = pageRect.left + (startTransform.xPercent / 100) * pageRect.width
    const centerY = pageRect.top + (startTransform.yPercent / 100) * pageRect.height
    if (gesture.kind === "RESIZE") {
      const distance = Math.max(8, Math.hypot(event.clientX - centerX, event.clientY - centerY))
      updateDraft({ ...startTransform, scale: clamp(startTransform.scale * (distance / gesture.startDistance), 0.6, 2) })
      return
    }
    const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI
    updateDraft({ ...startTransform, rotationDeg: clamp(startTransform.rotationDeg + angle - gesture.startAngle, -45, 45) })
  }

  const finishGesture = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current
    if (gesture === null || gesture.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    gestureRef.current = null
    onTransform(draftRef.current)
  }

  const keyboardTransform = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Partial<Record<string, Partial<DecorationPlacementTransform>>> = {
      ArrowLeft: { xPercent: clamp(draft.xPercent - 2, 4, 96) },
      ArrowRight: { xPercent: clamp(draft.xPercent + 2, 4, 96) },
      ArrowUp: { yPercent: clamp(draft.yPercent - 2, 4, 96) },
      ArrowDown: { yPercent: clamp(draft.yPercent + 2, 4, 96) },
      "+": { scale: clamp(draft.scale + 0.1, 0.6, 2) },
      "=": { scale: clamp(draft.scale + 0.1, 0.6, 2) },
      "-": { scale: clamp(draft.scale - 0.1, 0.6, 2) },
    }
    const update = moves[event.key]
    if (update === undefined) return
    event.preventDefault()
    const next = { ...draft, ...update }
    updateDraft(next)
    onTransform(next)
  }

  return (
    <div
      className="decorated-journal-page__free-item"
      data-category={item.category}
      data-selected={selected ? "true" : undefined}
      style={{
        left: `${draft.xPercent}%`,
        top: `${draft.yPercent}%`,
        transform: `translate(-50%, -50%) rotate(${draft.rotationDeg}deg) scale(${draft.scale})`,
      }}
      role="button"
      tabIndex={0}
      aria-label={`${item.name} 선택됨. 드래그해 옮기고 모서리 손잡이로 크기와 각도를 바꿔요.`}
      onClick={onSelect}
      onKeyDown={keyboardTransform}
      onPointerDown={(event) => beginGesture("MOVE", event)}
      onPointerMove={moveGesture}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
    >
      <DecorationAsset
        item={item}
        className={`decorated-journal-page__slot decorated-journal-page__free-asset decorated-journal-page__slot--${slot.toLowerCase().replaceAll("_", "-")}`}
        testId={SLOT_TEST_IDS[slot]}
      />
      {selected && (
        <>
          <button
            type="button"
            className="decorated-journal-page__transform-handle decorated-journal-page__transform-handle--rotate"
            aria-label={`${item.name} 회전`}
            onPointerDown={(event) => beginGesture("ROTATE", event)}
            onPointerMove={moveGesture}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
          ><RotateCw aria-hidden="true" size={15} /></button>
          <button
            type="button"
            className="decorated-journal-page__transform-handle decorated-journal-page__transform-handle--resize"
            aria-label={`${item.name} 크기 조절`}
            onPointerDown={(event) => beginGesture("RESIZE", event)}
            onPointerMove={moveGesture}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
          ><Maximize2 aria-hidden="true" size={15} /></button>
        </>
      )}
    </div>
  )
}

export function DecoratedJournalPageFrame({
  date,
  state,
  children,
  pageTopRef,
  frameTopRef,
  editable = false,
  selectedSlot = null,
  onSelectPlacement,
  onTransformPlacement,
}: DecoratedJournalPageFrameProps) {
  const theme = decorationCatalogItem(state.equipped.themeId)
  const avatar = state.equipped.avatarId === null
    ? undefined
    : decorationCatalogItem(state.equipped.avatarId)
  const placements = DECORATION_SLOTS.flatMap((slot) => {
    const placement = state.pagePlacements.find((candidate) => candidate.date === date && candidate.slot === slot)
    if (placement === undefined) return []
    const item = decorationCatalogItem(placement.itemId)
    return item === undefined ? [] : [{ item, slot, transform: placement.transform }]
  })
  const freePlacements = placements.filter((placement) => editable || placement.transform !== undefined)
  const fixedPlacements = placements.filter((placement) => !editable && placement.transform === undefined)
  const placementFor = (slot: DecorationSlot) => fixedPlacements.find((placement) => placement.slot === slot)
  const headerTape = placementFor("HEADER_TAPE")
  const topCorner = placementFor("TOP_CORNER")
  const bodyMargin = placementFor("BODY_MARGIN")
  const pageFooter = placementFor("PAGE_FOOTER")
  const stickerSlots = (["BODY_STICKER_1", "BODY_STICKER_2", "BODY_STICKER_3"] as const)
    .map((slot) => ({ slot, placement: placementFor(slot) }))
  const hasTopRail = avatar !== undefined || headerTape !== undefined || topCorner !== undefined
  const hasStickerRail = stickerSlots.some(({ placement }) => placement !== undefined)

  return (
    <section
      ref={frameTopRef}
      className="decorated-journal-page"
      data-theme-id={state.equipped.themeId}
      data-ink-id={state.equipped.inkId}
    >
      {theme !== undefined && (
        <DecorationAsset item={theme} className="decorated-journal-page__theme" testId="journal-page-theme" />
      )}
      {hasTopRail && (
        <div className="decorated-journal-page__top-rail" aria-hidden="true">
          <span>{avatar !== undefined && <DecorationAsset item={avatar} className="decorated-journal-page__avatar" testId="journal-page-avatar" />}</span>
          <span>{headerTape !== undefined && <DecorationAsset item={headerTape.item} className="decorated-journal-page__slot decorated-journal-page__slot--header-tape" testId={SLOT_TEST_IDS.HEADER_TAPE} />}</span>
          <span>{topCorner !== undefined && <DecorationAsset item={topCorner.item} className="decorated-journal-page__slot decorated-journal-page__slot--top-corner" testId={SLOT_TEST_IDS.TOP_CORNER} />}</span>
        </div>
      )}
      <div className="decorated-journal-page__body" data-has-side-rail={bodyMargin !== undefined ? "true" : undefined}>
        <div
          key={date}
          ref={pageTopRef}
          className="decorated-journal-page__content journal-reader-page journal-page-scroll-target"
          data-testid="decorated-journal-content"
        >
          {children}
        </div>
        {bodyMargin !== undefined && (
          <aside className="decorated-journal-page__side-rail" aria-hidden="true">
            <DecorationAsset item={bodyMargin.item} className="decorated-journal-page__slot decorated-journal-page__slot--body-margin" testId={SLOT_TEST_IDS.BODY_MARGIN} />
          </aside>
        )}
      </div>
      {hasStickerRail && (
        <div className="decorated-journal-page__sticker-rail" data-testid="journal-sticker-rail" aria-hidden="true">
          {stickerSlots.map(({ slot, placement }) => (
            <span key={slot} className="decorated-journal-page__sticker-cell">
              {placement !== undefined && (
                <DecorationAsset
                  item={placement.item}
                  className={`decorated-journal-page__slot decorated-journal-page__slot--${slot.toLowerCase().replaceAll("_", "-")}`}
                  testId={SLOT_TEST_IDS[slot]}
                />
              )}
            </span>
          ))}
        </div>
      )}
      {pageFooter !== undefined && (
        <div className="decorated-journal-page__footer-rail" aria-hidden="true">
          <DecorationAsset item={pageFooter.item} className="decorated-journal-page__slot decorated-journal-page__slot--page-footer" testId={SLOT_TEST_IDS.PAGE_FOOTER} />
        </div>
      )}
      {freePlacements.length > 0 && (
        <div className="decorated-journal-page__free-layer" data-editable={editable ? "true" : undefined}>
          {freePlacements.map((placement) => {
            const transform = placement.transform ?? defaultJournalDecorationTransform(placement.slot)
            if (!editable || onSelectPlacement === undefined || onTransformPlacement === undefined) {
              return (
                <div
                  key={placement.slot}
                  className="decorated-journal-page__free-item decorated-journal-page__free-item--readonly"
                  data-category={placement.item.category}
                  style={{
                    left: `${transform.xPercent}%`,
                    top: `${transform.yPercent}%`,
                    transform: `translate(-50%, -50%) rotate(${transform.rotationDeg}deg) scale(${transform.scale})`,
                  }}
                  aria-hidden="true"
                >
                  <DecorationAsset
                    item={placement.item}
                    className={`decorated-journal-page__slot decorated-journal-page__free-asset decorated-journal-page__slot--${placement.slot.toLowerCase().replaceAll("_", "-")}`}
                    testId={SLOT_TEST_IDS[placement.slot]}
                  />
                </div>
              )
            }
            return (
              <EditableDecorationPlacement
                key={placement.slot}
                item={placement.item}
                slot={placement.slot}
                transform={transform}
                selected={selectedSlot === placement.slot}
                onSelect={() => onSelectPlacement(placement.slot)}
                onTransform={(next) => onTransformPlacement(placement.slot, next)}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
