import { BookOpen, Check, ChevronDown, Eye, Palette, PenLine, Smile, Trash2, Undo2, X } from "lucide-react"
import React from "react"
import type { DecorationCatalogItem, DecorationSlot } from "../../domain/decorations"

const SLOT_LABELS: Readonly<Record<DecorationSlot, string>> = {
  HEADER_TAPE: "머리말",
  TOP_CORNER: "오른쪽 위",
  BODY_MARGIN: "본문 옆",
  PAGE_FOOTER: "페이지 아래",
  BODY_STICKER_1: "본문 스티커 ①",
  BODY_STICKER_2: "본문 스티커 ②",
  BODY_STICKER_3: "본문 스티커 ③",
}

/*
 * 이모지 스티커는 48종이라 행 목록 대신 44px 터치 타깃 그리드로 보여 준다.
 * 탭 = 붙이기(빈 칸 자동 배정), 붙은 것을 다시 탭 = 떼기.
 * 유니코드 텍스트 렌더 전용 — 이미지 자산 없음.
 */
function EmojiStickerGrid({
  items,
  activeItemIds,
  onApply,
  onRemove,
}: {
  readonly items: readonly DecorationCatalogItem[]
  readonly activeItemIds: ReadonlySet<string>
  readonly onApply: (item: DecorationCatalogItem) => void
  readonly onRemove: (item: DecorationCatalogItem) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="journal-decoration-toolbar__emoji-section">
      <small>이모지 스티커 · 한 페이지에 3개까지</small>
      <div className="journal-decoration-toolbar__emoji-grid" role="group" aria-label="이모지 스티커">
        {items.map((item) => {
          const active = activeItemIds.has(item.id)
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              aria-label={`${item.name} 이모지 ${active ? "떼기" : "붙이기"}`}
              onClick={() => (active ? onRemove(item) : onApply(item))}
            >
              <span aria-hidden="true">{item.emoji}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

type JournalDecorationToolbarProps = {
  readonly hasEntries: boolean
  readonly items: readonly DecorationCatalogItem[]
  readonly open: boolean
  readonly drawerOpen: boolean
  readonly activeItemIds: ReadonlySet<string>
  readonly canUndo: boolean
  readonly notice: string
  readonly previewItemId: string | null
  readonly onApply: (item: DecorationCatalogItem, slot?: DecorationSlot) => void
  readonly onClose: () => void
  readonly onDrawerClose: () => void
  readonly onDrawerOpen: () => void
  readonly onOpen: () => void
  readonly onPreview: (item: DecorationCatalogItem, slot?: DecorationSlot) => void
  readonly onRemove: (item: DecorationCatalogItem) => void
  readonly onUndo: () => void
}

export function JournalDecorationToolbar(props: JournalDecorationToolbarProps) {
  const closeButtonRef = React.useRef<HTMLButtonElement>(null)
  const drawerRef = React.useRef<HTMLElement>(null)
  const [toolFilter, setToolFilter] = React.useState<"ALL" | "EMOJI_STICKER" | "THEME" | "INK">("ALL")

  React.useEffect(() => {
    if (!props.open) return
    closeButtonRef.current?.focus()
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
  }, [props.drawerOpen])

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

  const chooseTool = (filter: typeof toolFilter) => {
    setToolFilter(filter)
    props.onDrawerOpen()
  }
  const visibleItems = toolFilter === "ALL"
    ? props.items
    : props.items.filter((item) => item.category === toolFilter)

  return (
    <>
      <header className="journal-decoration-editor__topbar" data-decoration-interaction="true">
        <button ref={closeButtonRef} type="button" onClick={props.onClose} aria-label="꾸미기 편집기 닫기" title="닫기"><X aria-hidden="true" size={18} /></button>
        <span><strong>이 일지 꾸미기</strong><small>장식을 눌러 옮기고 모서리로 크기를 바꿔요.</small></span>
        {props.canUndo && (
          <button type="button" onClick={props.onUndo} aria-label="꾸미기 되돌리기" title="되돌리기"><Undo2 aria-hidden="true" size={18} /></button>
        )}
        <button type="button" onClick={props.onClose} aria-label="꾸미기 완료" title="완료"><Check aria-hidden="true" size={18} /></button>
      </header>

      {props.notice !== "" && <p className="journal-decoration-editor__notice" role="status" aria-live="polite">{props.notice}</p>}

      <nav className="journal-decoration-editor__dock" aria-label="일지 꾸미기 도구" data-decoration-interaction="true">
        <button type="button" aria-label="모든 꾸미기 도구" aria-pressed={props.drawerOpen && toolFilter === "ALL"} onClick={() => chooseTool("ALL")}><Palette aria-hidden="true" size={19} /><span>모두</span></button>
        <button type="button" aria-label="이모지 스티커 도구" aria-pressed={props.drawerOpen && toolFilter === "EMOJI_STICKER"} onClick={() => chooseTool("EMOJI_STICKER")}><Smile aria-hidden="true" size={19} /><span>스티커</span></button>
        <button type="button" aria-label="페이지 테마 도구" aria-pressed={props.drawerOpen && toolFilter === "THEME"} onClick={() => chooseTool("THEME")}><BookOpen aria-hidden="true" size={19} /><span>테마</span></button>
        <button type="button" aria-label="글자색 도구" aria-pressed={props.drawerOpen && toolFilter === "INK"} onClick={() => chooseTool("INK")}><PenLine aria-hidden="true" size={19} /><span>글자</span></button>
      </nav>

      <section ref={drawerRef} className="journal-decoration-toolbar" data-open={props.drawerOpen ? "true" : "false"} aria-label="꾸미기 도구 선택" aria-hidden={props.drawerOpen ? undefined : "true"} data-decoration-interaction="true">
        <header>
          <div>
            <strong>꾸미기 도구</strong>
            <span>{props.hasEntries ? "고른 뒤 일지에서 직접 옮길 수 있어요." : "기록이 없는 날에는 테마만 미리 볼 수 있어요."}</span>
          </div>
          <button type="button" className="journal-decoration-toolbar__icon" onClick={props.onDrawerClose} aria-label="꾸미기 도구 숨기기"><ChevronDown aria-hidden="true" size={19} /></button>
        </header>
        <div className="journal-decoration-toolbar__items">
          {visibleItems.filter((item) => item.category !== "EMOJI_STICKER").map((item) => {
            const slot = item.compatibleSlots[0]
            const position = slot === undefined ? "" : `${SLOT_LABELS[slot]}에 `
            const active = props.activeItemIds.has(item.id)
            return (
              <article key={item.id}>
                <img src={`${import.meta.env.BASE_URL}${item.assetPath}`} alt="" />
                <div><small>{item.typeLabel}</small><strong>{item.name}</strong></div>
                <div className="journal-decoration-toolbar__actions">
                  <button type="button" onClick={() => props.onPreview(item, slot)} aria-label={`${item.name} ${position}미리보기`}>
                    <Eye aria-hidden="true" size={14} /> 미리보기
                  </button>
                  {props.hasEntries && active && item.compatibleSlots.length > 0 && (
                    <button type="button" onClick={() => props.onRemove(item)} aria-label={`${item.name} 제거`}>
                      <Trash2 aria-hidden="true" size={14} /> 제거
                    </button>
                  )}
                  {props.hasEntries && !active && props.activeItemIds.has(`owned:${item.id}`) && (
                    <button type="button" onClick={() => props.onApply(item, slot)} aria-label={`${item.name} ${position}사용`}>
                      사용
                    </button>
                  )}
                </div>
                {props.previewItemId === item.id && <span className="journal-decoration-toolbar__previewing">{item.name} 미리보기 중</span>}
              </article>
            )
          })}
        </div>
        <EmojiStickerGrid
          items={visibleItems.filter((item) => item.category === "EMOJI_STICKER")}
          activeItemIds={props.activeItemIds}
          onApply={props.onApply}
          onRemove={props.onRemove}
        />
      </section>
    </>
  )
}
