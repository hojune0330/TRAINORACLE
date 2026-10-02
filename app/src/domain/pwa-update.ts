import { isReloadBlocked } from "./screen-recovery"

/** Automatic updates remain enabled, but never discard a volatile draft. */
export function registerAppServiceWorker(baseUrl: string, reload = () => window.location.reload()): void {
  if (!("serviceWorker" in navigator)) return
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
  if (local && new URLSearchParams(window.location.search).get("pwa-test") !== "1") return

  let registration: ServiceWorkerRegistration | null = null
  let pendingWorker: ServiceWorker | null = null
  let reloadRequested = false
  let controllerChanged = false
  let checking = false
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  const resume = () => {
    if (retryTimer !== undefined) clearTimeout(retryTimer)
    retryTimer = undefined
    if (!pendingWorker && !controllerChanged) return
    // Even a form without a registered draft guard must not be replaced mid-entry.
    const inputSurface = document.querySelector("input:not([type='hidden']), textarea, select, [contenteditable='true']")
    if (document.visibilityState !== "visible" || isReloadBlocked() || inputSurface !== null) {
      retryTimer = setTimeout(resume, 5_000)
      return
    }
    if (controllerChanged) {
      controllerChanged = false
      reload()
      return
    }
    const worker = pendingWorker
    pendingWorker = null
    reloadRequested = true
    worker?.postMessage({ type: "SKIP_WAITING" })
  }
  const activateWhenSafe = (worker: ServiceWorker) => {
    pendingWorker = worker
    resume()
  }
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadRequested) return
    reloadRequested = false
    controllerChanged = true
    resume()
  })

  const inspectRegistration = (next: ServiceWorkerRegistration) => {
    registration = next
    if (next.waiting !== null) activateWhenSafe(next.waiting)
    next.addEventListener("updatefound", () => {
      const installing = next.installing
      if (installing === null) return
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller !== null) {
          activateWhenSafe(next.waiting ?? installing)
        }
      })
    })
  }

  void navigator.serviceWorker
    .register(`${baseUrl}sw.js`, { scope: baseUrl })
    .then(inspectRegistration)
    .catch(() => console.warn("[SW] registration unavailable"))

  const checkForUpdate = () => {
    resume()
    if (document.visibilityState !== "visible" || !registration || checking) return
    checking = true
    void registration.update()
      .catch(() => console.warn("[SW] update unavailable; keeping current screen"))
      .finally(() => { checking = false })
  }
  window.addEventListener("focus", checkForUpdate)
  document.addEventListener("visibilitychange", checkForUpdate)
}
