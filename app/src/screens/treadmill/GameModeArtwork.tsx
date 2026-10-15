import { PartyIcon } from './PartyIcon'
import './game-mode-art.css'
/** Original miniature stages assembled from our existing Tripo assets. */
export function GameModeArtwork({mode}:{mode:'push'|'survival'|'defense'}) {
  return <span className="game-mode-art" data-mode={mode} aria-hidden="true">
    <span className="game-mode-art__lane" />
    <PartyIcon id={mode==='defense'?'upgrade-core':mode==='survival'?'jump-pad':'track-island'} size={100}/>
    <span className="game-mode-art__satellite"><PartyIcon id={mode==='defense'?'supply-capsule':mode==='survival'?'jump-pad':'respawn-beacon'} size={52}/></span>
  </span>
}
