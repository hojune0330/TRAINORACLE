import {TD_PATH,TD_PADS,TD_TOWERS,TD_ENEMIES,routePoint,towerStats} from '../../domain/minigame/tower-defense'
import type {TowerDefense} from '../../domain/minigame/tower-defense'
export const tdTile=(n:number)=>`${import.meta.env.BASE_URL}game/kenney-td/tile${n}.png`
const path=TD_PATH.map(p=>`${p.x*100},${p.y*100}`).join(' ')
export function TowerDefenseBoard({state,selected,onSelect}:{state:TowerDefense;selected:number;onSelect:(pad:number)=>void}){
 const active=state.towers.find(t=>t.pad===selected),pad=TD_PADS[selected]!
 return <div className="td-board">
  <svg viewBox="0 0 1200 1000" role="img" aria-label="왼쪽 입구에서 굽은 길을 따라 오른쪽 기지로 향하는 전장">
   <defs><pattern id="td-grass" width="100" height="100" patternUnits="userSpaceOnUse"><image href={tdTile(162)} width="100" height="100"/></pattern><pattern id="td-dirt" width="100" height="100" patternUnits="userSpaceOnUse"><image href={tdTile(167)} width="100" height="100"/></pattern></defs>
   <rect width="1200" height="1000" className="td-grass"/><rect width="1200" height="1000" fill="url(#td-grass)"/>
   <polyline points={path} className="td-road-edge"/><polyline points={path} className="td-road"/><polyline points={path} className="td-road-texture"/>
   <text x="30" y="100" className="td-map-label">입구 →</text><text x="990" y="930" className="td-map-label">기지 {state.lives}</text>
   <path d="M1120 740h70v120h-70z" className="td-gate"/>
   {active&&<circle data-testid="tower-range" cx={pad.x*100} cy={pad.y*100} r={towerStats(active).range*100} className="td-range"/>}
   {TD_PADS.map((p,i)=>{const tower=state.towers.find(t=>t.pad===i);return <g key={i} transform={`translate(${p.x*100},${p.y*100})`}>
    <circle r="58" className={`td-foundation ${selected===i?'td-selected':''}`}/><image href={tdTile(180)} x="-70" y="-70" width="140" height="140"/>
    {tower&&<><circle r="36" className={`td-tower-${tower.kind}`}/><image href={tdTile(TD_TOWERS[tower.kind].tile)} x="-95" y="-95" width="190" height="190" transform={`rotate(${tower.angle*180/Math.PI})`}/><text x="-30" y="92" className="td-level">Lv.{tower.level}</text></>}
   </g>})}
   {state.enemies.map(e=>{const p=routePoint(e.distance),size=e.kind==='boss'?300:225;return <g key={e.id} transform={`translate(${p.x*100},${p.y*100})`}>
    <circle r={e.kind==='boss'?35:22} className={`td-enemy td-enemy-${e.kind}`}/><image href={tdTile(TD_ENEMIES[e.kind].tile)} x={-size/2} y={-size/2} width={size} height={size}/>
    {e.slowUntil>state.time&&<circle r="42" className="td-frozen"/>}<rect x="-35" y="-53" width="70" height="12" className="td-hp-back"/><rect x="-35" y="-53" width={70*e.hp/e.maxHp} height="12" className="td-hp"/>
   </g>})}
   {state.shots.map((s,i)=><g key={i} className={`td-shot td-shot-${s.kind}`}><line x1={s.from.x*100} y1={s.from.y*100} x2={s.to.x*100} y2={s.to.y*100}/><circle cx={s.to.x*100} cy={s.to.y*100} r={s.kind==='cannon'?85:16}/></g>)}
  </svg>
  {TD_PADS.map((p,i)=><button key={i} className="td-pad" style={{left:`${p.x/12*100}%`,top:`${p.y/10*100}%`}} aria-label={`${i+1}번 건설 지점`} aria-pressed={selected===i} onClick={()=>onSelect(i)}><span>{i+1}</span></button>)}
 </div>
}
