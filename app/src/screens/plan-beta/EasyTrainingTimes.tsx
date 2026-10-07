import { useId } from "react"
import type { PlanSession } from "@impl/plan-generator/types"
import { easyDurationRows } from "./plan-duration-options"

/** Read-only times from the displayed schedule, never a new dose or saved edit. */
export function EasyTrainingTimes({ sessions }: { readonly sessions: readonly PlanSession[] }) {
  const id = useId()
  const rows = easyDurationRows(sessions)
  if (rows.length === 0) return null
  return <section className="plan-easy-times" aria-labelledby={id}>
    <h3 id={id}>기초·회복 운동 시간</h3>
    <dl>{rows.map(row => <div key={row.key}>
      <dt>{row.title}<span>{row.sessionCount}회</span></dt>
      <dd><small>1회</small>{row.minutesLabel}</dd>
    </div>)}</dl>
    <p>한 번의 운동에 배정된 시간이에요.{rows.some(row => row.minutesLabel.includes("~")) && " 범위가 있으면 그 안에서 시간을 정해요."}</p>
    <details>
      <summary>해당 날짜 보기</summary>
      {rows.map(row => <p key={row.key}><strong>{row.title} · {row.minutesLabel}</strong><br />{row.daysLabel}</p>)}
    </details>
  </section>
}
