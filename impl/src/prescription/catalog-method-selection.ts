import { canonicalJsonFingerprint } from "../plan-generator/candidate-identity"
import type { WorkoutCatalogEntry } from "./all-workout-calculator"
import type { RecoveryStepV3, SequenceNodeV3 } from "./sequence-v3"

const methodAliases: Readonly<Record<string, string>> = {
  "BASE:CONTINUOUS": "BASE:CONTINUOUS_RUN",
  "BASE:EASY_CONTINUOUS": "BASE:CONTINUOUS_RUN",
}

/** Exploration identity only. Never replaces a stored prescription/calculation fingerprint. */
export function catalogRecommendationMethodKey(entry: WorkoutCatalogEntry): string {
  const recovery = (steps: readonly RecoveryStepV3[]) => steps.map(step => ({
    mode: step.mode, unit: "distanceM" in step ? "distance" : "duration",
  }))
  const project = (node: SequenceNodeV3): unknown => {
    const rest = { between: recovery(node.recoveryBetweenRepeats), after: recovery(node.recoveryAfter) }
    if (node.kind === "group") {
      const children = node.children.map(project)
      if (node.repeatCount === 1 && node.repeatUnit !== "SET"
        && children.length === 1 && !rest.between.length && !rest.after.length) return children[0]
      return { kind: node.kind, unit: node.repeatUnit, rest, children }
    }
    const context = entry.segments.find(row => row.segmentId === node.id)
    return { kind: node.kind, role: node.role, workUnit: node.work.kind, rest,
      context: context ? { intent: context.intent, modality: context.modality, terrain: context.terrain } : null }
  }
  return canonicalJsonFingerprint("trainoracle.catalog-recommendation-method.v1", {
    family: entry.family, group: methodAliases[entry.methodGroup] ?? entry.methodGroup,
    structure: entry.sequence?.main.map(project) ?? [],
  })
}

export function groupEligibleCatalogMethods(entries: readonly WorkoutCatalogEntry[]): ReadonlyMap<string, readonly WorkoutCatalogEntry[]> {
  const groups = new Map<string, WorkoutCatalogEntry[]>()
  for (const entry of entries) {
    const key = catalogRecommendationMethodKey(entry)
    const group = groups.get(key) ?? []
    if (!group.some(row => row.id === entry.id)) group.push(entry)
    groups.set(key, group)
  }
  return groups
}

export function drawUnseenCatalogMethod(
  eligible: readonly WorkoutCatalogEntry[], current: WorkoutCatalogEntry,
  previousSeen: ReadonlySet<string>, random: () => number = Math.random,
): { readonly entry: WorkoutCatalogEntry; readonly seen: ReadonlySet<string> } | null {
  const currentKey = catalogRecommendationMethodKey(current)
  const groups = [...groupEligibleCatalogMethods(eligible)].filter(([key]) => key !== currentKey)
  if (!groups.length) return null
  const seen = new Set(previousSeen)
  seen.add(currentKey)
  let unseen = groups.filter(([key]) => !seen.has(key))
  if (!unseen.length) { seen.clear(); seen.add(currentKey); unseen = groups }
  // Draw a method first, then an eligible exact variant: extra doses cannot inflate its odds.
  const [key, variants] = unseen[Math.floor(random() * unseen.length)]!
  const entry = variants[Math.floor(random() * variants.length)]!
  seen.add(key)
  return { entry, seen }
}
