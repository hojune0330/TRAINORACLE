import { useCallback, useEffect, useRef, useState } from "react"
import { ACCOUNT_PLAN_EVENT, accountPlanService, type AccountPlanMutation, type AccountPlanService, type AccountPlanResult } from "../../domain/account/account-plan-service"

type AccountPlanRuntime = {
  view: ReturnType<AccountPlanService["snapshot"]> | null;
  mutate: (command: AccountPlanMutation) => Promise<AccountPlanResult>;
  retry: (freshReview?: () => boolean) => Promise<AccountPlanResult>;
}

/** Parent mounts this once per account epoch; never writes the legacy device plan key. */
export function useAccountPlanRuntime(service: AccountPlanService | null = accountPlanService()): AccountPlanRuntime {
  const [stored, setStored] = useState<{ service: AccountPlanService | null; view: ReturnType<AccountPlanService["snapshot"]> | null }>(
    () => ({ service, view: service?.snapshot() ?? null }))
  const view = stored.service === service ? stored.view : service?.snapshot() ?? null
  const activeService = useRef(service)
  activeService.current = service
  useEffect(() => {
    let current = true
    const refresh = () => { if (current) setStored({ service, view: service?.snapshot() ?? null }) }
    window.addEventListener(ACCOUNT_PLAN_EVENT, refresh)
    refresh()
    void service?.hydrate().finally(refresh)
    return () => { current = false; window.removeEventListener(ACCOUNT_PLAN_EVENT, refresh) }
  }, [service])
  const mutate = useCallback(async (command: AccountPlanMutation) => {
    // Bind to the screen's rendered version, not whichever version is newest after a click.
    if (!service || !view?.fingerprint) return "STALE" as const
    const result = await service.mutate(command, view.fingerprint)
    if (activeService.current === service) setStored({ service, view: service.snapshot() })
    return result
  }, [service, view?.fingerprint])
  const retry = useCallback(async (freshReview?: () => boolean) => {
    if (!service) return "FAILED" as const
    const result = await service.retry(freshReview)
    if (activeService.current === service) setStored({ service, view: service.snapshot() })
    return result
  }, [service])
  return { view, mutate, retry }
}
