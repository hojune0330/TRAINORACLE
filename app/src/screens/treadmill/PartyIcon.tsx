import { useState } from 'react'
import type { ReactNode } from 'react'
import { partyIconUrl } from './party-art'
import type { PartyProp } from './party-art'

/** Decorative image; the surrounding real button/text retains the accessible name. */
export function PartyIcon({ id, size = 64, fallback = null }: {
  readonly id: PartyProp; readonly size?: number; readonly fallback?: ReactNode
}) {
  const [failed, setFailed] = useState<string | null>(null)
  if (failed === id) return <>{fallback}</>
  return <img className="treadmill-party-icon" src={partyIconUrl(id)} alt="" aria-hidden="true"
    width={size} height={size} draggable={false}
    style={{ width: size, height: size, objectFit: 'contain', transform: 'none', flexShrink: 0 }}
    onError={() => setFailed(id)} />
}
