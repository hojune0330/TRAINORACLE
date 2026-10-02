/* TRAINORACLE service worker — v6 (입력 보존 후 교체)
 * 전략:
 *  - 내비게이션(HTML): network-first → 실패 시 캐시된 셸 (오프라인에서도 앱이 뜬다)
 *  - 해시된 정적 자산(/assets/): cache-first (Vite 해시 = 불변)
 *  - 아이콘/매니페스트: cache-first
 *  - 꾸미기 컬렉션 자산(/collections/<id>/*.webp, assets.json): 의도적으로 캐시하지 않음.
 *    컬렉션은 늘어나고(시즌·굿즈) 대부분의 사용자는 한두 개만 열기 때문에 처음 열 때 lazy fetch 한다.
 *    프리캐시·런타임 캐시 어디에도 넣지 말 것 — 새 컬렉션을 추가해도 SW 버전을 올릴 필요가 없다.
 * 주의: 훈련계획·일지 데이터는 SW 캐시가 아니라 localStorage/IndexedDB 소관 — 여기서 다루지 않는다.
 */
const VERSION = `trainoracle-v6:${self.registration.scope}`;
const SHELL = ["./", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL))
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    // Keep prior hashed assets for open tabs; never delete another app's origin caches.
    self.clients.claim()
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부 요청은 관여하지 않음
  // Recovery probes must reach the server, not an offline shell.
  if (url.searchParams.has("screen-recovery-check")) return;

  // 내비게이션: network-first, 오프라인이면 캐시된 셸
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.headers.get("content-type")?.includes("text/html")) {
            const copy = res.clone();
            e.waitUntil(caches.open(VERSION).then((c) => c.put("./", copy)).catch(() => {}));
          }
          return res;
        })
        .catch(() => caches.open(VERSION).then((c) => c.match("./")).then((hit) => hit || Response.error()))
    );
    return;
  }

  // 정적 자산: cache-first
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          // `/collections/`는 여기 포함하지 않는다(위 전략 참고).
          if (res.ok && (
            url.pathname.includes("/assets/")
            || url.pathname.includes("/icons/")
            || url.pathname.includes("/fonts/")
          )) {
            const copy = res.clone();
            e.waitUntil(caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {}));
          }
          return res;
        })
    )
  );
});
