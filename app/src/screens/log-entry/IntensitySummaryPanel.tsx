import type { IntensitySummary } from "../../domain/intensity-assessment"

const COVERAGE_LABEL: Readonly<Record<IntensitySummary["coverage"], string>> = {
  COMBINED: "주관 + 객관 함께 기록",
  SUBJECTIVE_ONLY: "주관 기록만 있음",
  OBJECTIVE_ONLY: "객관 기록으로만 표시",
  MISSING: "강도 자료 없음",
}

export function IntensitySummaryPanel({
  summary,
  onRemove,
}: {
  readonly summary: IntensitySummary
  readonly onRemove?: (componentId: string) => void
}) {
  if (summary.coverage === "MISSING") return null

  return (
    <section aria-label="강도 종합" style={{ marginTop: 10, borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
      <div style={{ padding: "9px 0", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600, color: "var(--ink)", letterSpacing: 0 }}>
        {COVERAGE_LABEL[summary.coverage]}
      </div>
      {(summary.plannedRpe !== undefined || summary.reportedRpe !== undefined) && (
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", margin: 0, borderTop: "1px dashed var(--hair)" }}>
          <IntensityValue label="예상" value={summary.plannedRpe} />
          <IntensityValue label="실제 체감" value={summary.reportedRpe} />
        </dl>
      )}
      {summary.objectiveComponents.map((component) => (
        <div key={component.componentId} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 44px", borderTop: "1px dashed var(--hair)", alignItems: "start" }}>
          <div style={{ minWidth: 0, padding: "9px 0" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 600, color: "var(--ink-3)" }}>{component.label}</div>
            <div style={{ marginTop: 3, fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.55, color: "var(--ink)" }}>
              {component.facts.map((fact) => fact.text).join(" · ")}
            </div>
          </div>
          {onRemove !== undefined && (
            <button
              type="button"
              aria-label={`${component.label} 구성 삭제`}
              title={`${component.label} 구성 삭제`}
              onClick={() => onRemove(component.componentId)}
              style={{ width: 44, height: 44, border: 0, background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 20 }}
            >×</button>
          )}
        </div>
      ))}
    </section>
  )
}

function IntensityValue({ label, value }: { readonly label: string; readonly value?: number }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <dt style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-3)" }}>{label}</dt>
      <dd style={{ margin: "3px 0 0", fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)" }}>{value === undefined ? "미기록" : `${value}/10`}</dd>
    </div>
  )
}
