import { useEffect, useLayoutEffect, useRef } from "react"
import { localAccountScopeSnapshot } from "../../domain/account/local-account-scope"
import { registerUnsavedDraftGuard } from "../../domain/unsaved-draft-navigation"

export function usePlanDraftNavigationGuard(hasDraft: boolean) {
  const owner = useRef(localAccountScopeSnapshot())
  const dirty = useRef(hasDraft)
  useLayoutEffect(() => { dirty.current = hasDraft }, [hasDraft])
  useEffect(() => {
    const unsafe = () => dirty.current && owner.current === localAccountScopeSnapshot()
    const unregister = registerUnsavedDraftGuard({
      isUnsafe: unsafe,
      onBlocked: () => {},
      confirmDiscard: () => window.confirm("아직 저장하지 않은 계획이 있어요. 계획 만들기를 그만두고 이동할까요?\n계속 만들려면 취소를 눌러 주세요."),
      discard: () => { dirty.current = false },
    })
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unsafe()) { event.preventDefault(); event.returnValue = "" }
    }
    window.addEventListener("beforeunload", beforeUnload)
    return () => { unregister(); window.removeEventListener("beforeunload", beforeUnload) }
  }, [])
}
