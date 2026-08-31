import React from "react"
import { DecoratedJournalPageFrame } from "../../components/DecoratedJournalPageFrame"
import {
  DECORATION_CATALOG,
  MAX_DECORATION_ITEMS_PER_PAGE,
  isAvatarDecorationId,
  isInkDecorationId,
  isPlacementDecorationId,
  isThemeDecorationId,
  loadDecorationState,
  readDecorationStateSerialized,
  saveDecorationStateIfCurrent,
} from "../../domain/decorations"
import type { DecorationCatalogItem, DecorationPlacementTransform, DecorationState } from "../../domain/decorations"
import {
  applyJournalDecoration,
  duplicateJournalDecorationAt,
  journalDecorationItems,
  previewJournalDecoration,
  removeJournalDecoration,
  removeJournalDecorationAt,
  roundJournalDecorationTransform,
  updateJournalDecorationTransform,
} from "../../domain/journal-decoration-state"
import { withJosa } from "../../domain/korean-josa"
import { JournalDecorationToolbar } from "./JournalDecorationToolbar"

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
  /* Undo/Redo: past/future 스택 각 20단계 (마스터 플랜 §2.4) — 이력은 세션 메모리에만 산다. */
  const [past, setPast] = React.useState<readonly DecorationState[]>([])
  const [future, setFuture] = React.useState<readonly DecorationState[]>([])
  const [previewItemId, setPreviewItemId] = React.useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
  const visible = preview ?? canonical
  const items = DECORATION_CATALOG.filter((item) => (
    isThemeDecorationId(item.id)
    || (isInkDecorationId(item.id) && canonical.ownedItemIds.includes(item.id))
    || (isAvatarDecorationId(item.id) && canonical.ownedItemIds.includes(item.id))
    || (hasEntries && isPlacementDecorationId(item.id) && canonical.ownedItemIds.includes(item.id))
  ))
  const pageItems = journalDecorationItems(canonical, date)
  const activeItemIds = new Set<string>([
    ...canonical.ownedItemIds.map((itemId) => `owned:${itemId}`),
    canonical.equipped.themeId,
    canonical.equipped.inkId,
    ...(canonical.equipped.avatarId === null ? [] : [canonical.equipped.avatarId]),
    ...pageItems.map((item) => item.itemId),
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
    setPast((stack) => [...stack.slice(-19), canonical])
    setFuture([])
    setCanonical(next)
    setStorageVersion(JSON.stringify(next))
    setPreview(null)
    setPreviewItemId(null)
    setNotice(successMessage)
    return true
  }

  /* Undo/Redo 공통: 대상 상태를 저장하고 스택을 반대쪽으로 옮긴다. 저장 실패 시 스택 보존. */
  const timeTravel = (direction: "UNDO" | "REDO"): void => {
    const source = direction === "UNDO" ? past : future
    const target = source[source.length - 1]
    if (target === undefined) return
    if (!saveDecorationStateIfCurrent(target, storageVersion).ok) {
      setNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
      return
    }
    if (direction === "UNDO") {
      setPast((stack) => stack.slice(0, -1))
      setFuture((stack) => [...stack.slice(-19), canonical])
    } else {
      setFuture((stack) => stack.slice(0, -1))
      setPast((stack) => [...stack.slice(-19), canonical])
    }
    setCanonical(target)
    setStorageVersion(JSON.stringify(target))
    setPreview(null)
    setPreviewItemId(null)
    setSelectedIndex(null)
    setNotice(direction === "UNDO" ? "이전 꾸미기로 되돌렸어요." : "되돌리기를 취소했어요.")
  }

  /* Ctrl+Z / Ctrl+Y(또는 Ctrl+Shift+Z) — 편집기가 열려 있을 때만. */
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === "z" && !event.shiftKey) {
        event.preventDefault()
        timeTravel("UNDO")
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault()
        timeTravel("REDO")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  /* v3 자유 배치: 슬롯 점유·교체 확인이 사라졌다 — 탭 = 배열 끝에 추가(최상단). */
  const apply = (item: DecorationCatalogItem): void => {
    if (isPlacementDecorationId(item.id) && pageItems.length >= MAX_DECORATION_ITEMS_PER_PAGE) {
      setNotice(`한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지 붙일 수 있어요.`)
      return
    }
    const next = applyJournalDecoration(canonical, item, date)
    if (commit(next, `${withJosa(item.name, "을/를")} 저장했어요.`)) {
      if (isPlacementDecorationId(item.id)) setSelectedIndex(pageItems.length)
      setDrawerOpen(false)
    }
  }

  const close = (): void => {
    setOpen(false)
    setDrawerOpen(false)
    setPreview(null)
    setPreviewItemId(null)
    setSelectedIndex(null)
    setNotice("")
  }

  const transformPlacement = (index: number, transform: DecorationPlacementTransform): void => {
    setSelectedIndex(index)
    /* 저장 직전 라운딩(0.1% · 0.05 · 1°) — 제스처 중 부드러움은 유지하고 저장만 정규화한다. */
    commit(
      updateJournalDecorationTransform(canonical, date, index, roundJournalDecorationTransform(transform)),
      "위치와 크기를 저장했어요.",
    )
  }

  /* v3: 전 품목 복제 (계약 §6). 복제본은 최상단에 붙고 바로 선택된다. */
  const duplicatePlacement = (index: number): void => {
    const next = duplicateJournalDecorationAt(canonical, date, index)
    if (next === null) {
      setNotice(`복제할 자리가 없어요. 한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지예요.`)
      return
    }
    if (commit(next, "복제했어요. 새 장식을 옮겨 보세요.")) {
      setSelectedIndex(pageItems.length)
    }
  }

  const deletePlacement = (index: number): void => {
    const placement = pageItems[index]
    const item = placement === undefined ? undefined : DECORATION_CATALOG.find((candidate) => candidate.id === placement.itemId)
    const label = item === undefined ? "꾸미기" : item.name
    if (commit(removeJournalDecorationAt(canonical, date, index), `${withJosa(label, "을/를")} 지웠어요. 되돌리기로 복구할 수 있어요.`)) {
      setSelectedIndex(null)
    }
  }

  return (
    <div className={`journal-decoration-workspace${open ? " journal-decoration-workspace--open" : ""}`} role={open ? "dialog" : undefined} aria-label={open ? "이 일지 꾸미기" : undefined} aria-modal={open ? "true" : undefined}>
      <JournalDecorationToolbar
        hasEntries={hasEntries}
        items={items}
        open={open}
        drawerOpen={drawerOpen}
        activeItemIds={activeItemIds}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        notice={notice}
        previewItemId={previewItemId}
        onOpen={() => {
          setOpen(true)
          setDrawerOpen(false)
        }}
        onDrawerOpen={() => setDrawerOpen(true)}
        onDrawerClose={() => setDrawerOpen(false)}
        onClose={close}
        onPreview={(item) => {
          setPreview(previewJournalDecoration(canonical, item, date))
          setPreviewItemId(item.id)
          setNotice("")
        }}
        onApply={apply}
        onRemove={(item) => {
          if (commit(removeJournalDecoration(canonical, item, date), `${withJosa(item.name, "을/를")} 제거했어요.`)) {
            setSelectedIndex(null)
            setDrawerOpen(false)
          }
        }}
        onUndo={() => timeTravel("UNDO")}
        onRedo={() => timeTravel("REDO")}
      />
      <DecoratedJournalPageFrame
        date={date}
        state={visible}
        pageTopRef={pageTopRef}
        editable={open && preview === null}
        selectedIndex={selectedIndex}
        onSelectPlacement={(index) => {
          setSelectedIndex(index)
          setDrawerOpen(false)
        }}
        onTransformPlacement={transformPlacement}
        onDeselectPlacement={() => setSelectedIndex(null)}
        onDeletePlacement={deletePlacement}
        onDuplicatePlacement={duplicatePlacement}
      >{children}</DecoratedJournalPageFrame>
    </div>
  )
}
