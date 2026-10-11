import React from "react"
import { isPlacementDecorationId, isThemeDecorationId } from "../../domain/decorations"
import type { DecorationCatalogItem, DecorationId, DecorationPlacementTransform, PlacementDecorationId } from "../../domain/decorations"
import { calendarDecorationStateSchema } from "../../domain/calendar-decoration-schema"
import type { CalendarDecorationRegion, CalendarDecorationState } from "../../domain/calendar-decoration-schema"
import { CalendarDecorationFrame, safeCalendarTransform } from "../../components/CalendarDecorationFrame"
import "./CalendarDecorationEditor.css"

const HISTORY_LIMIT = 20
const MAX_ITEMS = 6
const MAX_ITEMS_PER_REGION = 3

export type CalendarDecorationEditorHandle = {
  hasDirty(): boolean
  getDraft(): CalendarDecorationState
  requestApply(): Promise<boolean>
  discard(): void
  closeTopLayer(): boolean
  previewMaterial(item: DecorationCatalogItem): void
  clearPreview(): void
  applyMaterial(item: DecorationCatalogItem): void
}

type CalendarDecorationEditorProps = {
  readonly state: CalendarDecorationState
  readonly children: React.ReactNode
  readonly ownedIds: ReadonlySet<DecorationId>
  readonly saving?: boolean
  readonly requiresApply?: boolean
  readonly disabledReason?: string
  readonly onDirtyChange?: (dirty: boolean) => void
  readonly onApply: (candidate: CalendarDecorationState) => Promise<boolean>
  readonly onExit: () => void
  readonly onCancel?: () => void
  readonly onOpenMaterials?: () => void
}

const EMPTY_TRANSFORM: DecorationPlacementTransform = { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 }

function sameState(left: CalendarDecorationState, right: CalendarDecorationState): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function makePlacementId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const part = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0")
  return `${part()}${part()}-${part()}-4${part().slice(1)}-a${part().slice(1)}-${part()}${part()}${part()}`
}

function countRegion(state: CalendarDecorationState, region: CalendarDecorationRegion): number {
  return state.items.filter((item) => item.region === region).length
}

export const CalendarDecorationEditor = React.forwardRef<CalendarDecorationEditorHandle, CalendarDecorationEditorProps>(function CalendarDecorationEditor({
  state,
  children,
  ownedIds,
  saving = false,
  requiresApply = false,
  disabledReason,
  onDirtyChange,
  onApply,
  onExit,
  onCancel,
  onOpenMaterials,
}, ref) {
  const [draft, setDraft] = React.useState(state)
  const editorRoot = React.useRef<HTMLElement>(null)
  const [past, setPast] = React.useState<readonly CalendarDecorationState[]>([])
  const [future, setFuture] = React.useState<readonly CalendarDecorationState[]>([])
  const [region, setRegion] = React.useState<CalendarDecorationRegion>("HEADER_MARGIN")
  const [selectedPlacementId, setSelectedPlacementId] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState("")
  const [materialPreview, setMaterialPreview] = React.useState<CalendarDecorationState | null>(null)
  const [previewItemId, setPreviewItemId] = React.useState<DecorationId | null>(null)
  const baselineRef = React.useRef(state)
  const applyRef = React.useRef(onApply)
  applyRef.current = onApply
  const dirty = !sameState(draft, baselineRef.current)

  React.useEffect(() => {
    if (sameState(state, baselineRef.current)) return
    // A remote/store refresh may arrive while the local editor has unsaved work.
    // Keep that draft visible; the parent save callback remains responsible for
    // optimistic-concurrency rejection if this baseline is no longer current.
    if (!sameState(draft, baselineRef.current)) return
    baselineRef.current = state
    setDraft(state)
    setPast([])
    setFuture([])
  }, [state, draft])

  React.useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const commitDraft = (candidate: CalendarDecorationState) => {
    const parsed = calendarDecorationStateSchema.safeParse(candidate)
    if (!parsed.success) return
    if (sameState(parsed.data, draft)) return
    setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), draft])
    setFuture([])
    setDraft(parsed.data)
  }

  const requestApply = React.useCallback(async (): Promise<boolean> => {
    if (!dirty && !requiresApply) return true
    if (saving || disabledReason) return false
    try {
      const ok = await applyRef.current(draft)
      if (!ok) return false
      baselineRef.current = draft
      setPast([])
      setFuture([])
      setNotice("모든 달에 적용했어요.")
      return true
    } catch {
      setNotice("저장하지 못했어요. 변경 내용은 화면에 남아 있어요.")
      return false
    }
  }, [dirty, requiresApply, saving, disabledReason, draft])

  const discard = React.useCallback(() => {
    setDraft(baselineRef.current)
    setMaterialPreview(null)
    setPreviewItemId(null)
    setPast([])
    setFuture([])
    setSelectedPlacementId(null)
    setNotice("")
  }, [])

  const closeTopLayer = React.useCallback(() => {
    const openMore = editorRoot.current?.querySelector<HTMLDetailsElement>("details[open]")
    if (openMore) { openMore.open = false; return true }
    if (selectedPlacementId !== null) {
      setSelectedPlacementId(null)
      return true
    }
    return false
  }, [selectedPlacementId])

  const updateTheme = (id: CalendarDecorationState["paperThemeId"]) => commitDraft({ ...draft, paperThemeId: id })
  const addPlacement = (itemId: PlacementDecorationId) => {
    if (draft.items.length >= MAX_ITEMS) {
      setNotice("달력 여백에는 장식을 6개까지 둘 수 있어요.")
      return
    }
    if (countRegion(draft, region) >= MAX_ITEMS_PER_REGION) {
      setNotice("한쪽 여백에는 장식을 3개까지 둘 수 있어요.")
      return
    }
    const placementId = makePlacementId()
    const next: CalendarDecorationState = {
      ...draft,
      items: [...draft.items, { placementId, itemId, region, transform: EMPTY_TRANSFORM }],
    }
    commitDraft(next)
    setSelectedPlacementId(placementId)
    setNotice("")
  }

  const previewMaterial = React.useCallback((item: DecorationCatalogItem) => {
    setPreviewItemId(item.id)
    if (isThemeDecorationId(item.id)) {
      setMaterialPreview({ ...draft, paperThemeId: item.id })
      return
    }
    if (!isPlacementDecorationId(item.id)) return
    if (draft.items.length >= MAX_ITEMS || countRegion(draft, region) >= MAX_ITEMS_PER_REGION) {
      setMaterialPreview(null)
      setNotice("이 여백에는 장식을 더 놓을 수 없어요.")
      return
    }
    const previewId = "00000000-0000-4000-8000-000000000000"
    setMaterialPreview({
      ...draft,
      items: [...draft.items.filter((candidate) => candidate.placementId !== previewId), {
        placementId: previewId,
        itemId: item.id,
        region,
        transform: EMPTY_TRANSFORM,
      }],
    })
  }, [draft, region])

  const clearPreview = React.useCallback(() => { setMaterialPreview(null); setPreviewItemId(null) }, [])

  const applyMaterial = React.useCallback((item: DecorationCatalogItem) => {
    if (saving || disabledReason) return
    setMaterialPreview(null)
    setPreviewItemId(null)
    if (isThemeDecorationId(item.id)) {
      if (!ownedIds.has(item.id) && draft.paperThemeId !== item.id) {
        setNotice("소유한 종이 테마만 적용할 수 있어요.")
        return
      }
      setNotice("")
      updateTheme(item.id)
      return
    }
    if (!isPlacementDecorationId(item.id)) return
    if (!ownedIds.has(item.id)) {
      setNotice("소유한 장식만 달력에 붙일 수 있어요.")
      return
    }
    addPlacement(item.id)
  }, [ownedIds, draft.paperThemeId, updateTheme, addPlacement, saving, disabledReason])

  React.useImperativeHandle(ref, () => ({
    hasDirty: () => !sameState(draft, baselineRef.current),
    getDraft: () => draft,
    requestApply,
    discard,
    closeTopLayer,
    previewMaterial,
    clearPreview,
    applyMaterial,
  }), [draft, requestApply, discard, closeTopLayer, previewMaterial, clearPreview, applyMaterial])

  const updatePlacement = (placementId: string, nextRegion: CalendarDecorationRegion, transform: DecorationPlacementTransform) => {
    const safeTransform = safeCalendarTransform(transform, editorRoot.current?.querySelector<HTMLElement>(".calendar-decoration-frame")?.clientWidth || 320)
    const next: CalendarDecorationState = {
      ...draft,
      items: draft.items.map((item) => item.placementId === placementId ? { ...item, region: nextRegion, transform: safeTransform } : item),
    }
    commitDraft(next)
  }

  const removePlacement = (placementId: string) => {
    commitDraft({ ...draft, items: draft.items.filter((item) => item.placementId !== placementId) })
    setSelectedPlacementId(null)
  }

  const undo = () => {
    const previous = past[past.length - 1]
    if (!previous) return
    setPast(past.slice(0, -1))
    setFuture((current) => [...current.slice(-(HISTORY_LIMIT - 1)), draft])
    setDraft(previous)
  }

  const redo = () => {
    const next = future[future.length - 1]
    if (!next) return
    setFuture(future.slice(0, -1))
    setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), draft])
    setDraft(next)
  }

  React.useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(""), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  return <section ref={editorRoot} className="calendar-decoration-editor" aria-label="달력 꾸미기 편집기">
    <div className="calendar-decoration-editor__controls">
      <div className="calendar-decoration-editor__heading">
        <div>
          <h2>여백 배치</h2>
        </div>
      </div>

      <div className="calendar-decoration-editor__regions app-choice-group" role="group" aria-label="장식할 여백">
        <button className="app-choice-control" type="button" disabled={saving || Boolean(disabledReason)} aria-pressed={region === "HEADER_MARGIN"} onClick={() => setRegion("HEADER_MARGIN")}>위쪽 여백 {countRegion(draft, "HEADER_MARGIN")}/{MAX_ITEMS_PER_REGION}</button>
        <button className="app-choice-control" type="button" disabled={saving || Boolean(disabledReason)} aria-pressed={region === "FOOTER_MARGIN"} onClick={() => setRegion("FOOTER_MARGIN")}>아래쪽 여백 {countRegion(draft, "FOOTER_MARGIN")}/{MAX_ITEMS_PER_REGION}</button>
      </div>

      <div className="calendar-decoration-editor__materials">
        <div className="calendar-decoration-editor__materials-heading"><h3>달력 여백 재료</h3>{onOpenMaterials && <button type="button" disabled={saving || Boolean(disabledReason)} onClick={() => { setSelectedPlacementId(null); onOpenMaterials() }}>재료 서랍 열기</button>}</div>
        <p>종이와 그림은 재료에서 골라요.</p>
      </div>

      <div className="calendar-decoration-editor__history">
        <button type="button" onClick={undo} disabled={saving || Boolean(disabledReason) || past.length === 0} aria-label="달력 꾸미기 실행 취소">되돌리기</button>
        <button type="button" onClick={redo} disabled={saving || Boolean(disabledReason) || future.length === 0} aria-label="달력 꾸미기 다시 실행">다시 하기</button>
        <span aria-live="polite">{draft.items.length}/{MAX_ITEMS} 장식</span>
      </div>
      <details className="calendar-decoration-editor__more"><summary>달력 초기화</summary>
      <button type="button" disabled={draft.paperThemeId === null || saving || Boolean(disabledReason)} onClick={() => updateTheme(null)}>종이를 기본으로</button>
      <button type="button" className="calendar-decoration-editor__reset" disabled={(draft.paperThemeId === null && draft.items.length === 0) || saving || Boolean(disabledReason)} onClick={() => {
        commitDraft({ version: 1, paperThemeId: null, items: [] })
        setSelectedPlacementId(null)
        setMaterialPreview(null)
        setPreviewItemId(null)
        setNotice("기본 달력 미리보기로 되돌렸어요. 적용 전까지 저장되지는 않아요.")
      }}>달력 기본으로 되돌리기</button></details>
      {selectedPlacementId && <div className="calendar-decoration-editor__selected-tools" aria-label="선택한 장식 조절">
        <button type="button" onClick={() => {
          const selected = draft.items.find((item) => item.placementId === selectedPlacementId)
          if (selected) updatePlacement(selectedPlacementId, selected.region, { ...selected.transform, xPercent: Math.max(4, selected.transform.xPercent - 2) })
        }} disabled={saving || Boolean(disabledReason)}>왼쪽</button>
        <button type="button" onClick={() => {
          const selected = draft.items.find((item) => item.placementId === selectedPlacementId)
          if (selected) updatePlacement(selectedPlacementId, selected.region, { ...selected.transform, xPercent: Math.min(96, selected.transform.xPercent + 2) })
        }} disabled={saving || Boolean(disabledReason)}>오른쪽</button>
        <button type="button" onClick={() => {
          const selected = draft.items.find((item) => item.placementId === selectedPlacementId)
          if (selected) updatePlacement(selectedPlacementId, selected.region, { ...selected.transform, yPercent: Math.max(4, selected.transform.yPercent - 2) })
        }} disabled={saving || Boolean(disabledReason)}>위쪽</button>
        <button type="button" onClick={() => {
          const selected = draft.items.find((item) => item.placementId === selectedPlacementId)
          if (selected) updatePlacement(selectedPlacementId, selected.region, { ...selected.transform, yPercent: Math.min(96, selected.transform.yPercent + 2) })
        }} disabled={saving || Boolean(disabledReason)}>아래쪽</button>
        {([
          ["작게", { scale: -0.1 }], ["크게", { scale: 0.1 }],
          ["왼쪽 회전", { rotationDeg: -15 }], ["오른쪽 회전", { rotationDeg: 15 }],
        ] as const).map(([label, change]) => <button key={label} type="button" disabled={saving || Boolean(disabledReason)} onClick={() => {
          const selected = draft.items.find(item => item.placementId === selectedPlacementId)
          if (!selected) return
          updatePlacement(selected.placementId, selected.region, { ...selected.transform,
            scale: selected.transform.scale + ("scale" in change ? change.scale : 0),
            rotationDeg: selected.transform.rotationDeg + ("rotationDeg" in change ? change.rotationDeg : 0),
          })
        }}>{label}</button>)}
        <button type="button" onClick={() => removePlacement(selectedPlacementId)} disabled={saving || Boolean(disabledReason)}>선택한 장식 지우기</button>
      </div>}
      {disabledReason && <p className="calendar-decoration-editor__notice" role="status">{disabledReason}</p>}
      {notice && <p className="calendar-decoration-editor__notice" role="status">{notice}</p>}
      <div className="calendar-decoration-editor__actions" role="group" aria-label="달력 변경 적용">
        <button type="button" className="calendar-decoration-editor__cancel" onClick={() => onCancel ? onCancel() : (discard(), onExit())}>취소</button>
        <button type="button" className="calendar-decoration-editor__apply" onClick={() => void requestApply()} disabled={(!dirty && !requiresApply) || saving || Boolean(disabledReason)}>{saving ? "저장 중…" : "모든 달에 적용"}</button>
      </div>
    </div>

    <div className="calendar-decoration-editor__preview">
      <CalendarDecorationFrame
        state={materialPreview ?? draft}
        allowedItemIds={new Set([...ownedIds, ...(previewItemId ? [previewItemId] : [])])}
        editable={!saving && !disabledReason}
        selectedPlacementId={selectedPlacementId}
        onSelectPlacement={setSelectedPlacementId}
        onTransformPlacement={updatePlacement}
        onDeletePlacement={removePlacement}
      >{children}</CalendarDecorationFrame>
      <p className="calendar-decoration-editor__preview-caption">그림을 선택하면 이동·크기·회전을 조절할 수 있어요.</p>
    </div>
  </section>
})
