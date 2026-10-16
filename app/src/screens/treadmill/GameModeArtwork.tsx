import { PartyIcon } from './PartyIcon'
import {TDArtwork} from './TowerDefenseArtwork'
import './game-mode-art.css'
/** Decorative previews from the same assets used by each game mode. */
export function GameModeArtwork({mode}:{mode:'push'|'survival'|'defense'}) {
  return <span className="game-mode-art" data-mode={mode} aria-hidden="true">
    <span className="game-mode-art__lane" />
    {mode==='defense'?<TDArtwork id="td-cannon-tower" size={100} fallbackTile={250}/>:<PartyIcon id={mode==='survival'?'jump-pad':'track-island'} size={100}/>}
    <span className="game-mode-art__satellite">{mode==='defense'?<TDArtwork id="td-rapid-tower" size={52} fallbackTile={249}/>:<PartyIcon id={mode==='survival'?'jump-pad':'respawn-beacon'} size={52}/>}</span>
  </span>
}
