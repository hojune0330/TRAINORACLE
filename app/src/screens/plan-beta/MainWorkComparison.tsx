import { ChevronDown } from "lucide-react"
import type { comparePlanMainWork, MainComparisonRow, MainPrescriptionView } from "../../domain/plan-main-comparison"

const FIELDS = [
  ["work", "운동 구간"], ["recovery", "회복"], ["intensity", "목표 강도"],
  ["time", "시간 정보"], ["limitation", "알 수 있는 것과 한계"],
] as const

export function MainWorkComparison({ comparison }: { readonly comparison: ReturnType<typeof comparePlanMainWork> }) {
  if (comparison.rows.length === 0) return <p className="plan-candidate-comparison__note">비교할 본운동 구간이 없어요.</p>
  return (
    <details className="plan-main-comparison">
      <summary>본운동 방법 비교<ChevronDown size={18} aria-hidden="true" /></summary>
      {comparison.rows.map((row) => (
        <section key={row.key} aria-label={`${row.day}일차 ${row.slot === "AM" ? "오전" : "오후"} 본운동 비교`}>
          <h3>{row.day}일차 · {row.slot === "AM" ? "오전" : "오후"}</h3>
          <p className="plan-main-comparison__status">{statusText(row)}</p>
          {row.samePrescribedValues && row.a !== null ? (
            <MethodValues label={row.a.kind === "RPE_TIME_RANGE" ? "A·B 시간·RPE 공통" : "A·B 공통"} view={row.a} />
          ) : (
            <div className="plan-main-comparison__pair">
              <MethodValues label="계획안 A" view={row.a} />
              <MethodValues label="계획안 B" view={row.b} />
            </div>
          )}
        </section>
      ))}
    </details>
  )
}

function statusText(row: MainComparisonRow) {
  if (row.methodRelation === "CONTEXT_MISMATCH") return "같은 일정·목적의 구간으로 비교할 수 없어요."
  if (row.methodRelation === "UNSPECIFIED" && row.a?.kind !== row.b?.kind) return "한쪽만 구간별 상세 처방이 있어 두 본운동 방법을 비교할 수 없어요."
  if (row.methodRelation === "UNSPECIFIED") return row.samePrescribedValues
    ? "같은 시간·RPE 범위예요. 서로 다른 두 본운동 방법이 정해진 것은 아니에요."
    : "시간·RPE 범위가 달라도, 반복과 회복이 없으면 다른 방법인지 판단할 수 없어요."
  if (row.methodRelation === "DIFFERENT_REQUIRES_REVIEW") return "본운동 구성이 달라요. 두 방법의 적용 범위와 차이를 검토해야 하며, 효과가 같다는 뜻은 아니에요."
  return row.samePrescribedValues
    ? "본운동 방법과 목표값이 같아요. 다른 방법 두 개가 아니에요."
    : "같은 본운동 방법에서 횟수나 목표값이 달라요. 별개의 방법으로 세지 않아요."
}

function MethodValues({ label, view }: { readonly label: string; readonly view: MainPrescriptionView | null }) {
  return <div className="plan-main-comparison__values">
    <strong>{label}</strong>
    {view === null ? <p>대응하는 본운동이 없거나 구성을 읽을 수 없어요.</p> : (
      <dl>{FIELDS.map(([field, title]) => <div key={field}><dt>{title}</dt><dd>{view[field]}</dd></div>)}</dl>
    )}
  </div>
}
