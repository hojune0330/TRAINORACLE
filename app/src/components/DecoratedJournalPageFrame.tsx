import { useDrag } from "@use-gesture/react"
import { Maximize2, RotateCw, X } from "lucide-react"
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
  readonly onDeselectPlacement?: () => void
  readonly onDeletePlacement?: (slot: DecorationSlot) => void
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

type GestureAnchor = {
  readonly pageRect: DOMRect
  readonly startTransform: DecorationPlacementTransform
  readonly startDistance: number
  readonly startAngle: number
}

/*
 * 제스처 중에는 React 리렌더 없이 ref + requestAnimationFrame으로 style.transform만 갱신한다.
 * (60fps 계약 — 마스터 플랜 §2.2). 저장 커밋은 손을 뗄 때 1회만 일어난다.
 */
function EditableDecorationPlacement({
  item,
  slot,
  transform,
  selected,
  onSelect,
  onTransform,
  onDelete,
  onDeselect,
}: {
  readonly item: DecorationCatalogItem
  readonly slot: DecorationSlot
  readonly transform: DecorationPlacementTransform
  readonly selected: boolean
  readonly onSelect: () => void
  readonly onTransform: (transform: DecorationPlacementTransform) => void
  readonly onDelete: () => void
  readonly onDeselect: () => void
}) {
  const itemRef = React.useRef<HTMLDivElement | null>(null)
  const draftRef = React.useRef(transform)
  const frameRef = React.useRef<number | null>(null)

  const paint = React.useCallback((next: DecorationPlacementTransform) => {
    const node = itemRef.current
    if (node === null) return
    node.style.left = `${next.xPercent}%`
    node.style.top = `${next.yPercent}%`
    node.style.transform = `translate(-50%, -50%) rotate(${next.rotationDeg}deg) scale(${next.scale})`
    node.style.setProperty("--item-scale", `${next.scale}`)
  }, [])

  const schedule = React.useCallback((next: DecorationPlacementTransform) => {
    draftRef.current = next
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      paint(draftRef.current)
    })
  }, [paint])

  React.useEffect(() => {
    draftRef.current = transform
    paint(transform)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [transform, paint])

  const anchor = React.useCallback((clientX: number, clientY: number): GestureAnchor | null => {
    const page = itemRef.current?.closest<HTMLElement>(".decorated-journal-page")
    if (page === undefined || page === null) return null
    const pageRect = page.getBoundingClientRect()
    const centerX = pageRect.left + (draftRef.current.xPercent / 100) * pageRect.width
    const centerY = pageRect.top + (draftRef.current.yPercent / 100) * pageRect.height
    return {
      pageRect,
      startTransform: draftRef.current,
      startDistance: Math.max(16, Math.hypot(clientX - centerX, clientY - centerY)),
      startAngle: Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI,
    }
  }, [])

  const finish = React.useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    paint(draftRef.current)
    onTransform(draftRef.current)
  }, [paint, onTransform])

  const bindMove = useDrag(({ first, last, tap, movement: [movementX, movementY], initial: [initialX, initialY], memo }) => {
    if (tap) return memo as GestureAnchor | null
    const start = first ? anchor(initialX, initialY) : (memo as GestureAnchor | null)
    if (start === null || start === undefined) return null
    if (first) onSelect()
    schedule({
      ...start.startTransform,
      xPercent: clamp(start.startTransform.xPercent + (movementX / start.pageRect.width) * 100, 4, 96),
      yPercent: clamp(start.startTransform.yPercent + (movementY / start.pageRect.height) * 100, 4, 96),
    })
    if (last) finish()
    return start
  }, { filterTaps: true, pointer: { capture: true } })

  const bindResize = useDrag(({ event, first, last, xy: [pointerX, pointerY], initial: [initialX, initialY], memo }) => {
    event.stopPropagation()
    const start = first ? anchor(initialX, initialY) : (memo as GestureAnchor | null)
    if (start === null || start === undefined) return null
    const centerX = start.pageRect.left + (start.startTransform.xPercent / 100) * start.pageRect.width
    const centerY = start.pageRect.top + (start.startTransform.yPercent / 100) * start.pageRect.height
    const distance = Math.max(8, Math.hypot(pointerX - centerX, pointerY - centerY))
    schedule({ ...start.startTransform, scale: clamp(start.startTransform.scale * (distance / start.startDistance), 0.6, 2) })
    if (last) finish()
    return start
  }, { pointer: { capture: true } })

  const bindRotate = useDrag(({ event, first, last, xy: [pointerX, pointerY], initial: [initialX, initialY], memo }) => {
    event.stopPropagation()
    const start = first ? anchor(initialX, initialY) : (memo as GestureAnchor | null)
    if (start === null || start === undefined) return null
    const centerX = start.pageRect.left + (start.startTransform.xPercent / 100) * start.pageRect.width
    const centerY = start.pageRect.top + (start.startTransform.yPercent / 100) * start.pageRect.height
    const angle = Math.atan2(pointerY - centerY, pointerX - centerX) * 180 / Math.PI
    schedule({ ...start.startTransform, rotationDeg: clamp(start.startTransform.rotationDeg + angle - start.startAngle, -45, 45) })
    if (last) finish()
    return start
  }, { pointer: { capture: true } })

  const keyboardTransform = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      /* 선택 상태의 Escape는 해제만 한다 — 편집기 전체 닫기(툴바 window 핸들러)로 새지 않게 막는다. */
      event.preventDefault()
      event.stopPropagation()
      onDeselect()
      return
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault()
      onDelete()
      return
    }
    const draft = draftRef.current
    const step = event.shiftKey ? 2 : 0.5
    const moves: Partial<Record<string, Partial<DecorationPlacementTransform>>> = {
      ArrowLeft: { xPercent: clamp(draft.xPercent - step, 4, 96) },
      ArrowRight: { xPercent: clamp(draft.xPercent + step, 4, 96) },
      ArrowUp: { yPercent: clamp(draft.yPercent - step, 4, 96) },
      ArrowDown: { yPercent: clamp(draft.yPercent + step, 4, 96) },
      "+": { scale: clamp(draft.scale + 0.05, 0.6, 2) },
      "=": { scale: clamp(draft.scale + 0.05, 0.6, 2) },
      "-": { scale: clamp(draft.scale - 0.05, 0.6, 2) },
      "[": { rotationDeg: clamp(draft.rotationDeg - 1, -45, 45) },
      "]": { rotationDeg: clamp(draft.rotationDeg + 1, -45, 45) },
    }
    const update = moves[event.key]
    if (update === undefined) return
    event.preventDefault()
    const next = { ...draft, ...update }
    draftRef.current = next
    paint(next)
    onTransform(next)
  }

  return (
    <div
      {...bindMove()}
      ref={itemRef}
      className="decorated-journal-page__free-item"
      data-category={item.category}
      data-selected={selected ? "true" : undefined}
      style={{
        left: `${transform.xPercent}%`,
        top: `${transform.yPercent}%`,
        transform: `translate(-50%, -50%) rotate(${transform.rotationDeg}deg) scale(${transform.scale})`,
        "--item-scale": `${transform.scale}`,
      } as React.CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={`${item.name} 선택됨. 드래그해 옮기고 손잡이로 크기와 각도를 바꿔요. Delete 키로 삭제해요.`}
      onClick={onSelect}
      onKeyDown={keyboardTransform}
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
            className="decorated-journal-page__transform-handle decorated-journal-page__transform-handle--delete"
            aria-label={`${item.name} 삭제`}
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
          ><X aria-hidden="true" size={15} /></button>
          <button
            {...bindRotate()}
            type="button"
            className="decorated-journal-page__transform-handle decorated-journal-page__transform-handle--rotate"
            aria-label={`${item.name} 회전`}
          ><RotateCw aria-hidden="true" size={15} /></button>
          <button
            {...bindResize()}
            type="button"
            className="decorated-journal-page__transform-handle decorated-journal-page__transform-handle--resize"
            aria-label={`${item.name} 크기 조절`}
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
  onDeselectPlacement,
  onDeletePlacement,
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
      onPointerDown={editable && onDeselectPlacement !== undefined
        ? (event) => {
          /* 빈 곳 탭 = 선택 해제 (상용 편집기 관욵). 장식이나 손잡이 위는 제외한다. */
          const target = event.target as HTMLElement
          if (target.closest(".decorated-journal-page__free-item") === null) onDeselectPlacement()
        }
        : undefined}
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
                onDelete={() => onDeletePlacement?.(placement.slot)}
                onDeselect={() => onDeselectPlacement?.()}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
