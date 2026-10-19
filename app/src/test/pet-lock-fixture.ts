export function petLockFixture() {
  const busy = new Set<string>()
  const manager = { request: (name: string, _options: LockOptions, callback: (lock: Lock | null) => unknown) => {
    if (busy.has(name)) return Promise.resolve(callback(null))
    busy.add(name)
    try { return Promise.resolve(callback({ name, mode: 'exclusive' } as Lock)).finally(() => busy.delete(name)) }
    catch (error) { busy.delete(name); return Promise.reject(error) }
  } }
  return { manager, external: (scope: string) => { const name = `trainoracle:pet-home:v2:${encodeURIComponent(scope)}`; busy.add(name); return () => busy.delete(name) } }
}
