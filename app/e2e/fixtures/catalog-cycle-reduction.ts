import { generatePlanFromDraft, selectPlanForActivation } from "../../src/domain/plan-beta-flow"
import { replaceCandidateCatalogWorkout } from "../../src/domain/catalog-plan-binding"
import { createPlannedSessionLogDraft } from "../../src/domain/planned-session-link"
import { parseJournalEntryForWrite, type PostSessionEntry } from "../../src/domain/journal-schema"
import { planBetaStateV3Schema } from "../../src/domain/plan-beta-schema"

export function catalogReductionFixture() {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000,
    competitionDivision: "OPEN", experienceBand: "EXPERIENCED", availableDayCount: 5,
    requestedFrameLength: 10, trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "MORNING", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(result.kind)
  let generated = result.generated
  for (const session of generated.candidates[0].sessions.filter(s => s.role === "QUALITY")) {
    const changed = replaceCandidateCatalogWorkout(generated, session, "P-LT-B", {
      eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null, confirmedRequirements: [],
      fiveK: null, segmentPaces: [],
    }, true)
    if (!changed) throw Error("Cannot prepare reviewed predecessor")
    generated = changed
  }
  const selected = selectPlanForActivation(generated.candidates[0].candidateId, generated, result.gate,
    { ...result.intake, startDate: "2026-09-01" }, result.athleteEvidence, new Date("2026-09-01T03:00:00Z"))
  if (selected.kind !== "selected") throw Error(selected.code)
  const state = planBetaStateV3Schema.parse(selected.state)
  const journals = state.activePlan.sessions.filter(s => s.role === "QUALITY").map((session, index) => {
    const draft = createPlannedSessionLogDraft(state, session, state.generatedAt)
    if (!draft) throw Error("Missing link")
    const entry: PostSessionEntry = { id: `reduction-${index}`, kind: "post-session", date: draft.date,
      savedAt: `${draft.date}T12:00:00Z`, syncState: "local", system: "base", title: "", memo: "",
      distanceKm: "", durationMin: "", avgPace: "", rpe: 10,
      activityOutcome: "COMPLETED", activitySlot: session.slot, painCheckStatus: "NO_SIGNAL_REPORTED",
      plannedSessionLink: draft.link,
      fieldProvenance: { rpe: { provenance: "EXPLICIT" }, activityOutcome: { provenance: "EXPLICIT" },
        activitySlot: { provenance: "EXPLICIT" }, painCheckStatus: { provenance: "EXPLICIT" },
        plannedSessionLink: { provenance: "EXPLICIT" } } }
    const checked = parseJournalEntryForWrite(entry)
    if (!checked) throw Error("Invalid synthetic journal")
    return checked
  })
  if (journals.length !== 2) throw Error("Expected two comparable MAIN results")
  return { state, journals }
}
