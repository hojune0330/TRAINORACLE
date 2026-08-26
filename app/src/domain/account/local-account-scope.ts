import { activeLocalAccount } from "./local-journal-ownership"

const ACCOUNT_SCOPE_SEGMENT = ".account."

/**
 * 비로그인 데이터는 기존 키를 유지하고, 로그인 데이터만 계정별 공간에 둔다.
 * 계정 ID는 키 구성요소로만 쓰며 저장된 데이터 본문에는 추가하지 않는다.
 */
export function accountScopedStorageKey(baseKey: string): string {
  return accountScopedStorageKeyFor(baseKey, activeLocalAccount())
}

export function accountScopedStorageKeyFor(
  baseKey: string,
  userId: string | null,
): string {
  return userId === null
    ? baseKey
    : `${baseKey}${ACCOUNT_SCOPE_SEGMENT}${encodeURIComponent(userId)}`
}

export function localAccountScopeSnapshot(): string | null {
  return activeLocalAccount()
}

export function localAccountScopeIsCurrent(snapshot: string | null): boolean {
  return activeLocalAccount() === snapshot
}

export function accountScopedStoragePrefix(baseKey: string): string {
  return `${baseKey}${ACCOUNT_SCOPE_SEGMENT}`
}

export function findAccountScopedStorageKeys(
  storage: Storage,
  baseKeys: readonly string[],
): string[] {
  const prefixes = baseKeys.map(accountScopedStoragePrefix)
  const matches: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key !== null && prefixes.some((prefix) => key.startsWith(prefix))) {
      matches.push(key)
    }
  }
  return matches
}
