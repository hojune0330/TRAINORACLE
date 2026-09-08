import { useCallback, useEffect, useRef, useState } from "react"
import { ACCOUNT_PLAN_EVENT, accountPlanService, type AccountPlanMutation, type AccountPlanService } from "../../domain/account/account-plan-service"

/** Parent mounts this once per account epoch; never writes the legacy device plan key. */
export function useAccountPlanRuntime(service: AccountPlanService | null = accountPlanService()) {
  const [view, setView] = useState(() => service?.snapshot() ?? null)
  const activeService = useRef(service)
  activeService.current = service
  useEffect(() => {
    let current = true
    const refresh = () => { if (current) setView(service?.snapshot() ?? null) }
    window.addEventListener(ACCOUNT_PLAN_EVENT, refresh)
    refresh()
    void service?.hydrate().finally(refresh)
    return () => { current = false; window.removeEventListener(ACCOUNT_PLAN_EVENT, refresh) }
  }, [service])
  const mutate = useCallback(async (command: AccountPlanMutation) => {
    // Bind to the screen's rendered version, not whichever version is newest after a click.
    if (!service || !view?.fingerprint) return "STALE" as const
    const result = await service.mutate(command, view.fingerprint)
    if (activeService.current === service) setView(service.snapshot())
    return result
  }, [service, view?.fingerprint])
  const retry = useCallback(async (freshReview?: () => boolean) => {
    if (!service) return "FAILED" as const
    const result = await service.retry(freshReview)
    if (activeService.current === service) setView(service.snapshot())
    return result
  }, [service])
  return { view, mutate, retry }
}
