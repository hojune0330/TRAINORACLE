import { useDrag, useGesture } from "@use-gesture/react"
import { Copy, Maximize2, Pencil, RotateCw, X } from "lucide-react"
import React from "react"
import { decorationCatalogItem, isTextStickerPageItem, textInkColor } from "../domain/decorations"
import type {
  DecorationCatalogItem,
  DecorationPlacementTransform,
  DecorationState,
  TextInkId,
} from "../domain/decorations"
import {
  clampToCenterBounds,
  inertiaCarryPx,
  inertiaProgress,
  INERTIA_DECAY_MS,
  rotatedAabbHalfExtents,
  rotationAwareCenterBounds,
} from "../domain/decoration-gesture-math"
import { journalDecorationItems } from "../domain/journal-decoration-state"

/* P6 마감 (마스터 플랜 §3-19): 스냅이 걸리는 순간만 10ms 진동 — 지원 기기 한정. */
function hapticTick(): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return
  navigator.vibrate(10)
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/*
 * 프레임이 그리는 자유 배치 비주얼: 카탈로그 아이템 또는 텍스트 스티커 (P5).
 * 텍스트 스티커는 카탈로그 조회 없이 text/inkId로 직접 렌더한다.
 */
type PlacementVisual =
  | { readonly kind: "catalog"; readonly item: DecorationCatalogItem }
  | { readonly kind: "text"; readonly text: string; readonly inkId: TextInkId }

const visualCategory = (visual: PlacementVisual): string => (
  visual.kind === "text" ? "TEXT_STICKER" : visual.item.category
)
const visualName = (visual: PlacementVisual): string => (
  visual.kind === "text" ? "글 스티커" : visual.item.name
)

type DecoratedJournalPageFrameProps = {
  readonly date: string
  readonly state: DecorationState
  readonly children: React.ReactNode
  readonly pageTopRef?: React.Ref<HTMLDivElement>
  readonly frameTopRef?: React.Ref<HTMLElement>
  readonly editable?: boolean
  readonly selectedIndex?: number | null
  readonly onSelectPlacement?: (index: number) => void
  readonly onTransformPlacement?: (index: number, transform: DecorationPlacementTransform) => void
  readonly onDeselectPlacement?: () => void
  readonly onDeletePlacement?: (index: number) => void
  readonly onDuplicatePlacement?: (index: number) => void
  readonly onEditTextPlacement?: (index: number) => void
}

/* 텍스트 스티커 본문 (P5 계약 U7): span 텍스트 노드, 잉크 색, 줄바꿈 없음. */
function TextStickerAsset({
  text,
  inkId,
  testId,
}: {
  readonly text: string
  readonly inkId: TextInkId
  readonly testId: string
}) {
  return (
    <span
      className="decorated-journal-page__slot decorated-journal-page__free-asset decorated-journal-page__text-sticker"
      data-testid={testId}
      style={{ color: textInkColor(inkId) }}
      aria-hidden="true"
    >
      {text}
    </span>
  )
}

function PlacementAsset({ visual, index }: { readonly visual: PlacementVisual; readonly index: number }) {
  if (visual.kind === "text") {
    return <TextStickerAsset text={visual.text} inkId={visual.inkId} testId={`journal-decoration-asset-${index}`} />
  }
  return (
    <DecorationAsset
      item={visual.item}
      className="decorated-journal-page__slot decorated-journal-page__free-asset"
      testId={`journal-decoration-asset-${index}`}
    />
  )
}

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

/* v3 조작 범위 (마이그레이션 계약 §2 C4~C5). */
const MIN_SCALE = 0.3
const MAX_SCALE = 3
const MAX_ROTATION = 180

/* 회전 스냅: 15° 배수에 ±3° 자석 (마스터 플랜 §2.3) — 자석 밖에서는 자유롭게 벗어난다. */
const snapRotation = (deg: number): { readonly value: number; readonly snapped: boolean } => {
  const nearest = Math.round(deg / 15) * 15
  return Math.abs(deg - nearest) <= 3 ? { value: nearest, snapped: true } : { value: deg, snapped: false }
}

/* 중앙 가이드라인 자석: 50%에서 ±2% 이내면 정중앙으로 붙는다. */
const CENTER_MAGNET_PERCENT = 2
const snapCenter = (percent: number): { value: number; snapped: boolean } => (
  Math.abs(percent - 50) <= CENTER_MAGNET_PERCENT
    ? { value: 50, snapped: true }
    : { value: percent, snapped: false }
)

type Guides = { readonly vertical: boolean; readonly horizontal: boolean }

type GestureAnchor = {
  readonly pageRect: DOMRect
  readonly startTransform: DecorationPlacementTransform
  readonly startDistance: number
  readonly startAngle: number
}

type PinchAnchor = {
  readonly startTransform: DecorationPlacementTransform
}

/*
 * 제스처 중에는 React 리렌더 없이 ref + requestAnimationFrame으로 style.transform만 갱신한다.
 * (60fps 계약 — 마스터 플랜 §2.2). 저장 커밋은 손을 뗄 때 1회만 일어난다.
 */
function EditableDecorationPlacement({
  visual,
  index,
  transform,
  selected,
  onSelect,
  onTransform,
  onDelete,
  onDeselect,
  onDuplicate,
  onEditText,
  onGuides,
}: {
  readonly visual: PlacementVisual
  readonly index: number
  readonly transform: DecorationPlacementTransform
  readonly selected: boolean
  readonly onSelect: () => void
  readonly onTransform: (transform: DecorationPlacementTransform) => void
  readonly onDelete: () => void
  readonly onDeselect: () => void
  readonly onDuplicate: () => void
  readonly onEditText?: () => void
  readonly onGuides: (guides: Guides) => void
}) {
  const itemRef = React.useRef<HTMLDivElement | null>(null)
  const draftRef = React.useRef(transform)
  const frameRef = React.useRef<number | null>(null)
  /* P6: 스냅 진입 엣지 감지(햇틱은 걸리는 순간 1회만)와 관성 rAF 핸들. */
  const snapStateRef = React.useRef({ x: false, y: false, rotation: false })
  const inertiaFrameRef = React.useRef<number | null>(null)

  const cancelInertia = React.useCallback(() => {
    if (inertiaFrameRef.current !== null) {
      cancelAnimationFrame(inertiaFrameRef.current)
      inertiaFrameRef.current = null
    }
  }, [])

  /* 햇틱 계약 (P6 §3-19): 자석이 "걸리는" 전이에만 1회 진동. 해제·유지 중에는 안 울린다. */
  const feelSnap = React.useCallback((axis: "x" | "y" | "rotation", snapped: boolean) => {
    const previous = snapStateRef.current[axis]
    snapStateRef.current[axis] = snapped
    if (snapped && !previous) hapticTick()
  }, [])

  /*
   * 회전 인지 AABB 중심 허용 범위 (P6 §3-20): 현재 크기·회전으로 경계 상자를 구해
   * 아이템 전체가 4% 마진 안에 머무는 중심 범위로 좁힌다. 측정 불가 시 스키마 기본 범위.
   */
  const centerBounds = React.useCallback((pageRect: DOMRect, scale: number, rotationDeg: number) => {
    const node = itemRef.current
    if (node === null || pageRect.width <= 0 || pageRect.height <= 0) {
      return {
        x: { minPercent: 4, maxPercent: 96 },
        y: { minPercent: 4, maxPercent: 96 },
      }
    }
    const { halfWidthPx, halfHeightPx } = rotatedAabbHalfExtents(
      node.offsetWidth * scale,
      node.offsetHeight * scale,
      rotationDeg,
    )
    return {
      x: rotationAwareCenterBounds((halfWidthPx / pageRect.width) * 100),
      y: rotationAwareCenterBounds((halfHeightPx / pageRect.height) * 100),
    }
  }, [])

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
      cancelInertia()
    }
  }, [transform, paint, cancelInertia])

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
    snapStateRef.current = { x: false, y: false, rotation: false }
    paint(draftRef.current)
    onGuides({ vertical: false, horizontal: false })
    onTransform(draftRef.current)
  }, [paint, onTransform, onGuides])

  /*
   * 드래그 놓기 관성 (P6 §3-19): 속도 기반 40ms 선형 감속 이월 후 커밋 1회.
   * reduced-motion이면 제거. 이월 중에도 회전 인지 경계를 벗어나지 않는다.
   */
  const finishWithInertia = React.useCallback((
    pageRect: DOMRect,
    velocity: readonly [number, number],
    direction: readonly [number, number],
  ) => {
    const carryXPx = inertiaCarryPx(velocity[0], direction[0])
    const carryYPx = inertiaCarryPx(velocity[1], direction[1])
    if (prefersReducedMotion() || (carryXPx === 0 && carryYPx === 0)) {
      finish()
      return
    }
    const origin = draftRef.current
    const bounds = centerBounds(pageRect, origin.scale, origin.rotationDeg)
    const carryXPercent = (carryXPx / pageRect.width) * 100
    const carryYPercent = (carryYPx / pageRect.height) * 100
    const startedAt = performance.now()
    const step = () => {
      const progress = inertiaProgress(performance.now() - startedAt)
      const next = {
        ...origin,
        xPercent: clampToCenterBounds(origin.xPercent + carryXPercent * progress, bounds.x),
        yPercent: clampToCenterBounds(origin.yPercent + carryYPercent * progress, bounds.y),
      }
      draftRef.current = next
      paint(next)
      if (progress < 1) {
        inertiaFrameRef.current = requestAnimationFrame(step)
        return
      }
      inertiaFrameRef.current = null
      finish()
    }
    cancelInertia()
    inertiaFrameRef.current = requestAnimationFrame(step)
  }, [finish, paint, centerBounds, cancelInertia])

  /*
   * 더블탭: 일반 장식 = 크기 1.0 / 회전 0° 리셋 (위치 유지, 되돌리기가 안전망).
   * 텍스트 스티커 = 재편집 시트 열기 (P5 계약 U4 — 리셋이 아니다).
   */
  const lastTapRef = React.useRef(0)
  const handleTap = React.useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0
      if (visual.kind === "text") {
        onEditText?.()
        return
      }
      const reset = { ...draftRef.current, scale: 1, rotationDeg: 0 }
      draftRef.current = reset
      paint(reset)
      onTransform(reset)
      return
    }
    lastTapRef.current = now
    onSelect()
  }, [paint, onTransform, onSelect, onEditText, visual.kind])

  const bindItem = useGesture({
    onDrag: ({ first, last, tap, pinching, cancel, movement: [movementX, movementY], initial: [initialX, initialY], velocity, direction, memo }) => {
      if (pinching) {
        cancel()
        return memo as GestureAnchor | null
      }
      if (tap) return memo as GestureAnchor | null
      const start = first ? anchor(initialX, initialY) : (memo as GestureAnchor | null)
      if (start === null || start === undefined) return null
      if (first) {
        cancelInertia()
        onSelect()
      }
      /* P6 §3-20: 회전 인지 AABB로 중심 허용 범위를 좁혀 아이템 전체가 4% 마진 안에 머무른다. */
      const bounds = centerBounds(start.pageRect, start.startTransform.scale, start.startTransform.rotationDeg)
      const rawX = clampToCenterBounds(start.startTransform.xPercent + (movementX / start.pageRect.width) * 100, bounds.x)
      const rawY = clampToCenterBounds(start.startTransform.yPercent + (movementY / start.pageRect.height) * 100, bounds.y)
      const snappedX = snapCenter(rawX)
      const snappedY = snapCenter(rawY)
      feelSnap("x", snappedX.snapped)
      feelSnap("y", snappedY.snapped)
      onGuides({ vertical: snappedX.snapped, horizontal: snappedY.snapped })
      schedule({ ...start.startTransform, xPercent: snappedX.value, yPercent: snappedY.value })
      if (last) {
        /* 자석에 붙은 채 놓으면 관성 없이 즉시 커밋 — 스냅이 관성보다 우선이다. */
        if (snappedX.snapped || snappedY.snapped) finish()
        else finishWithInertia(start.pageRect, velocity, direction)
      }
      return start
    },
    /*
     * 핀치 = 두 손가락 크기 + 비틀기 회전 동시 (use-gesture가 da=[distance, angle]로 제공).
     * 회전에는 15° 자석 스냅이 붙는다.
     */
    onPinch: ({ first, last, movement: [scaleRatio, angleDelta], memo }) => {
      const start = first ? { startTransform: draftRef.current } : (memo as PinchAnchor | null)
      if (start === null || start === undefined) return null
      if (first) {
        cancelInertia()
        onSelect()
      }
      const rotation = snapRotation(start.startTransform.rotationDeg + angleDelta)
      feelSnap("rotation", rotation.snapped)
      schedule({
        ...start.startTransform,
        scale: clamp(start.startTransform.scale * scaleRatio, MIN_SCALE, MAX_SCALE),
        rotationDeg: clamp(rotation.value, -MAX_ROTATION, MAX_ROTATION),
      })
      if (last) finish()
      return start
    },
  }, { drag: { filterTaps: true, pointer: { capture: true } } })

  const bindResize = useDrag(({ event, first, last, xy: [pointerX, pointerY], initial: [initialX, initialY], memo }) => {
    event.stopPropagation()
    const start = first ? anchor(initialX, initialY) : (memo as GestureAnchor | null)
    if (start === null || start === undefined) return null
    const centerX = start.pageRect.left + (start.startTransform.xPercent / 100) * start.pageRect.width
    const centerY = start.pageRect.top + (start.startTransform.yPercent / 100) * start.pageRect.height
    const distance = Math.max(8, Math.hypot(pointerX - centerX, pointerY - centerY))
    schedule({ ...start.startTransform, scale: clamp(start.startTransform.scale * (distance / start.startDistance), MIN_SCALE, MAX_SCALE) })
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
    const rotation = snapRotation(start.startTransform.rotationDeg + angle - start.startAngle)
    feelSnap("rotation", rotation.snapped)
    schedule({
      ...start.startTransform,
      rotationDeg: clamp(rotation.value, -MAX_ROTATION, MAX_ROTATION),
    })
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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault()
      event.stopPropagation()
      onDuplicate()
      return
    }
    const draft = draftRef.current
    const step = event.shiftKey ? 2 : 0.5
    const moves: Partial<Record<string, Partial<DecorationPlacementTransform>>> = {
      ArrowLeft: { xPercent: clamp(draft.xPercent - step, 4, 96) },
      ArrowRight: { xPercent: clamp(draft.xPercent + step, 4, 96) },
      ArrowUp: { yPercent: clamp(draft.yPercent - step, 4, 96) },
      ArrowDown: { yPercent: clamp(draft.yPercent + step, 4, 96) },
      "+": { scale: clamp(draft.scale + 0.05, MIN_SCALE, MAX_SCALE) },
      "=": { scale: clamp(draft.scale + 0.05, MIN_SCALE, MAX_SCALE) },
      "-": { scale: clamp(draft.scale - 0.05, MIN_SCALE, MAX_SCALE) },
      "[": { rotationDeg: clamp(draft.rotationDeg - 1, -MAX_ROTATION, MAX_ROTATION) },
      "]": { rotationDeg: clamp(draft.rotationDeg + 1, -MAX_ROTATION, MAX_ROTATION) },
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
      {...bindItem()}
      ref={itemRef}
      className="decorated-journal-page__free-item"
      data-category={visualCategory(visual)}
      data-selected={selected ? "true" : undefined}
      data-testid={`journal-decoration-item-${index}`}
      style={{
        left: `${transform.xPercent}%`,
        top: `${transform.yPercent}%`,
        transform: `translate(-50%, -50%) rotate(${transform.rotationDeg}deg) scale(${transform.scale})`,
        "--item-scale": `${transform.scale}`,
      } as React.CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={visual.kind === "text"
        ? `글 스티커: ${visual.text}. 드래그로 옮기고 두 손가락으로 크기와 각도를 바꿔요. 두 번 탭하면 글을 고치고 Delete 키로 삭제해요.`
        : `${visual.item.name} 선택됨. 드래그로 옮기고 두 손가락으로 크기와 각도를 바꿔요. 두 번 탭하면 원래 크기로 돌아가고 Delete 키로 삭제해요.`}
      onClick={handleTap}
      onKeyDown={keyboardTransform}
    >
      <PlacementAsset visual={visual} index={index} />
      {selected && (
        <>
          <button
            type="button"
            className="decorated-journal-page__transform-handle decorated-journal-page__transform-handle--delete"
            aria-label={`${visualName(visual)} 삭제`}
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
          ><X aria-hidden="true" size={15} /></button>
          <button
            type="button"
            className="decorated-journal-page__transform-handle decorated-journal-page__transform-handle--duplicate"
            aria-label={`${visualName(visual)} 복제`}
            onClick={(event) => {
              event.stopPropagation()
              onDuplicate()
            }}
          ><Copy aria-hidden="true" size={15} /></button>
          {/* 텍스트 스티커 전용 연필 손잡이 (P5 계약 U5): 더블탭 대체 경로, 44px 히트. 복제(T8)와 공존. */}
          {visual.kind === "text" && onEditText !== undefined && (
            <button
              type="button"
              className="decorated-journal-page__transform-handle decorated-journal-page__transform-handle--edit-text"
              aria-label="글 스티커 글 고치기"
              data-testid={`journal-decoration-edit-text-${index}`}
              onClick={(event) => {
                event.stopPropagation()
                onEditText()
              }}
            ><Pencil aria-hidden="true" size={15} /></button>
          )}
          <button
            {...bindRotate()}
            type="button"
            className="decorated-journal-page__transform-handle decorated-journal-page__transform-handle--rotate"
            aria-label={`${visualName(visual)} 회전`}
          ><RotateCw aria-hidden="true" size={15} /></button>
          <button
            {...bindResize()}
            type="button"
            className="decorated-journal-page__transform-handle decorated-journal-page__transform-handle--resize"
            aria-label={`${visualName(visual)} 크기 조절`}
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
  selectedIndex = null,
  onSelectPlacement,
  onTransformPlacement,
  onDeselectPlacement,
  onDeletePlacement,
  onDuplicatePlacement,
  onEditTextPlacement,
}: DecoratedJournalPageFrameProps) {
  /* 드래그 중 중앙 자석이 붙은 축에만 가이드라인을 그린다. */
  const [guides, setGuides] = React.useState<Guides>({ vertical: false, horizontal: false })
  const theme = decorationCatalogItem(state.equipped.themeId)
  const avatar = state.equipped.avatarId === null
    ? undefined
    : decorationCatalogItem(state.equipped.avatarId)
  /*
   * v3 단일 렌더 경로: 배열 순서 그대로 자유 레이어에 쌓는다 (계약 §2 C2 — 뒤가 위).
   * v2의 슬롯 레일은 마이그레이션이 좌표로 변환하므로 더 이상 필요 없다.
   */
  const placements = journalDecorationItems(state, date).flatMap((placement, index) => {
    if (isTextStickerPageItem(placement)) {
      /* 텍스트 스티커는 카탈로그 조회 없이 자체 데이터로 그린다 (P5). */
      return [{
        visual: { kind: "text", text: placement.text, inkId: placement.inkId } as PlacementVisual,
        index,
        transform: placement.transform,
      }]
    }
    const item = decorationCatalogItem(placement.itemId)
    return item === undefined ? [] : [{
      visual: { kind: "catalog", item } as PlacementVisual,
      index,
      transform: placement.transform,
    }]
  })

  return (
    <section
      ref={frameTopRef}
      className="decorated-journal-page"
      data-theme-id={state.equipped.themeId}
      data-ink-id={state.equipped.inkId}
      onPointerDown={editable && onDeselectPlacement !== undefined
        ? (event) => {
          /* 빈 곳 탭 = 선택 해제 (상용 편집기 관례). 장식이나 손잡이 위는 제외한다. */
          const target = event.target as HTMLElement
          if (target.closest(".decorated-journal-page__free-item") === null) onDeselectPlacement()
        }
        : undefined}
    >
      {theme !== undefined && (
        <DecorationAsset item={theme} className="decorated-journal-page__theme" testId="journal-page-theme" />
      )}
      {avatar !== undefined && (
        <div className="decorated-journal-page__top-rail" aria-hidden="true">
          <span><DecorationAsset item={avatar} className="decorated-journal-page__avatar" testId="journal-page-avatar" /></span>
        </div>
      )}
      <div className="decorated-journal-page__body">
        <div
          key={date}
          ref={pageTopRef}
          className="decorated-journal-page__content journal-reader-page journal-page-scroll-target"
          data-testid="decorated-journal-content"
        >
          {children}
        </div>
      </div>
      {editable && (guides.vertical || guides.horizontal) && (
        <div className="decorated-journal-page__guides" aria-hidden="true" data-testid="journal-decoration-guides">
          {guides.vertical && <span className="decorated-journal-page__guide decorated-journal-page__guide--vertical" />}
          {guides.horizontal && <span className="decorated-journal-page__guide decorated-journal-page__guide--horizontal" />}
        </div>
      )}
      {placements.length > 0 && (
        <div className="decorated-journal-page__free-layer" data-editable={editable ? "true" : undefined}>
          {placements.map((placement) => {
            if (!editable || onSelectPlacement === undefined || onTransformPlacement === undefined) {
              return (
                <div
                  key={placement.index}
                  className="decorated-journal-page__free-item decorated-journal-page__free-item--readonly"
                  data-category={visualCategory(placement.visual)}
                  data-testid={`journal-decoration-item-${placement.index}`}
                  style={{
                    left: `${placement.transform.xPercent}%`,
                    top: `${placement.transform.yPercent}%`,
                    transform: `translate(-50%, -50%) rotate(${placement.transform.rotationDeg}deg) scale(${placement.transform.scale})`,
                  }}
                  aria-hidden="true"
                >
                  <PlacementAsset visual={placement.visual} index={placement.index} />
                </div>
              )
            }
            return (
              <EditableDecorationPlacement
                key={placement.index}
                visual={placement.visual}
                index={placement.index}
                transform={placement.transform}
                selected={selectedIndex === placement.index}
                onSelect={() => onSelectPlacement(placement.index)}
                onTransform={(next) => onTransformPlacement(placement.index, next)}
                onDelete={() => onDeletePlacement?.(placement.index)}
                onDeselect={() => onDeselectPlacement?.()}
                onDuplicate={() => onDuplicatePlacement?.(placement.index)}
                onEditText={onEditTextPlacement === undefined ? undefined : () => onEditTextPlacement(placement.index)}
                onGuides={setGuides}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
