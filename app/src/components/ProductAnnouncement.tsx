import { useEffect, useReducer } from "react"
import { ArrowRight, Sparkles, X } from "lucide-react"
import { acknowledgeAnnouncement, announcementVisible, ANNOUNCEMENTS_CHANGED, type ProductAnnouncement as Notice } from "../domain/product-announcements"
import "./product-announcement.css"

/** One non-modal notice in a host-chosen slot; never steals focus or auto-opens. */
export function ProductAnnouncement({ notice, onOpen }: { readonly notice: Notice; readonly onOpen: () => void }) {
  const [, refresh] = useReducer(value => value + 1, 0)
  useEffect(() => {
    window.addEventListener("storage", refresh)
    window.addEventListener(ANNOUNCEMENTS_CHANGED, refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener(ANNOUNCEMENTS_CHANGED, refresh)
    }
  }, [])
  if (!announcementVisible(notice)) return null
  return <aside className="product-announcement" aria-label="새 소식">
    <Sparkles className="product-announcement__icon" size={22} aria-hidden="true" />
    <div className="product-announcement__copy">
      <span className="product-announcement__eyebrow">새로 나왔어요</span>
      <strong>{notice.title}</strong>
      <p>{notice.description}</p>
      <button type="button" className="product-announcement__open" onClick={() => { acknowledgeAnnouncement(notice); onOpen() }}>
        {notice.actionLabel}<ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
    <button type="button" className="product-announcement__dismiss" aria-label={`${notice.title} 안내 닫기`} onClick={() => acknowledgeAnnouncement(notice)}>
      <X size={18} aria-hidden="true" />
    </button>
  </aside>
}
