import { useState } from 'react'
import type { ReactNode } from 'react'
import { partyIconSources } from './party-art'
import type { PartyArtId } from './party-art'

/** Decorative image; the surrounding real button/text retains the accessible name. */
export function PartyIcon({ id, size = 64, fallback = null }: {
  readonly id: PartyArtId; readonly size?: number; readonly fallback?: ReactNode
}) {
  const [failed, setFailed] = useState<readonly string[]>([])
  const source = partyIconSources(id).find(url => !failed.includes(url))
  if (!source) return <>{fallback}</>
  return <img className="treadmill-party-icon" src={source} alt="" aria-hidden="true"
    width={size} height={size} draggable={false}
    style={{ width: size, height: size, objectFit: 'contain', transform: 'none', flexShrink: 0 }}
    onError={() => setFailed(previous => previous.includes(source) ? previous : [...previous, source])} />
}
