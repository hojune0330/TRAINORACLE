import { ACCOUNT_GOAL_PROGRAM_BUFFER } from "./account-goal-program-schema"

type DeleteDatabaseFactory = Pick<IDBFactory, "deleteDatabase">

export type GoalProgramDatabaseDisposalResult = {
  readonly ok: boolean
  /** Exact local database name, present when deletion could not be confirmed. */
  readonly failed: readonly string[]
}

function browserFactory(): DeleteDatabaseFactory | null {
  try {
    return typeof indexedDB === "undefined" ? null : indexedDB
  } catch {
    return null
  }
}

function failed(): GoalProgramDatabaseDisposalResult {
  return { ok: false, failed: [ACCOUNT_GOAL_PROGRAM_BUFFER] }
}

/**
 * Delete only the device-wide account goal-program database. IndexedDB sends
 * `versionchange` to open connections; the account buffer closes on that event.
 * A blocked/error request is deliberately reported as incomplete.
 */
export function disposeGoalProgramDatabase(
  factory: DeleteDatabaseFactory | null = browserFactory(),
): Promise<GoalProgramDatabaseDisposalResult> {
  if (!factory) return Promise.resolve(failed())

  try {
    const request = factory.deleteDatabase(ACCOUNT_GOAL_PROGRAM_BUFFER)
    return new Promise(resolve => {
      let settled = false
      const finish = (ok: boolean) => {
        if (settled) return
        settled = true
        resolve(ok ? { ok: true, failed: [] } : failed())
      }

      try {
        request.onsuccess = () => finish(true)
        request.onerror = () => finish(false)
        request.onblocked = () => finish(false)
      } catch {
        finish(false)
      }
    })
  } catch {
    return Promise.resolve(failed())
  }
}
