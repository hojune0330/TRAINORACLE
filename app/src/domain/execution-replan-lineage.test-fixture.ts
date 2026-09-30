import { prepareCatalogReplacement } from "./catalog-replacement"
import { replanFixture } from "./execution-replan.test-fixture"

export function replacedReplanFixture() {
  const f = replanFixture(), archivedPlans = [f.state]
  let state = f.state
  for (const catalogId of ["P-BASE-C", "P-BASE-B"]) {
    const result = prepareCatalogReplacement({ ...f, state, catalogId, address: { day: 4, slot: "AM" },
      inputs: { eventDistanceM: 5000, experience: state.intake.experienceBand, availableSeconds: null,
        confirmedRequirements: [], fiveK: null, segmentPaces: [] }, acceptLonger: true, acceptStronger: false })
    if (result.kind !== "ready") throw Error(`replacement fixture: ${result.message}`)
    if (state !== f.state) archivedPlans.push(state)
    state = result.proposal.after
  }
  return { ...f, state, archivedPlans }
}
