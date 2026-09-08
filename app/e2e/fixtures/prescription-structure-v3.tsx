import React from "react"
import { createRoot } from "react-dom/client"
import { PrescriptionStructureV3 } from "../../src/screens/plan-beta/PrescriptionStructureV3"
import { METHOD_ADOPTION_PROTOCOLS } from "../../../reports/research/method-adoption-protocols.mjs"
import { representPendingWholeSessionV3 } from "../../../reports/research/method-proposal-sequence-v3"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"
import "../../src/styles/app.css"
import "../../src/styles/plan-beta.css"

function Fixture() {
  const [id, setId] = React.useState("P-LT-C")
  const proposal = METHOD_ADOPTION_PROTOCOLS.find(p => p.id === id)!
  const result = representPendingWholeSessionV3(proposal)
  return <main className="plan-beta-screen">
    <h1>상세 훈련 구조 검수</h1>
    <label>검토 구성<select value={id} onChange={event => setId(event.target.value)}>
      {['P-LT-C', 'P-LT-B', 'P-GLY-S'].map(value => <option key={value}>{value}</option>)}
    </select></label>
    {result.kind === "represented" && <PrescriptionStructureV3 sequence={result.sequence} originalDurationMinutes={{ minimum: 25, maximum: 40 }} />}
  </main>
}
createRoot(document.getElementById("root")!).render(<Fixture />)
