import React from "react"
import { hasActiveBrowserBackLayer, isBrowserPopNavigationConsumed } from "../../navigation/browserNavigation"
import { DecoratedJournalPageFrame } from "../../components/DecoratedJournalPageFrame"
import { ContextualIllustration } from "../../components/ContextualIllustration"
import { AppHeading } from "../../components/AppHeading"
import {
  DECORATION_CATALOG,
  MAX_DECORATION_ITEMS_PER_PAGE,
  isAvatarDecorationId,
  isInkDecorationId,
  isPlacementDecorationId,
  isThemeDecorationId,
  claimRewardDecorations,
  collectionById,
  collectionVisibleInShop,
  loadDecorationState,
  purchaseCollectionBundle,
  purchaseDecoration,
  readDecorationStateSerialized,
  saveDecorationStateIfCurrent,
} from "../../domain/decorations"
import { isTextStickerPageItem } from "../../domain/decorations"
import type { DecorationCatalogItem, DecorationCollection, DecorationId, DecorationPlacementTransform, DecorationState, TextInkId } from "../../domain/decorations"
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
  clearJournalDecorationSessionClipboard,
} from "../../domain/journal-decoration-clipboard"
import {
  clearJournalDecorationAutoOpen,
  pendingJournalDecorationAutoOpenDate,
} from "../../domain/journal-decoration-intent"
import { ENGAGEMENT_EVENT, loadEngagementSummary, reconcileJournalAwards, toEngagementJournalRef } from "../../domain/engagement"
import { todayISO } from "../../domain/journal-store"
import { withJosa } from "../../domain/korean-josa"
import { JournalDecorationLauncher, JournalDecorationToolbar } from "./JournalDecorationToolbar"
import { JournalTextStickerSheet } from "./JournalTextStickerSheet"
import { accountDecorationsEnabled, accountDecorationStatus, ACCOUNT_DECORATION_EVENT,
  hydrateAccountDecorations, persistAccountDecorations, purchaseAccountDecoration } from "../../domain/account/account-decoration-service"
import { ACCOUNT_REWARD_EVENT, hydrateAccountRewards, readAccountRewardSummary } from "../../domain/account/account-reward-service"
import { activeLocalAccount, onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { AccountDecorationConflictPanel } from "../../components/AccountDecorationConflictPanel"
import { ShellToastHost } from "../../components/ShellToastHost"
import { MonthCalendar } from "../../components/MonthCalendar"
import type { CalendarDecorationEditorHandle } from "./CalendarDecorationEditor"
import { calendarDecorationReadStatus, loadCalendarDecorationState, readCalendarDecorationStateSerialized, persistCalendarDecorationStateIfCurrent, CALENDAR_DECORATION_EVENT } from "../../domain/calendar-decoration-store"
import { accountCalendarDecorationStatus, hydrateAccountCalendarDecorations } from "../../domain/account/account-calendar-decoration-service"
import type { CalendarDecorationState } from "../../domain/calendar-decoration-schema"
import { registerUnsavedDraftGuard } from "../../domain/unsaved-draft-navigation"
import { loadEntries } from "../../domain/journal-store"
import { JournalDecorationPreview, useJournalDecorationPreviews } from "./JournalDecorationPreview"
import "./journal-decoration-unified.css"
import { ACCOUNT_AUTH_STATE_EVENT, accountAuthState } from "../../domain/account/account-auth-state"
import { AccountCalendarDecorationConflictPanel } from "../../components/AccountCalendarDecorationConflictPanel"

const CalendarDecorationEditor = React.lazy(() => import("./CalendarDecorationEditor").then(module => ({ default: module.CalendarDecorationEditor })))
// Rejected ownership outbox data remains an owner-scoped local draft, not a
// successful save. It can still be loaded and compared through explicit CAS review.
const CALENDAR_REVIEWABLE_STATUSES = ["READY", "EMPTY", "PENDING", "OWNERSHIP_STATE_CHANGED"]

/* 입력 시트 상태: 새로 만들기 또는 기존 인덱스 재편집 (P5 U2/U4). */
type TextSheetState =
  | { readonly mode: "CREATE" }
  | { readonly mode: "EDIT"; readonly index: number; readonly text: string; readonly inkId: TextInkId }

type DecorationNotice = {
  readonly text: string
  readonly persistent: boolean
}

type SurfaceProps = {
  readonly date: string; readonly hasEntries: boolean; readonly children: React.ReactNode
  readonly pageTopRef?: React.Ref<HTMLDivElement>
  readonly initiallyOpen?: boolean
  readonly onDone?: () => void
  readonly previewMonth?: string
  readonly materialsFooter?: React.ReactNode
}
export function JournalDecorationSurface(props: SurfaceProps) {
  const owner = React.useSyncExternalStore(onLocalJournalScopeChange, activeLocalAccount, () => null)
  return <JournalDecorationSurfaceBootstrap key={`${owner ?? "device"}:${props.date}`} {...props} />
}

function JournalDecorationSurfaceBootstrap(props: SurfaceProps) {
  const [initial, setInitial] = React.useState<{ canonical: DecorationState; storageVersion: string | null } | null>(null)
  React.useEffect(() => {
    // The existing loader may initialize or migrate local decoration storage and
    // synchronously notify mounted previews. Do that after commit, before edits.
    const canonical = loadDecorationState()
    setInitial({ canonical, storageVersion: readDecorationStateSerialized() })
  }, [])
  if (initial === null) return <p role="status">꾸미기 상태를 준비하고 있어요.</p>
  return <JournalDecorationSurfaceSession {...props} initial={initial} />
}

function JournalDecorationSurfaceSession({
  date,
  hasEntries,
  children,
  pageTopRef,
  initiallyOpen = false,
  onDone,
  previewMonth,
  materialsFooter,
  initial,
}: SurfaceProps & { readonly initial: { readonly canonical: DecorationState; readonly storageVersion: string | null } }) {
  const [canonical, setCanonical] = React.useState(initial.canonical)
  const [storageVersion, setStorageVersion] = React.useState(initial.storageVersion)
  const [preview, setPreview] = React.useState<DecorationState | null>(null)
  /* 홈 "꾸미기 열기" → 오늘 일지로 이동해 바로 편집 시작 (레거시 별도 화면 통합). */
  const [open, setOpen] = React.useState(() => initiallyOpen || pendingJournalDecorationAutoOpenDate() === date)
  const [target, setTarget] = React.useState<"JOURNAL" | "CALENDAR">("JOURNAL")
  const editorHeadingId = React.useId()
  const [calendar, setCalendar] = React.useState(loadCalendarDecorationState)
  const calendarBase = React.useRef(readCalendarDecorationStateSerialized())
  const [calendarStatus, setCalendarStatus] = React.useState<string>(() => accountDecorationsEnabled() ? accountCalendarDecorationStatus() : calendarDecorationReadStatus())
  const [calendarMonth, setCalendarMonth] = React.useState(previewMonth ?? date.slice(0, 7))
  const [calendarDate, setCalendarDate] = React.useState(date)
  const [calendarSaving, setCalendarSaving] = React.useState(false)
  const calendarSavingRef = React.useRef(false)
  const [calendarChecking, setCalendarChecking] = React.useState(false)
  const calendarCheckingRef = React.useRef(false)
  const calendarRef = React.useRef<CalendarDecorationEditorHandle>(null)
  const [calendarDirty, setCalendarDirty] = React.useState(false)
  const [leave, setLeave] = React.useState<(() => void) | null>(null)
  const permitLeave = React.useRef(false)
  const requestLeaveRef = React.useRef<(done: () => void) => void>(() => {})
  const closeLayerRef = React.useRef<() => boolean>(() => false)
  const historyToken = React.useRef(`decoration-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const historyMounted = React.useRef(false)
  const [hiddenForReading, setHiddenForReading] = React.useState(false)
  const [calendarNotice, setCalendarNotice] = React.useState("")
  const [calendarReview, setCalendarReview] = React.useState<{ serialized: string | null; state: CalendarDecorationState; draft: CalendarDecorationState } | null>(null)
  const [calendarMaterials, setCalendarMaterials] = React.useState<CalendarDecorationState | null>(null)
  const entries = loadEntries()
  const activeDates = React.useMemo(() => new Set(entries.map(entry => entry.date)), [entries.map(entry => `${entry.id}:${entry.savedAt}`).join("|")])
  const motifs = useJournalDecorationPreviews(activeDates)
  React.useEffect(() => {
    const refresh = () => {
      const status = accountDecorationsEnabled() ? accountCalendarDecorationStatus() : calendarDecorationReadStatus()
      setCalendarStatus(status)
      if (CALENDAR_REVIEWABLE_STATUSES.includes(status) && !calendarRef.current?.hasDirty() && !calendarSavingRef.current) {
        setCalendar(loadCalendarDecorationState()); calendarBase.current = readCalendarDecorationStateSerialized()
      }
    }
    window.addEventListener(CALENDAR_DECORATION_EVENT, refresh)
    window.addEventListener("trainoracle:account-calendar-decorations-changed", refresh)
    window.addEventListener(ACCOUNT_AUTH_STATE_EVENT, refresh)
    if (accountDecorationsEnabled() && activeLocalAccount()) void hydrateAccountCalendarDecorations()
    return () => { window.removeEventListener(CALENDAR_DECORATION_EVENT, refresh); window.removeEventListener("trainoracle:account-calendar-decorations-changed", refresh); window.removeEventListener(ACCOUNT_AUTH_STATE_EVENT, refresh) }
  }, [])
  React.useEffect(() => registerUnsavedDraftGuard({
    isUnsafe: () => !permitLeave.current && Boolean(calendarRef.current?.hasDirty()),
    onBlocked: () => {},
    requestNavigation: resume => requestLeaveRef.current(() => { permitLeave.current = true; resume(); permitLeave.current = false }),
  }), [])
  React.useEffect(() => {
    if (!calendarDirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [calendarDirty])
  React.useEffect(() => { if (!calendarDirty) setCalendarReview(null) }, [calendarDirty])
  React.useEffect(() => {
    if (!open) return
    historyMounted.current = true
    const token = historyToken.current
    const push = () => window.history.pushState({ ...window.history.state, journalDecorationEditor: token }, "", window.location.href)
    if (window.history.state?.journalDecorationEditor !== token) push()
    const pop = (event: PopStateEvent) => {
      if (isBrowserPopNavigationConsumed(event)) return
      if (event.state?.journalDecorationEditor === token) return
      if (closeLayerRef.current()) { push(); return }
      if (calendarRef.current?.hasDirty()) push()
      requestLeaveRef.current(close)
    }
    window.addEventListener("popstate", pop)
    return () => {
      window.removeEventListener("popstate", pop)
      historyMounted.current = false
      // StrictMode rehearses effect cleanup before immediately mounting it again.
      // That rehearsal must not produce a real browser-back event and close the editor.
      queueMicrotask(() => { if (!historyMounted.current && window.history.state?.journalDecorationEditor === token) window.history.back() })
    }
  }, [open])
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
  const readingPosition = React.useRef<{ element: HTMLElement; top: number } | null>(null)
  const savingRef = React.useRef(false)
  const [saving, setSaving] = React.useState(false)
  const [accountStatus, setAccountStatus] = React.useState(accountDecorationStatus)
  const accountEpoch = React.useRef(0)
  const storageVersionRef = React.useRef(storageVersion)
  storageVersionRef.current = storageVersion
  const editable = !accountDecorationsEnabled() || ["READY", "EMPTY", "PENDING"].includes(accountStatus)
  React.useEffect(() => {
    const refresh = () => {
      setAccountStatus(accountDecorationStatus())
      if (!savingRef.current && accountDecorationsEnabled()) {
        if (readDecorationStateSerialized() !== storageVersionRef.current) {
          setPast([]); setFuture([]); setPreview(null); setPreviewItemId(null); setSelectedIndex(null); setTextSheet(null)
        }
        setCanonical(loadDecorationState())
        setStorageVersion(readDecorationStateSerialized())
      }
    }
    const scopeChanged = () => {
      accountEpoch.current += 1; savingRef.current = false; setSaving(false)
      clearJournalDecorationSessionClipboard(); setClipboardAvailable(false); setEarnedPoints(0)
      setCanonical(loadDecorationState()); setStorageVersion(readDecorationStateSerialized())
      setPast([]); setFuture([]); setPreview(null); setTextSheet(null); setSelectedIndex(null); setOpen(false)
    }
    const unsubscribe = onLocalJournalScopeChange(scopeChanged)
    window.addEventListener(ACCOUNT_DECORATION_EVENT, refresh)
    refresh()
    if (accountDecorationsEnabled() && activeLocalAccount()) void hydrateAccountDecorations()
    return () => { accountEpoch.current += 1; unsubscribe(); window.removeEventListener(ACCOUNT_DECORATION_EVENT, refresh) }
  }, [])
  /* 포인트 구매가 편집기 서랍으로 들어왔다 — 드래그 중 매 렌더 재계산을 피해 열 때만 읽는다. */
  const [earnedPoints, setEarnedPoints] = React.useState(() => loadEngagementSummary(todayISO()).points)
  const today = todayISO()
  React.useEffect(() => {
    const refresh = () => setEarnedPoints(loadEngagementSummary(today).points)
    if (open) {
      if (accountDecorationsEnabled()) {
        void hydrateAccountRewards()
      } else {
        const journalRefs = loadEntries().flatMap((entry) => {
          const ref = toEngagementJournalRef(entry)
          return ref === null ? [] : [ref]
        })
        const summary = reconcileJournalAwards(journalRefs, today)
        setEarnedPoints(summary.points)
        /* 계정 보상은 서버가 소유권을 검증한다. 기기 모드에서만 로컬 규칙으로 자동 지급한다. */
        const claim = claimRewardDecorations(
          canonical,
          { journalDays: summary.journalDays, visitDays: summary.visitDays },
          today,
          storageVersion,
        )
        if (claim.kind === "CLAIMED") {
          setCanonical(claim.state)
          setStorageVersion(JSON.stringify(claim.state))
          const names = claim.items.slice(0, 2).map((item) => item.name).join(", ")
          const extra = claim.items.length > 2 ? ` 외 ${claim.items.length - 2}종` : ""
          setNotice({ text: `활동 보상으로 ${withJosa(`${names}${extra}`, "을/를")} 받았어요.`, persistent: true })
        }
      }
    }
    window.addEventListener(ACCOUNT_REWARD_EVENT, refresh)
    window.addEventListener(ENGAGEMENT_EVENT, refresh)
    return () => {
      window.removeEventListener(ACCOUNT_REWARD_EVENT, refresh)
      window.removeEventListener(ENGAGEMENT_EVENT, refresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열릴 때 현재 저장 스냅샷을 한 번 판정한다.
  }, [open])
  const availablePoints = accountDecorationsEnabled() ? readAccountRewardSummary()?.availablePoints ?? 0
    : Math.max(0, earnedPoints - canonical.spentPoints)
  /* 자동-열기 인텐트는 1회용 — 소비 후 지워 새로고침·재진입 시 저절로 열리지 않게 한다. */
  React.useEffect(() => {
    if (pendingJournalDecorationAutoOpenDate() === date) clearJournalDecorationAutoOpen()
  }, [date])
  const visible = preview ?? canonical
  React.useEffect(() => {
    if (!open) return undefined
    const workspace = workspaceRef.current
    const parent = workspace?.parentElement
    if (workspace === null || workspace === undefined || parent === null || parent === undefined) return undefined
    const siblings = Array.from(parent.children).filter((element): element is HTMLElement => (
      element instanceof HTMLElement && element !== workspace
    ))
    const previous = siblings.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }))
    for (const element of siblings) {
      element.inert = true
      element.setAttribute("aria-hidden", "true")
    }
    return () => {
      for (const state of previous) {
        state.element.inert = state.inert
        if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden")
        else state.element.setAttribute("aria-hidden", state.ariaHidden)
      }
    }
  }, [open])
  const owned = (itemId: DecorationId): boolean => canonical.ownedItemIds.includes(itemId)
  /* 재료 서랍은 카탈로그 전체를 보여 준다. 기록 없음·24개 상한은 항목을
   * 숨기지 않고 dim + 사유 안내로 표현해 사용자가 재료의 존재를 알게 한다. */
  const items = DECORATION_CATALOG.filter((item) => (
    isThemeDecorationId(item.id)
    || isInkDecorationId(item.id)
    || isAvatarDecorationId(item.id)
    || isPlacementDecorationId(item.id)
  )).filter((item) => {
    /* retire-never-delete: 은퇴·시즌 종료·라이선스 만료 아이템은 보유한 것만 남기고, 미보유분은 상점에서 거둔다. */
    if (item.starterOwned || owned(item.id)) return true
    if (item.availability !== "ACTIVE") return false
    const collection = item.collection === undefined ? undefined : collectionById(item.collection)
    return collection === undefined || collectionVisibleInShop(collection, today)
  })
  const purchasableItemIds = new Set(
    items.filter((item) => !item.starterOwned && !owned(item.id)).map((item) => item.id),
  )
  const pageItems = journalDecorationItems(canonical, date)
  const pageItemCounts = new Map<string, number>()
  for (const item of target === "CALENDAR" ? calendarMaterials?.items ?? [] : pageItems) pageItemCounts.set(item.itemId, (pageItemCounts.get(item.itemId) ?? 0) + 1)
  const activeItemIds = new Set<string>([
    ...canonical.ownedItemIds.map((itemId) => `owned:${itemId}`),
    ...(target === "CALENDAR" ? [calendarMaterials?.paperThemeId, ...(calendarMaterials?.items.map(item => item.itemId) ?? [])] : [
      canonical.equipped.themeId, canonical.equipped.inkId,
      ...(canonical.equipped.avatarId === null ? ["avatar:none"] : [canonical.equipped.avatarId]),
      ...pageItems.map(item => item.itemId),
    ]),
  ].filter((id): id is string => typeof id === "string"))

  const showNotice = (text: string, persistent = false): void => setNotice({ text, persistent })

  const clearPreview = (): void => {
    setPreview(null)
    setPreviewItemId(null)
    calendarRef.current?.clearPreview()
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
    if (event.key !== "Tab" || leave || hasActiveBrowserBackLayer()) return
    const root = workspaceRef.current
    if (root === null) return
    const focusable = Array.from(root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
    )).filter(element => element.closest('[inert], [aria-hidden="true"]') === null && (element.tagName === "SUMMARY" || !element.closest('details:not([open])')))
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (hasActiveBrowserBackLayer()) return
      if (event.key === "Escape" && !leave) {
        event.preventDefault(); event.stopImmediatePropagation()
        if (textSheet) { setTextSheet(null); return }
        if (drawerOpen) { setDrawerOpen(false); clearPreview(); return }
        if (target === "CALENDAR" && calendarRef.current?.closeTopLayer()) return
        if (target === "JOURNAL" && selectedIndex !== null) { setSelectedIndex(null); return }
        requestLeaveRef.current(close)
        return
      }
      trapFocus(event)
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  })

  const saveDeviceState = (next: DecorationState) => {
    try {
      const result = saveDecorationStateIfCurrent(next, storageVersion)
      return result.ok ? { ok: true as const, storage: "DEVICE" as const, state: next } : result
    } catch { return { ok: false as const, code: "WRITE_FAILED" as const } }
  }
  const saveAccountState = async (next: DecorationState) => {
    try { return await persistAccountDecorations(next, storageVersion) }
    catch { return { ok: false as const, code: "WRITE_FAILED" as const } }
  }
  const commit = async (next: DecorationState | null, successMessage: string): Promise<boolean> => {
    if (savingRef.current || !editable) return false
    if (next === null) {
      setPreview(null)
      setPreviewItemId(null)
      showNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.", true)
      return false
    }
    const epoch = accountEpoch.current
    savingRef.current = true; setSaving(true)
    const saved = accountDecorationsEnabled() ? await saveAccountState(next) : saveDeviceState(next)
    if (epoch !== accountEpoch.current) return false
    savingRef.current = false; setSaving(false)
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
    setCanonical(saved.state)
    setStorageVersion(JSON.stringify(saved.state))
    setPreview(null)
    setPreviewItemId(null)
    showNotice(saved.storage === "PENDING" ? "변경 내용은 보관했어요. 연결되면 계정에 저장해요." : successMessage,
      saved.storage === "PENDING")
    return true
  }

  /* Undo/Redo 공통: 대상 상태를 저장하고 스택을 반대쪽으로 옮긴다. 저장 실패 시 스택 보존. */
  const timeTravel = async (direction: "UNDO" | "REDO"): Promise<void> => {
    if (savingRef.current || !editable) return
    const source = direction === "UNDO" ? past : future
    const previous = source[source.length - 1]
    if (previous === undefined) return
    // Undo changes the canvas, never ownership or spent points from a later purchase.
    const target = { ...previous, spentPoints: canonical.spentPoints, ownedItemIds: canonical.ownedItemIds }
    const epoch = accountEpoch.current
    savingRef.current = true; setSaving(true)
    const saved = accountDecorationsEnabled() ? await saveAccountState(target) : saveDeviceState(target)
    if (epoch !== accountEpoch.current) return
    savingRef.current = false; setSaving(false)
    if (!saved.ok) {
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
    setCanonical(saved.state)
    setStorageVersion(JSON.stringify(saved.state))
    setPreview(null)
    setPreviewItemId(null)
    setSelectedIndex(null)
    showNotice(direction === "UNDO" ? "이전 꾸미기로 되돌렸어요." : "되돌리기를 취소했어요.")
  }

  /* Ctrl+Z / Ctrl+Y(또는 Ctrl+Shift+Z) — 편집기가 열려 있을 때만.
   * 글 스티커 입력창처럼 편집 가능한 대상에 포커스가 있으면 건드리지 않는다:
   * 타이핑 취소(Ctrl+Z)가 장식 Undo로 변질되면 입력 내용과 캔버스가 함께 어긋난다. */
  React.useEffect(() => {
    if (!open || target === "CALENDAR") return
    const onKeyDown = (event: KeyboardEvent) => {
      if (hasActiveBrowserBackLayer()) return
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
  const apply = async (item: DecorationCatalogItem): Promise<void> => {
    if (isPlacementDecorationId(item.id) && pageItems.length >= MAX_DECORATION_ITEMS_PER_PAGE) {
      showNotice(`한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지 붙일 수 있어요.`, true)
      return
    }
    const next = applyJournalDecoration(canonical, item, date)
    if (await commit(next, `${withJosa(item.name, "을/를")} 저장했어요.`)) {
      if (isPlacementDecorationId(item.id)) setSelectedIndex(pageItems.length)
      setDrawerOpen(false)
    }
  }

  /* 포인트 구매(레거시 상점 이식): 구매는 장식 배치가 아니므로 undo 스택에 넣지 않는다. */
  const purchase = async (item: DecorationCatalogItem): Promise<void> => {
    if (savingRef.current || !editable) return
    const owner = activeLocalAccount(), epoch = accountEpoch.current
    let result: ReturnType<typeof purchaseDecoration>
    if (accountDecorationsEnabled()) {
      if (owned(item.id)) { showNotice("이미 가지고 있어요."); return }
      savingRef.current = true; setSaving(true)
      const saved = await purchaseAccountDecoration(item.id, storageVersion).catch(() => null)
      if (epoch !== accountEpoch.current || owner !== activeLocalAccount()) return
      savingRef.current = false; setSaving(false)
      if (!saved?.ok || saved.storage !== "ACCOUNT") {
        showNotice(saved?.ok ? "구매 내용을 전송 중이에요. 계정 저장을 확인한 뒤 사용할 수 있어요." : "구매를 확인하지 못했어요. 기존 꾸미기는 그대로예요.", true)
        return
      }
      result = { kind: "PURCHASED", state: saved.state, remainingPoints: saved.remainingPoints }
    } else result = purchaseDecoration(earnedPoints, canonical, item.id, storageVersion)
    if (result.kind === "PURCHASED") {
      setCanonical(result.state)
      setStorageVersion(JSON.stringify(result.state))
      showNotice(`받았어요. ${result.remainingPoints}P가 남았어요.`)
    } else if (result.kind === "INSUFFICIENT_POINTS") {
      showNotice(`포인트가 ${item.cost - result.remainingPoints}P 더 필요해요. 오늘 방문 확인은 1P, 훈련·회복 기록을 남긴 날은 4P가 쌓여요.`, true)
    } else if (result.kind === "SAVE_FAILED") {
      recoverFromSaveFailure(result.code)
    } else if (result.kind === "NOT_PURCHASABLE") {
      showNotice(
        result.reason === "RETIRED"
          ? "지금은 받을 수 없는 재료예요. 이미 받은 것은 그대로 쓸 수 있어요."
          : result.reason === "SEASON"
            ? "기간 안에 자동으로 받는 시즌 재료예요."
            : "포인트가 아니라 활동 보상으로 받는 재료예요.",
        true,
      )
    } else {
      showNotice(result.kind === "ALREADY_OWNED" ? "이미 가지고 있어요." : "꾸미기 항목을 찾지 못했어요.", true)
    }
  }

  const recoverFromSaveFailure = (code: string): void => {
    if (code === "STALE_STATE") {
      const latest = loadDecorationState()
      setCanonical(latest)
      setStorageVersion(readDecorationStateSerialized())
      showNotice("다른 화면에서 꾸미기가 바뀌어 최신 상태를 다시 불러왔어요.", true)
    } else showNotice("저장하지 못했어요. 다시 시도해 주세요.", true)
  }

  /* 컬렉션 일괄 구매 — 개별 구매와 같이 undo 스택 밖에서 저장한다. */
  const purchaseBundle = (collection: DecorationCollection): void => {
    if (accountDecorationsEnabled()) {
      showNotice("계정에서는 재료를 하나씩 받을 수 있어요. 묶음 받기는 서버 검증을 준비하고 있어요.", true)
      return
    }
    const result = purchaseCollectionBundle(earnedPoints, canonical, collection.id, today, storageVersion)
    if (result.kind === "PURCHASED") {
      setCanonical(result.state)
      setStorageVersion(JSON.stringify(result.state))
      showNotice(`${collection.title} ${result.itemIds.length}종을 받았어요. ${result.remainingPoints}P가 남았어요.`)
    } else if (result.kind === "INSUFFICIENT_POINTS") {
      showNotice(`포인트가 ${result.cost - result.remainingPoints}P 더 필요해요.`, true)
    } else if (result.kind === "SAVE_FAILED") {
      recoverFromSaveFailure(result.code)
    } else if (result.kind === "ALREADY_OWNED") {
      showNotice("이 컬렉션은 이미 모두 가지고 있어요.", true)
    } else {
      showNotice("지금은 한 번에 받을 수 없는 컬렉션이에요.", true)
    }
  }

  const close = (): void => {
    if (savingRef.current || calendarSavingRef.current) { showNotice("변경 내용을 저장하고 있어요.", true); return }
    setOpen(false)
    setDrawerOpen(false)
    setPreview(null)
    setPreviewItemId(null)
    setSelectedIndex(null)
    setTextSheet(null)
    setNotice(null)
    setTarget("JOURNAL")
    onDone?.()
    window.requestAnimationFrame(() => {
      const launcher = workspaceRef.current?.querySelector<HTMLButtonElement>('[aria-label="일지 꾸미기 열기"]')
      const focusTarget = launcher ?? focusBeforeOpenRef.current
      if (readingPosition.current?.element.isConnected) readingPosition.current.element.scrollTop = readingPosition.current.top
      focusTarget?.focus({ preventScroll: true })
    })
  }

  /* 텍스트 스티커 입력 시트 오픈 (P5 U1): 24개 상한은 붙이기 전에 미리 안내한다. */
  const openTextSheetForCreate = (): void => {
    if (!editable || savingRef.current) return
    if (pageItems.length >= MAX_DECORATION_ITEMS_PER_PAGE) {
      showNotice(`한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지 붙일 수 있어요.`, true)
      return
    }
    setDrawerOpen(false)
    setTextSheet({ mode: "CREATE" })
  }

  /* 더블탭·연필 손잡이 양쪽에서 호출 (P5 U4/U5). */
  const openTextSheetForEdit = (index: number): void => {
    if (!editable || savingRef.current) return
    const target = pageItems[index]
    if (target === undefined || !isTextStickerPageItem(target)) return
    setSelectedIndex(index)
    setTextSheet({ mode: "EDIT", index, text: target.text, inkId: target.inkId })
  }

  const confirmTextSheet = async (text: string, inkId: TextInkId): Promise<void> => {
    if (textSheet === null) return
    if (textSheet.mode === "CREATE") {
      if (await commit(appendJournalTextSticker(canonical, date, text.trim(), inkId), "글 스티커를 붙였어요. 드래그로 옮겨 보세요.")) {
        setSelectedIndex(pageItems.length)
        setTextSheet(null)
      }
      return
    }
    if (await commit(updateJournalTextSticker(canonical, date, textSheet.index, text.trim(), inkId), "글 스티커를 고쳤어요.")) {
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
  const duplicatePlacement = async (index: number): Promise<void> => {
    const next = duplicateJournalDecorationAt(canonical, date, index)
    if (next === null) {
      showNotice(`복제할 자리가 없어요. 한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지예요.`, true)
      return
    }
    if (await commit(next, "복제했어요. 새 장식을 옮겨 보세요.")) {
      setSelectedIndex(pageItems.length)
    }
  }

  const deletePlacement = async (index: number): Promise<void> => {
    const placement = pageItems[index]
    const item = placement === undefined ? undefined : DECORATION_CATALOG.find((candidate) => candidate.id === placement.itemId)
    const label = placement !== undefined && isTextStickerPageItem(placement)
      ? "글 스티커"
      : item === undefined ? "꾸미기" : item.name
    if (await commit(removeJournalDecorationAt(canonical, date, index), `${withJosa(label, "을/를")} 지웠어요. 되돌리기로 복구할 수 있어요.`)) {
      setSelectedIndex(null)
    }
  }

  const moveSelected = async (direction: "BACKWARD" | "FORWARD"): Promise<void> => {
    if (selectedIndex === null) return
    const target = direction === "BACKWARD" ? selectedIndex - 1 : selectedIndex + 1
    const next = reorderJournalDecoration(canonical, date, selectedIndex, target)
    if (await commit(next, direction === "BACKWARD" ? "장식을 한 칸 뒤로 보냈어요." : "장식을 한 칸 앞으로 가져왔어요.")) {
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

  const pasteCopied = async (): Promise<void> => {
    const copied = readJournalDecorationFromSession()
    if (copied === null) {
      setClipboardAvailable(false)
      return
    }
    if (pageItems.length >= MAX_DECORATION_ITEMS_PER_PAGE) {
      showNotice(`붙일 자리가 없어요. 한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지예요.`, true)
      return
    }
    if (await commit(appendJournalDecorationItem(canonical, date, copied), "복사한 장식을 붙였어요.")) {
      setSelectedIndex(pageItems.length)
    }
  }

  const openEditor = (): void => {
    if (!editable) {
      showNotice("계정 꾸미기 상태를 먼저 확인해 주세요.", true)
      return
    }
    focusBeforeOpenRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const readingRegion = workspaceRef.current?.closest<HTMLElement>(".app-scroll-region")
    readingPosition.current = readingRegion ? { element: readingRegion, top: readingRegion.scrollTop } : null
    setOpen(true)
    setDrawerOpen(false)
    setTarget("JOURNAL")
    setHiddenForReading(false)
  }

  const requestLeave = (done: () => void): void => {
    if (leave || calendarSavingRef.current) return
    if (calendarRef.current?.hasDirty()) setLeave(() => done)
    else done()
  }
  requestLeaveRef.current = requestLeave
  closeLayerRef.current = () => {
    if (textSheet) { setTextSheet(null); return true }
    if (drawerOpen) { setDrawerOpen(false); clearPreview(); return true }
    return target === "CALENDAR" && Boolean(calendarRef.current?.closeTopLayer())
  }
  const switchTarget = (next: "JOURNAL" | "CALENDAR") => {
    if (next === target) return
    requestLeave(() => {
      clearPreview(); setSelectedIndex(null); setTextSheet(null); setDrawerOpen(false); setNotice(null)
      setTarget(next)
    })
  }
  const applyCalendar = async (candidate: CalendarDecorationState): Promise<boolean> => {
    if (calendarSavingRef.current) return false
    const owner = activeLocalAccount(), epoch = accountEpoch.current
    calendarSavingRef.current = true; setCalendarSaving(true)
    try {
      const result = await persistCalendarDecorationStateIfCurrent(candidate, calendarBase.current)
      if (owner !== activeLocalAccount() || epoch !== accountEpoch.current) return false
      if (!result.ok) {
        const currentStatus = accountDecorationsEnabled() ? accountCalendarDecorationStatus() : calendarDecorationReadStatus()
        if (result.code === "STALE_STATE" && CALENDAR_REVIEWABLE_STATUSES.includes(currentStatus)) {
          setCalendarReview({ serialized: readCalendarDecorationStateSerialized(), state: loadCalendarDecorationState(), draft: candidate })
        }
        setCalendarNotice(result.code === "STALE_STATE" || result.code === "OWNERSHIP_STATE_CHANGED"
          ? result.code === "STALE_STATE" ? "저장된 달력 꾸밈이 바뀌었어요. 내 변경은 남겨 두었어요. 두 내용을 확인해 주세요."
            : "재료 보유 상태가 바뀌었어요. 내 변경은 남겨 두었어요. 확인된 재료로 다시 적용해 주세요."
          : "저장하지 못했어요. 변경 내용은 남아 있어요. 다시 적용해 주세요.")
        setCalendarStatus(currentStatus)
        return false
      }
      setCalendarReview(null)
      setCalendar(result.state); calendarBase.current = readCalendarDecorationStateSerialized()
      setCalendarNotice(result.storage === "LOCAL" ? "이 기기에 저장됨" : result.storage === "ACCOUNT" ? "계정에 저장됨" : "동기화 대기 중")
      return true
    } catch { setCalendarNotice("저장하지 못했어요. 변경 내용은 남아 있어요."); return false }
    finally { if (owner === activeLocalAccount() && epoch === accountEpoch.current) { calendarSavingRef.current = false; setCalendarSaving(false) } }
  }
  const recheckCalendar = async (): Promise<void> => {
    if (calendarCheckingRef.current || calendarSavingRef.current) return
    const owner = activeLocalAccount(), epoch = accountEpoch.current, accountMode = accountDecorationsEnabled()
    const sameSession = () => owner === activeLocalAccount() && epoch === accountEpoch.current
    const current = () => sameSession() && accountMode === accountDecorationsEnabled()
    calendarCheckingRef.current = true; setCalendarChecking(true)
    try {
      if (accountMode) {
        if (calendarStatus === "OWNERSHIP_STATE_CHANGED") await hydrateAccountDecorations()
        if (!current()) return
        await hydrateAccountCalendarDecorations()
      }
      if (!current()) return
      const status = accountMode ? accountCalendarDecorationStatus() : calendarDecorationReadStatus()
      setCalendarStatus(status)
      if (CALENDAR_REVIEWABLE_STATUSES.includes(status)) {
        // A dirty draft keeps its original CAS base. Any newer saved state must
        // still go through the explicit review instead of silently rebasing it.
        if (!calendarRef.current?.hasDirty()) {
          setCalendar(loadCalendarDecorationState()); calendarBase.current = readCalendarDecorationStateSerialized()
        }
        setCalendarNotice(calendarRef.current?.hasDirty() ? "저장 상태를 확인했어요. 내 변경은 그대로 남아 있어요." : "저장된 달력 꾸밈을 확인했어요.")
      } else setCalendarNotice("")
    } catch {
      if (current()) { setCalendarStatus("FAILED"); setCalendarNotice("달력 꾸밈을 확인하지 못했어요. 내 변경은 남아 있어요.") }
    } finally {
      if (sameSession()) { calendarCheckingRef.current = false; setCalendarChecking(false) }
    }
  }
  const reviewCurrentCalendar = (): typeof calendarReview => {
    if (!calendarReview) return null
    const currentStatus = accountDecorationsEnabled() ? accountCalendarDecorationStatus() : calendarDecorationReadStatus()
    if (!CALENDAR_REVIEWABLE_STATUSES.includes(currentStatus)) {
      setCalendarStatus(currentStatus)
      setCalendarNotice("저장된 내용을 다시 확인한 뒤 선택해 주세요. 내 변경은 남아 있어요.")
      return null
    }
    const serialized = readCalendarDecorationStateSerialized()
    const currentDraft = calendarRef.current?.getDraft()
    if (currentDraft && JSON.stringify(currentDraft) !== JSON.stringify(calendarReview.draft)) {
      setCalendarReview({ ...calendarReview, serialized, state: loadCalendarDecorationState(), draft: currentDraft })
      setCalendarNotice("내 변경 내용이 바뀌었어요. 새 내용을 확인하고 선택해 주세요.")
      return null
    }
    if (serialized !== calendarReview.serialized) {
      setCalendarReview({ ...calendarReview, serialized, state: loadCalendarDecorationState() })
      setCalendarNotice("저장된 내용이 다시 바뀌었어요. 새 내용을 확인하고 선택해 주세요.")
      return null
    }
    return calendarReview
  }
  const loadReviewedCalendar = () => {
    const reviewed = reviewCurrentCalendar()
    if (!reviewed) return
    calendarRef.current?.discard(); clearPreview(); setDrawerOpen(false); setCalendarDirty(false)
    setCalendar(reviewed.state); calendarBase.current = reviewed.serialized; setCalendarReview(null)
    setCalendarNotice("저장된 달력 꾸밈을 불러왔어요.")
  }
  const reapplyReviewedCalendar = async () => {
    const reviewed = reviewCurrentCalendar()
    if (!reviewed) return
    // Rebase only after this explicit choice, and keep the reviewed CAS value.
    // A later change is rejected by the same save path instead of being overwritten.
    calendarBase.current = reviewed.serialized
    await calendarRef.current?.requestApply()
  }
  const calendarDisabled = !editable || !["READY", "EMPTY", "PENDING", "OWNERSHIP_STATE_CHANGED"].includes(calendarStatus)
    ? calendarStatus === "UNSUPPORTED" ? accountDecorationsEnabled() ? "달력 계정 저장을 아직 지원하지 않아요. 기존 일지는 그대로 사용할 수 있어요."
      : "이 버전에서 읽을 수 없는 달력 꾸밈이에요. 원본은 보존하고 편집은 제한했어요."
      : "저장된 달력 꾸밈을 확인한 뒤 편집할 수 있어요." : undefined

  return (
    <div ref={workspaceRef} className={`journal-decoration-workspace${open ? " journal-decoration-workspace--open" : ""}`} role={open ? "dialog" : undefined} aria-labelledby={open ? editorHeadingId : undefined} aria-modal={open ? "true" : undefined}>
      {!open && <div className="journal-decoration-unified__entry"><JournalDecorationLauncher onOpen={openEditor} /><details><summary>더보기</summary><button type="button" onClick={() => setHiddenForReading(value => !value)}>{hiddenForReading ? "장식 다시 보기" : "장식 잠시 숨기기"}</button></details></div>}
      {open && <header className="journal-decoration-unified__header"><div className="contextual-entry-intro"><AppHeading id={editorHeadingId} as="h1" variant="screen">{target === "CALENDAR" ? "달력 꾸미기" : "일지 꾸미기"}</AppHeading>
        {target === "JOURNAL" && selectedIndex === null && !drawerOpen && !preview && !textSheet && !notice && !saving && !leave
          && (!accountDecorationsEnabled() || accountAuthState() === "ACCOUNT" && ["READY", "EMPTY"].includes(accountStatus))
          && <ContextualIllustration image="decorating-kit-v2" />}
      </div><div className="app-choice-group" role="group" aria-label="꾸밀 대상"><button className="app-choice-control" type="button" aria-pressed={target === "JOURNAL"} onClick={() => switchTarget("JOURNAL")}>일지</button><button className="app-choice-control" type="button" aria-pressed={target === "CALENDAR"} onClick={() => switchTarget("CALENDAR")}>달력</button></div>{target === "CALENDAR" && <button type="button" aria-label="꾸미기 완료" onClick={() => requestLeave(close)}>완료</button>}</header>}
      {accountDecorationsEnabled() && <div role="status" className="account-storage-status">
        {accountAuthState() === "RESOLVING" ? "로그인 상태를 확인하고 있어요." : accountAuthState() === "FAILED" ? "로그인 상태를 확인하지 못했어요. 게스트 장부로 전환하지 않았어요." : saving ? "꾸미기 저장 중" : accountStatus === "READY" ? "계정 꾸미기" : accountStatus === "EMPTY" ? "계정에 저장된 꾸미기가 없어요." : accountStatus === "PENDING"
          ? "연결되면 계정에 저장해요" : accountStatus === "CONFLICT" ? "다른 기기의 꾸미기와 달라요. 두 내용을 확인해 주세요."
            : accountStatus === "FAILED" ? "꾸미기 조회에 실패했어요. 기기의 보관 내용은 지우지 않았어요."
            : accountStatus === "DELETED" ? "계정에서 삭제된 꾸미기예요. 자동으로 복원하지 않아요."
            : accountStatus === "AUTH_REQUIRED" ? "계정 꾸미기는 로그인 후 사용할 수 있어요."
            : "계정의 꾸미기를 불러오고 있어요."}
        {!saving && accountStatus === "FAILED" && <button type="button" onClick={() => void hydrateAccountDecorations()}>다시 불러오기</button>}
      </div>}
      {accountDecorationsEnabled() && activeLocalAccount() && <AccountDecorationConflictPanel />}
      {(target === "JOURNAL" || drawerOpen) && <JournalDecorationToolbar
        calendarMode={target === "CALENDAR"}
        materialsFooter={materialsFooter}
        hasEntries={hasEntries}
        items={items}
        open={open}
        renderLauncher={false}
        drawerOpen={drawerOpen}
        activeItemIds={activeItemIds}
        availablePoints={availablePoints}
        purchasableItemIds={purchasableItemIds}
        pageItemCounts={pageItemCounts}
        canUndo={editable && !saving && past.length > 0}
        canRedo={editable && !saving && future.length > 0}
        selectedIndex={selectedIndex}
        placementCount={target === "CALENDAR" ? calendarMaterials?.items.length ?? 0 : pageItems.length}
        clipboardAvailable={clipboardAvailable}
        notice={notice?.text ?? ""}
        previewItemId={previewItemId}
        onOpen={openEditor}
        onDrawerOpen={() => setDrawerOpen(true)}
        onDrawerClose={() => {
          setDrawerOpen(false)
          clearPreview()
        }}
        onClose={() => requestLeave(close)}
        onPreview={(item) => {
          if (target === "CALENDAR") { calendarRef.current?.previewMaterial(item); setPreviewItemId(item.id); return }
          setPreview(previewJournalDecoration(canonical, item, date))
          setPreviewItemId(item.id)
          setSelectedIndex(null)
          setNotice(null)
        }}
        onPreviewEnd={clearPreview}
        onUnavailable={(message) => showNotice(message, true)}
        onApply={item => { if (target === "CALENDAR") { calendarRef.current?.applyMaterial(item); setDrawerOpen(false); clearPreview() } else void apply(item) }}
        onPurchase={purchase}
        bundlePurchasesEnabled={!accountDecorationsEnabled()}
        onPurchaseBundle={purchaseBundle}
        today={today}
        onClearAvatar={async () => {
          if (await commit(clearJournalAvatarDecoration(canonical), "아바타를 기본 상태로 바꿨어요.")) {
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
      />}
      {open && target === "CALENDAR" ? <><div role="status" className="account-storage-status calendar-decoration-storage-status">{calendarChecking ? "달력 저장 상태를 확인하고 있어요." : calendarNotice || (calendarStatus === "OWNERSHIP_STATE_CHANGED" ? "재료 보유 상태가 바뀌었어요. 재료를 확인하고 다시 적용해 주세요." : calendarStatus === "PENDING" ? "동기화 대기 중" : calendarDisabled || "모든 달에 공통으로 적용돼요.")}
        {["FAILED", "UNSUPPORTED", "AUTH_REQUIRED", "OWNERSHIP_STATE_CHANGED"].includes(calendarStatus) && <button type="button" disabled={calendarChecking || calendarSaving} onClick={() => void recheckCalendar()}>달력 다시 확인</button>}
      </div>
      {accountDecorationsEnabled() && activeLocalAccount() && <AccountCalendarDecorationConflictPanel onBeforeResolve={requestLeave} onResolved={() => { setCalendar(loadCalendarDecorationState()); calendarBase.current = readCalendarDecorationStateSerialized(); setCalendarNotice("") }} />}
      {calendarReview && CALENDAR_REVIEWABLE_STATUSES.includes(calendarStatus) && <section className="calendar-decoration-review" aria-label="달력 변경 확인">
        <h2>어떤 꾸밈을 사용할까요?</h2>
        <p>저장된 꾸밈: {calendarReview.state.paperThemeId ? DECORATION_CATALOG.find(item => item.id === calendarReview.state.paperThemeId)?.name ?? "종이 테마" : "기본 종이"} · 그림 {calendarReview.state.items.length}개</p>
        <p>내 변경: {calendarReview.draft.paperThemeId ? DECORATION_CATALOG.find(item => item.id === calendarReview.draft.paperThemeId)?.name ?? "종이 테마" : "기본 종이"} · 그림 {calendarReview.draft.items.length}개</p>
        <p>내 변경으로 바꾸면 지금 확인한 저장 내용을 대신해요.</p>
        <button type="button" disabled={calendarSaving} onClick={loadReviewedCalendar}>저장된 꾸밈 불러오기</button>
        <button type="button" disabled={calendarSaving} onClick={() => void reapplyReviewedCalendar()}>내 변경으로 바꾸기</button>
      </section>}
      <React.Suspense fallback={<p role="status">달력 미리보기를 준비하고 있어요.</p>}><CalendarDecorationEditor
        ref={calendarRef} state={calendar} ownedIds={new Set(canonical.ownedItemIds)} saving={calendarSaving} requiresApply={calendarStatus === "OWNERSHIP_STATE_CHANGED"}
        disabledReason={calendarDisabled} onDirtyChange={setCalendarDirty} onApply={applyCalendar}
        onExit={() => requestLeave(close)} onCancel={() => { calendarRef.current?.discard(); setCalendarDirty(false); setDrawerOpen(false); clearPreview(); setTarget("JOURNAL") }} onOpenMaterials={() => { setCalendarMaterials(calendarRef.current?.getDraft() ?? calendar); setDrawerOpen(true) }}>
        <MonthCalendar month={calendarMonth} today={today} selectedDate={calendarDate} onMonthChange={setCalendarMonth} onSelectDate={setCalendarDate}
          dayDescription={day => activeDates.has(day) ? "저장한 일지 있음" : "일지 없음"}
          dayAdornmentDescription={day => motifs.has(day) ? "일지에 그림 장식 있음" : undefined}
          renderDayAdornment={day => <JournalDecorationPreview item={motifs.get(day)} />}
          renderDay={day => { const count = entries.filter(entry => entry.date === day).length; return count ? <span>{count}개 기록</span> : null }} />
      </CalendarDecorationEditor></React.Suspense></> : <DecoratedJournalPageFrame
        hideDecorations={hiddenForReading && !open}
        date={date}
        state={visible}
        pageTopRef={pageTopRef}
        editable={editable && !saving && open && preview === null}
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
      >{children}</DecoratedJournalPageFrame>}
      {!open && !hiddenForReading && pageItems.some(isTextStickerPageItem) && <div className="journal-decoration-text-equivalent">{pageItems.filter(isTextStickerPageItem).map((item, index) => <p key={index}>글 스티커: {item.text}</p>)}</div>}
      {leave && <CalendarLeaveDialog onKeep={() => setLeave(null)} onDiscard={() => { const done = leave; calendarRef.current?.discard(); setCalendarDirty(false); setLeave(null); done() }} onApply={async () => { if (await calendarRef.current?.requestApply()) { const done = leave; setCalendarDirty(false); setLeave(null); done() } }} />}
      <ShellToastHost active={open} />
      {textSheet !== null && (
        <JournalTextStickerSheet
          mode={textSheet.mode}
          initialText={textSheet.mode === "EDIT" ? textSheet.text : ""}
          initialInkId={textSheet.mode === "EDIT" ? textSheet.inkId : "TEXT_INK_NAVY"}
          onConfirm={confirmTextSheet}
          onClose={() => setTextSheet(null)}
        />
      )}
    </div>
  )
}

function CalendarLeaveDialog({ onKeep, onDiscard, onApply }: { onKeep: () => void; onDiscard: () => void; onApply: () => Promise<void> }) {
  const panel = React.useRef<HTMLDivElement>(null)
  const [busy, setBusy] = React.useState(false)
  React.useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.current?.querySelector<HTMLButtonElement>('[data-keep]')?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  return <div className="calendar-decoration-leave"><div ref={panel} className="calendar-decoration-leave__panel" role="alertdialog" aria-modal="true" aria-labelledby="calendar-leave-heading" aria-describedby="calendar-leave-description" onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!busy) onKeep() }
    if (event.key === "Tab") {
      const buttons = [...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus() }
    }
  }}><h2 id="calendar-leave-heading">달력 변경을 적용할까요?</h2><p id="calendar-leave-description">아직 적용하지 않은 꾸밈이 있어요. 구매한 재료는 어떤 선택을 해도 남아요.</p><div className="calendar-decoration-leave__actions">
    <button type="button" disabled={busy} onClick={() => { setBusy(true); void onApply().finally(() => setBusy(false)) }}>적용하고 나가기</button>
    <button type="button" data-keep disabled={busy} onClick={onKeep}>계속 편집</button>
    <button type="button" disabled={busy} onClick={onDiscard}>변경 버리기</button>
  </div></div></div>
}
