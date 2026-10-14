import { useEffect, useRef } from "react"
import type { TourCity } from "../../domain/minigame/tour"
import { citySceneFor, drawCityBackdrop, drawCityGround } from "./city-art"
import { gamePalette } from "./sprites"
import { loadSceneArt } from "./scene-art"

/** Reuses the playable world's renderer so the map never promises a different course. */
export function CityPreview({ city }: { readonly city: TourCity }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    let mounted = true
    const paint = () => {
      if (!mounted) return
      const palette = gamePalette(canvas)
      const frame = { width: 390, height: 210, floor: 170, left: 22, beltWidth: 350,
        travel: 80, clock: 0, reduced: true, low: true, skyFromShader: false }
      const scene = citySceneFor(city, "track")
      drawCityBackdrop(ctx, palette, scene, frame)
      drawCityGround(ctx, palette, scene, frame, 0.1, 0)
    }
    paint()
    void loadSceneArt().then(() => {
      if (!mounted) return
      paint()
      canvas.dataset.art = "settled"
    })
    return () => { mounted = false }
  }, [city])
  return <span className="treadmill-game__city-preview" aria-hidden="true">
    <canvas ref={ref} width={390} height={210} data-art="loading" />
    <span>트랙 <i /> 진흙 <i /> 야간</span>
  </span>
}
