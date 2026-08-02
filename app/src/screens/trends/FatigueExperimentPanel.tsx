import React from "react"
import { experimentalFatigueComposite, fatigueEvidence } from "../../domain/fatigue-vector"
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

export function FatigueExperimentPanel({ now = () => new Date().toISOString() }: {
  readonly now?: () => string
} = {}) {
  const [state, setState] = React.useState(loadFatigueExperiment)
  const [draftVector, setDraftVector] = React.useState(state.vector)
  const isDirty = FIELDS.some((field) => draftVector[field.key] !== state.vector[field.key])
  const composite = isDirty
    ? null
    : experimentalFatigueComposite(state.vector, state.evidence, state.optedIn)

  const update = (next: typeof state) => {
    if (saveFatigueExperiment(next)) setState(next)
  }

  const updateVector = (key: keyof FatigueVector, value: number) => {
    setDraftVector((current) => ({ ...current, [key]: value }))
  }

  const recordVector = () => {
    const next = {
      ...state,
      vector: draftVector,
      evidence: fatigueEvidence({
        observedAt: now(),
        source: "SELF_REPORTED_SLIDERS",
        uncertainty: "HIGH_SUBJECTIVE_ONLY",
        containsPrivateRawText: false,
      }),
    }
    update(next)
  }

  return (
    <section style={{ margin: "24px 20px 0", padding: "16px 0", borderBlock: "1px solid var(--line)" }} aria-labelledby="fatigue-experiment-title">
      <h2 id="fatigue-experiment-title" style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 16 }}>피로도 나눠 보기</h2>
      <p style={{ margin: "6px 0 14px", fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink-3)" }}>
        다섯 항목 모두 지금 느끼는 정도를 직접 고르는 값이에요. 센서 측정값이나 진단이 아니에요.
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
              value={draftVector[field.key]}
              onChange={(event) => updateVector(field.key, Number(event.target.value))}
            />
            <output>{draftVector[field.key]}</output>
          </label>
        ))}
      </div>
      {isDirty && (
        <p role="status" style={{ margin: "10px 0 0", fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-2)" }}>
          바꾼 값이 아직 저장되지 않았어요.
        </p>
      )}
      <button
        type="button"
        onClick={recordVector}
        style={{ width: "100%", minHeight: 44, marginTop: 12, border: "1px solid var(--ink)", background: "var(--surface)", fontFamily: "var(--sans)", fontSize: 13 }}
      >
        지금 값 기록하기
      </button>
      <EvidenceReceipt evidence={state.evidence} />
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

function EvidenceReceipt({ evidence }: {
  readonly evidence: ReturnType<typeof loadFatigueExperiment>["evidence"]
}) {
  if (evidence === null) {
    return (
      <p style={{ margin: "10px 0 0", fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink-3)" }}>
        아직 저장된 피로 기록이 없어요. 값을 확인하고 기록 버튼을 눌러 주세요.
      </p>
    )
  }
  return (
    <div aria-label="피로 기록 근거" style={{ marginTop: 10, padding: 10, border: "1px solid var(--line)", fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6 }}>
      <div>기록 시각 · <time dateTime={evidence.observedAt}>{formatObservedAt(evidence.observedAt)}</time></div>
      <div>출처 · 내가 직접 고른 값</div>
      <div>불확실성 큼 · 현재의 주관적 느낌만 반영</div>
    </div>
  )
}

function formatObservedAt(observedAt: string): string {
  return `${new Date(observedAt).toISOString().slice(0, 16).replace("T", " ")} UTC`
}
