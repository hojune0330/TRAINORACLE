/**
 * Popover — TermHelp / BalanceMarker 공용 팝오버 프리미티브
 *
 * 해결하는 문제 (총책임자 UX 진단):
 * 1. 오버플로우: 카드가 left/right 고정이라 화면 가장자리에서 프레임 밖으로 넘어감
 *    → 열릴 때 가장 가까운 [data-mobile-frame] (없으면 뷰포트) 경계를 측정해
 *      수평 보정(translateX clamp), 아래 공간 부족 + 위 공간이 더 크면 위로 뒤집기(flip).
 * 2. 접근성: Escape 닫기, 바깥 탭 닫기.
 * 3. 검증 가능성: URL에 ?uitest 가 있으면 모든 팝오버가 자동 열리고
 *    보정 후 실측 결과를 [POPCLAMP] 콘솔 로그로 남긴다 (런타임 증거용, 프로덕션 무해).
 *
 * 표시 전용 — 어떤 데이터·안전 상태도 변경하지 않는다.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, ReactNode, RefObject } from "react"

const UITEST =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("uitest")

export function usePopover(): {
  open: boolean
  toggle: () => void
  wrapRef: RefObject<HTMLSpanElement>
} {
  const [open, setOpen] = useState<boolean>(UITEST)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return { open, toggle: () => setOpen(v => !v), wrapRef }
}

function boundaryRect(el: HTMLElement): DOMRect {
  const frame = el.closest("[data-mobile-frame]") as HTMLElement | null
  if (frame) return frame.getBoundingClientRect()
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight)
}

export function PopCard({ open, align = "left", width = 232, accentBorder, label, children }: {
  open: boolean
  /** 트리거 기준 기본 정렬 (보정 전) */
  align?: "left" | "right"
  width?: number
  /** 카드 테두리/좌측 강조선 색 (안전 용어 = warn) */
  accentBorder: { border: string; bar: string }
  /** uitest 로그 식별용 */
  label?: string
  children: ReactNode
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [adj, setAdj] = useState<{ dx: number; up: boolean } | null>(null)

  // 1차: 초기 위치로 렌더(숨김) → 실측 → 보정값 확정
  useLayoutEffect(() => {
    if (!open) { setAdj(null); return }
    const el = cardRef.current
    if (!el) return
    const fr = boundaryRect(el)
    const r = el.getBoundingClientRect()
    const pad = 10
    let dx = 0
    if (r.right > fr.right - pad) dx = fr.right - pad - r.right
    if (r.left + dx < fr.left + pad) dx = fr.left + pad - r.left
    const anchor = el.parentElement?.getBoundingClientRect()
    let up = false
    if (anchor) {
      const spaceBelow = fr.bottom - anchor.bottom
      const spaceAbove = anchor.top - fr.top
      up = r.height + pad > spaceBelow && spaceAbove > spaceBelow
    }
    setAdj({ dx: Math.round(dx), up })
  }, [open])

  // 2차(uitest 전용): 보정 적용 후 실측 재검증 로그
  useLayoutEffect(() => {
    if (!open || !adj || !UITEST) return
    const el = cardRef.current
    if (!el) return
    const fr = boundaryRect(el)
    const r = el.getBoundingClientRect()
    const withinX = r.left >= fr.left - 1 && r.right <= fr.right + 1
    console.log(`[POPCLAMP] label=${label ?? "?"} withinX=${withinX} dx=${adj.dx} up=${adj.up} card=[${Math.round(r.left)},${Math.round(r.right)}] frame=[${Math.round(fr.left)},${Math.round(fr.right)}]`)
  }, [open, adj, label])

  if (!open) return null

  const positionerStyle: CSSProperties = {
    position: "absolute",
    ...(adj?.up ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }),
    ...(align === "right" ? { right: -8 } : { left: -8 }),
    transform: adj ? `translateX(${adj.dx}px)` : undefined,
    visibility: adj ? "visible" : "hidden",
    zIndex: 40,
  }

  const surfaceStyle: CSSProperties = {
    width,
    background: "var(--surface)",
    border: `1px solid ${accentBorder.border}`,
    borderLeft: `3px solid ${accentBorder.bar}`,
    boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
    padding: "10px 12px",
    textTransform: "none", letterSpacing: 0, textAlign: "left",
  }

  return (
    <div
      ref={cardRef}
      className="popover-positioner"
      data-align={align}
      data-side={adj?.up ? "top" : "bottom"}
      style={positionerStyle}
    >
      <div role="note" className="popover-surface" style={surfaceStyle}>{children}</div>
    </div>
  )
}
