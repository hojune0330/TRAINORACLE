import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { configurationReference, revalidateAdjustmentReceipt } from "@impl/prescription/prescription-adjustment"
import type { AdjustmentAuthority, AdjustmentReceipt, ConfigurationReference, PrescriptionSnapshot } from "@impl/prescription/prescription-adjustment"
import { hasCanonicalJsonTree } from "./plan-beta-schema"

export type AdjustmentExplanationBinding = {
  readonly configuration: ConfigurationReference
  readonly explanationVersion: string
  readonly evidenceRefs: readonly string[]
}

/** An editor workspace snapshot, not an accepted active plan or retention authority. */
export type AdjustmentCommitState = {
  readonly candidateLineageId: string
  readonly mainSlotId: string
  readonly contextKey: string
  readonly revision: string
  readonly prescription: PrescriptionSnapshot
  readonly explanation: AdjustmentExplanationBinding
  readonly lastCommit: { readonly intentId: string; readonly receipt: AdjustmentReceipt } | null
}

export type AdjustmentCommitEnvironment = {
  readonly allowed: boolean
  readonly contextKey: string
  readonly authority: AdjustmentAuthority
  readonly explanations: readonly AdjustmentExplanationBinding[]
}

export type AdjustmentCommitResult =
  | { readonly kind: "committed" | "replayed"; readonly state: AdjustmentCommitState }
  | { readonly kind: "rejected"; readonly code: string }

export type AdjustmentCommitAdapter = {
  readonly readState: () => AdjustmentCommitState
  /** Must read current safety, account, anchor and policy state, not the opening props. */
  readonly readEnvironment: () => AdjustmentCommitEnvironment
  /** The owner atomically compares the whole expected snapshot, including context.
   * A multi-key localStorage write without a cooperating lock is not this contract.
   */
  readonly compareAndSwap: (expected: AdjustmentCommitState, next: AdjustmentCommitState, validateBeforeWrite: () => boolean) => boolean | Promise<boolean>
  readonly now: () => number
}

const rejected = (code: string): AdjustmentCommitResult => ({ kind: "rejected", code })
const fingerprint = (value: unknown): string | null => hasCanonicalJsonTree(value)
  ? canonicalJsonFingerprint("adjustment-workspace-v1", value) : null
const same = (left: unknown, right: unknown): boolean => {
  const a = fingerprint(left)
  return a !== null && a === fingerprint(right)
}
const text = (value: string) => typeof value === "string" && value.trim().length > 0
const keysOnly = (value: object, keys: readonly string[]) => Reflect.ownKeys(value).length === keys.length
  && Reflect.ownKeys(value).every(key => typeof key === "string" && keys.includes(key))

function validBinding(value: AdjustmentExplanationBinding): boolean {
  return keysOnly(value, ["configuration", "explanationVersion", "evidenceRefs"])
    && text(value.explanationVersion) && value.evidenceRefs.length > 0
    && value.evidenceRefs.every(ref => text(ref) && !/\s/u.test(ref))
    && new Set(value.evidenceRefs).size === value.evidenceRefs.length
}

function validState(state: AdjustmentCommitState): boolean {
  return keysOnly(state, ["candidateLineageId", "mainSlotId", "contextKey", "revision", "prescription", "explanation", "lastCommit"])
    && fingerprint(state) !== null && validBinding(state.explanation)
    && [state.candidateLineageId, state.mainSlotId, state.contextKey, state.revision].every(text)
    && (state.lastCommit === null || keysOnly(state.lastCommit, ["intentId", "receipt"]))
    && same(state.explanation.configuration, state.prescription.configuration)
}

/** Validate an unmodified editor baseline against the current trusted environment.
 * Persisted workspaces never supply their own authority or explanations.
 */
export function validateInitialAdjustmentWorkspace(base: AdjustmentCommitState, environment: AdjustmentCommitEnvironment): boolean {
  try {
    if (fingerprint(base) === null || fingerprint(environment) === null || !validState(base)
        || base.lastCommit !== null || !environment.allowed || environment.contextKey !== base.contextKey) return false
    const configurations = environment.authority.catalog.flatMap(family => family.configurations.map(configuration => ({ family, configuration })))
      .filter(({ family, configuration }) => family.familyId === base.prescription.configuration.familyId
        && configuration.configurationId === base.prescription.configuration.configurationId
        && configuration.version === base.prescription.configuration.version)
    if (configurations.length !== 1) return false
    const { configuration } = configurations[0]!
    const reference = configurationReference(base.prescription.configuration, configuration.sequence)
    if (!same(base.prescription, { configuration: reference, sequence: configuration.sequence })) return false
    const bindings = environment.explanations.filter(item => same(item.configuration, reference))
    return bindings.length === 1 && same(bindings[0], base.explanation)
  } catch { return false }
}

/** Bridges editor receipts to one immutable CAS snapshot. No dose defaults,
 * registry entries, plan activation or browser storage are supplied here.
 */
export function createAdjustmentCommitController(adapter: AdjustmentCommitAdapter) {
  let pending: Promise<AdjustmentCommitResult> | null = null
  let pendingIntent: string | null = null
  let generation = 0

  function commit(input: {
    readonly base: AdjustmentCommitState
    readonly receipt: AdjustmentReceipt
    readonly prescription: PrescriptionSnapshot
  }): Promise<AdjustmentCommitResult> {
    let detached: typeof input
    let intentId: string
    try {
      if (fingerprint(input) === null || !validState(input.base)) return Promise.resolve(rejected("INVALID_WORKSPACE"))
      detached = structuredClone(input)
      const { appliedAtMs: _time, ...action } = detached.receipt
      intentId = fingerprint({ base: detached.base, action, prescription: detached.prescription })!
    } catch { return Promise.resolve(rejected("INVALID_WORKSPACE")) }
    if (pending !== null) return pendingIntent === intentId ? pending : Promise.resolve(rejected("ADJUSTMENT_COMMIT_BUSY"))
    pendingIntent = intentId
    pending = execute(detached, intentId, generation).finally(() => { pending = null; pendingIntent = null })
    return pending
  }

  async function execute(input: Parameters<typeof commit>[0], intentId: string, openedGeneration: number): Promise<AdjustmentCommitResult> {
    try {
      const environment = adapter.readEnvironment()
      if (fingerprint(environment) === null) return rejected("INVALID_ADJUSTMENT_ENVIRONMENT")
      if (!environment.allowed || environment.contextKey !== input.base.contextKey) return rejected("ADJUSTMENT_CONTEXT_CHANGED")
      const checked = revalidateAdjustmentReceipt({ authority: environment.authority, receipt: input.receipt,
        current: input.base.prescription, contextKey: environment.contextKey, nowMs: adapter.now() })
      if (checked.kind === "rejected") return checked
      if (!same(checked.prescription, input.prescription)) return rejected("ADJUSTMENT_OUTPUT_MISMATCH")
      const explanations = environment.explanations.filter(binding => same(binding.configuration, checked.prescription.configuration))
      const explanation = explanations[0]
      if (explanations.length !== 1 || explanation === undefined || !validBinding(explanation)) return rejected("ADJUSTMENT_EXPLANATION_UNAVAILABLE")

      const read = adapter.readState()
      if (!validState(read)) return rejected("INVALID_WORKSPACE")
      const current = structuredClone(read)
      if (current.contextKey !== input.base.contextKey
          || current.mainSlotId !== input.base.mainSlotId || current.candidateLineageId !== input.base.candidateLineageId) return rejected("ADJUSTMENT_CONTEXT_CHANGED")
      const nextRevision = canonicalJsonFingerprint("adjustment-revision-v1", { previous: input.base.revision, intentId })
      if (current.lastCommit?.intentId === intentId && current.revision === nextRevision
          && same(current.prescription, checked.prescription) && same(current.explanation, explanation)) {
        const previous = revalidateAdjustmentReceipt({ authority: environment.authority, receipt: current.lastCommit.receipt,
          current: input.base.prescription, contextKey: environment.contextKey, nowMs: adapter.now() })
        if (previous.kind === "rejected") return previous
        const { appliedAtMs: _previousTime, ...previousAction } = previous.receipt
        if (fingerprint({ base: input.base, action: previousAction, prescription: current.prescription }) !== intentId) {
          return rejected("ADJUSTMENT_REPLAY_MISMATCH")
        }
        return { kind: "replayed", state: current }
      }
      if (!same(current, input.base)) return rejected("STALE_ADJUSTMENT_WORKSPACE")

      const next: AdjustmentCommitState = structuredClone({
        ...input.base, revision: nextRevision,
        prescription: checked.prescription, explanation,
        lastCommit: { intentId, receipt: checked.receipt },
      })
      let validatedBeforeWrite = false
      const swapped = await adapter.compareAndSwap(current, next, () => {
        try {
          validatedBeforeWrite = false
          if (generation !== openedGeneration) return false
          const live = adapter.readEnvironment()
          if (fingerprint(live) === null) return false
          if (!live.allowed || live.contextKey !== next.contextKey || !same(adapter.readState(), current)) return false
          const valid = revalidateAdjustmentReceipt({ authority: live.authority, receipt: input.receipt,
            current: input.base.prescription, contextKey: live.contextKey, nowMs: adapter.now() })
          const bindings = live.explanations.filter(binding => same(binding.configuration, next.prescription.configuration))
          validatedBeforeWrite = valid.kind === "applied" && bindings.length === 1 && same(bindings[0], next.explanation)
          return validatedBeforeWrite
        } catch { return false }
      })
      if (!swapped) return rejected("STALE_ADJUSTMENT_WORKSPACE")
      if (!validatedBeforeWrite) return rejected("ATOMIC_VALIDATION_NOT_CONFIRMED")
      const latestEnvironment = adapter.readEnvironment()
      const stored = adapter.readState()
      if (generation !== openedGeneration || !latestEnvironment.allowed || latestEnvironment.contextKey !== next.contextKey || !same(stored, next)) {
        return rejected("ADJUSTMENT_COMMIT_UNCONFIRMED")
      }
      return { kind: "committed", state: structuredClone(stored) }
    } catch { return rejected("ADJUSTMENT_COMMIT_UNCONFIRMED") }
  }

  return { commit, invalidate: () => { generation++ } }
}
