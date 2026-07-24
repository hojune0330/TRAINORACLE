/* TRAINORACLE service worker — v2
 * 전략:
 *  - 내비게이션(HTML): network-first → 실패 시 캐시된 셸 (오프라인에서도 앱이 뜬다)
 *  - 해시된 정적 자산(/assets/): cache-first (Vite 해시 = 불변)
 *  - 아이콘/매니페스트: cache-first
 * 주의: 훈련계획·일지 데이터는 SW 캐시가 아니라 localStorage/IndexedDB 소관 — 여기서 다루지 않는다.
 */
const VERSION = "trainoracle-v2";
const SHELL = ["./", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부 요청은 관여하지 않음

  // 내비게이션: network-first, 오프라인이면 캐시된 셸
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./"))
    );
    return;
  }

  // 정적 자산: cache-first
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.includes("/assets/") || url.pathname.includes("/icons/"))) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
