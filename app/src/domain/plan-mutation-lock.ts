export const PLAN_BETA_MUTATION_LOCK_NAME = "trainoracle.plan-beta.mutation.v1"

export type PlanMutationLockManager = {
  request<T>(
    name: string,
    options: { readonly mode: "exclusive"; readonly ifAvailable: true },
    callback: (lock: object | null) => T | Promise<T>,
  ): Promise<T>
}

export function getPlanMutationLockManager(): PlanMutationLockManager | null {
  try {
    const candidate = (globalThis.navigator as (Navigator & { readonly locks?: unknown }) | undefined)?.locks
    if (candidate === null || typeof candidate !== "object") return null
    const request = Reflect.get(candidate, "request")
    if (typeof request !== "function") return null
    return { request: request.bind(candidate) as PlanMutationLockManager["request"] }
  } catch {
    return null
  }
}
