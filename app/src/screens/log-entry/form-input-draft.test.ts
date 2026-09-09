import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { decodeFormDraft, encodeFormDraft, formDraftDocumentId, formInputSchema, type FormDraftBody } from "./form-input-draft"

const body: FormDraftBody = { format: "TRAINORACLE_FORM_INPUT_V1", context: "synthetic-context",
  entryId: "synthetic-entry", baseSavedAt: null, completed: false, input: { kind: "quick", step: "effort", outcome: "PARTIAL",
    slot: null, rpe: 0, effortAnswered: true, painStatus: "UNANSWERED", painParts: {} } }
beforeEach(() => vi.stubGlobal("crypto", webcrypto))
afterEach(() => vi.unstubAllGlobals())

describe("validated form input DRAFT adapter", () => {
  it("roundtrips skipped RPE independently of a missing answer without creating a journal record", () => {
    const envelope = encodeFormDraft("2026-09-08", body)
    expect(envelope.state).toBe("DRAFT")
    expect(envelope.visibility).toBe("PRIVATE")
    expect(decodeFormDraft(envelope)).toEqual(body)
    const missing = { ...body, input: { ...body.input, effortAnswered: false } }
    expect(decodeFormDraft(encodeFormDraft("2026-09-08", missing))).not.toEqual(body)
    expect(envelope).not.toHaveProperty("entry")
  })
  it("preserves incomplete numeric strings, whitespace, null purpose and null self checks", () => {
    const input = { kind: "race", stage: "pre", record: " 16:", rank: "", result: "", tension: null,
      condition: null, mood: null, paceMinutes: "03.", paceSeconds: "", memo: " synthetic\n", purpose: null } as const
    expect(formInputSchema.parse(input)).toEqual(input)
    expect(decodeFormDraft(encodeFormDraft("2026-09-08", { ...body, input })).input).toEqual(input)
  })
  it.each([
    { ...body, extra: "unexpected" },
    { ...body, input: { ...body.input, rpe: "0" } },
    { ...body, input: { ...body.input, effortAnswered: undefined } },
    { ...body, input: { ...body.input, kind: "finalized" } },
    { ...body, input: { ...body.input, reward: 100 } },
    { ...body, input: { ...body.input, painParts: { fixture: "secret" } } },
  ])("rejects unvalidated payload %# with a content-free error", value => {
    expect(() => encodeFormDraft("2026-09-08", value as FormDraftBody)).toThrow("Invalid form input draft")
  })
  it("rejects ordinary/free-text DRAFT bodies and public visibility", () => {
    const envelope = encodeFormDraft("2026-09-08", body)
    expect(() => decodeFormDraft({ ...envelope, body: "synthetic secret" })).toThrow("Invalid form input draft")
    expect(() => decodeFormDraft({ ...envelope, visibility: "PERSONAL" })).toThrow()
  })
  it("derives stable, owner- and form-context-isolated document IDs", async () => {
    const a = await formDraftDocumentId("owner-a", "race:date-a")
    expect(await formDraftDocumentId("owner-a", "race:date-a")).toBe(a)
    expect(await formDraftDocumentId("owner-b", "race:date-a")).not.toBe(a)
    expect(await formDraftDocumentId("owner-a", "quick:date-a")).not.toBe(a)
    expect(a).toMatch(/^[\da-f]{8}-[\da-f]{4}-5[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
  })
})
