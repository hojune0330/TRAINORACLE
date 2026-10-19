// One exclusive writer per owner across tabs. A room holds the lease for its
// lifetime so its existing synchronous care completions can remain synchronous.
// Legacy clients only know v1 and never participate in the authoritative v2 key.
const held = new Map<string, { token: object; release: () => void }>()
const requests = new Map<string, { token: object; signal: AbortSignal | undefined; released: boolean; done: Promise<void> }>()
const lockName = (scope: string) => `trainoracle:pet-home:v2:${encodeURIComponent(scope)}`
export const petHomeLeaseHeld = (scope: string) => held.has(scope)
export type PetHomeLease = { ok: true; release: () => void } | { ok: false; error: string }
export const PET_HOME_BUSY = '다른 창에서 이 계정의 친구 방을 사용하고 있어요. 그 방을 닫고 다시 열어 주세요.'
const unsupported = '이 브라우저에서는 친구 기록을 안전하게 저장할 수 없어요. 지원되는 브라우저에서 다시 열어 주세요.'

export async function acquirePetHomeLease(scope: string, signal?: AbortSignal): Promise<PetHomeLease> {
  // React StrictMode may cancel one mount while its WebLock request is still
  // arriving. Wait for that cancelled/released request to leave LockManager;
  // merely clearing our local map would race the browser's actual release.
  const previous = requests.get(scope)
  if (previous && (previous.signal?.aborted || previous.released)) await previous.done
  if (signal?.aborted) return { ok: false, error: '친구 방 열기를 취소했어요.' }
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.locks?.request) { resolve({ ok: false, error: unsupported }); return }
    if (held.has(scope) || requests.has(scope)) { resolve({ ok: false, error: PET_HOME_BUSY }); return }
    const token = {}
    let finish: () => void = () => {}
    const entry = { token, signal, released: false, done: new Promise<void>(done => { finish = done }) }
    requests.set(scope, entry)
    const settled = () => { if (requests.get(scope)?.token === token) requests.delete(scope); finish() }
    try { void navigator.locks.request(lockName(scope), { mode: 'exclusive', ifAvailable: true }, lock => {
      if (signal?.aborted) { resolve({ ok: false, error: '친구 방 열기를 취소했어요.' }); return }
      if (!lock) { resolve({ ok: false, error: PET_HOME_BUSY }); return }
      return new Promise<void>(releaseLock => {
        const release = () => { signal?.removeEventListener('abort', release); entry.released = true; if (held.get(scope)?.token === token) held.delete(scope); releaseLock() }
        held.set(scope, { token, release })
        signal?.addEventListener('abort', release, { once: true })
        resolve({ ok: true, release })
      })
    }).catch(() => resolve({ ok: false, error: unsupported })).finally(settled) }
    catch { settled(); resolve({ ok: false, error: unsupported }) }
  })
}

/** Journal saves reuse this realm's room lease, otherwise take a short lease.
 * Contention never queues a late journal credit into a different account scope. */
export async function withPetHomeWrite<T>(scope: string, action: () => T): Promise<T> {
  if (held.has(scope)) return action()
  const lease = await acquirePetHomeLease(scope)
  if (!lease.ok) throw new Error(lease.error)
  try { return action() } finally { lease.release() }
}
