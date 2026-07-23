import {
  ArrowRight,
  CircleHelp,
  House,
  Plus,
  TrendingUp,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { LOCAL_SAVE_NOTICE, SYNC_UPSELL_NOTICE } from "../domain/journal-store"
import type { SavedFactReceipt } from "../domain/save-receipt"

export type AppTab = "home" | "log" | "trends" | "guide"
export type ToastPhase = "enter" | "exit"

type TabItem = {
  readonly id: AppTab
  readonly label: string
  readonly icon: LucideIcon
}

const TAB_ITEMS: readonly TabItem[] = [
  { id: "home", label: "홈", icon: House },
  { id: "log", label: "기록", icon: Plus },
  { id: "trends", label: "추이", icon: TrendingUp },
  { id: "guide", label: "가이드", icon: CircleHelp },
] as const

export function TabBar({ tab, onTab }: {
  readonly tab: AppTab
  readonly onTab: (tab: AppTab) => void
}) {
  return (
    <nav className="app-tab-bar" aria-label="주 탭">
      {TAB_ITEMS.map(({ id, label, icon: Icon }) => {
        const active = tab === id
        return (
          <button
            className="app-tab-bar__button"
            type="button"
            key={id}
            onClick={() => onTab(id)}
            aria-current={active ? "page" : undefined}
            data-active={active ? "true" : "false"}
          >
            <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function SavedToast({
  count,
  phase,
  receipt = { kind: "generic" },
  reviewMessage,
  onDismiss,
  onOpenTrends,
}: {
  readonly count: number
  readonly phase: ToastPhase
  readonly receipt?: SavedFactReceipt
  readonly reviewMessage?: string
  readonly onDismiss?: () => void
  readonly onOpenTrends?: () => void
}) {
  const presentation = receiptPresentation(receipt)
  const needsReview = reviewMessage !== undefined
  const actionable = !needsReview && presentation.actionLabel !== undefined

  return (
    <div
      role={needsReview ? "alert" : "status"}
      aria-atomic="true"
      className={`saved-toast saved-toast--${phase}`}
    >
      <div className="saved-toast__surface">
        <div className="saved-toast__heading">
          <strong>
            {needsReview ? LOCAL_SAVE_NOTICE : presentation.title}
            {count > 0 ? ` · 이 기기에 ${count}건` : ""}
          </strong>
          {needsReview && (
            <button type="button" aria-label="검토 안내 닫기" title="닫기" onClick={onDismiss}>
              <X aria-hidden="true" size={19} />
            </button>
          )}
        </div>
        <div className="saved-toast__detail">
          {needsReview ? `분석 결과를 확인해야 해요. ${reviewMessage}` : presentation.detail}
        </div>
        {actionable && (
          <button className="saved-toast__action" type="button" onClick={onOpenTrends}>
            {presentation.actionLabel}
            <ArrowRight aria-hidden="true" size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

function receiptPresentation(receipt: SavedFactReceipt): {
  readonly title: string
  readonly detail: string
  readonly actionLabel?: string
} {
  switch (receipt.kind) {
    case "pain":
      return {
        title: "통증 기록이 저장됐어요",
        detail: receipt.moodAlsoSaved
          ? "기분도 함께 저장됐어요. 통증 추이에서 다시 볼 수 있어요."
          : "통증 추이에서 다시 볼 수 있어요.",
        actionLabel: "통증 추이 보기",
      }
    case "mood":
      return {
        title: "기분 기록이 저장됐어요",
        detail: "최근 28일 기분 추이에 오늘 기록이 더해졌어요.",
        actionLabel: "기분 추이 보기",
      }
    case "distance":
      return {
        title: `${receipt.distanceKm} km가 이번 주 거리에 반영됐어요`,
        detail: "직접 입력한 거리만 합산했어요.",
        actionLabel: "거리 추이 보기",
      }
    case "generic":
      return {
        title: LOCAL_SAVE_NOTICE,
        detail: SYNC_UPSELL_NOTICE,
      }
  }
}
