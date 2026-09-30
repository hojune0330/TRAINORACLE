import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout, calculatedWorkoutSequence,
  compareCatalogPerformance, verifyCalculatedWorkout } from "@impl/prescription/all-workout-calculator"
import { catalogRecommendationMethodKey } from "@impl/prescription/catalog-method-selection"
import type { CalculatedWorkout, WorkoutCalculationInputs, WorkoutCatalogEntry } from "@impl/prescription/all-workout-calculator"
import { bindCatalogSession, catalogFamilyForIntent, catalogRpe, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { PrescriptionSequenceV3, RecoveryStepV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { rebindCandidatePairIdentity } from "@impl/plan-generator/candidate-identity"
import type { PlanSession, PlanGenerationSuccess } from "@impl/plan-generator/types"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { savePlanBetaState, loadPlanBetaState, activePlanBetaStorageKey } from "./plan-beta-store"
import type { PlanBetaIntake } from "./plan-beta-store"
import { parsePlanBetaState } from "./plan-beta-schema"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { sessionWorkoutNotation, sequenceNotation } from "./workout-notation"
import { createSelfReportedAthleteRecord, saveAthleteRecord } from "./athlete-records"
import { replayExecutionReplan } from "./execution-replan-policy"
import type { ExecutionReplanReceipt } from "./execution-replan-policy"
import { CatalogWorkoutPicker } from "../screens/plan-beta/CatalogWorkoutPicker"
import { CatalogWorkoutDetail } from "../screens/plan-beta/CatalogWorkoutDetail"

// The audit never enables account storage or calls an external service.
vi.mock("./account/account-plan-service", () => ({ accountPlansEnabled: () => false, accountPlanService: () => null }))
vi.mock("./account/plan-cloud-backup", () => ({ backupActivePlanToServer: vi.fn(), archivePlanOnServer: vi.fn() }))

const configuredRepo = process.env.TRAINORACLE_PERSONA_AUDIT_REPO
if (!configuredRepo) throw new Error("Run the persona audit with its explicit configuration")
const repo = resolve(configuredRepo)
const git = (...args: string[]) => execFileSync("git", ["-c", `safe.directory=${repo.replaceAll("\\", "/")}`, ...args], { cwd: repo, encoding: "utf8" }).trim()
const BASELINE = git("rev-parse", "HEAD")
const RUNTIME = "WORKING_TREE_NOT_DEPLOYED"
const DIRTY = git("status", "--porcelain").length > 0
const ROOT_SEED = 0x09302026
const AT = new Date("2026-09-30T03:00:00.000Z")
const runId = process.env.TRAINORACLE_PERSONA_AUDIT_RUN ?? new Date().toISOString().replaceAll(/[:.]/gu, "-")
if (!/^[a-zA-Z0-9_-]{1,80}$/u.test(runId)) throw new Error("Invalid persona audit run identifier")
const OUT = `${resolve(repo, `.scratch/persona-100-core-${runId}`)}/`
const EVENTS = [800, 1500, 3000, 5000, 10000, 21097, 42195] as const
const FOCI = ["BASE_INTENT", "LT_INTENT", "VO2_INTENT", "GLY_INTENT", "ATP_PC_INTENT", "MIXED_INTENT", "RECOVERY_INTENT"] as const
const EXPERIENCES = ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const
type Persona = { id: string; seed: number; syntheticAge: number; draft: PlanBetaIntake;
  recordMode: "absent" | "current" | "stale" | "decimal"; recordSeconds: number;
  risk: "none" | "contraindication" | "unknown"; missing: keyof PlanBetaIntake | null }
type Failure = { code: string; detail: unknown }
type Audit = { id: string; seed: number; persona: Persona; checks: number; failures: Failure[];
  generation?: string; catalog: unknown[]; actions: unknown[]; observations: unknown[] }
const audits: Audit[] = []
const namedEvidence: { name: string; detail: unknown }[] = []
let networkCalls = 0
type IsolatedDom = { window: Window }
const JSDOM = createRequire(resolve(repo, "app/package.json"))("jsdom").JSDOM as new (html: string, options: { url: string }) => IsolatedDom
let isolated: IsolatedDom | null = null
const originalWindow = window

function rng(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let x = Math.imul(state ^ state >>> 15, 1 | state)
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x)
    return ((x ^ x >>> 14) >>> 0) / 4294967296
  }
}
const pick = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)]!
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value !== null && typeof value === "object") {
    const row = value as Record<string, unknown>
    return `{${Object.keys(row).filter(k => row[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stable(row[k])}`).join(",")}}`
  }
  return JSON.stringify(value)
}
const same = (a: unknown, b: unknown) => stable(a) === stable(b)
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-8, Math.abs(b) * 1e-12)
const address = (s: { day: number; slot: string }) => `${s.day}:${s.slot}`
function check(a: Audit, condition: boolean, code: string, detail: unknown) {
  a.checks++
  if (!condition) a.failures.push({ code, detail })
}
function artifact(name: string, value: unknown) {
  mkdirSync(OUT, { recursive: true })
  writeFileSync(`${OUT}${name}.json`, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}
const personas: Persona[] = Array.from({ length: 100 }, (_, i) => {
  const seed = (ROOT_SEED ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0
  const random = rng(seed), event = EVENTS[i % EVENTS.length]!
  const syntheticAge = [12, 15, 17, 22, 34, 51, 67][Math.floor(i / 7) % 7]!
  return { id: `P${String(i + 1).padStart(3, "0")}`, seed, syntheticAge,
    draft: { eventGroup: event <= 3000 ? "MIDDLE_DISTANCE" : event === 5000 ? "FIVE_K" : event === 10000 ? "TEN_K" : "GENERAL_ENDURANCE",
      eventDistanceM: event, competitionDivision: syntheticAge < 14 ? "ELEMENTARY" : syntheticAge < 17 ? "MIDDLE_SCHOOL"
        : syntheticAge < 20 ? "HIGH_SCHOOL" : syntheticAge >= 50 ? "MASTERS" : "OPEN",
      experienceBand: EXPERIENCES[Math.floor(i / 3) % 3]!, availableDayCount: [3, 4, 5, 6, "EVERY_DAY"][i % 5] as PlanBetaIntake["availableDayCount"],
      requestedFrameLength: [7, 9, 10][i % 3] as 7 | 9 | 10, trainingFocus: FOCI[Math.floor(i / 7) % 7]!,
      secondSessionMode: i % 2 ? "RECOVERY_PM_ALLOWED" : "SINGLE_SESSION_ONLY",
      trainingTimePreference: ["MORNING", "EVENING", "VARIES"][Math.floor(i / 2) % 3] as PlanBetaIntake["trainingTimePreference"],
      selectedDetailedTemplateRef: null, startDate: "2026-09-30" },
    recordMode: ["absent", "current", "stale", "decimal"][i % 4] as Persona["recordMode"],
    recordSeconds: 900 + Math.floor(random() * 2700) + (i % 4 === 3 ? 0.731 : 0),
    risk: i % 13 === 0 ? "contraindication" : i % 19 === 0 ? "unknown" : "none",
    missing: i % 17 === 0 ? ["experienceBand", "availableDayCount", "trainingFocus"][Math.floor(i / 17) % 3] as keyof PlanBetaIntake : null }
})

function inputsFor(p: Persona, budget: number | null = null): WorkoutCalculationInputs {
  return { eventDistanceM: p.draft.eventDistanceM, experience: p.draft.experienceBand, availableSeconds: budget,
    confirmedRequirements: [], segmentPaces: [], fiveK: p.recordMode === "absent" ? null : {
      recordId: `synthetic-${p.id}-5k`, seconds: p.recordSeconds,
      achievedAt: p.recordMode === "stale" ? "2020-01-02" : "2026-09-01", evaluatedAt: "2026-09-30" } }
}

// A weighted source-tree ledger, independent of the production expansion/totals helpers.
type LedgerRow = { phase: "warmup" | "main" | "cooldown"; segmentId: string; kind: string;
  count: number; distanceM: number | null; sourceSeconds: number | null; context?: WorkoutCatalogEntry["segments"][number] }
function sourceLedger(entry: WorkoutCatalogEntry): LedgerRow[] {
  if (!entry.sequence) return []
  const rows: LedgerRow[] = []
  for (const phase of ["warmup", "main", "cooldown"] as const) {
    const rest = (items: readonly RecoveryStepV3[], prefix: string, count: number) => items.forEach((item, index) => {
      if (count) rows.push({ phase, segmentId: `${prefix}:recovery-${index}`, kind: "RECOVERY", count,
        distanceM: "distanceM" in item ? item.distanceM : null, sourceSeconds: item.seconds })
    })
    const walk = (nodes: readonly SequenceNodeV3[], multiplicity: number) => nodes.forEach(node => {
      const workCount = multiplicity * node.repeatCount
      if (node.kind === "group") walk(node.children, workCount)
      else rows.push({ phase, segmentId: node.id, kind: node.role, count: workCount,
        distanceM: node.work.distanceM, sourceSeconds: node.work.durationSeconds,
        context: entry.segments.find(s => s.segmentId === node.id) })
      rest(node.recoveryBetweenRepeats, `${node.id}:between`, multiplicity * (node.repeatCount - 1))
      rest(node.recoveryAfter, `${node.id}:after`, multiplicity)
    })
    walk(entry.sequence[phase], 1)
  }
  return rows
}
function sourceOrder(sequence: PrescriptionSequenceV3 | null): string[] {
  if (!sequence) return []
  const expand = (nodes: readonly SequenceNodeV3[], phase: string): string[] => nodes.flatMap(node => {
    const body = node.kind === "segment" ? [`${phase}:${node.id}:${node.role}`] : expand(node.children, phase)
    const gaps = node.recoveryBetweenRepeats.map((_, i) => `${phase}:${node.id}:between:recovery-${i}:RECOVERY`)
    return Array.from({ length: node.repeatCount }, (_, i) => i ? [...gaps, ...body] : body).flat()
      .concat(node.recoveryAfter.map((_, i) => `${phase}:${node.id}:after:recovery-${i}:RECOVERY`))
  })
  return (["warmup", "main", "cooldown"] as const).flatMap(phase => expand(sequence[phase], phase))
}
function expectedSeconds(row: LedgerRow, input: WorkoutCalculationInputs): { minimum: number; maximum: number } | null {
  const scalar = (seconds: number) => ({ minimum: seconds, maximum: seconds })
  if (row.kind === "RECOVERY") {
    const seconds = row.sourceSeconds ?? input.recoverySeconds?.find(s => s.segmentId === row.segmentId)?.seconds
    return seconds == null ? null : scalar(seconds)
  }
  if (row.sourceSeconds !== null) return scalar(row.sourceSeconds)
  const direct = input.segmentSeconds?.find(s => s.segmentId === row.segmentId)
  if (direct) return scalar(direct.seconds)
  const c = row.context
  const eligible = c?.modality === "RUN" && c.terrain === "FLAT" && !["ATP-PC", "ATP_PC", "TECHNIQUE"].includes(c.intent)
    && row.distanceM !== null && row.distanceM >= 60
  if (!eligible) return null
  const explicit = input.segmentPaces.find(s => s.segmentId === row.segmentId)
  if (explicit) return scalar(row.distanceM! / 1000 * explicit.secondsPerKm)
  const record = input.fiveK
  // All current/stale fixtures are well away from the existing 18-month boundary.
  if (!record || record.achievedAt === "2020-01-02") return null
  if (c!.intent === "VO2") {
    const seconds = row.distanceM! * record.seconds / 5000
    return seconds <= 300 ? scalar(seconds) : null
  }
  if (c!.intent === "LT") {
    const minimum = row.distanceM! / 1000 * (record.seconds / 5 + 24 * 1000 / 1609.344)
    const maximum = row.distanceM! / 1000 * (record.seconds / 5 + 30 * 1000 / 1609.344)
    return maximum <= 1200 ? { minimum, maximum } : null
  }
  return null
}
function auditCalculation(a: Audit, entry: WorkoutCatalogEntry, result: CalculatedWorkout) {
  const ledger = sourceLedger(entry)
  check(a, same(result.steps.map(s => `${s.phase}:${s.segmentId}:${s.kind}`), sourceOrder(entry.sequence)), "SEQUENCE_ORDER", entry.id)
  for (const row of ledger) {
    const actual = result.steps.filter(s => s.phase === row.phase && s.segmentId === row.segmentId && s.kind === row.kind)
    check(a, actual.length === row.count, "SOURCE_OCCURRENCE_COUNT", { id: entry.id, row, count: actual.length })
    const seconds = expectedSeconds(row, result.inputs)
    for (const step of actual) {
      check(a, step.distanceM === row.distanceM, "SOURCE_DISTANCE", { id: entry.id, segment: row.segmentId })
      check(a, seconds === null ? step.seconds === null : step.seconds !== null
        && close(step.seconds.minimum, seconds.minimum) && close(step.seconds.maximum, seconds.maximum), "INDEPENDENT_SECONDS", { id: entry.id, segment: row.segmentId, seconds, actual: step.seconds })
      if (row.kind !== "RECOVERY" && (row.context?.terrain !== "FLAT" || row.context?.modality !== "RUN"
        || ["ATP-PC", "ATP_PC"].includes(row.context?.intent ?? "") || (row.distanceM !== null && row.distanceM < 60)))
        check(a, step.referenceRecordId === null && step.paceSecondsPerKm === null, "FORBIDDEN_RACE_CONVERSION", { id: entry.id, step })
      if (a.persona.recordMode === "absent" || a.persona.recordMode === "stale")
        check(a, step.referenceRecordId === null, "STALE_OR_ABSENT_RECORD_USED", { id: entry.id, step: step.segmentId })
    }
  }
  const main = ledger.filter(r => r.phase === "main" && r.kind === "WORK")
  const mainDistance = main.reduce((sum, r) => sum + r.count * (r.distanceM ?? 0), 0)
  check(a, result.totals.workOccurrences === main.reduce((sum, r) => sum + r.count, 0), "MAIN_COUNT", entry.id)
  check(a, result.totals.recoveryOccurrences === ledger.filter(r => r.kind === "RECOVERY").reduce((sum, r) => sum + r.count, 0), "RECOVERY_COUNT", entry.id)
  check(a, result.totals.mainDistanceM === (main.every(r => r.distanceM !== null) ? mainDistance : null)
    && result.totals.knownMainDistanceM === mainDistance, "MAIN_DISTANCE_NOT_RECOVERY", entry.id)
  const amounts = ledger.map(row => ({ row, seconds: expectedSeconds(row, result.inputs) }))
  const minimum = amounts.reduce((sum, r) => sum + r.row.count * (r.seconds?.minimum ?? 0), 0)
  const maximum = amounts.reduce((sum, r) => sum + r.row.count * (r.seconds?.maximum ?? 0), 0)
  check(a, close(result.totals.knownSeconds, minimum), "KNOWN_SECONDS", entry.id)
  check(a, amounts.some(r => !r.seconds) ? result.totals.seconds === null : result.totals.seconds !== null
    && close(result.totals.seconds.minimum, minimum) && close(result.totals.seconds.maximum, maximum), "TOTAL_SECONDS_WITH_SUPPORT", entry.id)
  check(a, verifyCalculatedWorkout(clone(result)), "CALCULATION_JSON_ROUNDTRIP", entry.id)
}
function completeInputs(entry: WorkoutCatalogEntry, base: WorkoutCalculationInputs, random: () => number): WorkoutCalculationInputs {
  // Explicit synthetic user targets test plumbing. These numbers are NOT physiological recommendations.
  const ledger = sourceLedger(entry)
  const segmentSeconds = ledger.filter(r => r.kind !== "RECOVERY" && expectedSeconds(r, base) === null)
    .map(r => ({ segmentId: r.segmentId, seconds: 20.173 + Math.floor(random() * 90) }))
  const recoverySeconds = ledger.filter(r => r.kind === "RECOVERY" && r.sourceSeconds === null)
    .map(r => ({ segmentId: r.segmentId, seconds: 90.317 + Math.floor(random() * 90) }))
  return { ...base, confirmedRequirements: [...entry.requirements], segmentSeconds, recoverySeconds }
}

beforeEach(() => {
  originalWindow.localStorage.clear()
  originalWindow.sessionStorage.clear()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AT)
  vi.stubGlobal("fetch", vi.fn(() => { networkCalls++; throw Error("AUDIT_NETWORK_FORBIDDEN") }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  isolated?.window.close()
  isolated = null
  vi.restoreAllMocks()
  vi.useRealTimers()
})
afterAll(() => {
  const failures = audits.flatMap(a => a.failures.map(f => ({ personaId: a.id, ...f })))
  const counts: Record<string, number> = {}
  for (const f of failures) counts[f.code] = (counts[f.code] ?? 0) + 1
  const report = { baseline: BASELINE, runtime: RUNTIME, dirtyWorkingTree: DIRTY, rootSeed: ROOT_SEED, fixedTime: AT.toISOString(),
    syntheticOnly: true, browserBoundary: "fresh jsdom Window per persona; no user browser", networkCalls,
    personas: audits.length, distinctInputs: new Set(personas.map(p => JSON.stringify({ draft: p.draft, recordMode: p.recordMode, recordSeconds: p.recordSeconds, risk: p.risk, missing: p.missing }))).size,
    checks: audits.reduce((sum, a) => sum + a.checks, 0), catalogCalculations: audits.reduce((sum, a) => sum + a.catalog.length, 0),
    actionAttempts: audits.reduce((sum, a) => sum + a.actions.length, 0), failedPersonas: audits.filter(a => a.failures.length).map(a => a.id),
    generationCounts: audits.reduce<Record<string, number>>((m, a) => { m[a.generation ?? "exception"] = (m[a.generation ?? "exception"] ?? 0) + 1; return m }, {}),
    failureCounts: counts, namedEvidence, failures }
  if (audits.length === 100) {
    artifact("summary", report)
    artifact("personas", personas)
  } else artifact("focused-summary", report)
})

describe("seeded independent 100-persona domain audit", () => {
  it("has 100 different inputs with every requested categorical axis", () => {
    expect(personas).toHaveLength(100)
    expect(new Set(personas.map(p => JSON.stringify(p.draft))).size).toBe(100)
    for (const event of EVENTS) expect(personas.some(p => p.draft.eventDistanceM === event)).toBe(true)
    for (const focus of FOCI) expect(personas.some(p => p.draft.trainingFocus === focus)).toBe(true)
    for (const experience of EXPERIENCES) expect(personas.some(p => p.draft.experienceBand === experience)).toBe(true)
    expect(personas.some(p => p.syntheticAge < 18)).toBe(true)
    expect(personas.some(p => p.syntheticAge >= 18)).toBe(true)
  })
  it.each(personas)("$id seed=$seed: source math, generation, repeated change, save and reload", p => {
    isolated = new JSDOM("<!doctype html><html><body></body></html>", { url: `https://synthetic.invalid/${p.id}` })
    vi.stubGlobal("window", isolated.window)
    const random = rng(p.seed)
    const a: Audit = { id: p.id, seed: p.seed, persona: p, checks: 0, failures: [], catalog: [], actions: [], observations: [] }
    audits.push(a)
    try {
      const base = inputsFor(p)
      for (const entry of ALL_WORKOUT_CATALOG) {
        const result = calculateCatalogWorkout(entry.id, base)
        check(a, result !== null, "VALID_INPUT_NOT_CALCULABLE", entry.id)
        if (!result) continue
        auditCalculation(a, entry, result)
        check(a, entry.eventDistances.includes(base.eventDistanceM) === !result.unavailable.includes("EVENT_SCOPE"), "EVENT_ELIGIBILITY", entry.id)
        check(a, entry.experience.includes(base.experience) === !result.unavailable.includes("EXPERIENCE_SCOPE"), "EXPERIENCE_ELIGIBILITY", entry.id)
        check(a, entry.requirements.every(r => result.unavailable.includes(r)), "MISSING_REQUIREMENT_NOT_HELD", entry.id)
        const supplied = completeInputs(entry, base, random)
        const resolved = calculateCatalogWorkout(entry.id, supplied)
        check(a, resolved !== null, "EXPLICIT_TARGET_NOT_CALCULABLE", { id: entry.id, supplied })
        if (resolved) auditCalculation(a, entry, resolved)
        const cue = calculatedWorkoutSequence(resolved ?? result)
        a.catalog.push({ id: entry.id, fingerprint: result.fingerprint, unavailable: result.unavailable, unresolved: result.unresolved,
          fullTime: result.totals.seconds, explicitInputs: supplied, resolvedTime: resolved?.totals.seconds,
          resolvedUnavailable: resolved?.unavailable, notation: cue ? sequenceNotation(cue) : "OFF" })
        if (entry.family === "OFF") check(a, result.steps.length === 0 && result.totals.workOccurrences === 0, "OFF_IS_PLANNED_ABSENCE", entry.id)
        const familyIntent = FOCI.find(f => catalogFamilyForIntent(f) === entry.family)
        if (familyIntent) {
          const common = { day: 1, slot: "AM" as const, prescription: { kind: "RPE_TIME_RANGE" as const,
            rpe: { minimum: 1, maximum: 10 }, durationMinutes: { minimum: 1, maximum: 30 } } }
          const session: PlanSession = familyIntent === "BASE_INTENT" || familyIntent === "RECOVERY_INTENT"
            ? { ...common, role: "EASY", plannedEnergyIntent: familyIntent }
            : { ...common, role: "QUALITY", plannedEnergyIntent: familyIntent }
          const bound = bindCatalogSession(session, entry.id, base)
          if (result.totals.seconds === null || result.unavailable.length)
            check(a, bound === null, "INCOMPLETE_OR_INELIGIBLE_BOUND", entry.id)
          const mismatched = { ...session, plannedEnergyIntent: familyIntent === "BASE_INTENT" ? "VO2_INTENT" : "BASE_INTENT" } as PlanSession
          check(a, bindCatalogSession(mismatched, entry.id, supplied, true) === null, "CROSS_PURPOSE_BIND", entry.id)
        }
      }
      if (p.recordMode !== "absent") {
        const record = createSelfReportedAthleteRecord({ id: base.fiveK!.recordId, purpose: "RECENT_RESULT", eventDistanceM: 5000,
          performanceSeconds: p.recordSeconds, achievedOn: base.fiveK!.achievedAt, seasonId: null }, AT)
        check(a, record !== null && saveAthleteRecord(record!).ok, "SYNTHETIC_RECORD_FIXTURE", p.id)
      }
      const draft = clone(p.draft) as Partial<PlanBetaIntake>
      if (p.missing) delete draft[p.missing]
      const current = p.risk === "none" ? "NO_KNOWN_RISK" : p.risk === "contraindication" ? "REVIEW_REQUIRED" : undefined
      const generation = generatePlanFromDraft(draft, current as Parameters<typeof generatePlanFromDraft>[1])
      a.generation = generation.kind
      if (p.missing || p.risk !== "none") {
        check(a, generation.kind !== "generated", "MISSING_OR_RISK_GENERATED", { check: current ?? "MISSING", kind: generation.kind,
          ...(generation.kind === "generated" ? { gate: generation.gate } : { result: generation }) })
        return
      }
      check(a, generation.kind === "generated", "COMPLETE_SAFE_PROFILE_REJECTED", generation)
      if (generation.kind !== "generated") return
      const again = generatePlanFromDraft(draft, "NO_KNOWN_RISK")
      check(a, again.kind === "generated" && same(again.generated, generation.generated), "RENDER_TIME_REDRAW", p.id)
      let generated = generation.generated
      a.observations.push({ stage: "initial", focus: p.draft.trainingFocus, experience: p.draft.experienceBand,
        main: generated.candidates[0].sessions.filter(s => s.role === "QUALITY").map(s => ({ slot: address(s),
          kind: s.prescription.kind, catalogId: s.prescription.kind === "RPE_TIME_RANGE" ? s.prescription.catalogWorkout?.catalogId ?? null : null,
          prescription: s.prescription })) })
      const skeleton = generated.candidates[0].sessions.map(s => ({ day: s.day, slot: s.slot, role: s.role, purpose: s.plannedEnergyIntent }))
      for (const candidate of generated.candidates) {
        check(a, new Set(candidate.sessions.map(address)).size === candidate.sessions.length, "DUPLICATE_SLOT", candidate.kind)
        for (const day of new Set(candidate.sessions.map(s => s.day))) {
          const daily = candidate.sessions.filter(s => s.day === day)
          check(a, daily.length <= (p.draft.secondSessionMode === "RECOVERY_PM_ALLOWED" ? 2 : 1)
            && daily.filter(s => s.role === "QUALITY").length <= 1, "DAILY_OR_MAIN_CAP", { day, daily })
        }
        for (const session of candidate.sessions) {
          if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) continue
          const b = session.prescription.catalogWorkout, result = resolveCatalogBinding(b)
          check(a, result !== null, "GENERATED_BINDING_UNREADABLE", session)
          check(a, session.prescription.rpe.maximum <= b.originalEnvelope.rpe.maximum
            && session.prescription.durationMinutes.maximum <= b.originalEnvelope.durationMinutes.maximum, "AUTO_ENVELOPE_ESCALATION", session)
          check(a, b.inputs.confirmedRequirements.length === 0 && b.inputs.fiveK === null, "AUTO_INVENTED_CONFIRMATION_OR_RECORD", session)
        }
      }
      const persist = (step: string) => {
        const index = random() < 0.5 ? 0 : 1
        const candidate = generated.candidates[index]!
        const selected = selectPlanForActivation(candidate.candidateId, generated, generation.gate, generation.intake, generation.athleteEvidence, AT)
        check(a, selected.kind === "selected", "GENERATED_OR_CHANGED_UNSELECTABLE", { step, kind: candidate.kind, selected })
        if (selected.kind !== "selected") return
        const before = stable(selected.state)
        check(a, parsePlanBetaState(clone(selected.state)) !== null, "SELECTED_STATE_INVALID", step)
        const saved = savePlanBetaState(selected.state)
        check(a, saved.ok, "SAVE_REJECTED_VALID_SELECTION", { step, saved })
        const loaded = loadPlanBetaState()
        check(a, loaded !== null && stable(loaded) === before, "SAVE_RELOAD_CONTENT_DRIFT", step)
        if (loaded !== null && stable(loaded) !== before) artifact(`${p.id}-state-difference-${step}`, { expected: selected.state, loaded })
        if (loaded) {
          check(a, same(loaded.activePlan.sessions.map(sessionWorkoutNotation), selected.state.activePlan.sessions.map(sessionWorkoutNotation)), "SAVE_RELOAD_NOTATION_DRIFT", step)
          const raw = window.localStorage.getItem(activePlanBetaStorageKey())
          loadPlanBetaState()
          check(a, window.localStorage.getItem(activePlanBetaStorageKey()) === raw, "RELOAD_REWRITES_HISTORY", step)
          a.actions.push({ type: "save-reload", step, candidate: candidate.kind, id: candidate.candidateId, bytes: raw?.length })
        }
      }
      persist("initial")
      for (let step = 0; step < 12; step++) {
        const candidates = generated.candidates[0].sessions.filter(s => s.role !== "REST" && s.prescription.kind === "RPE_TIME_RANGE")
        if (!candidates.length) break
        const session = pick(candidates, random)
        const family = catalogFamilyForIntent(session.plannedEnergyIntent)
        const pool = ALL_WORKOUT_CATALOG.filter(e => e.family === family)
        const entry = pick(pool, random)
        const supplied = step % 3 ? completeInputs(entry, inputsFor(p), random) : inputsFor(p)
        const useLonger = step % 4 === 1
        const before = JSON.stringify(generated)
        const storageBefore = window.localStorage.getItem(activePlanBetaStorageKey())
        const next = replaceCandidateCatalogWorkout(generated, session, entry.id, supplied, useLonger)
        check(a, JSON.stringify(generated) === before && window.localStorage.getItem(activePlanBetaStorageKey()) === storageBefore, "PREVIEW_MUTATES_PLAN_OR_STORAGE", { step, id: entry.id })
        a.actions.push({ type: step % 3 ? "explicit-target-adjustment" : "missing-input-swap", step, slot: address(session), catalogId: entry.id,
          inputs: supplied, acceptLongerDuration: useLonger, outcome: next ? "changed" : "held" })
        if (!next) continue
        for (const candidate of next.candidates) {
          check(a, same(candidate.sessions.map(s => ({ day: s.day, slot: s.slot, role: s.role, purpose: s.plannedEnergyIntent })), skeleton), "SWAP_CHANGES_SCHEDULE_OR_PURPOSE", step)
          for (const old of generated.candidates.find(c => c.kind === candidate.kind)!.sessions) {
            if (address(old) !== address(session)) check(a, same(candidate.sessions.find(s => address(s) === address(old)), old), "SWAP_ALTERS_OTHER_SLOT", { step, slot: address(old) })
          }
          const changed = candidate.sessions.find(s => address(s) === address(session))!
          if (changed.prescription.kind === "RPE_TIME_RANGE" && changed.prescription.catalogWorkout) {
            const b = changed.prescription.catalogWorkout, result = resolveCatalogBinding(b)
            check(a, result !== null, "CHANGED_BINDING_UNREADABLE", step)
            if (result) {
              const tooLong = result.totals.seconds!.maximum > b.originalEnvelope.durationMinutes.maximum * 60
              check(a, !tooLong || useLonger && b.acceptedDurationSeconds === result.totals.seconds!.maximum, "DURATION_CONFIRMATION_LOST", { step, b })
              const actual = result.steps.filter(s => s.phase === "main" && s.kind === "WORK").slice(0, 2)
                .map(s => ({ key: s.key, ...(s.distanceM === null ? {} : { distanceM: s.distanceM }), seconds: 37.123 }))
              const comparison = compareCatalogPerformance(result, actual)
              check(a, comparison !== null && comparison.unrecordedSteps === result.steps.length - actual.length
                && comparison.automaticIncreaseAllowed === false, "ACTUAL_MISSING_OR_AUTOINCREASE", step)
            }
          }
        }
        generated = next
        persist(`change-${step}`)
        // Cancel/undo is a restored full snapshot; never apply arithmetic to stored dose.
        if (step % 5 === 2) {
          generated = JSON.parse(before) as PlanGenerationSuccess
          persist(`undo-${step}`)
        }
      }
      a.observations.push({ qualityCatalogBound: generated.candidates[0].sessions.filter(s => s.role === "QUALITY" && s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.catalogWorkout).length,
        qualityTimeOnly: generated.candidates[0].sessions.filter(s => s.role === "QUALITY" && s.prescription.kind === "RPE_TIME_RANGE" && !s.prescription.catalogWorkout).length })
    } catch (error) {
      a.failures.push({ code: "AUDIT_EXECUTION_EXCEPTION", detail: String(error) })
    } finally {
      artifact(`${p.id}-${p.seed}`, a)
      expect(a.failures, `${p.id}: ${JSON.stringify(a.failures.slice(0, 6))}`).toEqual([])
    }
  })
})

function safeFixture(focus: PlanBetaIntake["trainingFocus"] = "LT_INTENT", experience: PlanBetaIntake["experienceBand"] = "EXPERIENCED") {
  const generation = generatePlanFromDraft({ ...personas[3]!.draft, eventGroup: "FIVE_K", eventDistanceM: 5000,
    competitionDivision: "OPEN", trainingFocus: focus, experienceBand: experience, availableDayCount: 5,
    secondSessionMode: "SINGLE_SESSION_ONLY", requestedFrameLength: 9 }, "NO_KNOWN_RISK")
  if (generation.kind !== "generated") throw Error(`fixture: ${generation.kind}`)
  return generation
}
function evidence(name: string, detail: unknown) {
  namedEvidence.push({ name, detail })
  artifact(name, detail)
}

function measureDefaultMainCoverage() {
  const rows = personas.filter(p => !p.missing && p.risk === "none").map(p => {
    window.localStorage.clear()
    const generated = generatePlanFromDraft(p.draft, "NO_KNOWN_RISK")
    expect(generated.kind, p.id).toBe("generated")
    if (generated.kind !== "generated") throw Error(`coverage fixture: ${p.id}`)
    const main = generated.generated.candidates[0].sessions.filter(s => s.role === "QUALITY").map(session => {
      expect(session.prescription.kind).toBe("RPE_TIME_RANGE")
      if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("unexpected detailed lane in coverage")
      const envelope = session.prescription.catalogWorkout?.originalEnvelope ?? session.prescription
      const original = { ...session, prescription: { kind: "RPE_TIME_RANGE" as const,
        rpe: envelope.rpe, durationMinutes: envelope.durationMinutes } }
      const input: WorkoutCalculationInputs = { eventDistanceM: p.draft.eventDistanceM, experience: p.draft.experienceBand,
        availableSeconds: envelope.durationMinutes.maximum * 60, confirmedRequirements: [], fiveK: null, segmentPaces: [] }
      const options = ALL_WORKOUT_CATALOG.filter(e => e.family === catalogFamilyForIntent(session.plannedEnergyIntent)).map(entry => {
        const result = calculateCatalogWorkout(entry.id, input)!
        const reasons = [...result.unavailable]
        if (!result.totals.seconds) reasons.push("INCOMPLETE_TOTAL_TIME")
        if (catalogRpe(result).maximum > envelope.rpe.maximum) reasons.push("AUTO_RPE_ENVELOPE_EXCEEDED")
        const bound = bindCatalogSession(original, entry.id, input)
        const eligible = bound !== null && catalogRpe(result).maximum <= envelope.rpe.maximum
        return { id: entry.id, eligible, reasons: [...new Set(reasons)], unresolved: result.unresolved,
          calculatedTime: result.totals.seconds, rpe: catalogRpe(result) }
      })
      const catalogId = session.prescription.catalogWorkout?.catalogId ?? null
      expect(options.some(o => o.eligible), `${p.id}:${address(session)}`).toBe(catalogId !== null)
      return { slot: address(session), catalogId, originalEnvelope: envelope, options }
    })
    return { id: p.id, seed: p.seed, focus: p.draft.trainingFocus, experience: p.draft.experienceBand,
      eventDistanceM: p.draft.eventDistanceM, main }
  })
  const slots = rows.flatMap(row => row.main)
  evidence("default-main-coverage", { candidate: "first balanced candidate only; QUALITY denotes MAIN",
    safeGeneratedProfiles: rows.length, mainProfiles: rows.filter(row => row.main.length).length,
    profilesWithIncompleteMain: rows.filter(row => row.main.some(s => !s.catalogId)).length,
    mainSlots: slots.length, incompleteMainSlots: slots.filter(s => !s.catalogId).length, rows })
}

describe("named adversarial contract counterexamples", () => {
  it("AUDIT-MUTATION-CONTROL detects source-count, terminal-rest and decimal corruption without changing runtime", () => {
    const entry = ALL_WORKOUT_CATALOG.find(e => e.id === "X-LT-01")!
    const result = calculateCatalogWorkout(entry.id, inputsFor(personas[3]!))!
    const a: Audit = { id: "mutation-control", seed: ROOT_SEED, persona: personas[3]!, checks: 0, failures: [], catalog: [], actions: [], observations: [] }
    auditCalculation(a, entry, result)
    expect(a.failures).toEqual([])
    const missing = clone(result) as { steps: CalculatedWorkout["steps"][number][] } & CalculatedWorkout
    missing.steps = missing.steps.filter((s, i) => i !== missing.steps.findIndex(x => x.kind === "RECOVERY"))
    auditCalculation(a, entry, missing)
    expect(a.failures.some(f => f.code === "SOURCE_OCCURRENCE_COUNT")).toBe(true)
    const rounded = clone(result), target = rounded.steps.find(s => s.targetModel === "THRESHOLD_REFERENCE")!
    Object.assign(target, { seconds: { minimum: Math.round(target.seconds!.minimum), maximum: Math.round(target.seconds!.maximum) } })
    a.failures = []
    auditCalculation(a, entry, rounded)
    expect(a.failures.some(f => f.code === "INDEPENDENT_SECONDS")).toBe(true)
    evidence("mutation-control", { caught: ["SOURCE_OCCURRENCE_COUNT", "SEQUENCE_ORDER", "INDEPENDENT_SECONDS"], runtimeEdited: false })
  })

  it("AUDIT-STALE-DISPLAY saved stale reference must remain visibly stale in the workout reader", () => {
    const p = { ...personas[3]!, recordMode: "stale" as const }
    const result = calculateCatalogWorkout("P-LT-C", inputsFor(p))!
    expect(result.unresolved).toContain("RECORD_NOT_CURRENT")
    render(React.createElement(CatalogWorkoutDetail, { workout: result, evidence: true }))
    const rendered = document.body.textContent ?? ""
    evidence("stale-reader", { record: result.inputs.fiveK, unresolved: result.unresolved, rendered })
    expect(rendered).toMatch(/오래된|현재.*아니|사용하지.*기록|기록.*사용하지/u)
  })

  it("AUDIT-DRAW-NO-REPEAT seeded picker must exhaust unseen eligible methods before returning", () => {
    const source = safeFixture("VO2_INTENT")
    const random = rng(ROOT_SEED)
    vi.spyOn(Math, "random").mockImplementation(random)
    render(React.createElement(CatalogWorkoutPicker, { generated: source.generated, intake: source.intake, records: [], onChange: vi.fn() }))
    fireEvent.click(screen.getByText("다른 훈련으로 바꾸기", { exact: true }))
    const select = screen.getByRole("combobox", { name: "훈련 구성" }) as HTMLSelectElement
    const trace = [select.value]
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole("button", { name: "같은 목적의 다른 훈련" }))
      trace.push(select.value)
    }
    const session = source.generated.candidates[0].sessions.find(s => s.role === "QUALITY")!
    if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("fixture")
    const budget = (session.prescription.catalogWorkout?.originalEnvelope ?? session.prescription).durationMinutes.maximum * 60
    const eligible = ALL_WORKOUT_CATALOG.filter(e => e.family === "VO2").filter(e => {
      const p = calculateCatalogWorkout(e.id, inputsFor({ ...personas[3]!, draft: source.intake, recordMode: "absent" }, budget))
      return p !== null && !p.unavailable.length
    })
    const methods = new Set(eligible.map(catalogRecommendationMethodKey)).size
    const firstCycle = trace.slice(0, methods)
    const methodTrace = trace.map(id => catalogRecommendationMethodKey(ALL_WORKOUT_CATALOG.find(e => e.id === id)!))
    evidence("seeded-picker-draw", { seed: ROOT_SEED, budget, methods, eligible: eligible.map(e => e.id), trace, firstCycle,
      uniqueFirstCycleMethods: new Set(methodTrace.slice(0, methods)).size })
    expect(new Set(methodTrace.slice(0, methods)).size).toBe(methods)
    expect(methodTrace.every((identity, i) => i === 0 || identity !== methodTrace[i - 1])).toBe(true)
  })

  it("AUDIT-DRAW-ELIGIBILITY empty eligible draw pool disables random choice with reason and preserves the manual choice", () => {
    const source = safeFixture("ATP_PC_INTENT", "NEW_TO_RUNNING")
    const random = vi.spyOn(Math, "random").mockImplementation(rng(ROOT_SEED))
    const onChange = vi.fn()
    render(React.createElement(CatalogWorkoutPicker, { generated: source.generated, intake: source.intake, records: [], onChange }))
    fireEvent.click(screen.getByText("다른 훈련으로 바꾸기", { exact: true }))
    const select = screen.getByRole("combobox", { name: "훈련 구성" }) as HTMLSelectElement
    const before = select.value
    const session = source.generated.candidates[0].sessions.find(s => s.role === "QUALITY")!
    if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("fixture")
    const budget = (session.prescription.catalogWorkout?.originalEnvelope ?? session.prescription).durationMinutes.maximum * 60
    const eligible = ALL_WORKOUT_CATALOG.filter(e => e.family === "ATP-PC").filter(e => {
      const result = calculateCatalogWorkout(e.id, inputsFor({ ...personas[3]!, draft: source.intake, recordMode: "absent" }, budget))
      return result !== null && result.unavailable.length === 0
    })
    expect(eligible).toHaveLength(0)
    const draw = screen.getByRole("button", { name: "같은 목적의 다른 훈련" }) as HTMLButtonElement
    expect(draw.disabled).toBe(true)
    const reason = screen.getByText(/지금 바로 바꿀 수 있는 다른 구성이 없어요/u).textContent
    fireEvent.click(draw)
    expect(select.value).toBe(before)
    expect(random).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(select.disabled).toBe(false)
    const alternative = Array.from(select.options).find(option => option.value !== before)
    expect(alternative).toBeDefined()
    fireEvent.change(select, { target: { value: alternative!.value } })
    expect(select.value).toBe(alternative!.value)
    expect(onChange).not.toHaveBeenCalled()
    evidence("unavailable-random-fallback", { eligibleCount: eligible.length, before, afterDisabledClick: before,
      disabled: draw.disabled, reason, randomCalls: random.mock.calls.length, appliedChanges: onChange.mock.calls.length,
      manualListEnabled: !select.disabled, manualChoice: select.value,
      invariantCorrection: "An unchanged manual choice may still need requirements; only an unavailable random transition is forbidden." })
  })

  it("AUDIT-LIMITATIONS-LIST actual limitations arrays render as separate uncoerced list items", () => {
    expect(ALL_WORKOUT_CATALOG.every(entry => Array.isArray(entry.explanation.limitations))).toBe(true)
    const entry = ALL_WORKOUT_CATALOG.find(e => e.id === "P-LT-C")!
    const result = calculateCatalogWorkout(entry.id, inputsFor(personas[3]!))!
    render(React.createElement(CatalogWorkoutDetail, { workout: result, evidence: true }))
    const section = screen.getByRole("heading", { name: "적용의 한계" }).parentElement!
    const items = Array.from(section.querySelectorAll("ul > li")).map(item => item.textContent)
    expect(items).toEqual(entry.explanation.limitations)
    expect(items.length).toBeGreaterThan(1)
    evidence("limitations-list", { arrayEntries: ALL_WORKOUT_CATALOG.length, id: entry.id,
      expected: entry.explanation.limitations, items, exactSeparateItems: true })
  })

  it("AUDIT-DURATION-VARIANTS continuous easy dose variants do not become different methods", () => {
    const one = ALL_WORKOUT_CATALOG.find(e => e.id === "X-BASE-01")!
    const two = ALL_WORKOUT_CATALOG.find(e => e.id === "X-BASE-03")!
    evidence("method-dose-identity", { one: { id: one.id, methodGroup: one.methodGroup, identity: catalogRecommendationMethodKey(one) },
      two: { id: two.id, methodGroup: two.methodGroup, identity: catalogRecommendationMethodKey(two) } })
    expect(one.methodGroup).toBe(two.methodGroup)
    expect(catalogRecommendationMethodKey(one)).toBe(catalogRecommendationMethodKey(two))
  })

  it("AUDIT-RELOAD-CONFIRMATION picker preserves the stored record and exact target on reopening", () => {
    const source = safeFixture()
    const input = { ...inputsFor(personas[3]!), eventDistanceM: source.intake.eventDistanceM, experience: source.intake.experienceBand }
    const session = source.generated.candidates[0].sessions.find(s => s.role === "QUALITY")!
    const changed = replaceCandidateCatalogWorkout(source.generated, session, "X-LT-01", input, true)
    expect(changed).not.toBeNull()
    const selection = selectPlanForActivation(changed!.candidates[0].candidateId, changed!, source.gate, source.intake, source.athleteEvidence, AT)
    expect(selection.kind).toBe("selected")
    if (selection.kind !== "selected") return
    expect(savePlanBetaState(selection.state).ok).toBe(true)
    const loaded = loadPlanBetaState()!
    const loadedSession = loaded.activePlan.sessions.find(s => address(s) === address(session))!
    expect(loadedSession.prescription).toEqual(changed!.candidates[0].sessions.find(s => address(s) === address(session))!.prescription)
    const record = createSelfReportedAthleteRecord({ id: input.fiveK!.recordId, purpose: "RECENT_RESULT", eventDistanceM: 5000,
      performanceSeconds: input.fiveK!.seconds, achievedOn: input.fiveK!.achievedAt, seasonId: null }, AT)!
    render(React.createElement(CatalogWorkoutPicker, { generated: changed!, intake: source.intake, records: [record], onChange: vi.fn() }))
    fireEvent.click(screen.getByText("다른 훈련으로 바꾸기", { exact: true }))
    const displayedRecord = (screen.getByRole("combobox", { name: "참고 페이스에 사용할 5km 기록" }) as HTMLSelectElement).value
    evidence("reopened-picker-input", { storedRecord: input.fiveK, displayedRecord, storedNotation: sessionWorkoutNotation(loadedSession), rendered: document.body.textContent })
    expect(displayedRecord).toBe(record.id)
  })

  it("AUDIT-REDUCE-CATALOG rejects a range clamp but replays a whole-slot low-intensity replacement", () => {
    const source = safeFixture("VO2_INTENT")
    const quality = source.generated.candidates[0].sessions.find(s => s.role === "QUALITY")!
    expect(quality.prescription.kind === "RPE_TIME_RANGE" && quality.prescription.catalogWorkout).toBeTruthy()
    const receipt: ExecutionReplanReceipt = { version: 1, policy: "execution-remainder-v1", trigger: "EXECUTION_REVIEW_CONFIRMED", action: "REDUCE",
      source: { day: quality.day, slot: quality.slot }, target: null, baseStateFingerprint: `sha256:${"0".repeat(64)}`,
      baseCandidateId: source.generated.candidates[0].candidateId, baseSessions: clone([...source.generated.candidates[0].sessions]), protectedSlots: [],
      startDate: "2026-10-01", today: "2026-09-30", sourceJournalId: "synthetic-journal", evidenceFingerprint: `sha256:${"1".repeat(64)}`,
      journalGuard: null, noFixedFutureCommitments: true, acceptedAt: AT.toISOString() }
    expect(replayExecutionReplan(receipt)).toBeNull()
    const easy = receipt.baseSessions.find(s => s.role === "EASY" && s.prescription.kind === "RPE_TIME_RANGE"
      && s.prescription.durationMinutes.maximum <= (quality.prescription.kind === "RPE_TIME_RANGE" ? quality.prescription.durationMinutes.minimum : 0))
    if (easy) {
      const replaced = replayExecutionReplan({ ...receipt, action: "REPLACE", target: { day: easy.day, slot: easy.slot } })
      expect(replaced).not.toBeNull()
      expect(replaced!.find(s => address(s) === address(quality))!.prescription).toEqual(easy.prescription)
      evidence("remainder-adjustment", { clamp: "rejected", replacement: "exact target prescription preserved" })
    } else evidence("remainder-adjustment", { clamp: "rejected", replacement: "no eligible low-intensity target in fixture" })
  })

  it("AUDIT-COMPATIBILITY catalog-free legacy snapshots are not backfilled on reload", () => {
    const source = safeFixture("VO2_INTENT")
    const pair = rebindCandidatePairIdentity(source.generated.candidates.map(c => ({ ...c, sessions: c.sessions.map(s =>
      s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.catalogWorkout
        ? { ...s, prescription: { kind: "RPE_TIME_RANGE" as const, ...s.prescription.catalogWorkout.originalEnvelope } } : s) })) as unknown as Parameters<typeof rebindCandidatePairIdentity>[0])
    const generated = { ...source.generated, candidates: pair, pairId: pair[0].pairId }
    const selected = selectPlanForActivation(pair[0].candidateId, generated, source.gate, source.intake, source.athleteEvidence, AT)
    expect(selected.kind).toBe("selected")
    if (selected.kind !== "selected") return
    expect(savePlanBetaState(selected.state).ok).toBe(true)
    const raw = window.localStorage.getItem(activePlanBetaStorageKey())
    const reloaded = loadPlanBetaState()!
    expect(reloaded.activePlan.sessions).toEqual(selected.state.activePlan.sessions)
    expect(window.localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
    expect(reloaded.activePlan.sessions.some(s => s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.catalogWorkout)).toBe(false)
    evidence("legacy-roundtrip", { saved: true, noBackfill: true })
  })

  it("AUDIT-CURRENT-CHECK-FAIL-CLOSED unknown/missing checks cannot generate, activate and save", () => {
    const source = safeFixture("VO2_INTENT")
    const rows = [undefined, null, "UNKNOWN", "", false].map(currentCheck => {
      window.localStorage.clear()
      const result = generatePlanFromDraft(source.intake, currentCheck as Parameters<typeof generatePlanFromDraft>[1])
      if (result.kind !== "generated") return { input: currentCheck ?? String(currentCheck), generated: false, result }
      const selection = selectPlanForActivation(result.generated.candidates[0].candidateId, result.generated, result.gate, result.intake, result.athleteEvidence, AT)
      const saved = selection.kind === "selected" && savePlanBetaState(selection.state).ok
      return { input: currentCheck ?? String(currentCheck), generated: true, gate: result.gate, selected: selection.kind,
        saved, reloaded: loadPlanBetaState() !== null }
    })
    expect(generatePlanFromDraft(source.intake, "REVIEW_REQUIRED").kind).toBe("blocked")
    evidence("missing-current-check-save", { rows, explicitRiskControl: "blocked" })
    expect(rows.filter(row => row.generated)).toEqual([])
  })

  it("AUDIT-ACTUAL-ROUTE-COVERAGE all 117 calculation IDs are measured against real generated slots", () => {
    const cache = new Map<string, ReturnType<typeof safeFixture>>()
    const rows: unknown[] = []
    const random = rng(ROOT_SEED)
    for (const entry of ALL_WORKOUT_CATALOG) {
      if (entry.family === "OFF") {
        const result = calculateCatalogWorkout(entry.id, inputsFor(personas[3]!))!
        rows.push({ id: entry.id, status: "PLANNED_OFF", work: result.totals.workOccurrences })
        continue
      }
      const focus = FOCI.find(f => catalogFamilyForIntent(f) === entry.family)!
      const experience = entry.experience[0] as PlanBetaIntake["experienceBand"]
      const eventDistanceM = entry.eventDistances[0] as PlanBetaIntake["eventDistanceM"]
      const key = `${focus}:${experience}:${eventDistanceM}`
      let source = cache.get(key)
      if (!source) {
        const draft = { ...personas[3]!.draft, experienceBand: experience, eventDistanceM,
          eventGroup: eventDistanceM <= 3000 ? "MIDDLE_DISTANCE" as const : eventDistanceM === 5000 ? "FIVE_K" as const
            : eventDistanceM === 10000 ? "TEN_K" as const : "GENERAL_ENDURANCE" as const,
          competitionDivision: "OPEN" as const, trainingFocus: focus, availableDayCount: 5 as const,
          requestedFrameLength: 9 as const, secondSessionMode: "SINGLE_SESSION_ONLY" as const }
        const result = generatePlanFromDraft(draft, "NO_KNOWN_RISK")
        expect(result.kind, key).toBe("generated")
        if (result.kind !== "generated") continue
        source = result
        cache.set(key, source)
      }
      const session = source.generated.candidates[0].sessions.find(s => s.plannedEnergyIntent === focus && s.role !== "REST")!
      const inputs = completeInputs(entry, { ...inputsFor(personas[3]!), eventDistanceM, experience }, random)
      const result = calculateCatalogWorkout(entry.id, inputs)!
      expect(result.unavailable, entry.id).toEqual([])
      expect(result.totals.seconds, entry.id).not.toBeNull()
      const next = replaceCandidateCatalogWorkout(source.generated, session, entry.id, inputs, true)
      if (!next) {
        rows.push({ id: entry.id, family: entry.family, status: "CALCULABLE_NOT_BINDABLE", inputs,
          original: session, calculatedTime: result.totals.seconds, instructions: [...new Set(result.steps.filter(s => s.phase === "main").map(s => s.instruction))] })
        continue
      }
      const selected = selectPlanForActivation(next.candidates[0].candidateId, next, source.gate, source.intake, source.athleteEvidence, AT)
      expect(selected.kind, entry.id).toBe("selected")
      if (selected.kind !== "selected") continue
      expect(savePlanBetaState(selected.state).ok, entry.id).toBe(true)
      const loaded = loadPlanBetaState()!
      expect(loaded.activePlan.sessions, entry.id).toEqual(selected.state.activePlan.sessions)
      rows.push({ id: entry.id, family: entry.family, status: "BOUND_SAVED_RELOADED", slot: address(session), inputs,
        durationConfirmation: loaded.activePlan.sessions.find(s => address(s) === address(session))!.prescription })
    }
    evidence("all-117-real-slot-binding", { scope: "one declared compatible event/experience per ID, explicit synthetic targets and time acceptance", rows })
    expect(rows).toHaveLength(117)
    measureDefaultMainCoverage()
  })
})
