import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { accountJournalDraftSchema, createAccountJournalDraftBuffer } from "./account-journal-draft-buffer"
import type { AccountJournalDraft, AccountJournalDraftBuffer } from "./account-journal-draft-buffer"

// Node-hosted schema/refusal tests only. The repository's shared setup needs jsdom.
// Use real Node Web Crypto, not a crypto mock. There is no IndexedDB emulator here.
// REQUIRED browser evidence (parent harness): reopen/reload, structured-cloned
// nonextractable keys, two-tab key creation/save CAS, fixed retries + late ack,
// owner isolation/logout during crypto and IDB, corrupt records/keys/ciphertext,
// remote dirty/clean/racing imports, quota/abort failure and no plaintext at rest.
const owner = "11111111-1111-4111-8111-111111111111"
const doc = "22222222-2222-4222-8222-222222222222"
const operation = "33333333-3333-4333-8333-333333333333"
const draft: AccountJournalDraft = {
  version: 1, state: "DRAFT", visibility: "PRIVATE", date: "2024-02-29", title: "", body: "Synthetic draft",
}

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto)
  vi.stubGlobal("CryptoKey", webcrypto.CryptoKey)
})
afterEach(() => vi.unstubAllGlobals())

describe("accountJournalDraftSchema", () => {
  it.each(["PRIVATE", "PERSONAL"] as const)("accepts %s drafts without changing content", visibility => {
    const input = { ...draft, visibility, title: "  Title  ", body: "Line 1\nLine 2  " }
    expect(accountJournalDraftSchema.parse(input)).toEqual(input)
  })

  it("accepts exact title/body limits and empty drafts", () => {
    expect(accountJournalDraftSchema.safeParse({ ...draft, title: "t".repeat(200), body: "b".repeat(100_000) }).success).toBe(true)
    expect(accountJournalDraftSchema.safeParse({ ...draft, title: "", body: "" }).success).toBe(true)
  })

  it.each([
    { version: 2 }, { state: "COMPLETED" }, { visibility: "PUBLIC" },
    { date: "2023-02-29" }, { date: "2024-04-31" }, { date: "2024-13-01" },
    { date: "2024-2-29" }, { date: "2024-02-29T00:00:00Z" },
    { title: "t".repeat(201) }, { body: "b".repeat(100_001) },
    { title: null }, { body: 4 }, { date: undefined }, { extra: true },
    { ownerId: owner }, { operationId: operation },
  ])("refuses invalid draft patch %#", patch => {
    expect(accountJournalDraftSchema.safeParse({ ...draft, ...patch }).success).toBe(false)
  })

  it.each(Object.keys(draft))("requires %s", field => {
    const incomplete: Record<string, unknown> = { ...draft }
    delete incomplete[field]
    expect(accountJournalDraftSchema.safeParse(incomplete).success).toBe(false)
  })

  it.each([null, undefined, [], "draft", 1])("refuses non-object input %#", input => {
    expect(accountJournalDraftSchema.safeParse(input).success).toBe(false)
  })
})

// This sentinel only proves pre-I/O refusal, not any storage or durability behavior.
function unopenedBuffer() {
  const open = vi.fn(() => { throw new Error("STORAGE_SENTINEL") })
  const factory = { open } as unknown as IDBFactory
  return { buffer: createAccountJournalDraftBuffer(factory), open }
}

const ownerCalls: Array<[string, (buffer: AccountJournalDraftBuffer, id: string) => Promise<unknown>]> = [
  ["saveDraft", (buffer, id) => buffer.saveDraft(id, doc, draft)],
  ["read", (buffer, id) => buffer.read(id, doc)],
  ["list", (buffer, id) => buffer.list(id)],
  ["queue", (buffer, id) => buffer.queue(id, doc, operation)],
  ["ack", (buffer, id) => buffer.ack(id, doc, operation, 1)],
  ["conflict", (buffer, id) => buffer.conflict(id, doc, operation, 2)],
  ["importRemote", (buffer, id) => buffer.importRemote(id, doc, draft, 1)],
  ["clear", (buffer, id) => buffer.clear(id, doc)],
]

describe("draft buffer refusal before storage", () => {
  it("requires IndexedDB and Web Crypto without memory fallback", () => {
    vi.stubGlobal("indexedDB", undefined)
    expect(() => createAccountJournalDraftBuffer()).toThrow("IndexedDB unavailable")
    vi.stubGlobal("crypto", undefined)
    expect(() => unopenedBuffer()).toThrow("Web Crypto unavailable")
  })

  it("uses the default global factory lazily", async () => {
    const open = vi.fn(() => { throw new Error("STORAGE_SENTINEL") })
    vi.stubGlobal("indexedDB", { open })
    const buffer = createAccountJournalDraftBuffer()
    expect(open).not.toHaveBeenCalled()
    await expect(buffer.read(owner, doc)).rejects.toThrow("STORAGE_SENTINEL")
    expect(open).toHaveBeenCalledExactlyOnceWith("trainoracle-account-journal-drafts-v1", 1)
    buffer.close()
  })

  it.each(ownerCalls)("%s refuses invalid owners before opening storage", async (_name, call) => {
    const { buffer, open } = unopenedBuffer()
    await expect(call(buffer, "not-an-owner")).rejects.toThrow()
    expect(open).not.toHaveBeenCalled()
  })

  it.each(ownerCalls)("%s refuses disposed owner scope", async (_name, call) => {
    const { buffer, open } = unopenedBuffer()
    buffer.logout(owner)
    await expect(call(buffer, owner)).rejects.toThrow("scope disposed")
    expect(open).not.toHaveBeenCalled()
  })

  it.each(ownerCalls)("%s refuses a closed instance", async (_name, call) => {
    const { buffer, open } = unopenedBuffer()
    buffer.close()
    await expect(call(buffer, owner)).rejects.toThrow("scope disposed")
    expect(open).not.toHaveBeenCalled()
  })

  it("logout does not dispose another owner or erase storage", async () => {
    const { buffer, open } = unopenedBuffer()
    buffer.logout(doc)
    expect(open).not.toHaveBeenCalled()
    await expect(buffer.read(owner, doc)).rejects.toThrow("STORAGE_SENTINEL")
  })

  it("refuses invalid document and operation identifiers", async () => {
    const { buffer, open } = unopenedBuffer()
    await expect(buffer.saveDraft(owner, "bad", draft)).rejects.toThrow()
    await expect(buffer.read(owner, "bad")).rejects.toThrow()
    await expect(buffer.queue(owner, doc, "bad")).rejects.toThrow()
    await expect(buffer.ack(owner, doc, "bad", 1)).rejects.toThrow()
    await expect(buffer.conflict(owner, doc, "bad", 1)).rejects.toThrow()
    expect(open).not.toHaveBeenCalled()
  })

  it("refuses invalid drafts without leaking their contents into errors", async () => {
    const { buffer, open } = unopenedBuffer()
    const invalid = { ...draft, body: "sensitive-synthetic-value", visibility: "PUBLIC" } as unknown as AccountJournalDraft
    await expect(buffer.saveDraft(owner, doc, invalid)).rejects.toThrow(/^Invalid journal draft$/)
    await expect(buffer.importRemote(owner, doc, invalid, 1)).rejects.toThrow(/^Invalid journal draft$/)
    expect(open).not.toHaveBeenCalled()
  })

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])("refuses unsafe server revisions %#", async value => {
    const { buffer, open } = unopenedBuffer()
    await expect(buffer.ack(owner, doc, operation, value)).rejects.toThrow()
    await expect(buffer.conflict(owner, doc, operation, value)).rejects.toThrow()
    await expect(buffer.importRemote(owner, doc, draft, value)).rejects.toThrow()
    expect(open).not.toHaveBeenCalled()
  })

  it("refuses revision zero for a remote existing document", async () => {
    const { buffer, open } = unopenedBuffer()
    await expect(buffer.importRemote(owner, doc, draft, 0)).rejects.toThrow()
    expect(open).not.toHaveBeenCalled()
  })

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("refuses invalid expected local sequence %# before storage", async value => {
    const { buffer, open } = unopenedBuffer()
    await expect(buffer.saveDraft(owner, doc, draft, value)).rejects.toThrow()
    expect(open).not.toHaveBeenCalled()
  })
})
