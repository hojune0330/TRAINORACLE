import { z } from "zod"
import { accountJournalDraftSchema, createAccountDocumentBuffer } from "../../domain/account/account-journal-draft-buffer"
import { objectiveLoadComponentSchema } from "../../domain/intensity-assessment"
import { FORM_INPUT_DRAFT_TITLE } from "./form-draft-marker"

const text = z.string().max(10_000)
const rpe = z.number().int().min(0).max(10)
const mood = z.number().int().min(0).max(5)
const pain = z.record(z.string().max(80), z.number().int().min(0).max(5))
const purpose = z.enum(["PRIVATE_SELF_ONLY", "ANALYZABLE_TRAINING_NOTE"]).nullable()
const outcome = z.enum(["COMPLETED", "PARTIAL", "LIGHT_ACTIVITY", "RESTED", "SKIPPED"])
const slot = z.enum(["UNSPECIFIED", "AM", "PM"])
const painStatus = z.enum(["UNANSWERED", "NO_SIGNAL_REPORTED", "SIGNAL_REPORTED"])
const memo = { memo: z.string().max(50_000), purpose }
export const objectiveEditorDraftSchema = z.object({
  kind: z.enum(["RUNNING", "INTERVALS", "STRENGTH", "PLYOMETRIC", "HILLS", "CROSS_TRAINING"]),
  fields: z.object({
    distanceKm: text.optional(), actualPace: text.optional(), typicalDistanceKm: text.optional(),
    referencePace: text.optional(), repetitions: text.optional(), workSeconds: text.optional(),
    recoverySeconds: text.optional(), exerciseType: text.optional(), sets: text.optional(),
    loadPercent1Rm: text.optional(), repsInReserve: text.optional(), contacts: text.optional(),
    typicalContacts: text.optional(), gradePercent: text.optional(), modality: text.optional(),
    durationMin: text.optional(), heartRatePercent: text.optional(),
  }).strict(),
}).strict()
export type ObjectiveEditorDraft = z.infer<typeof objectiveEditorDraftSchema>

// These are input schemas, not completed JournalEntry schemas: empty and partial
// strings and the quick form's explicit skipped answer survive without coercion.
export const formInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("evening"), sleep: z.number().min(0).max(24), quality: mood,
    mood, painParts: pain, weight: text, hr: text, ...memo }).strict(),
  z.object({ kind: z.literal("race"), stage: z.enum(["pre", "post"]), record: text,
    rank: text, result: text, tension: rpe.nullable(), condition: mood.nullable(),
    mood: mood.nullable(), paceMinutes: text, paceSeconds: text, ...memo }).strict(),
  z.object({ kind: z.literal("post-session"), rpe, activityOutcome: outcome.nullable(),
    activitySlot: slot.nullable(), painCheckStatus: painStatus, painParts: pain,
    system: text, title: text, distanceKm: text, durationMin: text, avgPace: text,
    plannedRpe: rpe, objectiveComponents: z.array(objectiveLoadComponentSchema).max(6),
    objectiveEditor: objectiveEditorDraftSchema, ...memo }).strict(),
  z.object({ kind: z.literal("quick"), step: z.enum(["activity", "effort"]),
    outcome: outcome.nullable(), slot: slot.nullable(), rpe, effortAnswered: z.boolean(),
    painStatus, painParts: pain }).strict(),
])
export type FormInput = z.infer<typeof formInputSchema>
export type FormKind = FormInput["kind"]
export const formDraftBodySchema = z.object({
  format: z.literal("TRAINORACLE_FORM_INPUT_V1"), context: z.string().max(20_000),
  entryId: z.string().min(1).max(200), completed: z.boolean(), input: formInputSchema,
  baseSavedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict()
export type FormDraftBody = z.infer<typeof formDraftBodySchema>

export function decodeFormDraft(value: unknown): FormDraftBody {
  try {
    const envelope = accountJournalDraftSchema.parse(value)
    if (envelope.visibility !== "PRIVATE" || envelope.title !== FORM_INPUT_DRAFT_TITLE) throw new Error()
    return formDraftBodySchema.parse(JSON.parse(envelope.body))
  } catch { throw new Error("Invalid form input draft") }
}
export const formDraftEnvelopeSchema = accountJournalDraftSchema.refine(value => {
  try { decodeFormDraft(value); return true } catch { return false }
}, "Invalid form input draft")

export function encodeFormDraft(date: string, value: FormDraftBody) {
  const parsed = formDraftBodySchema.safeParse(value)
  if (!parsed.success) throw new Error("Invalid form input draft")
  const envelope = { version: 1 as const, state: "DRAFT" as const, visibility: "PRIVATE" as const,
    date, title: FORM_INPUT_DRAFT_TITLE, body: JSON.stringify(parsed.data) }
  if (!formDraftEnvelopeSchema.safeParse(envelope).success) throw new Error("Invalid form input draft")
  return envelope
}

export function createFormDraftBuffer() {
  return createAccountDocumentBuffer(formDraftEnvelopeSchema, "trainoracle-form-input-drafts-v1")
}

export async function formDraftDocumentId(owner: string, context: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(JSON.stringify(["trainoracle.form-input.v1", owner, context]))))
  bytes[6] = (bytes[6]! & 15) | 80
  bytes[8] = (bytes[8]! & 63) | 128
  const h = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
