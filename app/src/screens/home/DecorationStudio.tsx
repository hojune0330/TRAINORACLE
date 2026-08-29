import { Sparkles } from "lucide-react"
import React from "react"
import { JournalConfirmationDialog } from "../../components/JournalConfirmationDialog"
import {
  DECORATION_CATALOG,
  EMOJI_STICKER_GROUPS,
  decorationItemOwned,
  isPlacementDecorationId,
  purchaseDecoration,
  loadDecorationState,
  readDecorationStateSerialized,
  saveDecorationStateIfCurrent,
  toggleFavoriteDecoration,
} from "../../domain/decorations"
import type { DecorationCatalogItem, DecorationState } from "../../domain/decorations"
import { withJosa } from "../../domain/korean-josa"
import { DecorationStudioItem } from "./DecorationStudioItem"
import { DecorationStudioPreview } from "./DecorationStudioPreview"
import { resolveJournalDecorationSlot } from "../../domain/journal-decoration-state"
import {
  DECORATION_PRESETS,
  SITUATION_TABS,
  TYPE_FILTERS,
  decorationItemActive,
  missingPresetItems,
  moveDecorationDate,
  previewDecorationItem,
  previewDecorationPreset,
  removeDecorationItem,
  useOwnedDecorationItem,
  visibleStudioItems,
} from "./decoration-studio-model"
import type { DecorationPreset, SituationTabId, TypeFilterId } from "./decoration-studio-model"

type PreviewSelection =
  | { readonly kind: "ITEM"; readonly item: DecorationCatalogItem }
  | { readonly kind: "PRESET"; readonly preset: DecorationPreset }
  | null

type Replacement = {
  readonly item: DecorationCatalogItem
  readonly previous: DecorationCatalogItem
}

export function DecorationStudio({
  date,
  today,
  earnedPoints,
  state,
  onStateChange,
  onNotice,
  onDateChange,
  expectedSerialized,
  onStorageVersionChange,
  hasEntriesForDate,
}: {
  readonly date: string
  readonly today: string
  readonly earnedPoints: number
  readonly state: DecorationState
  readonly onStateChange: (state: DecorationState) => void
  readonly onNotice: (notice: string) => void
  readonly onDateChange: (date: string) => void
  readonly expectedSerialized: string | null
  readonly onStorageVersionChange: (serialized: string | null) => void
  readonly hasEntriesForDate: (date: string) => boolean
}) {
  const [situation, setSituation] = React.useState<SituationTabId>("RECOMMENDED")
  const [type, setType] = React.useState<TypeFilterId>("ALL")
  const [selection, setSelection] = React.useState<PreviewSelection>(null)
  const [replacement, setReplacement] = React.useState<Replacement | null>(null)
  const previewDate = date
  const base = state
  const previewState = selection?.kind === "ITEM"
    ? previewDecorationItem(base, selection.item, previewDate)
    : selection?.kind === "PRESET"
      ? previewDecorationPreset(base, selection.preset, previewDate)
      : base
  const previewName = selection?.kind === "ITEM" ? selection.item.name : selection?.preset.name ?? null
  const items = visibleStudioItems(state, situation, type)
  const rowItems = items.filter((item) => item.category !== "EMOJI_STICKER")
  const emojiItems = items.filter((item) => item.category === "EMOJI_STICKER")

  const persist = (next: DecorationState | null, success: string) => {
    if (next === null) {
      onNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
      return false
    }
    const result = saveDecorationStateIfCurrent(next, expectedSerialized)
    if (!result.ok) {
      if (result.code === "STALE_STATE") {
        const latest = loadDecorationState()
        onStateChange(latest)
        onStorageVersionChange(readDecorationStateSerialized())
        onNotice("다른 화면에서 꾸미기가 바뀌어 최신 상태를 다시 불러왔어요.")
        return false
      }
      onNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
      return false
    }
    onStateChange(next)
    onStorageVersionChange(JSON.stringify(next))
    onNotice(success)
    return true
  }

  const buy = (item: DecorationCatalogItem) => {
    const result = purchaseDecoration(earnedPoints, state, item.id, expectedSerialized)
    if (result.kind === "PURCHASED") {
      onStateChange(result.state)
      onStorageVersionChange(JSON.stringify(result.state))
      onNotice(`받았어요. ${result.remainingPoints}P가 남았어요.`)
    } else if (result.kind === "SAVE_FAILED") {
      if (result.code === "STALE_STATE") {
        const latest = loadDecorationState()
        onStateChange(latest)
        onStorageVersionChange(readDecorationStateSerialized())
        onNotice("다른 화면에서 꾸미기가 바뀌어 최신 상태를 다시 불러왔어요.")
      } else onNotice("저장하지 못했어요. 다시 시도해 주세요.")
    } else if (result.kind === "INSUFFICIENT_POINTS") {
      onNotice(`포인트가 ${item.cost - result.remainingPoints}P 더 필요해요. 오늘 방문 확인은 1P, 훈련·회복 기록을 남긴 날은 4P가 쌓여요.`)
    } else {
      onNotice(result.kind === "ALREADY_OWNED" ? "이미 가지고 있어요." : "꾸미기 항목을 찾지 못했어요.")
    }
  }

  const favorite = (item: DecorationCatalogItem) => {
    const next = toggleFavoriteDecoration(state, item.id)
    const added = next.library.favoriteItemIds.includes(item.id)
    persist(next, added ? `${withJosa(item.name, "을/를")} 즐겨찾기에 담았어요.` : `${withJosa(item.name, "을/를")} 즐겨찾기에서 뺐어요.`)
  }

  const changeDate = (nextDate: string) => {
    setSelection(null)
    onDateChange(nextDate)
  }

  const use = (item: DecorationCatalogItem) => {
    if (isPlacementDecorationId(item.id) && !hasEntriesForDate(date)) {
      onNotice("기록이 있는 날짜에만 날짜 장식을 저장할 수 있어요. 지금은 미리보기만 가능해요.")
      return
    }
    if (isPlacementDecorationId(item.id)) {
      /* 이모지는 빈 칸 자동 배정과 같은 규칙으로 교체 대상을 찾는다. */
      const slot = resolveJournalDecorationSlot(state, item, date)
      const current = slot === undefined ? undefined : state.pagePlacements.find((placement) => placement.date === date && placement.slot === slot)
      const previous = current === undefined ? undefined : DECORATION_CATALOG.find((candidate) => candidate.id === current.itemId)
      if (previous !== undefined && previous.id !== item.id) {
        setReplacement({ item, previous })
        return
      }
    }
    persist(useOwnedDecorationItem(state, item, date), `${withJosa(item.name, "을/를")} 사용했어요.`)
  }

  return (
    <div className="decoration-studio" data-decoration-interaction="true">
      <DecorationStudioPreview
        date={previewDate}
        today={today}
        state={previewState}
        previewName={previewName}
        hasEntries={hasEntriesForDate(date)}
        onPreviousDate={() => changeDate(moveDecorationDate(date, -1))}
        onNextDate={() => changeDate(moveDecorationDate(date, 1))}
        onToday={() => changeDate(today)}
      />

      <div className="decoration-studio__situation-tabs" role="tablist" aria-label="꾸미기 상황">
        {SITUATION_TABS.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={situation === tab.id} onClick={() => setSituation(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {situation === "RECOMMENDED" && (
        <section className="decoration-studio__presets" aria-labelledby="decoration-presets-title">
          <h4 id="decoration-presets-title"><Sparkles aria-hidden="true" size={16} /> 조합 미리보기</h4>
          <div>
            {DECORATION_PRESETS.map((preset) => {
              const missing = missingPresetItems(state, preset)
              return (
                <button key={preset.id} type="button" data-testid={`decoration-preset-${preset.id}`} onClick={() => setSelection({ kind: "PRESET", preset })} aria-label={`${preset.name} 미리보기`}>
                  <strong>{preset.name}</strong>
                  <small>{preset.description}</small>
                  <small>미리보기</small>
                  {missing > 0 && <span>없는 항목 {missing}개</span>}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <div className="decoration-studio__type-filter" aria-label="꾸미기 종류">
        {TYPE_FILTERS.map((filter) => (
          <button key={filter.id} type="button" aria-pressed={type === filter.id} onClick={() => setType(filter.id)}>{filter.label}</button>
        ))}
      </div>

      {items.length === 0 && <p className="decoration-studio__empty">아직 여기에 모인 꾸미기가 없어요.</p>}
      {rowItems.length > 0 && (
        <div className="decoration-shop__items">
          {rowItems.map((item) => {
            const owned = decorationItemOwned(state, item.id)
            return (
              <DecorationStudioItem
                key={item.id}
                item={item}
                owned={owned}
                active={decorationItemActive(state, item, date)}
                favorite={state.library.favoriteItemIds.includes(item.id)}
                onPreview={() => setSelection({ kind: "ITEM", item })}
                onBuy={() => buy(item)}
                onFavorite={() => favorite(item)}
                onUse={() => use(item)}
                onRemove={() => persist(removeDecorationItem(state, item, date), `${withJosa(item.name, "을/를")} 제거했어요.`)}
              />
            )
          })}
        </div>
      )}
      {emojiItems.length > 0 && (
        /*
         * 이모지 스티커는 그룹별 44px 그리드(계약 §6) — 행 목록은 48종에 부적합.
         * 탭 = 붙이기(빈 칸 자동 배정 · 교체 확인 포함), 붙은 것 탭 = 떼기.
         * 상황 탭(날씨/회복/경기/계절)에서도 해당 그룹 이모지가 함께 보인다.
         */
        <div className="decoration-studio__emoji-groups">
          {EMOJI_STICKER_GROUPS.map((group) => {
            const groupItems = emojiItems.filter((item) => item.emojiGroup === group.id)
            if (groupItems.length === 0) return null
            return (
              <section key={group.id} aria-label={`${group.label} 이모지`}>
                <small>{group.label}</small>
                <div className="decoration-studio__emoji-grid">
                  {groupItems.map((item) => {
                    const active = decorationItemActive(state, item, date)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${item.name} 이모지 ${active ? "떼기" : "붙이기"}`}
                        data-testid={`decoration-emoji-${item.id}`}
                        onClick={() => (
                          active
                            ? persist(removeDecorationItem(state, item, date), `${withJosa(item.name, "을/를")} 제거했어요.`)
                            : use(item)
                        )}
                      >
                        <span aria-hidden="true">{item.emoji}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
      {replacement !== null && (
        <JournalConfirmationDialog
          title="꾸미기를 바꿀까요?"
          description={`${replacement.previous.name} 대신 ${withJosa(replacement.item.name, "을/를")} 이 칸에 놓아요.`}
          confirmLabel="바꾸기"
          onCancel={() => setReplacement(null)}
          onConfirm={() => {
            const ok = persist(useOwnedDecorationItem(state, replacement.item, date), `${withJosa(replacement.item.name, "을/를")} 사용했어요.`)
            if (ok) setReplacement(null)
            return ok
          }}
        />
      )}
    </div>
  )
}
