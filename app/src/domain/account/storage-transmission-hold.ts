// Only a boolean preference per account, never journal content. An unconfirmed
// withdrawal must not be silently undone by a status refresh or another tab.
const held = new Set<string>()
const key = (userId: string) => `trainoracle.account.storage-withdrawal-pending.${userId}`
export function holdStorageTransmission(userId: string) {
  held.add(userId)
  try { localStorage.setItem(key(userId), "true") } catch { /* in-memory hold remains */ }
}
export function releaseStorageTransmissionHold(userId: string) {
  held.delete(userId)
  try { localStorage.removeItem(key(userId)) } catch { /* a durable hold fails closed */ }
}
export function isStorageTransmissionHeld(userId: string) {
  try { if (localStorage.getItem(key(userId)) === "true") return true } catch { /* use in-memory hold */ }
  return held.has(userId)
}
