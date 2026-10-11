import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree } from "../plan-beta-schema"
import { validateGoalTrainingProgram, type GoalTrainingProgram } from "../goal-training-program"
import { goalProgramApplicationSchema, goalProgramCycleSchema, parseStoredGoalTrainingProgram,
  type StoredGoalTrainingProgram, type GoalTrainingProgramHistory } from "../goal-training-program-document"

export const ACCOUNT_GOAL_PROGRAM_NAMESPACE = "trainoracle.account.goal-program.v1"
export const ACCOUNT_GOAL_PROGRAM_BUFFER = "trainoracle-account-goal-program-v1"
export const ACCOUNT_GOAL_PROGRAM_MAX_BYTES = 500_000
const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const programIdSchema = z.string().regex(/^goal-program:sha256:[a-f0-9]{64}$/u)
const hash = (value: unknown) => canonicalJsonFingerprint(ACCOUNT_GOAL_PROGRAM_NAMESPACE, value)
export const accountGoalProgramFingerprint = hash
const shell = { version: z.literal(3), state: z.literal("ACCOUNT_STATE") }
const bodyWire = z.object({ ...shell, kind: z.literal("GOAL_PROGRAM_BODY"), data: z.object({
  id: hashSchema, programId: programIdSchema,
  program: z.custom<GoalTrainingProgram>(value => validateGoalTrainingProgram(value).kind === "valid"),
}).strict() }).strict()
const progressWire = z.object({ ...shell, kind: z.literal("GOAL_PROGRAM_PROGRESS"), data: z.object({
  id: hashSchema, bodyId: hashSchema, programId: programIdSchema,
  revision: z.number().int().nonnegative().safe(), application: goalProgramApplicationSchema,
  cycles: z.tuple([goalProgramCycleSchema, goalProgramCycleSchema, goalProgramCycleSchema]),
}).strict() }).strict()
const referenceWire = z.object({ programId: programIdSchema, bodyId: hashSchema, progressId: hashSchema }).strict()
const indexWire = z.object({ ...shell, kind: z.literal("GOAL_PROGRAM_INDEX"), data: z.object({
  schemaVersion: z.literal(1), current: referenceWire.nullable(),
  history: z.array(z.object({ archivedAt: z.iso.datetime(), reference: referenceWire }).strict()).max(18),
}).strict() }).strict()
export type AccountGoalProgramBody = z.infer<typeof bodyWire>
export type AccountGoalProgramProgress = z.infer<typeof progressWire>
export type AccountGoalProgramIndex = z.infer<typeof indexWire>
export type AccountGoalProgramReference = z.infer<typeof referenceWire>
export type AccountGoalProgramDocument = AccountGoalProgramBody | AccountGoalProgramProgress | AccountGoalProgramIndex
export type AccountGoalProgramCollection = { index: AccountGoalProgramIndex; parts: (AccountGoalProgramBody | AccountGoalProgramProgress)[] }
export const emptyAccountGoalProgramIndex = (): AccountGoalProgramIndex => ({ version: 3, state: "ACCOUNT_STATE",
  kind: "GOAL_PROGRAM_INDEX", data: { schemaVersion: 1, current: null, history: [] } })
export function accountGoalProgramReferences(index: AccountGoalProgramIndex): AccountGoalProgramReference[] {
  return [...(index.data.current ? [index.data.current] : []), ...index.data.history.map(entry => entry.reference)]
}
const fits = (value: unknown) => hasCanonicalJsonTree(value)
  && new TextEncoder().encode(JSON.stringify(value)).byteLength <= ACCOUNT_GOAL_PROGRAM_MAX_BYTES
const partHash = (value: AccountGoalProgramBody | AccountGoalProgramProgress) => {
  const { id: _id, ...data } = value.data
  return hash({ ...value, data })
}
export function validateAccountGoalProgramDocument(value: unknown): value is AccountGoalProgramDocument {
  try {
    if (!fits(value)) return false
    const kind = (value as AccountGoalProgramDocument).kind
    if (kind === "GOAL_PROGRAM_BODY") {
      const parsed = bodyWire.safeParse(value)
      return parsed.success && parsed.data.data.programId === parsed.data.data.program.programId
        && parsed.data.data.id === partHash(parsed.data)
    }
    if (kind === "GOAL_PROGRAM_PROGRESS") {
      const parsed = progressWire.safeParse(value)
      return parsed.success && parsed.data.data.id === partHash(parsed.data)
    }
    const parsed = indexWire.safeParse(value)
    if (!parsed.success) return false
    const references = accountGoalProgramReferences(parsed.data)
    return new Set(references.map(reference => hash(reference))).size === references.length
      && parsed.data.data.history.every(entry => new Date(entry.archivedAt).toISOString() === entry.archivedAt
        && Date.parse(entry.archivedAt) <= Date.now())
  } catch { return false }
}
export const accountGoalProgramDocumentSchema = z.custom<AccountGoalProgramDocument>(validateAccountGoalProgramDocument)
export function validateAccountGoalProgramDocumentUpdate(previous: unknown, next: unknown): boolean {
  if (!validateAccountGoalProgramDocument(previous) || !validateAccountGoalProgramDocument(next) || previous.kind !== next.kind) return false
  if (previous.kind !== "GOAL_PROGRAM_INDEX" || next.kind !== "GOAL_PROGRAM_INDEX") return hash(previous) === hash(next)
  // An acknowledged archive or a replaced original can never silently disappear.
  if (!previous.data.history.every(old => next.data.history.some(row => hash(row) === hash(old)))) return false
  const old = previous.data.current, current = next.data.current
  if (!old) return true
  if (current?.bodyId === old.bodyId && current.programId === old.programId) return true
  return next.data.history.some(row => row.reference.bodyId === old.bodyId && row.reference.programId === old.programId)
}
export function splitAccountGoalProgram(document: StoredGoalTrainingProgram) {
  const validated = parseStoredGoalTrainingProgram(document)
  if (!validated) throw Error("INVALID_GOAL_PROGRAM_DOCUMENT")
  const body: AccountGoalProgramBody = { version: 3, state: "ACCOUNT_STATE", kind: "GOAL_PROGRAM_BODY",
    data: { id: "", programId: validated.program.programId, program: validated.program } }
  body.data.id = partHash(body)
  const progress: AccountGoalProgramProgress = { version: 3, state: "ACCOUNT_STATE", kind: "GOAL_PROGRAM_PROGRESS",
    data: { id: "", bodyId: body.data.id, programId: validated.program.programId,
      revision: validated.revision, application: validated.application, cycles: validated.cycles } }
  progress.data.id = partHash(progress)
  if (!validateAccountGoalProgramDocument(body) || !validateAccountGoalProgramDocument(progress)) throw Error("GOAL_PROGRAM_PART_CAPACITY")
  return { body, progress, reference: { programId: body.data.programId, bodyId: body.data.id, progressId: progress.data.id } }
}
export function joinAccountGoalProgram(reference: AccountGoalProgramReference, body: unknown, progress: unknown): StoredGoalTrainingProgram | null {
  if (!validateAccountGoalProgramDocument(body) || body.kind !== "GOAL_PROGRAM_BODY"
    || !validateAccountGoalProgramDocument(progress) || progress.kind !== "GOAL_PROGRAM_PROGRESS"
    || body.data.id !== reference.bodyId || progress.data.id !== reference.progressId
    || body.data.programId !== reference.programId || progress.data.programId !== reference.programId
    || progress.data.bodyId !== body.data.id) return null
  return parseStoredGoalTrainingProgram({ version: 1, revision: progress.data.revision,
    program: body.data.program, application: progress.data.application, cycles: progress.data.cycles })
}
export function splitAccountGoalProgramCollection(document: StoredGoalTrainingProgram, history: GoalTrainingProgramHistory): AccountGoalProgramCollection {
  const current = splitAccountGoalProgram(document), parts = new Map<string, AccountGoalProgramBody | AccountGoalProgramProgress>()
  const retain = (value: ReturnType<typeof splitAccountGoalProgram>) => {
    parts.set(value.body.data.id, value.body); parts.set(value.progress.data.id, value.progress)
    return value.reference
  }
  const index: AccountGoalProgramIndex = { version: 3, state: "ACCOUNT_STATE", kind: "GOAL_PROGRAM_INDEX", data: {
    schemaVersion: 1, current: retain(current), history: history.entries.map(entry => ({
      archivedAt: entry.archivedAt, reference: retain(splitAccountGoalProgram(entry.document)),
    })),
  } }
  if (!validateAccountGoalProgramDocument(index)) throw Error("INVALID_GOAL_PROGRAM_COLLECTION")
  return { index, parts: [...parts.values()] }
}
export function joinAccountGoalProgramCollection(index: AccountGoalProgramIndex, parts: readonly AccountGoalProgramDocument[]) {
  if (!validateAccountGoalProgramDocument(index) || index.kind !== "GOAL_PROGRAM_INDEX") return null
  const part = (id: string) => parts.find(value => value.kind !== "GOAL_PROGRAM_INDEX" && value.data.id === id)
  const read = (reference: AccountGoalProgramReference) => joinAccountGoalProgram(reference, part(reference.bodyId), part(reference.progressId))
  const document = index.data.current ? read(index.data.current) : null
  if (index.data.current && !document) return null
  const entries: GoalTrainingProgramHistory["entries"] = []
  for (const entry of index.data.history) {
    const archived = read(entry.reference)
    if (!archived) return null
    entries.push({ archivedAt: entry.archivedAt, document: archived })
  }
  return { document, history: { version: 1 as const, entries } }
}
/** Resolve both immutable progress snapshots before accepting a pointer change. */
export function validateAccountGoalProgramCollectionUpdate(previous: AccountGoalProgramIndex, previousParts: readonly AccountGoalProgramDocument[],
  next: AccountGoalProgramIndex, nextParts: readonly AccountGoalProgramDocument[]): boolean {
  if (!validateAccountGoalProgramDocumentUpdate(previous, next)) return false
  const before = joinAccountGoalProgramCollection(previous, previousParts), after = joinAccountGoalProgramCollection(next, nextParts)
  if (!before || !after) return false
  if (!before.document || !after.document) return true
  const old = before.document, value = after.document
  if (hash(old) === hash(value)) return true
  if (value.revision <= old.revision) return false
  if (previous.data.current!.bodyId !== next.data.current!.bodyId) return true
  const oldCycle = old.application?.currentCycleIndex, cycle = value.application?.currentCycleIndex
  if (oldCycle !== undefined && (cycle === undefined || cycle < oldCycle || cycle > oldCycle + 1)) return false
  if (oldCycle === undefined && cycle !== undefined && cycle !== 1) return false
  if (oldCycle !== undefined && cycle === oldCycle + 1 && old.cycles[oldCycle - 1]!.status !== "ENDED") return false
  return old.cycles.every((row, index) => row.status !== "ENDED" || value.cycles[index]!.status === "ENDED")
}
/** Physical names are derived from both owner and immutable content identity. */
export async function accountGoalProgramDocumentId(ownerId: string, kind: AccountGoalProgramDocument["kind"] = "GOAL_PROGRAM_INDEX", id?: string) {
  if (!z.uuid().safeParse(ownerId).success || kind !== "GOAL_PROGRAM_INDEX" && !hashSchema.safeParse(id).success) throw Error("INVALID_GOAL_PROGRAM_IDENTITY")
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(
    JSON.stringify([ACCOUNT_GOAL_PROGRAM_NAMESPACE, ownerId.toLowerCase(), kind, kind === "GOAL_PROGRAM_INDEX" ? null : id]))))
  bytes[6] = (bytes[6]! & 15) | 80; bytes[8] = (bytes[8]! & 63) | 128
  const h = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
