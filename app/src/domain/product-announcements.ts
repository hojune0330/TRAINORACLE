/** Small release notices only. No account/health data, network calls or reward writes. */
export type ProductAnnouncement = {
  readonly id: string
  readonly version: number
  readonly enabled: boolean
  readonly title: string
  readonly description: string
  readonly actionLabel: string
  readonly illustration?: "running-game-announcement" | "pace-calculator-announcement"
}

export const MINIGAME_ANNOUNCEMENT: ProductAnnouncement = {
  id: "running-tour", version: 1, enabled: true,
  title: "게임 라운지에서 한 판 어때요?",
  description: "달리기부터 디펜스까지, 혼자 또는 친구와 즐겨요.",
  actionLabel: "게임 라운지 열기",
  illustration: "running-game-announcement",
}

export const announcementKey = (notice: ProductAnnouncement): string =>
  `trainoracle:announcement:${notice.id}:v${notice.version}`
// Storage can be unavailable in embedded/private browsers. Still dismiss for this page session.
const sessionAcknowledged = new Set<string>()
export const ANNOUNCEMENTS_CHANGED = "trainoracle:announcements-changed"

export function announcementVisible(notice: ProductAnnouncement): boolean {
  if (!notice.enabled) return false
  const key = announcementKey(notice)
  try { return !sessionAcknowledged.has(key) && localStorage.getItem(key) !== "acknowledged" }
  catch { return !sessionAcknowledged.has(key) }
}

export function acknowledgeAnnouncement(notice: ProductAnnouncement): void {
  const key = announcementKey(notice)
  sessionAcknowledged.add(key)
  try { localStorage.setItem(key, "acknowledged") } catch { /* in-memory fallback above */ }
  window.dispatchEvent(new Event(ANNOUNCEMENTS_CHANGED))
}
