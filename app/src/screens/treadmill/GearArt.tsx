import { useState } from "react"
import { Footprints, MoveUp, Zap } from "lucide-react"
import type { TreadmillUpgrade } from "../../domain/minigame/treadmill"
import { sceneArtUrl } from "./scene-art"
import { PartyIcon } from "./PartyIcon"

export function GearArt({ upgrade }: { readonly upgrade: TreadmillUpgrade }) {
  const [failed, setFailed] = useState(false)
  const Icon = upgrade === "grip" ? Footprints : upgrade === "spring" ? MoveUp : Zap
  if (upgrade !== "grip") return <PartyIcon id={upgrade === "spring" ? "jump-pad" : "supply-capsule"} size={48} fallback={<Icon size={28} />} />
  return <span className="treadmill-game__gear-art" data-gear={upgrade} aria-hidden="true">
    {failed ? <Icon size={28} /> : <>
      <img src={sceneArtUrl("shoe")} alt="" onError={() => setFailed(true)} />
      <Icon size={13} className="treadmill-game__gear-badge" />
    </>}
  </span>
}
