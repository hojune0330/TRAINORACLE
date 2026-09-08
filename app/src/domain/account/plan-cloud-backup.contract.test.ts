import { beforeEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../plan-beta-store.test-fixture"
import { planBetaStateV3Schema } from "../plan-beta-schema"
import { setActiveLocalAccount } from "./local-journal-ownership"
import { generatePlanFromDraft, selectPlanForActivation } from "../plan-beta-flow"
import { RUNTIME_CASES, TODAY, draftFor, saveCurrentRecord } from "../prescription-quality-matrix.test-fixtures"

let savedRow: Record<string, unknown> | null = null
let serverRows: Record<string, unknown>[] | null = null

function selectQuery() {
  const filters: [string, unknown][] = []
  const query = {
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query },
    is: (key: string, value: unknown) => { filters.push([key, value]); return query },
    order: () => query,
    limit: () => query,
    maybeSingle: () => {
      const rows = serverRows ?? (savedRow === null ? [] : [savedRow])
      const row = rows.filter(item => filters.every(([key, value]) => (
        value === null ? item[key] == null : item[key] === value
      ))).sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at)))[0]
      return Promise.resolve({ data: row ?? null, error: null })
    },
  }
  return query
}

vi.mock("../product-features", () => ({
  productFeatures: () => ({
    sync: true,
    sharing: true,
    planProposals: true,
    planBackup: true,
    publicProfile: true,
    experimentalFatigue: false,
    decorationShop: true,
    productAnalytics: false,
    feedbackBoard: false,
  }),
}))

vi.mock("./supabase-client", () => ({
  supabase: () => Promise.resolve({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: "user-1" } } }, error: null }),
    },
    from: () => ({
      upsert: (row: Record<string, unknown>) => {
        savedRow = JSON.parse(JSON.stringify(row)) as Record<string, unknown>
        return Promise.resolve({ data: null, error: null })
      },
      select: selectQuery,
      update: (patch: Record<string, unknown>) => ({
        eq: () => ({
          eq: () => {
            if (savedRow !== null) savedRow = { ...savedRow, ...patch }
            return Promise.resolve({ data: null, error: null })
          },
        }),
      }),
    }),
  }),
  __resetSupabaseForTest: () => {},
}))

import {
  archivePlanOnServer,
  backupActivePlanToServer,
  loadLatestPlanFromServer,
} from "./plan-cloud-backup"

beforeEach(() => {
  savedRow = null
  serverRows = null
  window.localStorage.clear()
  setActiveLocalAccount("user-1")
})

describe("active plan cloud backup", () => {
  it("blocks every legacy cloud path while account-canonical PLAN storage owns the account", async () => {
    vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")
    vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
    try {
      const state = planBetaStateV3Schema.parse(stateFixture())
      await expect(backupActivePlanToServer(state)).resolves.toEqual({ kind: "unavailable" })
      await expect(loadLatestPlanFromServer()).resolves.toEqual({ kind: "unavailable" })
      await archivePlanOnServer(state.activePlan.candidateId)
      expect(savedRow).toBeNull()
    } finally { vi.unstubAllEnvs() }
  })
  it("finds the latest V3 plan when a newer V6 snapshot exists", async () => {
    const state = planBetaStateV3Schema.parse(stateFixture())
    serverRows = [
      { user_id: "user-1", schema_version: 6, plan_id: "multi-v6:newer", plan_payload: { version: 6 }, saved_at: "2026-09-08T02:00:00Z" },
      { user_id: "user-1", schema_version: 3, plan_id: state.activePlan.candidateId, plan_payload: state, saved_at: "2026-09-08T01:00:00Z" },
    ]
    await expect(loadLatestPlanFromServer()).resolves.toEqual({ kind: "loaded", state })
  })

  it("leaves V6-only accounts to the separate V6 restore flow", async () => {
    serverRows = [
      { user_id: "user-1", schema_version: 6, plan_id: "multi-v6:only", plan_payload: { version: 6 }, saved_at: "2026-09-08T02:00:00Z" },
    ]
    await expect(loadLatestPlanFromServer()).resolves.toEqual({ kind: "unavailable" })
  })

  it("round-trips a bound V2 structure through the private backup payload", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
    try {
      const fixture = RUNTIME_CASES[1]
      const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
      const result = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
      if (result.kind !== "generated") throw new Error("Expected candidate")
      const selected = selectPlanForActivation(result.generated.candidates[0].candidateId, result.generated, result.gate, result.intake)
      if (selected.kind !== "selected" || selected.state.version !== 3) throw new Error("Expected V3 plan")
      const p = selected.state.activePlan.sessions.find(item => item.prescription.kind === "PACE_TARGET")?.prescription
      if (p?.kind !== "PACE_TARGET") throw new Error("Expected detailed prescription")
      expect(p.sequence?.version).toBe(2)
      await expect(backupActivePlanToServer(selected.state)).resolves.toEqual({ kind: "saved" })
      await expect(loadLatestPlanFromServer()).resolves.toEqual({ kind: "loaded", state: selected.state })
      expect(savedRow).toMatchObject({ user_id: "user-1", schema_version: 3 })
      expect(JSON.stringify(savedRow)).toContain('"terminalRecovery":{"mode":"NOT_APPLICABLE","seconds":null}')
    } finally {
      vi.useRealTimers()
    }
  })

  it("stores only a validated v3 plan for the signed-in local account", async () => {
    const state = planBetaStateV3Schema.parse(stateFixture())

    await expect(backupActivePlanToServer(state)).resolves.toEqual({ kind: "saved" })
    expect(savedRow).toMatchObject({
      user_id: "user-1",
      plan_id: state.activePlan.candidateId,
      schema_version: 3,
      plan_payload: state,
    })
  })

  it("restores the latest validated plan payload", async () => {
    const state = planBetaStateV3Schema.parse(stateFixture())
    await backupActivePlanToServer(state)

    await expect(loadLatestPlanFromServer()).resolves.toEqual({ kind: "loaded", state })
  })

  it("does not upload when the active local account differs from the session", async () => {
    setActiveLocalAccount("user-2")

    await expect(backupActivePlanToServer(stateFixture())).resolves.toEqual({ kind: "unavailable" })
    expect(savedRow).toBeNull()
  })

  it("does not restore a plan after the athlete archived it", async () => {
    const state = planBetaStateV3Schema.parse(stateFixture())
    await backupActivePlanToServer(state)
    await archivePlanOnServer(state.activePlan.candidateId)

    await expect(loadLatestPlanFromServer()).resolves.toEqual({ kind: "unavailable" })
    expect(savedRow?.archived_at).toEqual(expect.any(String))
  })

  it("does not let a late backup reopen an archived plan", async () => {
    const state = planBetaStateV3Schema.parse(stateFixture())
    await backupActivePlanToServer(state)
    await archivePlanOnServer(state.activePlan.candidateId)

    await expect(backupActivePlanToServer(state)).resolves.toEqual({ kind: "unavailable" })
    expect(savedRow?.archived_at).toEqual(expect.any(String))
  })
})
