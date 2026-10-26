import { useState } from "react"
import { Footprints, MoveUp, Zap } from "lucide-react"
import type { TreadmillUpgrade } from "../../domain/minigame/treadmill"
import { sceneArtUrl } from "./scene-art"

export function GearArt({ upgrade }: { readonly upgrade: TreadmillUpgrade }) {
  const [failed, setFailed] = useState(false)
  const Icon = upgrade === "grip" ? Footprints : upgrade === "spring" ? MoveUp : Zap
  if (upgrade === "economy") return <span className="treadmill-game__gear-art" data-gear="economy" aria-hidden="true">
    <span className="treadmill-game__gear-band"><Zap size={18} /></span>
  </span>
  return <span className="treadmill-game__gear-art" data-gear={upgrade} aria-hidden="true">
    {failed ? <Icon size={28} /> : <>
      <img src={sceneArtUrl("shoe")} alt="" onError={() => setFailed(true)} />
      <Icon size={13} className="treadmill-game__gear-badge" />
      {upgrade === "spring" && <span className="treadmill-game__gear-springs"><i /><i /></span>}
    </>}
  </span>
}
