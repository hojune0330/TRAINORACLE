import { createPortal } from "react-dom"
import { GLOSSARY, type TermId } from "../../domain/glossary"
import { PopCard, usePopover } from "../../components/Popover"

export type PlanFlowPrimaryCode = "MAIN" | "BASE" | "REC" | "OFF"
export type PlanFlowSecondaryCode = "LT" | "VO2" | "GLY" | "ATP" | "MIX"
export type PlanFlowKind = "main" | "base" | "recovery" | "off"

const PRIMARY_TERM: Record<PlanFlowPrimaryCode, TermId> = {
  MAIN: "main",
  BASE: "base",
  REC: "rec",
  OFF: "off",
}

const SECONDARY_TERM: Record<PlanFlowSecondaryCode, TermId> = {
  LT: "lt",
  VO2: "vo2",
  GLY: "gly",
  ATP: "atp",
  MIX: "mix",
}

export function PlanFlowCodeHelp({
  primary,
  secondary,
  kind,
  variant = "badge",
}: {
  readonly primary: PlanFlowPrimaryCode
  readonly secondary?: PlanFlowSecondaryCode
  readonly kind: PlanFlowKind
  readonly variant?: "legend" | "badge"
}) {
  const { open, toggle, wrapRef } = usePopover()
  const primaryTerm = PRIMARY_TERM[primary]
  const secondaryTerm = secondary === undefined ? undefined : SECONDARY_TERM[secondary]
  const accessibleCode = secondary === undefined ? primary : `${primary} ${secondary}`
  const contextLabel = variant === "legend" ? "일정표 구분" : "훈련"
  const content = (
    <>
      <GlossarySection term={primaryTerm} />
      {secondaryTerm !== undefined && <GlossarySection term={secondaryTerm} divided />}
    </>
  )

  return (
    <span
      ref={wrapRef}
      className="plan-flow-code-help"
      data-variant={variant}
    >
      <button
        type="button"
        className="plan-flow-code-help__trigger"
        aria-label={`${accessibleCode} ${contextLabel} 설명 ${open ? "닫기" : "보기"}`}
        aria-expanded={open}
        onClick={toggle}
      >
        <span
          className={variant === "badge" ? "plan-session-flow-code" : "plan-flow-code-help__legend-code"}
          data-flow-kind={kind}
          aria-hidden="true"
        >
          <strong>{primary}</strong>
          {secondary !== undefined && <small>{secondary}</small>}
          <span className="plan-flow-code-help__question">?</span>
        </span>
      </button>
      {variant === "legend" ? (
        <PopCard
          open={open}
          align="left"
          width={248}
          label={`plan-flow:${accessibleCode}`}
          accentBorder={{ border: "var(--line)", bar: "var(--ink-3)" }}
        >
          {content}
        </PopCard>
      ) : open && typeof document !== "undefined" ? createPortal(
        <div
          className="plan-flow-code-help__floating-card"
          role="note"
          aria-label={`${accessibleCode} 훈련 설명`}
        >
          {content}
        </div>,
        document.body,
      ) : null}
    </span>
  )
}

function GlossarySection({ term, divided = false }: {
  readonly term: TermId
  readonly divided?: boolean
}) {
  const entry = GLOSSARY[term]
  return (
    <section className="plan-flow-code-help__section" data-divided={divided ? "true" : undefined}>
      <div className="term-help__label">{entry.label}</div>
      <div className="term-help__short">{entry.short}</div>
      {entry.detail !== undefined && <div className="term-help__detail">{entry.detail}</div>}
    </section>
  )
}
