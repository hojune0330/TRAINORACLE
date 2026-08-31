import React from "react"
import { DecoratedJournalPageFrame } from "../../components/DecoratedJournalPageFrame"
import { JournalConfirmationDialog } from "../../components/JournalConfirmationDialog"
import {
  DECORATION_CATALOG,
  isAvatarDecorationId,
  isInkDecorationId,
  isPlacementDecorationId,
  isThemeDecorationId,
  loadDecorationState,
  readDecorationStateSerialized,
  saveDecorationStateIfCurrent,
} from "../../domain/decorations"
import type { DecorationCatalogItem, DecorationPlacementTransform, DecorationSlot, DecorationState } from "../../domain/decorations"
import {
  applyJournalDecoration,
  previewJournalDecoration,
  removeJournalDecoration,
  removeJournalDecorationAt,
  resolveJournalDecorationSlot,
  roundJournalDecorationTransform,
  updateJournalDecorationTransform,
} from "../../domain/journal-decoration-state"
import { withJosa } from "../../domain/korean-josa"
import { JournalDecorationToolbar } from "./JournalDecorationToolbar"

type Replacement = {
  readonly item: DecorationCatalogItem
  readonly previous: DecorationCatalogItem
  readonly slot: DecorationSlot
}

export function JournalDecorationSurface({
  date,
  hasEntries,
  children,
  pageTopRef,
}: {
  readonly date: string
  readonly hasEntries: boolean
  readonly children: React.ReactNode
  readonly pageTopRef?: React.Ref<HTMLDivElement>
}) {
  const [canonical, setCanonical] = React.useState(loadDecorationState)
  const [storageVersion, setStorageVersion] = React.useState(() => readDecorationStateSerialized())
  const [preview, setPreview] = React.useState<DecorationState | null>(null)
  const [open, setOpen] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [notice, setNotice] = React.useState("")
  const [undoState, setUndoState] = React.useState<DecorationState | null>(null)
  const [replacement, setReplacement] = React.useState<Replacement | null>(null)
  const [previewItemId, setPreviewItemId] = React.useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = React.useState<DecorationSlot | null>(null)
  const visible = preview ?? canonical
  const items = DECORATION_CATALOG.filter((item) => (
    isThemeDecorationId(item.id)
    || (isInkDecorationId(item.id) && canonical.ownedItemIds.includes(item.id))
    || (isAvatarDecorationId(item.id) && canonical.ownedItemIds.includes(item.id))
    || (hasEntries && isPlacementDecorationId(item.id) && canonical.ownedItemIds.includes(item.id))
  ))
  const activeItemIds = new Set<string>([
    ...canonical.ownedItemIds.map((itemId) => `owned:${itemId}`),
    canonical.equipped.themeId,
    canonical.equipped.inkId,
    ...(canonical.equipped.avatarId === null ? [] : [canonical.equipped.avatarId]),
    ...canonical.pagePlacements.filter((placement) => placement.date === date).map((placement) => placement.itemId),
  ])

  const commit = (next: DecorationState | null, successMessage: string): boolean => {
    if (next === null) {
      setPreview(null)
      setPreviewItemId(null)
      setNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
      return false
    }
    const saved = saveDecorationStateIfCurrent(next, storageVersion)
    if (!saved.ok) {
      if (saved.code === "STALE_STATE") {
        const latest = loadDecorationState()
        setCanonical(latest)
        setStorageVersion(readDecorationStateSerialized())
        setNotice("다른 화면에서 꾸미기가 바뀌어 최신 상태를 다시 불러왔어요.")
      } else setNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
      return false
    }
    setUndoState(canonical)
    setCanonical(next)
    setStorageVersion(JSON.stringify(next))
    setPreview(null)
    setPreviewItemId(null)
    setNotice(successMessage)
    return true
  }

  const apply = (item: DecorationCatalogItem, slot?: DecorationSlot): void => {
    /* 이모지는 빈 칸 자동 배정 결과를 기준으로 교체 확인을 한다. */
    const targetSlot = resolveJournalDecorationSlot(canonical, item, date, slot)
    if (targetSlot !== undefined) {
      const current = canonical.pagePlacements.find((placement) => placement.date === date && placement.slot === targetSlot)
      const previous = current === undefined ? undefined : DECORATION_CATALOG.find((candidate) => candidate.id === current.itemId)
      if (previous !== undefined && previous.id !== item.id) {
        setReplacement({ item, previous, slot: targetSlot })
        return
      }
    }
    const next = applyJournalDecoration(canonical, item, date, slot)
    if (commit(next, `${withJosa(item.name, "을/를")} 저장했어요.`)) {
      const resolvedSlot = resolveJournalDecorationSlot(canonical, item, date, slot)
      if (resolvedSlot !== undefined) setSelectedSlot(resolvedSlot)
      setDrawerOpen(false)
    }
  }

  const close = (): void => {
    setOpen(false)
    setDrawerOpen(false)
    setPreview(null)
    setPreviewItemId(null)
    setReplacement(null)
    setSelectedSlot(null)
    setNotice("")
  }

  const transformPlacement = (slot: DecorationSlot, transform: DecorationPlacementTransform): void => {
    setSelectedSlot(slot)
    /* 저장 직전 라운딩(0.1% · 0.05 · 1°) — 제스처 중 부드러움은 유지하고 저장만 정규화한다. */
    commit(
      updateJournalDecorationTransform(canonical, date, slot, roundJournalDecorationTransform(transform)),
      "위치와 크기를 저장했어요.",
    )
  }

  const deletePlacement = (slot: DecorationSlot): void => {
    const placement = canonical.pagePlacements.find((candidate) => candidate.date === date && candidate.slot === slot)
    const item = placement === undefined ? undefined : DECORATION_CATALOG.find((candidate) => candidate.id === placement.itemId)
    const label = item === undefined ? "꾸미기" : item.name
    if (commit(removeJournalDecorationAt(canonical, date, slot), `${withJosa(label, "을/를")} 지웠어요. 되돌리기로 복구할 수 있어요.`)) {
      setSelectedSlot(null)
    }
  }

  return (
    <>
      <div className={`journal-decoration-workspace${open ? " journal-decoration-workspace--open" : ""}`} role={open ? "dialog" : undefined} aria-label={open ? "이 일지 꾸미기" : undefined} aria-modal={open ? "true" : undefined}>
        <JournalDecorationToolbar
          hasEntries={hasEntries}
          items={items}
          open={open}
          drawerOpen={drawerOpen}
          activeItemIds={activeItemIds}
          canUndo={undoState !== null}
          notice={notice}
          previewItemId={previewItemId}
          onOpen={() => {
            setOpen(true)
            setDrawerOpen(false)
          }}
          onDrawerOpen={() => setDrawerOpen(true)}
          onDrawerClose={() => setDrawerOpen(false)}
          onClose={close}
          onPreview={(item, slot) => {
            setPreview(previewJournalDecoration(canonical, item, date, slot))
            setPreviewItemId(item.id)
            setNotice("")
          }}
          onApply={apply}
          onRemove={(item) => {
            if (commit(removeJournalDecoration(canonical, item, date), `${withJosa(item.name, "을/를")} 제거했어요.`)) {
              setSelectedSlot(null)
              setDrawerOpen(false)
            }
          }}
          onUndo={() => {
            const previous = undoState
            if (previous !== null && saveDecorationStateIfCurrent(previous, storageVersion).ok) {
              setCanonical(previous)
              setStorageVersion(JSON.stringify(previous))
              setPreview(null)
              setUndoState(null)
              setPreviewItemId(null)
              setSelectedSlot(null)
              setNotice("이전 꾸미기로 되돌렸어요.")
            } else {
              setNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
            }
          }}
        />
        <DecoratedJournalPageFrame
          date={date}
          state={visible}
          pageTopRef={pageTopRef}
          editable={open && preview === null}
          selectedSlot={selectedSlot}
          onSelectPlacement={(slot) => {
            setSelectedSlot(slot)
            setDrawerOpen(false)
          }}
          onTransformPlacement={transformPlacement}
          onDeselectPlacement={() => setSelectedSlot(null)}
          onDeletePlacement={deletePlacement}
        >{children}</DecoratedJournalPageFrame>
      </div>
      {replacement !== null && (
        <JournalConfirmationDialog
          title="꾸미기 교체 확인"
          description={`${replacement.previous.name} 대신 ${withJosa(replacement.item.name, "을/를")} 사용할까요?`}
          confirmLabel="교체하기"
          onCancel={() => setReplacement(null)}
          onConfirm={() => {
            const ok = commit(
              applyJournalDecoration(canonical, replacement.item, date, replacement.slot),
              `${withJosa(replacement.item.name, "으로/로")} 교체했어요.`,
            )
            if (ok) {
              setSelectedSlot(replacement.slot)
              setDrawerOpen(false)
              setReplacement(null)
            }
            return ok
          }}
        />
      )}
    </>
  )
}
