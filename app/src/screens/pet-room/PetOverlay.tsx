import React, { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function PetOverlay({ title, onClose, children, night = false, contained = false }: { title: string; onClose: () => void; children: ReactNode; night?: boolean; contained?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  return <div className={`pet-activity-backdrop${night ? ' pet-activity-backdrop--night' : ''}${contained ? ' pet-activity-backdrop--contained' : ''}`}>
    <section className={`pet-activity${contained ? ' pet-activity--contained' : ''}`} role="dialog" aria-modal="true" aria-labelledby="pet-activity-title" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key !== 'Tab') return
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(control => !control.closest('[hidden], [inert]'))
      const first = controls[0]; const last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
      <header className="pet-activity__header"><h2 id="pet-activity-title" tabIndex={-1} ref={heading}>{title}</h2><button type="button" className="pet-icon-button" aria-label="방으로 돌아가기" onClick={onClose}><X size={20} /></button></header>
      {children}
    </section>
  </div>
}
