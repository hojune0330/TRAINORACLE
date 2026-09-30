import React from "react"
import { createRoot } from "react-dom/client"
import { PlanBeta } from "../../app/src/screens/PlanBeta"
import { replacedReplanFixture } from "../../app/src/domain/execution-replan-lineage.test-fixture"
import { savePlanBetaState } from "../../app/src/domain/plan-beta-store"
import { planBetaStateV3Schema, planHistoryListSchema } from "../../app/src/domain/plan-beta-schema"
import { planHistorySnapshotContent } from "../../app/src/domain/plan-history-snapshot-content"
import "../../colors_and_type.css"
import "../../colors_and_type_journal.css"
import "../../app/src/styles/app.css"
import "../../app/src/styles/plan-beta.css"
import "../../app/src/styles/compact-tabs.css"

const f = replacedReplanFixture()
const original = planBetaStateV3Schema.parse({ ...f.state, progress: f.state.activePlan.sessions.map(session => ({
  sessionDay: session.day, sessionSlot: session.slot, state: "COMPLETED",
})) })
const history = new URLSearchParams(location.search).get("history") === "yes"
if (history) localStorage.setItem("trainoracle.plan-beta.history.v1", JSON.stringify(planHistoryListSchema.parse(
  f.archivedPlans.map((state, index) => planHistorySnapshotContent(state, `2026-09-29T0${index + 3}:00:00.000Z`, "REPLAN")))))
if (!savePlanBetaState(original).ok) throw Error("Synthetic current plan could not be saved")
createRoot(document.getElementById("root")!).render(<main style={{ padding: 16, maxWidth: 680, margin: "0 auto" }}><PlanBeta /></main>)
