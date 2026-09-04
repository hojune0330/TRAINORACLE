import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleCheck,
  House,
  Plus,
  TrendingUp,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { LOCAL_SAVE_NOTICE, SYNC_UPSELL_NOTICE } from "../domain/journal-store"
import type { SavedFactReceipt } from "../domain/save-receipt"
import { isWithinTrailingDays, isoToDate } from "../domain/dates"
import { todayISO } from "../domain/journal-store"

export type AppTab = "home" | "journal" | "log" | "plan" | "trends"
export type ToastPhase = "enter" | "exit"

type TabItem = {
  readonly id: AppTab
  readonly label: string
  readonly icon: LucideIcon
}

const TAB_ITEMS: readonly TabItem[] = [
  { id: "home", label: "홈", icon: House },
  { id: "journal", label: "일지", icon: BookOpen },
  { id: "log", label: "경기기록", icon: Plus },
  { id: "plan", label: "계획", icon: CalendarDays },
  { id: "trends", label: "분석", icon: TrendingUp },
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
            <Icon aria-hidden="true" size={13} strokeWidth={1.9} />
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
  rewardMessage,
  onDismiss,
  onOpenTrends,
  onOpenBackup,
}: {
  readonly count: number
  readonly phase: ToastPhase
  readonly receipt?: SavedFactReceipt
  readonly reviewMessage?: string
  readonly rewardMessage?: string
  readonly onDismiss?: () => void
  readonly onOpenTrends?: () => void
  readonly onOpenBackup?: () => void
}) {
  const presentation = receiptPresentation(receipt)
  const needsReview = reviewMessage !== undefined
  const actionable = !needsReview && presentation.actionLabel !== undefined
  // generic receipt의 "백업 안내 보기"는 추이가 아니라 백업/복원 화면으로 이동한다 (§4-2)
  const onAction = receipt.kind === "generic" ? onOpenBackup : onOpenTrends

  return (
    <div
      role={needsReview ? "alert" : "status"}
      aria-atomic="true"
      className={`saved-toast saved-toast--${phase}`}
    >
      <div className="saved-toast__surface">
        <div className="saved-toast__heading">
          <strong>
            {!needsReview && <CircleCheck className="saved-toast__check" aria-hidden="true" size={18} />}
            {needsReview ? LOCAL_SAVE_NOTICE : presentation.title}
            {count > 0 ? ` · 총 ${count}건` : ""}
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
        {rewardMessage !== undefined && <div className="saved-toast__reward">{rewardMessage}</div>}
        {actionable && (
          <button className="saved-toast__action" type="button" onClick={onAction}>
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
  const dateLabel = receipt.savedDate === undefined ? undefined : savedDateLabel(receipt.savedDate)
  const canOpenRecentTrends = receipt.savedDate !== undefined
    && isWithinTrailingDays(receipt.savedDate, todayISO(), 28)
  switch (receipt.kind) {
    case "pain":
      return {
        title: `${dateLabel === undefined ? "" : `${dateLabel} `}통증 기록이 저장됐어요`,
        detail: receipt.moodAlsoSaved
          ? "기분도 함께 저장됐어요."
          : "선택한 날짜의 통증 기록을 저장했어요.",
        ...(canOpenRecentTrends ? { actionLabel: "통증 추이 보기" } : {}),
      }
    case "mood":
      return {
        title: `${dateLabel === undefined ? "" : `${dateLabel} `}기분 기록이 저장됐어요`,
        detail: "선택한 날짜의 기분을 저장했어요.",
        ...(canOpenRecentTrends ? { actionLabel: "기분 추이 보기" } : {}),
      }
    case "distance":
      return {
        title: `${dateLabel === undefined ? "" : `${dateLabel} `}${receipt.distanceKm} km를 저장했어요`,
        detail: "직접 입력한 거리만 기록했어요.",
        ...(canOpenRecentTrends ? { actionLabel: "거리 추이 보기" } : {}),
      }
    case "generic":
      return {
        title: dateLabel === undefined ? LOCAL_SAVE_NOTICE : `${dateLabel} 기록을 남겼어요.`,
        detail: SYNC_UPSELL_NOTICE,
        actionLabel: "백업 안내 보기",
      }
  }
}

function savedDateLabel(date: string): string {
  if (date === todayISO()) return "오늘"
  const localDate = isoToDate(date)
  return `${localDate.getMonth() + 1}월 ${localDate.getDate()}일`
}
