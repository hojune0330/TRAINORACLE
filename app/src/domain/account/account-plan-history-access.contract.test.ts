import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { accountPlanExportStorage, ensureAccountPlanHistory } from "./account-plan-domain"
import { emptyAccountPlanDocument } from "./account-plan-document-schema"
import { readAdjustedOriginalPlans } from "../adjusted-plan-archive"
import { readAdjustedOriginalPlansV3 } from "../adjusted-plan-archive-v3"
import { readMultiAdjustedOriginalPlansV3 } from "../multi-adjusted-plan-archive-v3"

const runtime = vi.hoisted(() => ({ service: null as unknown, enabled: true }))
vi.mock("./account-plan-service", async original => ({
  ...await original<typeof import("./account-plan-service")>(),
  accountPlansEnabled: () => runtime.enabled, accountPlanService: () => runtime.service,
}))
beforeEach(() => { runtime.enabled = true })
afterEach(() => { runtime.service = null; vi.restoreAllMocks() })

function fixture() {
  const view = { confirmedDocument: emptyAccountPlanDocument(), currentPlan: null, historyLoaded: false, totalPlans: 18 }
  const loadHistory = vi.fn(async () => { view.historyLoaded = true; return true })
  const service = { snapshot: () => view, loadHistory }
  runtime.service = service
  return { view, service, loadHistory }
}

it("never exports or reports an empty archive from a current-only projection", () => {
  fixture()
  expect(() => accountPlanExportStorage("current", "archive", 4).getItem("archive")).toThrow(/history unavailable/u)
  for (const read of [readAdjustedOriginalPlans, readAdjustedOriginalPlansV3, readMultiAdjustedOriginalPlansV3]) {
    expect(read().kind).toBe("invalid")
  }
})

it("loads history explicitly before a complete empty backup can be produced", async () => {
  const { loadHistory } = fixture()
  expect(loadHistory).not.toHaveBeenCalled()
  expect(await ensureAccountPlanHistory()).toBe(true)
  expect(loadHistory).toHaveBeenCalledOnce()
  expect(JSON.parse(accountPlanExportStorage("current", "archive", 4).getItem("archive")!).entries).toEqual([])
})

it("does not authorize a backup when the account service changed during the read", async () => {
  const { loadHistory } = fixture()
  loadHistory.mockImplementation(async () => { runtime.service = { snapshot: () => ({ confirmedDocument: emptyAccountPlanDocument() }) }; return true })
  expect(await ensureAccountPlanHistory()).toBe(false)
})

it("keeps a failed history read unavailable instead of clearing the saved projection", async () => {
  const { loadHistory, view } = fixture()
  const original = structuredClone(view.confirmedDocument)
  loadHistory.mockResolvedValue(false)
  expect(await ensureAccountPlanHistory()).toBe(false)
  expect(view.confirmedDocument).toEqual(original)
  expect(() => accountPlanExportStorage("current", "archive", 6).getItem("archive")).toThrow()
})
