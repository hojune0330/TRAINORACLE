type UpdateListener = (ready: boolean) => void

const listeners = new Set<UpdateListener>()
let waitingWorker: ServiceWorker | null = null
let reloadRequested = false

function publish(): void {
  for (const listener of listeners) listener(waitingWorker !== null)
}

function rememberWaiting(worker: ServiceWorker | null): void {
  waitingWorker = worker
  publish()
}

export function subscribeToAppUpdate(listener: UpdateListener): () => void {
  listeners.add(listener)
  listener(waitingWorker !== null)
  return () => listeners.delete(listener)
}

export function activateWaitingAppUpdate(): void {
  if (waitingWorker === null) return
  reloadRequested = true
  waitingWorker.postMessage({ type: "SKIP_WAITING" })
}

export function registerAppServiceWorker(baseUrl: string): void {
  if (!("serviceWorker" in navigator)) return

  let registration: ServiceWorkerRegistration | null = null
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadRequested) return
    reloadRequested = false
    window.location.reload()
  })

  const inspectRegistration = (next: ServiceWorkerRegistration) => {
    registration = next
    if (next.waiting !== null) rememberWaiting(next.waiting)
    next.addEventListener("updatefound", () => {
      const installing = next.installing
      if (installing === null) return
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller !== null) {
          rememberWaiting(next.waiting ?? installing)
        }
      })
    })
  }

  void navigator.serviceWorker
    .register(`${baseUrl}sw.js`, { scope: baseUrl })
    .then(inspectRegistration)
    .catch((error) => console.warn("[SW] register failed:", error))

  const checkForUpdate = () => {
    if (document.visibilityState === "visible") void registration?.update()
  }
  window.addEventListener("focus", checkForUpdate)
  document.addEventListener("visibilitychange", checkForUpdate)
}
