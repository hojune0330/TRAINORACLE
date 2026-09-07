import React from "react"
import { createRoot } from "react-dom/client"
import { PrescriptionAdjustmentEditorV3 } from "../../src/screens/plan-beta/PrescriptionAdjustmentEditorV3"
import { unanchoredAdjustmentFixtureV3 } from "../../src/domain/unanchored-adjustment-v3.test-fixtures"
import { prepareUnanchoredAdjustmentOfferV3 } from "../../src/domain/unanchored-adjustment-offer-v3"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"
import "../../src/styles/app.css"
import "../../src/styles/plan-beta.css"

const offer = prepareUnanchoredAdjustmentOfferV3(unanchoredAdjustmentFixtureV3(false, 150, true))
if (offer.kind !== "available") throw Error(offer.code)
function Fixture() {
  const [open, setOpen] = React.useState(false), [result, setResult] = React.useState("미적용")
  if (offer.kind !== "available") return null
  return <main className="plan-beta-screen"><h1>합성 자료 편집기 검수</h1>
    <button type="button" onClick={() => setOpen(true)}>편집기 열기</button>
    <p role="status">{result}</p>
    {open && <PrescriptionAdjustmentEditorV3 sessionLabel="2026-09-08 · 오전" authority={offer.authority}
      current={offer.current} policy={offer.policy} contextKey={offer.contextKey} now={() => 150}
      primaryConfigurations={[offer.targets[0]!]}
      choices={offer.targets.map((configuration, i) => ({ configuration, label: i ? "시험용 세트 구성" : "시험용 반복 구성" }))}
      onCancel={() => setOpen(false)} onApply={receipt => { setResult(`적용: ${receipt.after.configuration.configurationId}`); setOpen(false) }} />}
  </main>
}
createRoot(document.getElementById("root")!).render(<Fixture />)
