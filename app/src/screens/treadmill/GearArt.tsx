import { useState } from "react"
import { Footprints, MoveUp, Zap } from "lucide-react"
import type { TreadmillUpgrade } from "../../domain/minigame/treadmill"
import { sceneArtUrl } from "./scene-art"

export function GearArt({ upgrade }: { readonly upgrade: TreadmillUpgrade }) {
  const [failed, setFailed] = useState(false)
  const Icon = upgrade === "grip" ? Footprints : upgrade === "spring" ? MoveUp : Zap
  return <span className="treadmill-game__gear-art" data-gear={upgrade} aria-hidden="true">
    {failed || upgrade === "economy" ? <Icon size={28} /> : <>
      <img src={sceneArtUrl("shoe")} alt="" onError={() => setFailed(true)} />
      <Icon size={13} className="treadmill-game__gear-badge" />
    </>}
  </span>
}
