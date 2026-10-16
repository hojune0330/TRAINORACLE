import { useEffect, useRef, useState } from 'react'
import { drawPartyProp, loadPartyArt } from './party-art'
import { PartyIcon } from './PartyIcon'
import type { PartyProp, PartyEffectId } from './party-art'
import './party-effects.css'

/** One finite cosmetic clip. No game timer, blocking overlay or delayed action. */
export function PartyEffect({ reduced = false, id = 'upgrade-core', size = 96 }: {
  readonly reduced?: boolean; readonly id?: PartyProp | PartyEffectId; readonly size?: number
}) {
  if (id.startsWith('fx-')) return <span className="party-effect-frame" data-reduced={reduced || undefined}
    style={{ width: size, height: size }} aria-hidden="true">
    <PartyIcon id={id} size={size} />
  </span>
  return <LegacyPartyEffect reduced={reduced} id={id as PartyProp} size={size} />
}

function LegacyPartyEffect({ reduced, id, size }: {
  readonly reduced: boolean; readonly id: PartyProp; readonly size: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [painted, setPainted] = useState(false)
  useEffect(() => {
    if (reduced) return
    let alive = true, frame = 0
    void loadPartyArt(id === 'jump-pad').then(() => {
      const canvas = ref.current, ctx = canvas?.getContext('2d')
      if (!alive || !canvas || !ctx) return
      const start = performance.now()
      const paint = (now: number) => {
        if (!alive) return
        const elapsed = Math.min(.639, (now-start)/1000)
        ctx.clearRect(0,0,128,128)
        if (drawPartyProp(ctx,id,64,64,128,elapsed)) setPainted(true)
        if (now-start < 640) frame=requestAnimationFrame(paint)
      }
      frame=requestAnimationFrame(paint)
    })
    return () => { alive=false; cancelAnimationFrame(frame) }
  }, [reduced, id])
  if (reduced) return <PartyIcon id={id} size={size * .75} />
  return <span style={{ position:'relative', display:'inline-grid', placeItems:'center', width:size, height:size }} aria-hidden="true">
    {!painted && <PartyIcon id={id} size={size * .75} />}
    <canvas ref={ref} width={128} height={128} style={{ position:'absolute', inset:0, width:size, height:size }} />
  </span>
}
