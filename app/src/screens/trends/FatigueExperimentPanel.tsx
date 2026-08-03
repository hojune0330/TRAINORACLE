import React from "react"
import { experimentalFatigueComposite, fatigueEvidence } from "../../domain/fatigue-vector"
import type { FatigueVector } from "../../domain/fatigue-vector"
import {
  loadFatigueExperiment,
  saveFatigueExperiment,
} from "../../domain/fatigue-experiment-store"
import "./fatigue-experiment.css"

const FIELDS = [
  { key: "neural", label: "신경계 피로", description: "반응이 둔하거나 집중하기 어려운 느낌" },
  { key: "metabolic", label: "대사계 피로", description: "숨이 차고 에너지가 바닥난 느낌" },
  { key: "muscular", label: "근육 피로", description: "근육이 뻐근하거나 힘이 빠진 느낌" },
  { key: "impact", label: "충격 부하", description: "달리거나 착지할 때 몸이 받은 충격의 느낌" },
  { key: "subjective", label: "주관적 피로", description: "전체적으로 내가 느끼는 피곤함" },
] as const

export function FatigueExperimentPanel({ now = () => new Date().toISOString() }: {
  readonly now?: () => string
} = {}) {
  const [state, setState] = React.useState(loadFatigueExperiment)
  const [draftVector, setDraftVector] = React.useState(state.vector)
  const [saveError, setSaveError] = React.useState(false)
  const isDirty = FIELDS.some((field) => draftVector[field.key] !== state.vector[field.key])
  const composite = isDirty
    ? null
    : experimentalFatigueComposite(state.vector, state.evidence, state.optedIn)

  const update = (next: typeof state) => {
    if (saveFatigueExperiment(next)) {
      setState(next)
      setSaveError(false)
      return
    }
    setSaveError(true)
  }

  const updateVector = (key: keyof FatigueVector, value: number) => {
    setSaveError(false)
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
    <section className="fatigue-experiment" aria-labelledby="fatigue-experiment-title">
      <h2 id="fatigue-experiment-title">피로도 나눠 보기</h2>
      <p className="fatigue-experiment__intro">
        다섯 항목 모두 지금 느끼는 정도를 직접 고르는 값이에요. 센서 측정값이나 진단이 아니에요.
      </p>
      <div className="fatigue-experiment__fields">
        {FIELDS.map((field) => (
          <label key={field.key} className="fatigue-experiment__field">
            <span className="fatigue-experiment__field-name">{field.label}</span>
            <span id={`fatigue-${field.key}-description`} className="fatigue-experiment__field-description">
              {field.description}
            </span>
            <span className="fatigue-experiment__slider-row">
              <span aria-hidden="true">0</span>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                aria-label={field.label}
                aria-describedby={`fatigue-${field.key}-description`}
                value={draftVector[field.key]}
                onChange={(event) => updateVector(field.key, Number(event.target.value))}
              />
              <output>{draftVector[field.key]}</output>
              <span aria-hidden="true">10</span>
            </span>
          </label>
        ))}
      </div>
      {isDirty && (
        <p role="status" className="fatigue-experiment__draft-status">
          바꾼 값이 아직 저장되지 않았어요.
        </p>
      )}
      <button
        type="button"
        onClick={recordVector}
        className="fatigue-experiment__save"
      >
        지금 값 기록하기
      </button>
      {saveError && (
        <p role="alert" className="fatigue-experiment__error">
          이 기기에 저장하지 못했어요. 입력한 값은 화면에 그대로 있어요.
        </p>
      )}
      <EvidenceReceipt evidence={state.evidence} />
      <p className="fatigue-experiment__composite-note">
        통합 참고값은 다섯 값을 단순히 평균해 보여줘요. 정확한 측정값이나 다음 훈련 지시가 아니에요.
      </p>
      <label className="fatigue-experiment__opt-in">
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
      <p className="fatigue-experiment__empty-evidence">
        아직 저장된 피로 기록이 없어요. 값을 확인하고 기록 버튼을 눌러 주세요.
      </p>
    )
  }
  return (
    <div aria-label="피로 기록 근거" className="fatigue-experiment__evidence">
      <div>기록 시각 · <time dateTime={evidence.observedAt}>{formatObservedAt(evidence.observedAt)}</time></div>
      <div>출처 · 내가 직접 고른 값</div>
      <div>불확실성 큼 · 현재의 주관적 느낌만 반영</div>
    </div>
  )
}

function formatObservedAt(observedAt: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(observedAt))
}
