type Point = { x: number; y: number; time: number }
type Contact = Point & { moved: number; jumped: boolean; multiple: boolean }

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
      contacts.set(id, { ...point, moved: 0, jumped: false, multiple })
      return dash
    },
    move(id: number, point: Point): boolean {
      const contact = contacts.get(id)
      if (!contact) return false
      const dx = point.x - contact.x, up = contact.y - point.y
      contact.moved = Math.max(contact.moved, Math.hypot(dx, up))
      if (contact.jumped || up < 28 || up < Math.abs(dx) * 0.45) return false
      contact.jumped = true; tap = null
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
