import {TD_PATH,TD_PADS,TD_TOWERS,TD_ENEMIES,routePoint,towerStats} from '../../domain/minigame/tower-defense'
import type {TowerDefense} from '../../domain/minigame/tower-defense'
import {TDSprite,tdTile,tdTowerArtwork,tdEnemyArtwork} from './TowerDefenseArtwork'
export {tdTile} from './TowerDefenseArtwork'
const path=TD_PATH.map(p=>`${p.x*100},${p.y*100}`).join(' ')
export function TowerDefenseBoard({state,selected,onSelect,buildEffect}:{state:TowerDefense;selected:number;onSelect:(pad:number)=>void;buildEffect?:{pad:number;at:number}|null}){
 const active=state.towers.find(t=>t.pad===selected),pad=TD_PADS[selected]!
 return <div className="td-board">
  <svg viewBox="0 0 1200 1000" role="img" aria-label="왼쪽 입구에서 굽은 길을 따라 오른쪽 기지로 향하는 전장">
   <defs><pattern id="td-grass" width="100" height="100" patternUnits="userSpaceOnUse"><image href={tdTile(162)} width="100" height="100"/></pattern><pattern id="td-dirt" width="100" height="100" patternUnits="userSpaceOnUse"><image href={tdTile(167)} width="100" height="100"/></pattern></defs>
   <rect width="1200" height="1000" className="td-grass"/><rect width="1200" height="1000" fill="url(#td-grass)"/>
   <polyline points={path} className="td-road-edge"/><polyline points={path} className="td-road"/><polyline points={path} className="td-road-texture"/>
   <text x="30" y="100" className="td-map-label">입구 →</text><text x="990" y="930" className="td-map-label">기지 {state.lives}</text>
   <TDSprite id="td-base-gate" x={1060} y={665} width={140} height={215} fallback={<path d="M1120 740h70v120h-70z" className="td-gate"/>}/>
   {active&&<circle data-testid="tower-range" cx={pad.x*100} cy={pad.y*100} r={towerStats(active).range*100} className="td-range"/>}
   {TD_PADS.map((p,i)=>{const tower=state.towers.find(t=>t.pad===i);return <g key={i} transform={`translate(${p.x*100},${p.y*100})`}>
    <TDSprite id="td-build-pad" x={-82} y={-62} width={164} height={125} fallback={<><circle r="58" className="td-foundation"/><image href={tdTile(180)} x="-70" y="-70" width="140" height="140"/></>}/>
    {tower&&<><TDSprite id={tdTowerArtwork(tower.kind,tower.level)} x={-104} y={-138} width={208} height={208} fallback={<><circle r="36" className={`td-tower-${tower.kind}`}/><image href={tdTile(TD_TOWERS[tower.kind].tile)} x="-95" y="-95" width="190" height="190" transform={`rotate(${tower.angle*180/Math.PI})`}/></>}/><text x="-30" y="94" className="td-level">Lv.{tower.level}</text></>}
    {selected===i&&<ellipse data-testid="tower-selection" cx="0" cy="22" rx="70" ry="38" className="td-selection-ring"/>}
    {buildEffect?.pad===i&&<TDSprite key={buildEffect.at} id="fx-upgrade-burst" x={-120} y={-150} width={240} className="td-build-effect"/>}
   </g>})}
   {state.enemies.map(e=>{const p=routePoint(e.distance),size=e.kind==='boss'?225:e.kind==='armored'?165:160;return <g key={e.id} transform={`translate(${p.x*100},${p.y*100})`}>
    <TDSprite id={tdEnemyArtwork(e.kind)} x={-size/2} y={-size*.64} width={size} fallback={<><circle r={e.kind==='boss'?35:22} className={`td-enemy td-enemy-${e.kind}`}/><image href={tdTile(TD_ENEMIES[e.kind].tile)} x={-size/2} y={-size/2} width={size} height={size}/></>}/>
    {e.slowUntil>state.time&&<circle r="42" className="td-frozen"/>}<rect x="-35" y={-size*.52} width="70" height="12" className="td-hp-back"/><rect x="-35" y={-size*.52} width={70*e.hp/e.maxHp} height="12" className="td-hp"/>
   </g>})}
   {state.shots.map((s,i)=>{const size=s.kind==='cannon'?240:140;return <g key={`${s.at}-${i}`} className={`td-shot td-shot-${s.kind}`}><line x1={s.from.x*100} y1={s.from.y*100} x2={s.to.x*100} y2={s.to.y*100}/><TDSprite id={s.kind==='cannon'?'fx-cannon-blast':s.kind==='frost'?'fx-frost-burst':'fx-hit-burst'} x={s.to.x*100-size/2} y={s.to.y*100-size/2} width={size} fallback={<circle cx={s.to.x*100} cy={s.to.y*100} r={s.kind==='cannon'?85:16}/>}/></g>})}
  </svg>
  {TD_PADS.map((p,i)=><button key={i} className="td-pad" style={{left:`${p.x/12*100}%`,top:`${p.y/10*100}%`}} aria-label={`${i+1}번 건설 지점`} aria-pressed={selected===i} onClick={()=>onSelect(i)}><span>{i+1}</span></button>)}
 </div>
}
