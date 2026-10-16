import { PartyIcon } from './PartyIcon'
import './game-mode-art.css'
/** Original miniature stages assembled from our existing Tripo assets. */
export function GameModeArtwork({mode}:{mode:'push'|'survival'|'defense'}) {
  return <span className="game-mode-art" data-mode={mode} aria-hidden="true">
    <span className="game-mode-art__lane" />
    {mode==='defense'?<img src={`${import.meta.env.BASE_URL}game/kenney-td/tile250.png`} width="100" height="100" alt=""/>:<PartyIcon id={mode==='survival'?'jump-pad':'track-island'} size={100}/>}
    <span className="game-mode-art__satellite">{mode==='defense'?<img src={`${import.meta.env.BASE_URL}game/kenney-td/tile249.png`} width="52" height="52" alt=""/>:<PartyIcon id={mode==='survival'?'jump-pad':'respawn-beacon'} size={52}/>}</span>
  </span>
}
