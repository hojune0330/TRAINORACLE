import React from "react"
import { activeLocalAccount, onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"

export function useImportOwnerScope(onChange: () => void) {
  const generation = React.useRef(0)
  const callback = React.useRef(onChange)
  callback.current = onChange
  React.useEffect(() => {
    let owner = activeLocalAccount()
    const unsubscribe = onLocalJournalScopeChange(() => {
      const next = activeLocalAccount()
      if (next === owner) return
      owner = next; generation.current++; callback.current()
    })
    return () => { generation.current++; unsubscribe() }
  }, [])
  return () => {
    const epoch = generation.current
    const owner = activeLocalAccount()
    return () => generation.current === epoch && activeLocalAccount() === owner
  }
}
