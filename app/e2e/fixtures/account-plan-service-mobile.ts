import { accountPlanEntry, emptyAccountPlanDocument } from "../../src/domain/account/account-plan-document-schema"
import { splitAccountPlanCollection } from "../../src/domain/account/account-plan-collection-schema"
import { planBetaStateV3Schema } from "../../src/domain/plan-beta-schema"
import { stateFixture } from "../../src/domain/plan-beta-store.test-fixture"
export { setActiveLocalAccount } from "../../src/domain/account/local-journal-ownership"

// Synthetic HTTP seed only; the mounted UI uses the real service and browser storage.
export function seed(count: number, hasCurrent: boolean) {
  const document = emptyAccountPlanDocument()
  for (let i = 0; i < count; i++) {
    const state = planBetaStateV3Schema.parse(stateFixture())
    state.generatedAt = new Date(Date.UTC(2026, 0, 1 + i)).toISOString()
    const entry = accountPlanEntry({ state, evidence: null }, state.generatedAt)
    entry.archivedAt = hasCurrent && i === 0 ? null : state.generatedAt
    document.data.plans.push(entry)
  }
  document.data.currentPlanId = hasCurrent ? document.data.plans[0]!.planId : null
  return splitAccountPlanCollection(document)
}

let probe: { started: number; last: number; gaps: number[]; frame: number } | null = null
export function startProbe() {
  probe = { started: performance.now(), last: performance.now(), gaps: [], frame: 0 }
  const tick = (now: number) => {
    if (!probe) return
    probe.gaps.push(now - probe.last); probe.last = now
    probe.frame = requestAnimationFrame(tick)
  }
  probe.frame = requestAnimationFrame(tick)
}
export function stopProbe() {
  if (!probe) throw Error("Probe not started")
  cancelAnimationFrame(probe.frame)
  const result = { elapsedMs: performance.now() - probe.started, frames: probe.gaps.length,
    maxFrameGapMs: Math.max(0, ...probe.gaps) }
  probe = null
  return result
}
