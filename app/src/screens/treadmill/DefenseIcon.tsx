import { useState } from 'react'
import { defenseArtUrl } from './defense-art'
import type { DefenseArt } from './defense-art'
export function DefenseIcon({ id, size = 64 }: { readonly id: DefenseArt; readonly size?: number }) {
  const [failed, setFailed] = useState(false)
  return failed ? null : <img src={defenseArtUrl(id)} width={size} height={size} alt="" aria-hidden="true"
    className="solo-party__art" draggable={false} onError={() => setFailed(true)} />
}
