import React from "react"
import { createRoot } from "react-dom/client"
import { PlanBeta } from "../../app/src/screens/PlanBeta"
import { stateFixture } from "../../app/src/domain/plan-beta-store.test-fixture"
import { planBetaStateV3Schema, planHistoryListSchema } from "../../app/src/domain/plan-beta-schema"
import { savePlanBetaState, readPlanBetaStateFromStorage } from "../../app/src/domain/plan-beta-store"
import { planHistorySnapshotContent } from "../../app/src/domain/plan-history-snapshot-content"
import { advancePeriodizationContext, createInitialPeriodizationContext } from "../../app/src/domain/periodization-lineage"
import "../../colors_and_type.css"
import "../../colors_and_type_journal.css"
import "../../app/src/styles/app.css"
import "../../app/src/styles/plan-beta.css"
import "../../app/src/styles/compact-tabs.css"

const ordinal = Number(new URLSearchParams(location.search).get("frame") ?? 6)
if (sessionStorage.getItem("b07-fixture-seeded") !== "yes") {
  const base = stateFixture()
  let periodization = createInitialPeriodizationContext(base.activePlan.candidateId, base.generatedAt)!
  for (let n = 1; n < ordinal; n++) periodization = advancePeriodizationContext(periodization, new Date(Date.UTC(2026, 7, n)).toISOString())!
  const state = planBetaStateV3Schema.parse({ ...base, periodization, progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }] })
  const history = Array.from({ length: 18 }, (_, i) => planHistorySnapshotContent(state, new Date(Date.UTC(2026, 8, 20 - i)).toISOString(), "MANUAL"))
  localStorage.setItem("trainoracle.plan-beta.history.v1", JSON.stringify(planHistoryListSchema.parse(history)))
  if (!savePlanBetaState(state).ok) throw Error("Synthetic fixture could not be saved")
  sessionStorage.setItem("b07-fixture-seeded", "yes")
}
Object.assign(window, { b07Read: readPlanBetaStateFromStorage })
createRoot(document.getElementById("root")!).render(<main className="app-scroll-region" style={{ padding: "16px", maxWidth: "680px", margin: "0 auto", height: "100dvh", overflowY: "auto" }}><PlanBeta /></main>)
