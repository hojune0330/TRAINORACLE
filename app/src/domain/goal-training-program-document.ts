import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { projectGoalTrainingProgramFrames, validateGoalTrainingProgram, type GoalTrainingProgram } from "./goal-training-program"
import { hasCanonicalJsonTree, planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { activePlanEditFingerprint } from "./active-plan-edit-policy"

export const GOAL_PROGRAM_MAX_DOCUMENT_BYTES = 10_000_000
export const GOAL_PROGRAM_MAX_HISTORY = 18
export type GoalTrainingProgramCycle = 1 | 2 | 3
export type GoalTrainingProgramCycleRecord = {
  cycle: GoalTrainingProgramCycle
  status: "PENDING" | "CURRENT" | "ENDED"
  latestPlan: PlanBetaStateV3 | null
  lineage: PlanBetaStateV3[]
}
export type StoredGoalTrainingProgram = {
  version: 1
  revision: number
  program: GoalTrainingProgram
  application: null | { appliedAt: string; currentCycleIndex: GoalTrainingProgramCycle }
  cycles: [GoalTrainingProgramCycleRecord, GoalTrainingProgramCycleRecord, GoalTrainingProgramCycleRecord]
}
export type GoalTrainingProgramHistory = {
  version: 1
  entries: { archivedAt: string; document: StoredGoalTrainingProgram }[]
}
export const goalTrainingProgramStoreFingerprint = (value: unknown) => canonicalJsonFingerprint("trainoracle.goal-training-program-store.v1", value)
const fingerprint = goalTrainingProgramStoreFingerprint
export const goalProgramCycleSchema = z.object({
  cycle: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  status: z.enum(["PENDING", "CURRENT", "ENDED"]),
  latestPlan: planBetaStateV3Schema.nullable(),
  lineage: z.array(planBetaStateV3Schema).max(18),
}).strict()
export const goalProgramApplicationSchema = z.object({
  appliedAt: z.string().datetime(), currentCycleIndex: z.union([z.literal(1), z.literal(2), z.literal(3)]),
}).strict().nullable()
const documentSchema = z.object({
  version: z.literal(1), revision: z.number().int().nonnegative().safe(),
  program: z.custom<GoalTrainingProgram>(value => validateGoalTrainingProgram(value).kind === "valid"),
  application: goalProgramApplicationSchema,
  cycles: z.tuple([goalProgramCycleSchema, goalProgramCycleSchema, goalProgramCycleSchema]),
}).strict()
const sameSelection = (a: PlanBetaStateV3, b: PlanBetaStateV3) => {
  const selection = ({ progress: _progress, explanationReceipt: _explanation, ...rest }: PlanBetaStateV3) => rest
  return fingerprint(selection(a)) === fingerprint(selection(b))
}
const metadata = (state: PlanBetaStateV3) => {
  const { progress: _progress, explanationReceipt: _explanation, activePlanEdit: _edit,
    executionReplan: _replan, catalogReplacement: _replacement, activePlan, ...rest } = state
  const { candidateId: _candidateId, sessions: _sessions, ...plan } = activePlan
  return { ...rest, activePlan: plan }
}
function follows(after: PlanBetaStateV3, before: PlanBetaStateV3): boolean {
  if (sameSelection(after, before)) return true
  const receipt = after.activePlanEdit ?? after.executionReplan ?? after.catalogReplacement
  if (!receipt || receipt.baseCandidateId !== before.activePlan.candidateId
    || fingerprint(metadata(after)) !== fingerprint(metadata(before))
    || fingerprint(receipt.baseSessions) !== fingerprint(before.activePlan.sessions)) return false
  if (after.activePlanEdit) {
    const r = after.activePlanEdit
    return r.baseStateFingerprint === activePlanEditFingerprint({ state: before,
      evidenceFingerprint: r.evidenceFingerprint, journalGuard: r.journalGuard, today: r.today, timeZone: r.timeZone })
  }
  return receipt.baseStateFingerprint === canonicalJsonFingerprint("trainoracle.execution-replan.v1", before)
}
export function resolveGoalTrainingProgramLineage(target: PlanBetaStateV3, original: PlanBetaStateV3, retained: readonly PlanBetaStateV3[]): PlanBetaStateV3[] | null {
  const visit = (state: PlanBetaStateV3, seen: ReadonlySet<string>): PlanBetaStateV3[] | null => {
    if (sameSelection(state, original)) return []
    if (seen.size >= 18 || seen.has(state.activePlan.candidateId)) return null
    const nextSeen = new Set(seen).add(state.activePlan.candidateId)
    for (const before of [original, ...retained]) {
      if (before.activePlan.candidateId === state.activePlan.candidateId || !follows(state, before)) continue
      const previous = visit(before, nextSeen)
      if (previous) return [...previous, before]
    }
    return null
  }
  return visit(target, new Set())
}
export function projectStoredGoalTrainingProgram(document: StoredGoalTrainingProgram) {
  return projectGoalTrainingProgramFrames(document.program, document.program.frames.map((frame, index) => ({
    ...frame, plan: document.cycles[index]!.latestPlan ?? frame.plan,
  })))
}
/** Pure shared client/server reader. It never repairs or activates a transported program. */
export function parseStoredGoalTrainingProgram(value: unknown): StoredGoalTrainingProgram | null {
  try {
    if (!hasCanonicalJsonTree(value) || new TextEncoder().encode(JSON.stringify(value)).byteLength > GOAL_PROGRAM_MAX_DOCUMENT_BYTES) return null
    const parsed = documentSchema.safeParse(value)
    if (!parsed.success) return null
    const document = parsed.data as StoredGoalTrainingProgram
    if (document.application && (new Date(document.application.appliedAt).toISOString() !== document.application.appliedAt
      || Date.parse(document.application.appliedAt) > Date.now())) return null
    const current = document.application?.currentCycleIndex
    for (const [index, cycle] of document.cycles.entries()) {
      if (cycle.cycle !== index + 1) return null
      if (current === undefined) {
        if (cycle.status !== "PENDING" || cycle.latestPlan !== null || cycle.lineage.length) return null
      } else if (cycle.cycle > current) {
        if (cycle.status !== "PENDING" || cycle.latestPlan !== null || cycle.lineage.length) return null
      } else if (!cycle.latestPlan || cycle.status === "PENDING" || cycle.cycle < current && cycle.status !== "ENDED"
        || resolveGoalTrainingProgramLineage(cycle.latestPlan, document.program.frames[index]!.plan, cycle.lineage) === null) return null
    }
    return projectStoredGoalTrainingProgram(document).kind === "ready" ? document : null
  } catch { return null }
}
export function parseGoalTrainingProgramHistory(value: unknown): GoalTrainingProgramHistory | null {
  try {
    if (!hasCanonicalJsonTree(value)) return null
    const parsed = z.object({ version: z.literal(1), entries: z.array(z.object({
      archivedAt: z.string().datetime(), document: z.unknown(),
    }).strict()).max(GOAL_PROGRAM_MAX_HISTORY) }).strict().safeParse(value)
    if (!parsed.success) return null
    const entries: GoalTrainingProgramHistory["entries"] = []
    for (const entry of parsed.data.entries) {
      const document = parseStoredGoalTrainingProgram(entry.document)
      if (!document || new Date(entry.archivedAt).toISOString() !== entry.archivedAt
        || Date.parse(entry.archivedAt) > Date.now()) return null
      entries.push({ archivedAt: entry.archivedAt, document })
    }
    return { version: 1, entries }
  } catch { return null }
}
