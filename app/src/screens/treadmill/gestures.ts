type Point = { x: number; y: number; time: number }
type Contact = Point & {
  moved: number; jumped: boolean; multiple: boolean
  anchorX: number; anchorY: number; peakY: number; armed: boolean
}

/** Screen-space gestures only. The engine still owns energy, cooldown and jump rules. */
export function createGameGestures() {
  const contacts = new Map<number, Contact>()
  let tap: Point | null = null
  return {
    get held() { return contacts.size > 0 },
    reset() { contacts.clear(); tap = null },
    down(id: number, point: Point): boolean {
      const multiple = contacts.size > 0
      if (multiple) for (const contact of contacts.values()) contact.multiple = true
      const dash = !multiple && tap !== null && point.time - tap.time >= 0
        && point.time - tap.time <= 300 && Math.hypot(point.x - tap.x, point.y - tap.y) <= 48
      tap = null
      contacts.set(id, { ...point, moved: 0, jumped: false, multiple,
        anchorX: point.x, anchorY: point.y, peakY: point.y, armed: true })
      return dash
    },
    move(id: number, point: Point): boolean {
      const contact = contacts.get(id)
      if (!contact) return false
      contact.moved = Math.max(contact.moved, Math.hypot(point.x - contact.x, point.y - contact.y))
      if (!contact.armed) {
        contact.peakY = Math.min(contact.peakY, point.y)
        // A deliberate downward return rearms the next stroke; small jitter does not.
        if (point.y - contact.peakY >= 24) {
          contact.armed = true
          contact.anchorX = point.x; contact.anchorY = point.y
        }
        return false
      }
      if (point.y > contact.anchorY) {
        contact.anchorX = point.x; contact.anchorY = point.y
      }
      const dx = point.x - contact.anchorX, up = contact.anchorY - point.y
      if (up < 28 || up < Math.abs(dx) * 0.45) return false
      contact.jumped = true; contact.armed = false; contact.peakY = point.y; tap = null
      return true
    },
    up(id: number, point: Point) {
      const contact = contacts.get(id)
      if (!contact) return
      contacts.delete(id)
      const distance = Math.max(contact.moved, Math.hypot(point.x - contact.x, point.y - contact.y))
      tap = !contact.multiple && !contact.jumped && contacts.size === 0
        && point.time - contact.time <= 220 && distance <= 14 ? point : null
    },
    cancel(id: number) {
      // Normal pointerup is followed by lostpointercapture: do not erase a completed tap.
      if (contacts.delete(id)) tap = null
    },
  }
}
