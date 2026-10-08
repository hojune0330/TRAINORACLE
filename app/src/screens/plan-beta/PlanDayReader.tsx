import React, { type ReactNode } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { calendarDayLabel } from "../../components/MonthCalendar"
import { useReaderDialog } from "../../hooks/useReaderDialog"
import { sessionSlotLabel } from "./labels"
import "../../styles/plan-day-reader.css"
import { useCalendarMotion } from "../../hooks/useCalendarMotion"
import { useShellReaderVisibility } from "../../components/AppShellFrame"

export function PlanDayReader({ date, sessions, initialSlot, initialSection, canPrevious, canNext, onPrevious, onNext, onClose, returnFocusTo, notice, children }: {
  readonly date: string
  readonly sessions: readonly { readonly slot: "AM" | "PM" }[]
  readonly initialSlot?: "AM" | "PM"
  readonly initialSection?: "records"
  readonly canPrevious: boolean
  readonly canNext: boolean
  readonly onPrevious: () => void
  readonly onNext: () => void
  readonly onClose: () => void
  readonly returnFocusTo?: (date: string) => HTMLElement | null
  readonly children: ReactNode | ((leave: (action: () => void) => void) => ReactNode)
  readonly notice?: ReactNode
}) {
  const dialog = React.useRef<HTMLDialogElement>(null)
  const content = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  const motion = useCalendarMotion()
  const enabled = useShellReaderVisibility()
  const calendar = React.useRef(document.activeElement?.closest<HTMLElement>(".month-calendar"))
  const requestedReturnFocus = React.useRef(returnFocusTo)
  const [activeSlot, setActiveSlot] = React.useState(initialSlot ?? sessions[0]?.slot)
  const pendingAction = React.useRef<(() => void) | null>(null)
  const close = useReaderDialog(dialog, () => {
    onClose()
    const action = pendingAction.current
    pendingAction.current = null
    action?.()
  }, () => requestedReturnFocus.current?.(date)
    ?? calendar.current?.querySelector<HTMLElement>(`button[data-date="${date}"]`)
    ?? calendar.current?.querySelector<HTMLElement>(".month-calendar__month") ?? null, enabled)
  const leave = (action: () => void) => { pendingAction.current = action; close() }
  const jumpToSlot = (slot: "AM" | "PM") => {
    const section = content.current?.querySelector<HTMLElement>(`[data-session-slot="${slot}"]`)
    section?.scrollIntoView?.({ block: "start", behavior: motion.reduced ? "auto" : "smooth" })
    section?.focus({ preventScroll: true })
    setActiveSlot(slot)
  }
  const syncSlot = () => {
    const body = content.current
    if (!body) return
    const sections = Array.from(body.querySelectorAll<HTMLElement>("[data-session-slot]"))
    const threshold = body.getBoundingClientRect().top + 48
    const current = sections.filter(section => section.getBoundingClientRect().top <= threshold).at(-1) ?? sections[0]
    const slot = current?.dataset.sessionSlot
    if (slot === "AM" || slot === "PM") setActiveSlot(slot)
  }
  React.useEffect(() => {
    if (!enabled || !dialog.current?.open) return
    if (content.current) content.current.scrollTop = 0
    const slot = initialSlot ?? sessions[0]?.slot
    setActiveSlot(slot)
    const section = content.current?.querySelector<HTMLElement>(`[data-session-slot="${slot}"]`)
    if (initialSection === "records") {
      const records = section?.querySelector<HTMLDetailsElement>("[data-session-records]")
      if (records) {
        records.open = true
        records.scrollIntoView?.({ block: "start", behavior: "instant" })
        records.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true })
      }
    } else if (slot === "PM") {
      section?.scrollIntoView?.({ block: "start", behavior: "instant" })
    }
  }, [date, initialSlot, initialSection, enabled, close])

  return createPortal(<dialog ref={dialog} className="plan-day-reader" data-reduced-motion={motion.reduced || undefined} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close() }}>
    <header className="plan-day-reader__header">
      <button type="button" onClick={close} aria-label="달력으로 돌아가기" title="달력으로 돌아가기"><ArrowLeft size={21} aria-hidden="true" /></button>
      <div><span>훈련 · 일지</span><h2 id={titleId}>{calendarDayLabel(date)}</h2></div>
      <div className="plan-day-reader__arrows">
        <button type="button" onClick={onPrevious} disabled={!canPrevious} aria-label="크게 보기 이전 날짜" title="이전 날짜"><ChevronLeft size={19} aria-hidden="true" /></button>
        <button type="button" onClick={onNext} disabled={!canNext} aria-label="크게 보기 다음 날짜" title="다음 날짜"><ChevronRight size={19} aria-hidden="true" /></button>
      </div>
    </header>
    {notice && <div className="plan-day-reader__notice">{notice}</div>}
    {sessions.length > 1 && <nav className="plan-day-reader__slots" aria-label="오전·오후 바로가기">
      {sessions.map(session => <button type="button" key={session.slot} aria-current={activeSlot === session.slot ? "location" : undefined}
        onClick={() => jumpToSlot(session.slot)}>{sessionSlotLabel(session.slot)}</button>)}
    </nav>}
    <div className="plan-day-reader__body" ref={content} onScroll={syncSlot}>
      <div key={date} className="plan-day-reader__content plan-schedule-preview__sessions calendar-reader-transition">{typeof children === "function" ? children(leave) : children}</div>
    </div>
  </dialog>, document.body)
}
