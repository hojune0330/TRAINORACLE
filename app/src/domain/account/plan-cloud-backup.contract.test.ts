import { beforeEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../plan-beta-store.test-fixture"
import { planBetaStateV3Schema } from "../plan-beta-schema"
import { setActiveLocalAccount } from "./local-journal-ownership"

let savedRow: Record<string, unknown> | null = null

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
        savedRow = row
        return Promise.resolve({ data: null, error: null })
      },
      select: () => ({
        eq: () => ({
          is: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({
                  data: savedRow === null ? null : {
                    plan_id: savedRow.plan_id,
                    plan_payload: savedRow.plan_payload,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
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
  window.localStorage.clear()
  setActiveLocalAccount("user-1")
})

describe("active plan cloud backup", () => {
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
