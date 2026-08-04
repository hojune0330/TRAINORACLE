import { Eye, Palette, Trash2, Undo2, X } from "lucide-react"
import React from "react"
import type { DecorationCatalogItem, DecorationSlot } from "../../domain/decorations"

const SLOT_LABELS: Readonly<Record<DecorationSlot, string>> = {
  HEADER_TAPE: "머리말",
  TOP_CORNER: "오른쪽 위",
  BODY_MARGIN: "본문 옆",
  PAGE_FOOTER: "페이지 아래",
}

type JournalDecorationToolbarProps = {
  readonly hasEntries: boolean
  readonly items: readonly DecorationCatalogItem[]
  readonly open: boolean
  readonly activeItemIds: ReadonlySet<string>
  readonly canUndo: boolean
  readonly notice: string
  readonly previewItemId: string | null
  readonly onApply: (item: DecorationCatalogItem, slot?: DecorationSlot) => void
  readonly onClose: () => void
  readonly onOpen: () => void
  readonly onPreview: (item: DecorationCatalogItem, slot?: DecorationSlot) => void
  readonly onRemove: (item: DecorationCatalogItem) => void
  readonly onUndo: () => void
}

export function JournalDecorationToolbar(props: JournalDecorationToolbarProps) {
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

  return (
    <section className="journal-decoration-toolbar" aria-label="이 일지 꾸미기" data-decoration-interaction="true">
      <header>
        <div>
          <strong>이 일지 꾸미기</strong>
          <span>{props.hasEntries ? "미리 본 뒤 저장해요." : "기록이 없는 날에는 테마만 미리 볼 수 있어요."}</span>
        </div>
        <button type="button" className="journal-decoration-toolbar__icon" onClick={props.onClose} aria-label="일지 꾸미기 닫기">
          <X aria-hidden="true" size={17} />
        </button>
      </header>
      <div className="journal-decoration-toolbar__items">
        {props.items.map((item) => {
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
                {props.hasEntries && active && slot !== undefined && (
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
      <footer>
        {props.canUndo && (
          <button type="button" onClick={props.onUndo} aria-label="꾸미기 되돌리기">
            <Undo2 aria-hidden="true" size={15} /> 되돌리기
          </button>
        )}
        <span role="status" aria-live="polite">{props.notice}</span>
      </footer>
    </section>
  )
}
