import React from "react"
import { experimentalFatigueComposite } from "../../domain/fatigue-vector"
import type { FatigueVector } from "../../domain/fatigue-vector"
import {
  loadFatigueExperiment,
  saveFatigueExperiment,
} from "../../domain/fatigue-experiment-store"

const FIELDS = [
  { key: "neural", label: "신경계 피로" },
  { key: "metabolic", label: "대사계 피로" },
  { key: "muscular", label: "근육 피로" },
  { key: "impact", label: "충격 부하" },
  { key: "subjective", label: "주관적 피로" },
] as const

export function FatigueExperimentPanel() {
  const [state, setState] = React.useState(loadFatigueExperiment)
  const composite = experimentalFatigueComposite(state.vector, state.optedIn)

  const update = (next: typeof state) => {
    if (saveFatigueExperiment(next)) setState(next)
  }

  const updateVector = (key: keyof FatigueVector, value: number) => {
    update({ ...state, vector: { ...state.vector, [key]: value } })
  }

  return (
    <section style={{ margin: "24px 20px 0", padding: "16px 0", borderBlock: "1px solid var(--line)" }} aria-labelledby="fatigue-experiment-title">
      <h2 id="fatigue-experiment-title" style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 16 }}>피로도 나눠 보기</h2>
      <p style={{ margin: "6px 0 14px", fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink-3)" }}>
        지금 느끼는 정도를 직접 고르는 실험 기록이에요. 측정값이나 진단이 아니에요.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {FIELDS.map((field) => (
          <label key={field.key} style={{ display: "grid", gridTemplateColumns: "88px minmax(0, 1fr) 28px", alignItems: "center", gap: 8, fontFamily: "var(--sans)", fontSize: 12 }}>
            <span>{field.label}</span>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              aria-label={field.label}
              value={state.vector[field.key]}
              onChange={(event) => updateVector(field.key, Number(event.target.value))}
            />
            <output>{state.vector[field.key]}</output>
          </label>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, marginTop: 12, fontFamily: "var(--sans)", fontSize: 13 }}>
        <input
          type="checkbox"
          checked={state.optedIn}
          onChange={(event) => update({ ...state, optedIn: event.target.checked })}
        />
        통합 참고값 보기 · 실험 기능
      </label>
      {composite !== null && (
        <div role="status" style={{ padding: 12, border: "1px solid var(--line)", fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.6 }}>
          <strong>통합 참고값 {composite.score}/10</strong>
          <br />{composite.uncertainty}
        </div>
      )}
    </section>
  )
}
