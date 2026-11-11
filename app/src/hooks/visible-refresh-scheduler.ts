export type RefreshClock = { now: () => number; set: (run: () => void, delay: number) => unknown; clear: (timer: unknown) => void }
/** Browser-independent scheduling, with no access to records or credentials. */
export function startVisibleRefresh(run: () => Promise<boolean>, visible: () => boolean, clock: RefreshClock, waiting = false) {
  let stopped = false, running = false, failures = 0, lastStarted = -Infinity
  let timer: unknown
  const began = clock.now()
  const delay = () => failures ? Math.min(300000, 15000 * 2 ** (failures - 1))
    : waiting && clock.now() - began < 120000 ? (clock.now() - began < 15000 ? 15000 : clock.now() - began < 45000 ? 30000 : 60000) : 60000
  const schedule = () => { clock.clear(timer); if (!stopped && visible()) timer = clock.set(() => { void refresh() }, delay()) }
  const refresh = async () => {
    if (stopped || running || !visible()) return
    if (clock.now() - lastStarted < 10000) { schedule(); return }
    running = true; lastStarted = clock.now()
    try { failures = await run() ? 0 : failures + 1 } catch { failures += 1 }
    finally { running = false; schedule() }
  }
  schedule()
  return { wake: () => { if (visible()) void refresh(); else clock.clear(timer) }, stop: () => { stopped = true; clock.clear(timer) } }
}
