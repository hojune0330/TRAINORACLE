import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardPaste,
  Copy,
  LayoutGrid,
  Layers2,
  LockKeyhole,
  Palette,
  PenLine,
  Redo2,
  Smile,
  Sticker,
  Type,
  Undo2,
  UserRoundX,
  X,
} from "lucide-react"
import React from "react"
import {
  CUTE_STICKER_GROUPS,
  CUTE_STICKER_PRICE,
  MAX_DECORATION_ITEMS_PER_PAGE,
} from "../../domain/decorations"
import type { DecorationCatalogItem } from "../../domain/decorations"

type DrawerFilter =
  | "ALL"
  | "MATERIALS"
  | "STICKER"
  | "STAMP"
  | "TAPE"
  | "THEME"
  | "AVATAR"
  | "INK"
  | "EMOJI_STICKER"

type MaterialCategory = Exclude<DrawerFilter, "ALL" | "MATERIALS" | "EMOJI_STICKER">

const DRAWER_FILTERS: readonly { readonly id: DrawerFilter; readonly label: string }[] = [
  { id: "ALL", label: "전체" },
  { id: "STICKER", label: "스티커" },
  { id: "STAMP", label: "도장" },
  { id: "TAPE", label: "테이프" },
  { id: "THEME", label: "테마" },
  { id: "AVATAR", label: "아바타" },
  { id: "INK", label: "글자색" },
  { id: "EMOJI_STICKER", label: "이모지" },
]

const MATERIAL_CATEGORY_ORDER: readonly MaterialCategory[] = [
  "STICKER",
  "STAMP",
  "TAPE",
  "THEME",
  "AVATAR",
  "INK",
]

const MATERIAL_CATEGORY_LABELS: Readonly<Record<MaterialCategory, string>> = {
  STICKER: "스티커",
  STAMP: "도장",
  TAPE: "테이프",
  THEME: "테마",
  AVATAR: "아바타",
  INK: "글자색",
}

function materialDisplayName(item: DecorationCatalogItem): string {
  if (item.id === "THEME_TRACK_NOTEBOOK") return "기본 · 트랙 노트"
  if (item.id === "INK_NAVY") return "기본 · 남색 잉크"
  return item.name
}

/*
 * 이모지 스티커는 기존 48종 전용 레일을 유지한다. 재료 서랍 안에서도
 * 44px 터치 타깃과 페이지 배치 수를 그대로 보여 준다.
 */
function EmojiStickerGrid({
  items,
  pageItemCounts,
  blockedReason,
  onApply,
  onUnavailable,
}: {
  readonly items: readonly DecorationCatalogItem[]
  readonly pageItemCounts: ReadonlyMap<string, number>
  readonly blockedReason: string | null
  readonly onApply: (item: DecorationCatalogItem) => void
  readonly onUnavailable: (message: string) => void
}) {
  if (items.length === 0) return null
  return (
    <section className="journal-decoration-toolbar__emoji-section" aria-labelledby="decoration-emoji-title">
      <h3 id="decoration-emoji-title">이모지 스티커</h3>
      <small>{`한 페이지에 장식 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지`}</small>
      <div className="journal-decoration-toolbar__emoji-grid" role="group" aria-label="이모지 스티커">
        {items.map((item) => {
          const count = pageItemCounts.get(item.id) ?? 0
          return (
            <button
              key={item.id}
              type="button"
              data-used={count > 0 ? "true" : undefined}
              data-blocked={blockedReason === null ? undefined : "true"}
              aria-disabled={blockedReason === null ? undefined : "true"}
              aria-label={`${item.name} 이모지 붙이기${count > 0 ? `, 현재 ${count}개` : ""}${blockedReason === null ? "" : `, ${blockedReason}`}`}
              onClick={() => blockedReason === null ? onApply(item) : onUnavailable(blockedReason)}
            >
              <span aria-hidden="true">{item.emoji}</span>
              {count > 0 && <b aria-hidden="true">{count}</b>}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function MaterialTile({
  item,
  active,
  owned,
  count,
  previewing,
  blockedReason,
  onActivate,
  onPreview,
  onPreviewEnd,
}: {
  readonly item: DecorationCatalogItem
  readonly active: boolean
  readonly owned: boolean
  readonly count: number
  readonly previewing: boolean
  readonly blockedReason: string | null
  readonly onActivate: () => void
  readonly onPreview: () => void
  readonly onPreviewEnd: () => void
}) {
  const timerRef = React.useRef<number | null>(null)
  const previewingRef = React.useRef(false)
  const suppressClickRef = React.useRef(false)
  const onPreviewRef = React.useRef(onPreview)
  const onPreviewEndRef = React.useRef(onPreviewEnd)

  React.useEffect(() => { onPreviewRef.current = onPreview }, [onPreview])
  React.useEffect(() => { onPreviewEndRef.current = onPreviewEnd }, [onPreviewEnd])

  const stopTimer = (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const endPreview = (): void => {
    stopTimer()
    if (!previewingRef.current) return
    previewingRef.current = false
    onPreviewEndRef.current()
  }

  const schedulePreview = (delay: number, suppressClick: boolean): void => {
    if (blockedReason !== null) return
    stopTimer()
    timerRef.current = window.setTimeout(() => {
      previewingRef.current = true
      suppressClickRef.current = suppressClick
      onPreviewRef.current()
    }, delay)
  }

  React.useEffect(() => () => {
    stopTimer()
    if (previewingRef.current) onPreviewEndRef.current()
  }, [])

  const statusLabel = blockedReason !== null
    ? `사용할 수 없음, ${blockedReason}`
    : !owned
      ? `${item.cost}P로 받기`
      : item.compatibleSlots.length > 0
        ? "붙이기"
        : active ? "적용 중" : "적용하기"
  const displayName = materialDisplayName(item)

  return (
    <button
      type="button"
      className="journal-decoration-toolbar__material-tile"
      data-active={active ? "true" : undefined}
      data-blocked={blockedReason === null ? undefined : "true"}
      data-previewing={previewing ? "true" : undefined}
      aria-label={`${displayName} ${statusLabel}`}
      aria-pressed={item.compatibleSlots.length === 0 ? active : undefined}
      aria-disabled={blockedReason === null ? undefined : "true"}
      title={item.description}
      onContextMenu={(event) => event.preventDefault()}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") schedulePreview(600, false)
      }}
      onPointerLeave={endPreview}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse") schedulePreview(400, true)
      }}
      onPointerUp={endPreview}
      onPointerCancel={endPreview}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        onActivate()
      }}
    >
      <span className="journal-decoration-toolbar__material-preview" data-category={item.category} aria-hidden="true">
        {item.category === "INK"
          ? <span className="journal-decoration-toolbar__ink-swatch" />
          : <img src={`${import.meta.env.BASE_URL}${item.assetPath}`} alt="" draggable="false" loading="lazy" />}
      </span>
      <span className="journal-decoration-toolbar__material-name">{displayName}</span>
      {!owned && (
        <span className="journal-decoration-toolbar__material-cost" aria-hidden="true">
          <LockKeyhole size={12} /> {item.cost}P
        </span>
      )}
      {owned && active && item.compatibleSlots.length === 0 && (
        <span className="journal-decoration-toolbar__material-check" aria-hidden="true"><Check size={12} /></span>
      )}
      {count > 0 && <b className="journal-decoration-toolbar__material-count" aria-hidden="true">{count}</b>}
    </button>
  )
}

type JournalDecorationToolbarProps = {
  readonly hasEntries: boolean
  readonly items: readonly DecorationCatalogItem[]
  readonly open: boolean
  readonly drawerOpen: boolean
  readonly activeItemIds: ReadonlySet<string>
  readonly availablePoints: number
  readonly purchasableItemIds: ReadonlySet<string>
  readonly pageItemCounts: ReadonlyMap<string, number>
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly selectedIndex: number | null
  readonly placementCount: number
  readonly clipboardAvailable: boolean
  readonly notice: string
  readonly previewItemId: string | null
  readonly onApply: (item: DecorationCatalogItem) => void
  readonly onPurchase: (item: DecorationCatalogItem) => void
  readonly onClose: () => void
  readonly onDrawerClose: () => void
  readonly onDrawerOpen: () => void
  readonly onOpen: () => void
  readonly onPreview: (item: DecorationCatalogItem) => void
  readonly onPreviewEnd: () => void
  readonly onUnavailable: (message: string) => void
  readonly onClearAvatar: () => void
  readonly onUndo: () => void
  readonly onRedo: () => void
  readonly onMoveBackward: () => void
  readonly onMoveForward: () => void
  readonly onCopySelected: () => void
  readonly onPaste: () => void
  readonly onOpenTextSticker?: () => void
}

export function JournalDecorationToolbar(props: JournalDecorationToolbarProps) {
  const closeButtonRef = React.useRef<HTMLButtonElement>(null)
  const drawerRef = React.useRef<HTMLElement>(null)
  const [toolFilter, setToolFilter] = React.useState<DrawerFilter>("ALL")
  const [cuteCollectionOpen, setCuteCollectionOpen] = React.useState(false)
  const [pendingPurchaseId, setPendingPurchaseId] = React.useState<string | null>(null)
  const wasOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (props.open && !wasOpenRef.current) closeButtonRef.current?.focus()
    wasOpenRef.current = props.open
  }, [props.open])

  React.useEffect(() => {
    if (!props.drawerOpen) {
      setPendingPurchaseId(null)
      setCuteCollectionOpen(false)
    }
  }, [props.drawerOpen])

  React.useEffect(() => {
    if (!props.open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (props.drawerOpen) props.onDrawerClose()
      else props.onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [props.drawerOpen, props.onClose, props.onDrawerClose, props.open])

  React.useEffect(() => {
    const drawer = drawerRef.current
    if (drawer === null) return
    if (props.drawerOpen) drawer.removeAttribute("inert")
    else drawer.setAttribute("inert", "")
  }, [props.drawerOpen, props.open])

  if (!props.open) {
    return (
      <div className="journal-decoration-launch" data-decoration-interaction="true">
        <button type="button" onClick={props.onOpen} aria-label="일지 꾸미기 열기">
          <Palette aria-hidden="true" size={16} />
          꾸미기
        </button>
      </div>
    )
  }

  const chooseTool = (filter: DrawerFilter) => {
    setToolFilter(filter)
    setPendingPurchaseId(null)
    setCuteCollectionOpen(false)
    props.onDrawerOpen()
  }

  const placementBlockedReason = !props.hasEntries
    ? "기록을 먼저 남기면 붙일 수 있어요."
    : props.placementCount >= MAX_DECORATION_ITEMS_PER_PAGE
      ? `한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지 붙일 수 있어요.`
      : null

  const blockedReasonFor = (item: DecorationCatalogItem): string | null => {
    if (item.compatibleSlots.length > 0) return placementBlockedReason
    if (!props.hasEntries && item.category !== "THEME") return "기록을 먼저 남기면 사용할 수 있어요."
    return null
  }

  const activateItem = (item: DecorationCatalogItem): void => {
    const blockedReason = blockedReasonFor(item)
    if (blockedReason !== null) {
      props.onUnavailable(blockedReason)
      return
    }
    if (props.purchasableItemIds.has(item.id)) {
      setPendingPurchaseId(item.id)
      return
    }
    if (!props.hasEntries) {
      props.onPreview(item)
      return
    }
    props.onApply(item)
  }

  const renderPurchaseRow = (item: DecorationCatalogItem): React.ReactNode => {
    if (pendingPurchaseId !== item.id) return null
    const missingPoints = Math.max(0, item.cost - props.availablePoints)
    return (
      <div className="journal-decoration-toolbar__purchase-row" role="group" aria-label={`${item.name} 받기 확인`}>
        <span>
          <strong>{item.name}</strong>
          <small>{missingPoints > 0 ? `${missingPoints}P 더 필요해요.` : `${item.cost}P를 사용해 받을까요?`}</small>
        </span>
        <button
          type="button"
          disabled={missingPoints > 0}
          onClick={() => {
            props.onPurchase(item)
            setPendingPurchaseId(null)
          }}
        >
          {item.cost}P로 받기
        </button>
        <button type="button" onClick={() => setPendingPurchaseId(null)}>취소</button>
      </div>
    )
  }

  const renderMaterialCategory = (category: MaterialCategory): React.ReactNode => {
    const partOfMaterialDrawer = category === "STICKER" || category === "STAMP" || category === "TAPE"
    if (toolFilter !== "ALL" && toolFilter !== category && !(toolFilter === "MATERIALS" && partOfMaterialDrawer)) return null
    const categoryItems = props.items.filter((item) => item.category === category && item.collection !== "OPEN_CUTE_V1")
    if (categoryItems.length === 0) return null
    return (
      <React.Fragment key={category}>
        {(toolFilter === "ALL" || toolFilter === "MATERIALS") && <h3 className="journal-decoration-toolbar__section-title">{MATERIAL_CATEGORY_LABELS[category]}</h3>}
        {category === "AVATAR" && props.hasEntries && (
          <button
            type="button"
            className="journal-decoration-toolbar__material-tile journal-decoration-toolbar__material-tile--none"
            data-active={props.activeItemIds.has("avatar:none") ? "true" : undefined}
            aria-label="아바타 없음 적용하기"
            aria-pressed={props.activeItemIds.has("avatar:none")}
            onClick={props.onClearAvatar}
          >
            <span className="journal-decoration-toolbar__material-preview" aria-hidden="true"><UserRoundX size={30} /></span>
            <span className="journal-decoration-toolbar__material-name">아바타 없음</span>
            {props.activeItemIds.has("avatar:none") && (
              <span className="journal-decoration-toolbar__material-check" aria-hidden="true"><Check size={12} /></span>
            )}
          </button>
        )}
        {categoryItems.map((item) => {
          const owned = !props.purchasableItemIds.has(item.id)
          const blockedReason = blockedReasonFor(item)
          return (
            <React.Fragment key={item.id}>
              <MaterialTile
                item={item}
                active={props.activeItemIds.has(item.id)}
                owned={owned}
                count={props.pageItemCounts.get(item.id) ?? 0}
                previewing={props.previewItemId === item.id}
                blockedReason={blockedReason}
                onActivate={() => activateItem(item)}
                onPreview={() => props.onPreview(item)}
                onPreviewEnd={props.onPreviewEnd}
              />
              {renderPurchaseRow(item)}
            </React.Fragment>
          )
        })}
      </React.Fragment>
    )
  }

  const emojiItems = props.items.filter((item) => item.category === "EMOJI_STICKER")
  const cuteItems = props.items.filter((item) => item.collection === "OPEN_CUTE_V1")
  const showEmoji = toolFilter === "ALL" || toolFilter === "EMOJI_STICKER"
  const showCuteCollectionEntry = cuteItems.length > 0
    && (toolFilter === "ALL" || toolFilter === "MATERIALS" || toolFilter === "STICKER")

  const renderCuteCollection = (): React.ReactNode => (
    <section className="journal-decoration-toolbar__cute-collection" aria-labelledby="cute-sticker-collection-title">
      <header>
        <button
          type="button"
          className="journal-decoration-toolbar__collection-back"
          onClick={() => {
            setCuteCollectionOpen(false)
            setPendingPurchaseId(null)
          }}
        >
          <ArrowLeft aria-hidden="true" size={16} />
          TrainOracle 재료
        </button>
        <div>
          <h3 id="cute-sticker-collection-title">귀여운 스티커</h3>
          <p>{`${cuteItems.length}종 · 한 개 ${CUTE_STICKER_PRICE}P`}</p>
        </div>
      </header>

      <details className="journal-decoration-toolbar__source-note">
        <summary>그림 출처 보기</summary>
        <p>Microsoft Fluent Emoji Flat과 Open Peeps의 오픈 라이선스 그림을 사용했어요.</p>
        <a href={`${import.meta.env.BASE_URL}legal/open-source.html`} target="_blank" rel="noreferrer">자산 출처와 라이선스</a>
      </details>

      <div className="journal-decoration-toolbar__items">
        {CUTE_STICKER_GROUPS.flatMap((group) => {
          const groupItems = cuteItems.filter((item) => item.cuteGroup === group.id)
          if (groupItems.length === 0) return []
          return [
            <h4 className="journal-decoration-toolbar__section-title" key={`${group.id}-title`}>{group.label}</h4>,
            ...groupItems.map((item) => {
              const owned = !props.purchasableItemIds.has(item.id)
              const blockedReason = blockedReasonFor(item)
              return (
                <React.Fragment key={item.id}>
                  <MaterialTile
                    item={item}
                    active={props.activeItemIds.has(item.id)}
                    owned={owned}
                    count={props.pageItemCounts.get(item.id) ?? 0}
                    previewing={props.previewItemId === item.id}
                    blockedReason={blockedReason}
                    onActivate={() => activateItem(item)}
                    onPreview={() => props.onPreview(item)}
                    onPreviewEnd={props.onPreviewEnd}
                  />
                  {renderPurchaseRow(item)}
                </React.Fragment>
              )
            }),
          ]
        })}
      </div>
    </section>
  )

  return (
    <>
      <header className="journal-decoration-editor__topbar" data-decoration-interaction="true">
        <button ref={closeButtonRef} type="button" onClick={props.onClose} aria-label="꾸미기 편집기 닫기" title="닫기"><X aria-hidden="true" size={18} /></button>
        <span><strong>이 일지 꾸미기</strong><small>장식을 눌러 옮기고 모서리로 크기를 바꿔요.</small></span>
        <div className="journal-decoration-editor__topbar-actions">
          {props.canUndo && (
            <button type="button" onClick={props.onUndo} aria-label="꾸미기 되돌리기" title="되돌리기"><Undo2 aria-hidden="true" size={18} /></button>
          )}
          {props.canRedo && (
            <button type="button" onClick={props.onRedo} aria-label="꾸미기 다시 실행" title="다시 실행"><Redo2 aria-hidden="true" size={18} /></button>
          )}
          <button type="button" onClick={props.onClose} aria-label="꾸미기 완료" title="완료"><Check aria-hidden="true" size={18} /></button>
        </div>
      </header>

      {props.notice !== "" && <p className="journal-decoration-editor__notice" role="status" aria-live="polite">{props.notice}</p>}

      <nav className="journal-decoration-editor__dock" aria-label="일지 꾸미기 도구" data-decoration-interaction="true">
        <button type="button" aria-label="모든 꾸미기 도구" aria-pressed={props.drawerOpen && toolFilter === "ALL"} onClick={() => chooseTool("ALL")}><LayoutGrid aria-hidden="true" size={19} /><span>전체</span></button>
        <button type="button" aria-label="꾸미기 재료 도구" aria-pressed={props.drawerOpen && toolFilter === "MATERIALS"} onClick={() => chooseTool("MATERIALS")}><Sticker aria-hidden="true" size={19} /><span>재료</span></button>
        <button type="button" aria-label="이모지 스티커 도구" aria-pressed={props.drawerOpen && toolFilter === "EMOJI_STICKER"} onClick={() => chooseTool("EMOJI_STICKER")}><Smile aria-hidden="true" size={19} /><span>이모지</span></button>
        {props.onOpenTextSticker !== undefined && (
          <button type="button" aria-label="글 스티커 도구" onClick={props.onOpenTextSticker}><Type aria-hidden="true" size={19} /><span>글</span></button>
        )}
        <button type="button" aria-label="페이지 테마 도구" aria-pressed={props.drawerOpen && toolFilter === "THEME"} onClick={() => chooseTool("THEME")}><BookOpen aria-hidden="true" size={19} /><span>테마</span></button>
        <button type="button" aria-label="글자색 도구" aria-pressed={props.drawerOpen && toolFilter === "INK"} onClick={() => chooseTool("INK")}><PenLine aria-hidden="true" size={19} /><span>글자</span></button>
      </nav>

      {!props.drawerOpen && (props.selectedIndex !== null || props.clipboardAvailable) && (
        <div className="journal-decoration-editor__selection-actions" role="toolbar" aria-label="선택한 장식 편집">
          {props.selectedIndex !== null && (
            <>
              <button type="button" disabled={props.selectedIndex <= 0} onClick={props.onMoveBackward} aria-label="선택한 장식을 한 칸 뒤로 보내기"><Layers2 aria-hidden="true" size={16} /><span>뒤로</span></button>
              <button type="button" disabled={props.selectedIndex >= props.placementCount - 1} onClick={props.onMoveForward} aria-label="선택한 장식을 한 칸 앞으로 가져오기"><Layers2 aria-hidden="true" size={16} /><span>앞으로</span></button>
              <button type="button" onClick={props.onCopySelected} aria-label="선택한 장식 복사"><Copy aria-hidden="true" size={16} /><span>복사</span></button>
            </>
          )}
          {props.clipboardAvailable && (
            <button type="button" onClick={props.onPaste} aria-label="복사한 장식 붙여넣기"><ClipboardPaste aria-hidden="true" size={16} /><span>붙이기</span></button>
          )}
        </div>
      )}

      <section
        ref={drawerRef}
        className="journal-decoration-toolbar"
        data-open={props.drawerOpen ? "true" : "false"}
        aria-label="꾸미기 재료 서랍"
        aria-hidden={props.drawerOpen ? undefined : "true"}
        data-decoration-interaction="true"
      >
        <div className="journal-decoration-toolbar__grabber" aria-hidden="true" />
        <header>
          <div>
            <strong>재료 서랍</strong>
            <span>{props.hasEntries ? "재료를 눌러 바로 붙여 보세요." : "기록을 남기기 전에는 테마만 미리 볼 수 있어요."}</span>
            <small className="journal-decoration-toolbar__points">베타 포인트 · 사용 가능 {props.availablePoints}P</small>
          </div>
          <button type="button" className="journal-decoration-toolbar__icon" onClick={props.onDrawerClose} aria-label="재료 서랍 숨기기"><ChevronDown aria-hidden="true" size={19} /></button>
        </header>

        {cuteCollectionOpen
          ? renderCuteCollection()
          : (
              <>
                <div className="journal-decoration-toolbar__filters" role="group" aria-label="꾸미기 재료 종류">
                  {DRAWER_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      aria-pressed={toolFilter === filter.id}
                      onClick={() => {
                        setToolFilter(filter.id)
                        setPendingPurchaseId(null)
                      }}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {toolFilter !== "EMOJI_STICKER" && (
                  <div className="journal-decoration-toolbar__items">
                    {MATERIAL_CATEGORY_ORDER.flatMap((category) => [
                      renderMaterialCategory(category),
                      ...(category === "STICKER" && showCuteCollectionEntry
                        ? [
                            <button
                              type="button"
                              className="journal-decoration-toolbar__collection-entry"
                              key="open-cute-collection"
                              onClick={() => {
                                setCuteCollectionOpen(true)
                                setPendingPurchaseId(null)
                              }}
                              aria-label={`귀여운 스티커 ${cuteItems.length}종 보기, 한 개 ${CUTE_STICKER_PRICE}포인트`}
                            >
                              <span className="journal-decoration-toolbar__collection-preview" aria-hidden="true">
                                {cuteItems.slice(0, 4).map((item) => (
                                  <img key={item.id} src={`${import.meta.env.BASE_URL}${item.assetPath}`} alt="" draggable="false" />
                                ))}
                              </span>
                              <span>
                                <strong>귀여운 스티커</strong>
                                <small>{`${cuteItems.length}종 · 모두 ${CUTE_STICKER_PRICE}P`}</small>
                              </span>
                              <span aria-hidden="true">보기</span>
                            </button>,
                          ]
                        : []),
                    ])}
                  </div>
                )}

                {showEmoji && (
                  <EmojiStickerGrid
                    items={emojiItems}
                    pageItemCounts={props.pageItemCounts}
                    blockedReason={placementBlockedReason}
                    onApply={props.onApply}
                    onUnavailable={props.onUnavailable}
                  />
                )}
              </>
            )}
      </section>
    </>
  )
}
