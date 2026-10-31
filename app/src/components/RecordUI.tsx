import { Check, CircleAlert, CircleHelp, Clock3, FileCheck2, Link2, Link2Off } from "lucide-react"
import { forwardRef, useId, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react"
import { MetricSummary } from "./MetricSummary"
import "./record-ui.css"

/** Reuse the existing metric formatter boundary: every value and unit is supplied. */
export function RecordMetrics(props: ComponentProps<typeof MetricSummary>) {
  if (props.items.length === 0) return null
  return <div className="record-ui record-metrics"><MetricSummary {...props} /></div>
}

/** Original and user-confirmed meanings stay visible as separate facts. */
export function RecordSource({ source, format, dateBasis, originalTimeMeaning, confirmedTimeMeaning }: {
  readonly source: string
  readonly format?: string
  readonly dateBasis?: string
  readonly originalTimeMeaning?: string
  readonly confirmedTimeMeaning?: string
}) {
  return <div className="record-ui record-source">
    <p>{source}{format && <> · {format}</>}</p>
    {(dateBasis || originalTimeMeaning || confirmedTimeMeaning) && <dl>
      {dateBasis && <div><dt>날짜 기준</dt><dd>{dateBasis}</dd></div>}
      {originalTimeMeaning && <div><dt>원본 시간</dt><dd>{originalTimeMeaning}</dd></div>}
      {confirmedTimeMeaning && <div><dt>내가 확인한 시간</dt><dd>{confirmedTimeMeaning}</dd></div>}
    </dl>}
  </div>
}

type Availability = { readonly disabled?: false; readonly disabledReason?: string }
  | { readonly disabled: boolean; readonly disabledReason: string }
type ChoiceAvailability =
  | { readonly disabled?: false; readonly disabledReason?: string; readonly disabledReasonId?: string }
  | { readonly disabled: boolean; readonly disabledReason: string; readonly disabledReasonId?: never }
  | { readonly disabled: boolean; readonly disabledReasonId: string; readonly disabledReason?: never }

/** Controlled native checkbox. Body never mounts/unmounts on selection; no persistence. */
export function RecordChoice({ checked, onChange, title, context, children, disabled = false, disabledReason, disabledReasonId, inputId, inputLabel, busy = false, density = "card", className = "", "data-testid": testId }: {
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly title: string
  readonly context?: string
  readonly children?: ReactNode
  readonly inputId?: string
  /** Preserve the screen's exact ordinal/date/facts identity without duplicating visible copy. */
  readonly inputLabel?: string
  readonly busy?: boolean
  readonly density?: "card" | "row"
  readonly className?: string
  readonly "data-testid"?: string
} & ChoiceAvailability) {
  const generatedId = useId()
  const id = inputId ?? generatedId
  const stateId = `${id}-state`
  const reasonId = disabledReasonId ?? `${id}-reason`
  return <div className={`record-ui record-choice ${className}`.trim()} data-testid={testId} data-density={density} data-selected={checked} data-disabled={disabled} aria-busy={busy || undefined}>
    <label className="record-choice__label" htmlFor={id}>
      <span className="record-choice__control"><input id={id} type="checkbox" checked={checked} disabled={disabled} aria-label={inputLabel}
        aria-describedby={[stateId, disabled ? reasonId : ""].filter(Boolean).join(" ")}
        onChange={event => onChange(event.target.checked)} /></span>
      <span className="record-choice__identity">
        {context && <span className="record-choice__context">{context}</span>}
        <strong>{title}</strong>
        <span id={stateId} className="record-choice__state">
          <span aria-hidden={!checked} data-visible={checked}>선택됨</span>
          <span aria-hidden={checked} data-visible={!checked}>선택 안 함</span>
        </span>
      </span>
    </label>
    {disabled && disabledReason !== undefined && <p id={reasonId} className="record-choice__reason">{disabledReason}</p>}
    {children != null && <div className="record-choice__body">{children}</div>}
  </div>
}

/** Orthogonal facts: connection/receipt never imply storage ACK or analysis readiness. */
export type RecordState =
  | { readonly phase: "connection"; readonly status: "unavailable" | "disconnected" | "connected" | "unknown" }
  | { readonly phase: "receipt"; readonly status: "none" | "receiving" | "received" | "failed" | "unknown" }
  | { readonly phase: "storage"; readonly status: "unsaved" | "device" | "pending" | "confirmed" | "failed" | "rejected" | "conflict" | "unknown" }
  | { readonly phase: "analysis"; readonly status: "unavailable" | "review" | "ready" | "failed" | "unknown" }

const STATE_LABELS = {
  connection: { unavailable: "연결 미제공", disconnected: "연결 안 됨", connected: "연결됨", unknown: "연결 상태 확인 불가" },
  receipt: { none: "아직 받은 기록 없음", receiving: "기록 받는 중", received: "기록 수신됨", failed: "기록 수신 실패", unknown: "수신 결과 확인 불가" },
  storage: { unsaved: "아직 저장 전", device: "기기에 보관됨", pending: "계정 저장 확인 중", confirmed: "계정 저장 확인됨", failed: "저장 실패", rejected: "저장 거절됨", conflict: "다른 수정본 확인 필요", unknown: "저장 결과 확인 불가" },
  analysis: { unavailable: "분석 미제공", review: "분석 기준 확인 필요", ready: "분석 가능", failed: "분석 실패", unknown: "분석 가능 여부 확인 불가" },
} as const
const PHASE_LABELS = { connection: "기기 연결", receipt: "기록 수신", storage: "저장 확인", analysis: "분석" } as const

function statePresentation(state: RecordState) {
  const label = state.phase === "connection" ? STATE_LABELS.connection[state.status]
    : state.phase === "receipt" ? STATE_LABELS.receipt[state.status]
      : state.phase === "storage" ? STATE_LABELS.storage[state.status] : STATE_LABELS.analysis[state.status]
  const tone = state.status === "failed" || state.status === "rejected" ? "error"
    : state.status === "conflict" || state.status === "unknown" || state.status === "review" ? "attention"
      : state.status === "pending" || state.status === "receiving" ? "pending" : "neutral"
  const Icon = tone === "error" || tone === "attention" ? CircleAlert : tone === "pending" ? Clock3
    : state.phase === "connection" ? state.status === "connected" ? Link2 : Link2Off
      : state.phase === "storage" && state.status === "confirmed" ? FileCheck2
        : state.phase === "analysis" && state.status === "ready" ? Check : CircleHelp
  return { label, tone, Icon }
}

/** Static facts by default; callers own any single live announcement at flow level. */
export function RecordStateList({ items, label }: {
  readonly label: string
  readonly items: readonly { readonly id: string; readonly label?: string; readonly state: RecordState; readonly detail?: ReactNode }[]
}) {
  if (items.length === 0) return null
  return <dl className="record-ui record-states" aria-label={label}>
    {items.map(({ id, label: itemLabel, state, detail }) => {
      const { label: stateLabel, tone, Icon } = statePresentation(state)
      return <div key={id} data-phase={state.phase} data-state={state.status} data-tone={tone}>
        <dt>{itemLabel ?? PHASE_LABELS[state.phase]}</dt>
        <dd><span className="record-states__value"><Icon size={18} aria-hidden="true" />{stateLabel}</span>
          {detail != null && <span className="record-states__detail">{detail}</span>}</dd>
      </div>
    })}
  </dl>
}

export type RecordNoticeKind = "pending" | "error" | "empty" | "conflict" | "unknown" | "blocked" | "confirmed"

/** One record-flow action role across device/account results. Native event/ref owner stays the screen. */
export const RecordAction = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly priority?: "primary" | "secondary"
}>(function RecordAction({ priority = "primary", className = "", children, ...button }, ref) {
  return <button {...button} ref={ref} type="button" className={`record-ui record-action ${className}`.trim()} data-priority={priority}>{children}</button>
})

/** Context + actual outcome + one explicit next action. No automatic retry or saving. */
export function RecordNotice({ kind, title, children, action, announce = false, headingLevel = 3, className = "", "data-testid": testId }: {
  readonly kind: RecordNoticeKind
  readonly title: string
  readonly children: ReactNode
  readonly action?: { readonly label: string; readonly onClick: () => void } & Availability
  readonly announce?: boolean | "assertive"
  readonly headingLevel?: 2 | 3
  readonly className?: string
  readonly "data-testid"?: string
}) {
  const id = useId()
  const Heading = headingLevel === 2 ? "h2" : "h3"
  const Icon = kind === "pending" ? Clock3 : kind === "confirmed" ? FileCheck2
    : kind === "empty" || kind === "blocked" ? CircleHelp : CircleAlert
  return <section className={`record-ui record-notice ${className}`.trim()} data-testid={testId} data-kind={kind} aria-labelledby={id}>
    <div className="record-notice__message" role={announce === "assertive" ? "alert" : announce ? "status" : undefined} aria-live={announce === "assertive" ? "assertive" : announce ? "polite" : undefined}>
      <Heading id={id}><Icon size={20} aria-hidden="true" />{title}</Heading>
      <div className="record-notice__detail">{children}</div>
    </div>
    {action && <><RecordAction className="record-notice__action" disabled={action.disabled}
      aria-describedby={action.disabled ? `${id}-reason` : undefined} onClick={action.onClick}>{action.label}</RecordAction>
      {action.disabled && <p id={`${id}-reason`}>{action.disabledReason}</p>}</>}
  </section>
}
