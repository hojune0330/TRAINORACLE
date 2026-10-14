import { useEffect, useRef, useState } from 'react'
import { drawPartyProp, loadPartyArt } from './party-art'
import { PartyIcon } from './PartyIcon'

/** One finite cosmetic clip. No game timer, blocking overlay or delayed action. */
export function PartyEffect({ reduced = false }: { readonly reduced?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [painted, setPainted] = useState(false)
  useEffect(() => {
    if (reduced) return
    let alive = true, frame = 0
    void loadPartyArt().then(() => {
      const canvas = ref.current, ctx = canvas?.getContext('2d')
      if (!alive || !canvas || !ctx) return
      const start = performance.now()
      const paint = (now: number) => {
        if (!alive) return
        const elapsed = Math.min(.639, (now-start)/1000)
        ctx.clearRect(0,0,128,128)
        if (drawPartyProp(ctx,'upgrade-core',64,64,128,elapsed)) setPainted(true)
        if (now-start < 640) frame=requestAnimationFrame(paint)
      }
      frame=requestAnimationFrame(paint)
    })
    return () => { alive=false; cancelAnimationFrame(frame) }
  }, [reduced])
  if (reduced) return <PartyIcon id="upgrade-core" size={72} />
  return <span style={{ position:'relative', display:'inline-grid', placeItems:'center', width:96, height:96 }} aria-hidden="true">
    {!painted && <PartyIcon id="upgrade-core" size={72} />}
    <canvas ref={ref} width={128} height={128} style={{ position:'absolute', inset:0, width:96, height:96 }} />
  </span>
}
