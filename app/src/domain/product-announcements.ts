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
  title: "러닝 투어가 열렸어요",
  description: "멈추면 밀려나는 트랙, 한 판 달려볼까요?",
  actionLabel: "게임하기",
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
