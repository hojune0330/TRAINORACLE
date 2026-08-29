// PWA 업데이트 — 새 버전이 발견되면 묻지 않고 즉시 교체한다.
// 베타 단계에는 실사용자가 없으므로 이전 버전 화면을 남겨 둘 이유가 없다.
// (오너 결정 2026-08-29: "지난 버전의 상태는 아무도 볼 필요가 없어. 선택할 것도 남기지 말고.")
let reloadRequested = false

function activateImmediately(worker: ServiceWorker): void {
  reloadRequested = true
  worker.postMessage({ type: "SKIP_WAITING" })
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
    if (next.waiting !== null) activateImmediately(next.waiting)
    next.addEventListener("updatefound", () => {
      const installing = next.installing
      if (installing === null) return
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller !== null) {
          activateImmediately(next.waiting ?? installing)
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
