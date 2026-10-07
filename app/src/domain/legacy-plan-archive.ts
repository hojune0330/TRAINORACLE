import { z } from "zod"
import { parsePlanBetaState, planBetaStateV2Schema, type PlanBetaState } from "./plan-beta-schema"
import { PLAN_BETA_STORAGE_KEY } from "./plan-beta-store"
import { accountPlansEnabled } from "./account/account-plan-service"
import { localJournalScopeGeneration } from "./account/local-journal-ownership"
import { accountScopedStorageKey, accountScopedStorageKeyFor, localAccountScopeIsCurrent, localAccountScopeSnapshot } from "./account/local-account-scope"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"

export const LEGACY_PLAN_ARCHIVE_KEY = "trainoracle.plan-beta.legacy-originals.v1"

function parseLegacyRaw(raw: string) {
  try {
    const value: unknown = JSON.parse(raw)
    if (value === null || typeof value !== "object" || !("version" in value) || ![1, 2].includes(Number(value.version))) return null
    const parsed = parsePlanBetaState(value)
    if (parsed?.version !== 2) return null
    const checked = planBetaStateV2Schema.safeParse(parsed)
    return checked.success ? checked.data : null
  } catch { return null }
}

const archiveSchema = z.object({
  version: z.literal(1),
  archives: z.array(z.object({
    raw: z.string().refine(raw => parseLegacyRaw(raw) !== null),
    archivedAt: z.string().datetime(),
  }).strict()),
}).strict()

export function readLegacyPlanArchives():
  | { kind: "loaded"; archives: z.infer<typeof archiveSchema>["archives"] }
  | { kind: "unavailable" } {
  try {
    const raw = window.localStorage.getItem(accountScopedStorageKey(LEGACY_PLAN_ARCHIVE_KEY))
    const checked = archiveSchema.parse(raw === null ? { version: 1, archives: [] } : JSON.parse(raw))
    return { kind: "loaded", archives: checked.archives }
  } catch { return { kind: "unavailable" } }
}

export type LegacyPlanArchiveResult =
  | { kind: "archived" }
  | { kind: "rejected"; code: "STALE_BASE" | "MUTATION_LOCK_UNAVAILABLE" }
  | { kind: "failed"; rollbackComplete: boolean }

/** Preserve the exact old bytes; this neither migrates nor grants execution authority. */
export async function archiveLegacyPlanForNewEntry(expected: PlanBetaState): Promise<LegacyPlanArchiveResult> {
  if (expected.version !== 2) return { kind: "rejected", code: "STALE_BASE" }
  if (accountPlansEnabled()) return { kind: "rejected", code: "STALE_BASE" }
  const scope = localAccountScopeSnapshot()
  const generation = localJournalScopeGeneration()
  const current = () => localAccountScopeIsCurrent(scope) && localJournalScopeGeneration() === generation && !accountPlansEnabled()
  const activeKey = accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, scope)
  const archiveKey = accountScopedStorageKeyFor(LEGACY_PLAN_ARCHIVE_KEY, scope)
  const expectedJson = JSON.stringify(expected)
  const locks = getPlanMutationLockManager()
  if (!locks) return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" }
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, lock => {
      if (!lock) return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" } as const
      if (!current()) return { kind: "rejected", code: "STALE_BASE" } as const
      let activeRaw: string | null = null, previousArchive: string | null = null, stagedArchive: string | null = null
      let started = false, removingActive = false
      try {
        const storage = window.localStorage
        activeRaw = storage.getItem(activeKey)
        previousArchive = storage.getItem(archiveKey)
        if (activeRaw === null || JSON.stringify(parseLegacyRaw(activeRaw)) !== expectedJson) return { kind: "rejected", code: "STALE_BASE" } as const
        const archive = archiveSchema.parse(previousArchive === null ? { version: 1, archives: [] } : JSON.parse(previousArchive))
        stagedArchive = JSON.stringify(archiveSchema.parse({ version: 1,
          archives: [...archive.archives, { raw: activeRaw, archivedAt: new Date().toISOString() }] }))
        if (!current() || storage.getItem(activeKey) !== activeRaw || storage.getItem(archiveKey) !== previousArchive) return { kind: "rejected", code: "STALE_BASE" } as const
        started = true
        storage.setItem(archiveKey, stagedArchive)
        if (storage.getItem(archiveKey) !== stagedArchive) throw Error("Archive readback failed")
        if (!current() || storage.getItem(activeKey) !== activeRaw) throw Error("Active plan changed")
        removingActive = true
        storage.removeItem(activeKey)
        if (storage.getItem(activeKey) !== null || !current()) throw Error("Active plan removal failed")
        return { kind: "archived" } as const
      } catch {
        if (!started) return { kind: "failed", rollbackComplete: true } as const
        const restore = (key: string, raw: string | null) => {
          try {
            if (raw === null) window.localStorage.removeItem(key)
            else window.localStorage.setItem(key, raw)
            return window.localStorage.getItem(key) === raw
          } catch { return false }
        }
        // Restore the active copy first; a failed archive rollback must not erase it.
        let activeRestored = !removingActive
        if (removingActive) {
          try {
            const currentRaw = window.localStorage.getItem(activeKey)
            activeRestored = currentRaw === activeRaw || currentRaw === null && restore(activeKey, activeRaw)
          } catch { activeRestored = false }
        }
        let archiveRestored = false
        // If the active copy cannot be confirmed, retain the archived original.
        // Rollback must never overwrite a different writer's archive either.
        if (activeRestored) {
          try {
            const currentArchive = window.localStorage.getItem(archiveKey)
            archiveRestored = currentArchive === previousArchive
              || currentArchive === stagedArchive && restore(archiveKey, previousArchive)
          } catch { archiveRestored = false }
        }
        return { kind: "failed", rollbackComplete: activeRestored && archiveRestored } as const
      }
    })
  } catch { return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" } }
}
