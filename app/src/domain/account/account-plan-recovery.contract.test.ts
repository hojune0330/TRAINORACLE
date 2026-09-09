import { webcrypto } from "node:crypto"
import { beforeEach, afterEach, it, expect, vi } from "vitest"
import { createAccountPlanService } from "./account-plan-service"
import { planIntegrationBuffer, planIntegrationTransport } from "./account-plan-integration.test-support"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { accountPlanCapacity, accountPlanEntry, emptyAccountPlanDocument, validateAccountPlanDocument } from "./account-plan-document-schema"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "./local-journal-ownership"
import { ACCOUNT_WRITE_REJECTIONS } from "./account-write-rejection"

const ownerId = "11111111-1111-4111-8111-111111111111"
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); localStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })

it("initialization failure is FAILED, not an empty account or successful device fallback", async () => {
  vi.stubGlobal("indexedDB", undefined)
  const send = vi.fn(), service = createAccountPlanService({ ownerId, isCurrent: () => true, send })
  expect(service.snapshot()).toMatchObject({ status: "FAILED", document: null, currentPlan: null })
  expect(await service.hydrate()).toBe(false)
  expect(service.snapshot().status).toBe("FAILED")
  expect(await service.retry()).toBe("FAILED")
  expect(send).not.toHaveBeenCalled()
  service.close()
})

it("import captures immutable input before deferred authentication and rejects differing existing progress", async () => {
  const remote = planIntegrationTransport()
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const service = createAccountPlanService({ ownerId, isCurrent: () => true, buffer: planIntegrationBuffer(),
    send: async request => { if (request.action === "read") await held; return remote.send(request) } })
  const hydrate = service.hydrate(), packets = [accountPlanPacketFixture(3)], original = structuredClone(packets[0]!)
  const { accountPlanFingerprint } = await import("./account-plan-document-schema")
  const imported = service.importHistory(packets, accountPlanFingerprint(emptyAccountPlanDocument()), () => true)
  Reflect.set(packets[0]!.state, "progress", [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }])
  packets.length = 0
  release(); await hydrate
  expect(await imported).toBe("ACCOUNT")
  expect(remote.document()?.data.plans[0]?.progress).toEqual(original.state.progress)
  const changed = structuredClone(original)
  Reflect.set(changed.state, "progress", [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }])
  expect(await service.importHistory([changed], service.snapshot().fingerprint!, () => true)).toBe("HISTORY_CONFLICT")
  expect(remote.revision()).toBe(1)
  expect(service.snapshot().currentPlan).toBeNull()
  service.close()
})

it.each(ACCOUNT_WRITE_REJECTIONS)("%s preserves rejected selection/import bytes without pending or account ACK", async code => {
  for (const operation of ["SELECT", "IMPORT"] as const) {
    const buffer = planIntegrationBuffer(), remote = planIntegrationTransport()
    let saves = 0
    const service = createAccountPlanService({ ownerId, isCurrent: () => true, buffer,
      send: async request => {
        if (request.action === "save") { saves++; return { ok: false, code } }
        return remote.send(request)
      } })
    await service.hydrate()
    const packet = accountPlanPacketFixture(3), fingerprint = service.snapshot().fingerprint!
    const result = operation === "SELECT"
      ? await service.mutate({ kind: "SELECT", packet, confirmsSelection: true, freshReview: () => true }, fingerprint)
      : await service.importHistory([packet], fingerprint, () => true)
    expect(result).toBe("REJECTED")
    expect(service.snapshot()).toMatchObject({ status: "REJECTED", currentPlan: null })
    expect(service.snapshot().document?.data.plans).toHaveLength(1)
    expect(await service.retry(() => true)).toBe("REJECTED")
    expect(await service.hydrate()).toBe(false)
    expect(service.snapshot().status).toBe("REJECTED")
    expect(saves).toBe(1)
    expect(remote.revision()).toBe(0)
    service.close()
  }
})

it.each([3, 4, 5, 6] as const)("V%s measured distinct original capacity rejects the next packet without erasing history", async version => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(TODAY.getTime() + 120_000))
  const document = emptyAccountPlanDocument()
  let firstPacketBytes = 0, rejectedBytes = 0
  for (let index = 0; index <= 100; index++) {
    localStorage.clear()
    const packet = accountPlanPacketFixture(version, new Date(TODAY.getTime() + index * 1000))
    if (!index) firstPacketBytes = new TextEncoder().encode(JSON.stringify(packet)).byteLength
    const entry = accountPlanEntry(packet)
    const next = structuredClone(document)
    next.data.plans.push({ ...entry, archivedAt: new Date().toISOString() })
    if (accountPlanCapacity(next).exceeded) {
      rejectedBytes = accountPlanCapacity(next).bytes
      expect(validateAccountPlanDocument(next)).toBe(false)
      const remote = planIntegrationTransport(), service = createAccountPlanService({ ownerId, isCurrent: () => true,
        buffer: planIntegrationBuffer(), send: remote.send })
      await service.hydrate()
      expect(await service.importHistory(document.data.plans.map(p => p.snapshot), service.snapshot().fingerprint!, () => true)).toBe("ACCOUNT")
      const before = remote.document()
      expect(await service.importHistory([packet], service.snapshot().fingerprint!, () => true)).toBe("CAPACITY")
      expect(remote.document()).toEqual(before); expect(remote.revision()).toBe(1)
      service.close(); break
    }
    expect(validateAccountPlanDocument(next)).toBe(true)
    document.data.plans.push({ ...entry, archivedAt: new Date().toISOString() })
  }
  process.stdout.write(`PLAN_CAPACITY V${version}: packet=${firstPacketBytes}B count=${document.data.plans.length} body=${accountPlanCapacity(document).bytes}B next=${rejectedBytes}B\n`)
  expect(document.data.plans.length).toBeGreaterThan(0)
  expect(rejectedBytes).toBeGreaterThan(0)
}, 60_000)
