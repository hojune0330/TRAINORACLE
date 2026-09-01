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
  purchaseDecoration,
  readDecorationStateSerialized,
  saveDecorationStateIfCurrent,
} from "../../domain/decorations"
import { isTextStickerPageItem } from "../../domain/decorations"
import type { DecorationCatalogItem, DecorationId, DecorationPlacementTransform, DecorationState, TextInkId } from "../../domain/decorations"
import {
  appendJournalDecorationItem,
  appendJournalTextSticker,
  applyJournalDecoration,
  clearJournalAvatarDecoration,
  duplicateJournalDecorationAt,
  journalDecorationItems,
  previewJournalDecoration,
  removeJournalDecorationAt,
  reorderJournalDecoration,
  roundJournalDecorationTransform,
  updateJournalDecorationTransform,
  updateJournalTextSticker,
} from "../../domain/journal-decoration-state"
import {
  copyJournalDecorationToSession,
  readJournalDecorationFromSession,
} from "../../domain/journal-decoration-clipboard"
import {
  clearJournalDecorationAutoOpen,
  pendingJournalDecorationAutoOpenDate,
} from "../../domain/journal-decoration-intent"
import { loadEngagementSummary } from "../../domain/engagement"
import { todayISO } from "../../domain/journal-store"
import { withJosa } from "../../domain/korean-josa"
import { JournalDecorationToolbar } from "./JournalDecorationToolbar"
import { JournalTextStickerSheet } from "./JournalTextStickerSheet"

/* 입력 시트 상태: 새로 만들기 또는 기존 인덱스 재편집 (P5 U2/U4). */
type TextSheetState =
  | { readonly mode: "CREATE" }
  | { readonly mode: "EDIT"; readonly index: number; readonly text: string; readonly inkId: TextInkId }

type DecorationNotice = {
  readonly text: string
  readonly persistent: boolean
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
  /* 홈 "꾸미기 열기" → 오늘 일지로 이동해 바로 편집 시작 (레거시 별도 화면 통합). */
  const [open, setOpen] = React.useState(() => pendingJournalDecorationAutoOpenDate() === date)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [notice, setNotice] = React.useState<DecorationNotice | null>(null)
  /* Undo/Redo: past/future 스택 각 20단계 (마스터 플랜 §2.4) — 이력은 세션 메모리에만 산다. */
  const [past, setPast] = React.useState<readonly DecorationState[]>([])
  const [future, setFuture] = React.useState<readonly DecorationState[]>([])
  const [previewItemId, setPreviewItemId] = React.useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
  const [textSheet, setTextSheet] = React.useState<TextSheetState | null>(null)
  const [clipboardAvailable, setClipboardAvailable] = React.useState(() => readJournalDecorationFromSession() !== null)
  const workspaceRef = React.useRef<HTMLDivElement>(null)
  const focusBeforeOpenRef = React.useRef<HTMLElement | null>(null)
  /* 포인트 구매가 편집기 서랍으로 들어왔다 — 드래그 중 매 렌더 재계산을 피해 열 때만 읽는다. */
  const [earnedPoints, setEarnedPoints] = React.useState(() => loadEngagementSummary(todayISO()).points)
  React.useEffect(() => {
    if (open) setEarnedPoints(loadEngagementSummary(todayISO()).points)
  }, [open])
  const availablePoints = Math.max(0, earnedPoints - canonical.spentPoints)
  /* 자동-열기 인텐트는 1회용 — 소비 후 지워 새로고침·재진입 시 저절로 열리지 않게 한다. */
  React.useEffect(() => {
    if (pendingJournalDecorationAutoOpenDate() === date) clearJournalDecorationAutoOpen()
  }, [date])
  const visible = preview ?? canonical
  const owned = (itemId: DecorationId): boolean => canonical.ownedItemIds.includes(itemId)
  /* 재료 서랍은 카탈로그 전체를 보여 준다. 기록 없음·24개 상한은 항목을
   * 숨기지 않고 dim + 사유 안내로 표현해 사용자가 재료의 존재를 알게 한다. */
  const items = DECORATION_CATALOG.filter((item) => (
    isThemeDecorationId(item.id)
    || isInkDecorationId(item.id)
    || isAvatarDecorationId(item.id)
    || isPlacementDecorationId(item.id)
  ))
  const purchasableItemIds = new Set(
    items.filter((item) => !item.starterOwned && !owned(item.id)).map((item) => item.id),
  )
  const pageItems = journalDecorationItems(canonical, date)
  const pageItemCounts = new Map<string, number>()
  for (const item of pageItems) pageItemCounts.set(item.itemId, (pageItemCounts.get(item.itemId) ?? 0) + 1)
  const activeItemIds = new Set<string>([
    ...canonical.ownedItemIds.map((itemId) => `owned:${itemId}`),
    canonical.equipped.themeId,
    canonical.equipped.inkId,
    ...(canonical.equipped.avatarId === null ? ["avatar:none"] : [canonical.equipped.avatarId]),
    ...pageItems.map((item) => item.itemId),
  ])

  const showNotice = (text: string, persistent = false): void => setNotice({ text, persistent })

  const clearPreview = (): void => {
    setPreview(null)
    setPreviewItemId(null)
  }

  React.useEffect(() => {
    if (notice === null || notice.persistent) return
    const timer = window.setTimeout(() => {
      setNotice((current) => (current === notice ? null : current))
    }, 2200)
    return () => window.clearTimeout(timer)
  }, [notice])

  /* 모달 편집기 밖의 앱 탐색으로 Tab 초점이 새지 않게 한다. 캡처 단계에서 막아 첫 키 입력도 놓치지 않는다. */
  const trapFocus = (event: { readonly key: string; readonly shiftKey: boolean; preventDefault: () => void }): void => {
    if (event.key !== "Tab") return
    const root = workspaceRef.current
    if (root === null) return
    const focusable = Array.from(root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.closest("[inert]") === null && element.getAttribute("aria-hidden") !== "true")
    const first = focusable.at(0)
    const last = focusable.at(-1)
    if (first === undefined || last === undefined) return
    const active = document.activeElement
    if (event.shiftKey && (active === first || !root.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !root.contains(active))) {
      event.preventDefault()
      first.focus()
    }
  }

  React.useLayoutEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => trapFocus(event)
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  })

  const commit = (next: DecorationState | null, successMessage: string): boolean => {
    if (next === null) {
      setPreview(null)
      setPreviewItemId(null)
      showNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.", true)
      return false
    }
    const saved = saveDecorationStateIfCurrent(next, storageVersion)
    if (!saved.ok) {
      if (saved.code === "STALE_STATE") {
        const latest = loadDecorationState()
        setCanonical(latest)
        setStorageVersion(readDecorationStateSerialized())
        showNotice("다른 화면에서 꾸미기가 바뀌어 최신 상태를 다시 불러왔어요.", true)
      } else showNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.", true)
      return false
    }
    setPast((stack) => [...stack.slice(-19), canonical])
    setFuture([])
    setCanonical(next)
    setStorageVersion(JSON.stringify(next))
    setPreview(null)
    setPreviewItemId(null)
    showNotice(successMessage)
    return true
  }

  /* Undo/Redo 공통: 대상 상태를 저장하고 스택을 반대쪽으로 옮긴다. 저장 실패 시 스택 보존. */
  const timeTravel = (direction: "UNDO" | "REDO"): void => {
    const source = direction === "UNDO" ? past : future
    const target = source[source.length - 1]
    if (target === undefined) return
    if (!saveDecorationStateIfCurrent(target, storageVersion).ok) {
      showNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.", true)
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
    showNotice(direction === "UNDO" ? "이전 꾸미기로 되돌렸어요." : "되돌리기를 취소했어요.")
  }

  /* Ctrl+Z / Ctrl+Y(또는 Ctrl+Shift+Z) — 편집기가 열려 있을 때만.
   * 글 스티커 입력창처럼 편집 가능한 대상에 포커스가 있으면 건드리지 않는다:
   * 타이핑 취소(Ctrl+Z)가 장식 Undo로 변질되면 입력 내용과 캔버스가 함께 어긋난다. */
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const target = event.target
      if (target instanceof HTMLElement && (
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
      )) return
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
      showNotice(`한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지 붙일 수 있어요.`, true)
      return
    }
    const next = applyJournalDecoration(canonical, item, date)
    if (commit(next, `${withJosa(item.name, "을/를")} 저장했어요.`)) {
      if (isPlacementDecorationId(item.id)) setSelectedIndex(pageItems.length)
      setDrawerOpen(false)
    }
  }

  /* 포인트 구매(레거시 상점 이식): 구매는 장식 배치가 아니므로 undo 스택에 넣지 않는다. */
  const purchase = (item: DecorationCatalogItem): void => {
    const result = purchaseDecoration(earnedPoints, canonical, item.id, storageVersion)
    if (result.kind === "PURCHASED") {
      setCanonical(result.state)
      setStorageVersion(JSON.stringify(result.state))
      showNotice(`받았어요. ${result.remainingPoints}P가 남았어요.`)
    } else if (result.kind === "INSUFFICIENT_POINTS") {
      showNotice(`포인트가 ${item.cost - result.remainingPoints}P 더 필요해요. 오늘 방문 확인은 1P, 훈련·회복 기록을 남긴 날은 4P가 쌓여요.`, true)
    } else if (result.kind === "SAVE_FAILED") {
      if (result.code === "STALE_STATE") {
        const latest = loadDecorationState()
        setCanonical(latest)
        setStorageVersion(readDecorationStateSerialized())
        showNotice("다른 화면에서 꾸미기가 바뀌어 최신 상태를 다시 불러왔어요.", true)
      } else showNotice("저장하지 못했어요. 다시 시도해 주세요.", true)
    } else {
      showNotice(result.kind === "ALREADY_OWNED" ? "이미 가지고 있어요." : "꾸미기 항목을 찾지 못했어요.", true)
    }
  }

  const close = (): void => {
    setOpen(false)
    setDrawerOpen(false)
    setPreview(null)
    setPreviewItemId(null)
    setSelectedIndex(null)
    setTextSheet(null)
    setNotice(null)
    window.requestAnimationFrame(() => focusBeforeOpenRef.current?.focus())
  }

  /* 텍스트 스티커 입력 시트 오픈 (P5 U1): 24개 상한은 붙이기 전에 미리 안내한다. */
  const openTextSheetForCreate = (): void => {
    if (pageItems.length >= MAX_DECORATION_ITEMS_PER_PAGE) {
      showNotice(`한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지 붙일 수 있어요.`, true)
      return
    }
    setDrawerOpen(false)
    setTextSheet({ mode: "CREATE" })
  }

  /* 더블탭·연필 손잡이 양쪽에서 호출 (P5 U4/U5). */
  const openTextSheetForEdit = (index: number): void => {
    const target = pageItems[index]
    if (target === undefined || !isTextStickerPageItem(target)) return
    setSelectedIndex(index)
    setTextSheet({ mode: "EDIT", index, text: target.text, inkId: target.inkId })
  }

  const confirmTextSheet = (text: string, inkId: TextInkId): void => {
    if (textSheet === null) return
    if (textSheet.mode === "CREATE") {
      if (commit(appendJournalTextSticker(canonical, date, text.trim(), inkId), "글 스티커를 붙였어요. 드래그로 옮겨 보세요.")) {
        setSelectedIndex(pageItems.length)
        setTextSheet(null)
      }
      return
    }
    if (commit(updateJournalTextSticker(canonical, date, textSheet.index, text.trim(), inkId), "글 스티커를 고쳤어요.")) {
      setTextSheet(null)
    }
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
      showNotice(`복제할 자리가 없어요. 한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지예요.`, true)
      return
    }
    if (commit(next, "복제했어요. 새 장식을 옮겨 보세요.")) {
      setSelectedIndex(pageItems.length)
    }
  }

  const deletePlacement = (index: number): void => {
    const placement = pageItems[index]
    const item = placement === undefined ? undefined : DECORATION_CATALOG.find((candidate) => candidate.id === placement.itemId)
    const label = placement !== undefined && isTextStickerPageItem(placement)
      ? "글 스티커"
      : item === undefined ? "꾸미기" : item.name
    if (commit(removeJournalDecorationAt(canonical, date, index), `${withJosa(label, "을/를")} 지웠어요. 되돌리기로 복구할 수 있어요.`)) {
      setSelectedIndex(null)
    }
  }

  const moveSelected = (direction: "BACKWARD" | "FORWARD"): void => {
    if (selectedIndex === null) return
    const target = direction === "BACKWARD" ? selectedIndex - 1 : selectedIndex + 1
    const next = reorderJournalDecoration(canonical, date, selectedIndex, target)
    if (commit(next, direction === "BACKWARD" ? "장식을 한 칸 뒤로 보냈어요." : "장식을 한 칸 앞으로 가져왔어요.")) {
      setSelectedIndex(target)
    }
  }

  const copySelected = (): void => {
    if (selectedIndex === null) return
    const selected = pageItems[selectedIndex]
    if (selected === undefined) return
    copyJournalDecorationToSession(selected)
    setClipboardAvailable(true)
    showNotice("장식을 복사했어요. 다른 날짜에서도 붙일 수 있어요.")
  }

  const pasteCopied = (): void => {
    const copied = readJournalDecorationFromSession()
    if (copied === null) {
      setClipboardAvailable(false)
      return
    }
    if (pageItems.length >= MAX_DECORATION_ITEMS_PER_PAGE) {
      showNotice(`붙일 자리가 없어요. 한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지예요.`, true)
      return
    }
    if (commit(appendJournalDecorationItem(canonical, date, copied), "복사한 장식을 붙였어요.")) {
      setSelectedIndex(pageItems.length)
    }
  }

  return (
    <div ref={workspaceRef} className={`journal-decoration-workspace${open ? " journal-decoration-workspace--open" : ""}`} role={open ? "dialog" : undefined} aria-label={open ? "이 일지 꾸미기" : undefined} aria-modal={open ? "true" : undefined}>
      <JournalDecorationToolbar
        hasEntries={hasEntries}
        items={items}
        open={open}
        drawerOpen={drawerOpen}
        activeItemIds={activeItemIds}
        availablePoints={availablePoints}
        purchasableItemIds={purchasableItemIds}
        pageItemCounts={pageItemCounts}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        selectedIndex={selectedIndex}
        placementCount={pageItems.length}
        clipboardAvailable={clipboardAvailable}
        notice={notice?.text ?? ""}
        previewItemId={previewItemId}
        onOpen={() => {
          focusBeforeOpenRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          setOpen(true)
          setDrawerOpen(false)
        }}
        onDrawerOpen={() => setDrawerOpen(true)}
        onDrawerClose={() => {
          setDrawerOpen(false)
          clearPreview()
        }}
        onClose={close}
        onPreview={(item) => {
          setPreview(previewJournalDecoration(canonical, item, date))
          setPreviewItemId(item.id)
          setSelectedIndex(null)
          setNotice(null)
        }}
        onPreviewEnd={clearPreview}
        onUnavailable={(message) => showNotice(message, true)}
        onApply={apply}
        onPurchase={purchase}
        onClearAvatar={() => {
          if (commit(clearJournalAvatarDecoration(canonical), "아바타를 기본 상태로 바꿨어요.")) {
            setSelectedIndex(null)
            setDrawerOpen(false)
          }
        }}
        onUndo={() => timeTravel("UNDO")}
        onRedo={() => timeTravel("REDO")}
        onMoveBackward={() => moveSelected("BACKWARD")}
        onMoveForward={() => moveSelected("FORWARD")}
        onCopySelected={copySelected}
        onPaste={pasteCopied}
        onOpenTextSticker={hasEntries ? openTextSheetForCreate : undefined}
      />
      {textSheet !== null && (
        <JournalTextStickerSheet
          mode={textSheet.mode}
          initialText={textSheet.mode === "EDIT" ? textSheet.text : ""}
          initialInkId={textSheet.mode === "EDIT" ? textSheet.inkId : "TEXT_INK_NAVY"}
          onConfirm={confirmTextSheet}
          onClose={() => setTextSheet(null)}
        />
      )}
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
        onEditTextPlacement={openTextSheetForEdit}
      >{children}</DecoratedJournalPageFrame>
    </div>
  )
}
