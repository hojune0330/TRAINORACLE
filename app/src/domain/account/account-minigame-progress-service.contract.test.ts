import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createMinigameProgressSync, minigameAccountStorageEnabled, minigameProgressDocumentId } from "./account-minigame-progress-service"
import type { AccountJournalRequest, AccountJournalResult } from "./account-journal-api"
import type { AccountMinigameProgressDocument } from "./account-minigame-progress-schema"
import { validateAccountMinigameProgressUpdate } from "./account-minigame-progress-schema"
import { emptyMinigameProgress, recordCityResult } from "../minigame/progress"

type Doc = AccountMinigameProgressDocument
const OWNER = "a1111111-1111-4111-8111-111111111111"

/** In-memory server with the same CAS and grow-only rule as the real gateway. */
function server(initial?: Doc, support = true) {
  let revision = initial ? 1 : 0
  let stored: Doc | null = initial ?? null
  const calls: string[] = []
  let race: (() => void) | null = null
  const send = async (request: AccountJournalRequest<Doc>): Promise<AccountJournalResult<Doc>> => {
    calls.push(request.action)
    if (request.action === "minigameProgressSupport") return support ? { ok: true, data: { kind: "minigame-progress-support", version: 1 } } : { ok: false, code: "MINIGAME_PROGRESS_UNSUPPORTED" }
    if (request.action === "read") return stored ? { ok: true, data: { kind: "document", documentId: request.documentId, revision, document: stored } } : { ok: false, code: "NOT_FOUND" }
    if (request.action === "save") {
      if (race) { const run = race; race = null; run() }
      if (request.expectedRevision !== revision) return { ok: true, data: { kind: "conflict", documentId: request.documentId, operationId: request.operationId, currentRevision: revision } }
      if (stored && !validateAccountMinigameProgressUpdate(stored, request.document)) return { ok: false, code: "UNAVAILABLE" }
      stored = request.document; revision += 1
      return { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision } }
    }
    if (request.action === "delete") { stored = null; revision += 1; return { ok: true, data: { kind: "deleted", documentId: request.documentId, revision } } }
    return { ok: false, code: "UNAVAILABLE" }
  }
  return { send, calls, get stored() { return stored }, raceOnce(change: (doc: Doc | null) => Doc) { race = () => { stored = change(stored); revision += 1 } } }
}
const wrap = (data: Doc["data"]): Doc => ({ version: 3, state: "ACCOUNT_STATE", kind: "MINIGAME_PROGRESS", data })

describe("minigame account sync", () => {
  it("uploads device progress to an empty account and reports SYNCED", async () => {
    const fake = server()
    const local = recordCityResult(emptyMinigameProgress(), "seoul", 2, 800)
    const result = await createMinigameProgressSync(OWNER, { send: fake.send }).sync(local)
    expect(result.status).toBe("SYNCED")
    expect(fake.stored?.data.cities.seoul?.stars).toBe(2)
  })
  it("merges a second device instead of overwriting it, and returns the merged copy", async () => {
    const fake = server(wrap(recordCityResult(emptyMinigameProgress(), "daejeon", 3, 1000)))
    const result = await createMinigameProgressSync(OWNER, { send: fake.send }).sync(recordCityResult(emptyMinigameProgress(), "seoul", 1, 300))
    expect(result.status).toBe("SYNCED")
    expect(Object.keys(fake.stored!.data.cities).sort()).toEqual(["daejeon", "seoul"])
    expect(result.progress.cities.daejeon?.stars).toBe(3)
  })
  it("retries after a concurrent write and keeps both writers' stars", async () => {
    const fake = server(wrap(emptyMinigameProgress()))
    fake.raceOnce(() => wrap(recordCityResult(emptyMinigameProgress(), "daegu", 2, 50)))
    const result = await createMinigameProgressSync(OWNER, { send: fake.send }).sync(recordCityResult(emptyMinigameProgress(), "seoul", 1, 300))
    expect(result.status).toBe("SYNCED")
    expect(Object.keys(fake.stored!.data.cities).sort()).toEqual(["daegu", "seoul"])
  })
  it("does not write when nothing changed", async () => {
    const same = recordCityResult(emptyMinigameProgress(), "seoul", 1, 300)
    const fake = server(wrap(same))
    expect((await createMinigameProgressSync(OWNER, { send: fake.send }).sync(same)).status).toBe("SYNCED")
    expect(fake.calls).not.toContain("save")
  })
  it("stays on the device when the server does not support game progress yet", async () => {
    const fake = server(undefined, false)
    const local = recordCityResult(emptyMinigameProgress(), "seoul", 1, 1)
    const result = await createMinigameProgressSync(OWNER, { send: fake.send }).sync(local)
    expect(result).toEqual({ status: "LOCAL_ONLY", progress: local })
    expect(fake.calls).toEqual(["minigameProgressSupport"])
  })
  it("deletes the account copy for an explicit reset", async () => {
    const fake = server(wrap(recordCityResult(emptyMinigameProgress(), "seoul", 1, 1)))
    expect(await createMinigameProgressSync(OWNER, { send: fake.send }).reset()).toBe(true)
    expect(fake.stored).toBeNull()
  })
  it("uses a per-owner namespaced document id and a dedicated kill switch", async () => {
    expect(await minigameProgressDocumentId(OWNER)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
    expect(await minigameProgressDocumentId(OWNER)).not.toBe(await minigameProgressDocumentId("b2222222-2222-4222-8222-222222222222"))
    const signedIn = { preview: () => true, owner: () => OWNER }
    expect(minigameAccountStorageEnabled({}, signedIn)).toBe(true)
    expect(minigameAccountStorageEnabled({ VITE_KILL_MINIGAME_PROGRESS: "true" }, signedIn)).toBe(false)
    expect(minigameAccountStorageEnabled({}, { preview: () => false, owner: () => OWNER })).toBe(false)
    expect(minigameAccountStorageEnabled({}, { preview: () => true, owner: () => null })).toBe(false)
  })
  it("never reaches for reward, point or training modules", () => {
    for (const path of ["src/domain/account/account-minigame-progress-service.ts", "src/domain/account/account-minigame-progress-schema.ts",
      "src/domain/minigame/progress.ts", "src/domain/minigame/progress-store.ts", "src/domain/minigame/tour.ts"]) {
      const source = readFileSync(path, "utf8")
      // Game-local modules (./rewards, ../minigame/*) are fine; app reward/point/training modules are not.
      const imports = [...source.matchAll(/from "([^"]+)"/gu)].map(match => match[1]!).filter(spec => !/^(\.\/(?!.*account)|\.\.\/minigame\/)/u.test(spec))
      for (const spec of imports) expect(spec, path).not.toMatch(/reward|engagement|decoration|journal-storage|plan-|athlete|running-profile|intensity/u)
    }
  })
})
