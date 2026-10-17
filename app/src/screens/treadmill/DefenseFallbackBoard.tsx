import {getTDMap,getTDWaveEntry,TD_TOWERS,TD_ENEMIES,routePoint,towerStats} from '../../domain/minigame/tower-defense'
import type {TowerDefense} from '../../domain/minigame/tower-defense'
import {TDSprite,tdTile,tdTowerArtwork,tdEnemyArtwork} from './TowerDefenseArtwork'
export {tdTile} from './TowerDefenseArtwork'
export function TowerDefenseBoard({state,selected,buildEffect}:{state:TowerDefense;selected:number;buildEffect?:{pad:number;at:number}|null}){
 const map=getTDMap(state),path=map.path.map(p=>`${p.x*100},${p.y*100}`).join(' '),width=map.bounds.width*100,height=map.bounds.height*100
 const active=state.towers.find(t=>t.pad===selected),pad=map.pads[selected],entry=getTDWaveEntry(state),exit=map.path.at(-1)!
 return <div className="td-board" data-defense-fallback={map.id} style={{aspectRatio:`${width+120} / ${height+200}`}}>
  <svg viewBox={`-60 -100 ${width+120} ${height+200}`} role="img" aria-label={`${map.name} 전체 지도. 입구에서 세워진 타워를 지나 기지로 향하는 전장`}>
   <defs><pattern id="td-grass" width="100" height="100" patternUnits="userSpaceOnUse"><image href={tdTile(162)} width="100" height="100"/></pattern><pattern id="td-dirt" width="100" height="100" patternUnits="userSpaceOnUse"><image href={tdTile(167)} width="100" height="100"/></pattern></defs>
   <rect x="-60" y="-100" width={width+120} height={height+200} className="td-grass"/><rect width={width} height={height} fill="url(#td-grass)"/>
   <polyline points={path} className="td-road-edge"/><polyline points={path} className="td-road"/><polyline points={path} className="td-road-texture"/>
   {map.regions.map(region=><text key={region.id} x={region.center.x*100} y={(region.center.y-2.8)*100} textAnchor="middle" className="td-map-label">{region.name}</text>)}
   <text x={entry.position.x*100+30} y={entry.position.y*100-100} className="td-map-label">{entry.regionName} 입구 →</text><text x={exit.x*100-200} y={exit.y*100+160} className="td-map-label">기지 {state.lives}</text>
   <TDSprite id="td-base-gate" x={exit.x*100-100} y={exit.y*100-135} width={140} height={215} fallback={<rect x={exit.x*100-70} y={exit.y*100-60} width="70" height="120" className="td-gate"/>}/>
   {active&&pad&&<circle data-testid="tower-range" cx={pad.x*100} cy={pad.y*100} r={towerStats(active).range*100} className="td-range"/>}
   {map.pads.map((p,i)=>{const tower=state.towers.find(t=>t.pad===i);return <g key={i} transform={`translate(${p.x*100},${p.y*100})`}>
    <TDSprite id="td-build-pad" x={-82} y={-62} width={164} height={125} fallback={<><circle r="58" className="td-foundation"/><image href={tdTile(180)} x="-70" y="-70" width="140" height="140"/></>}/>
    {tower&&<><TDSprite id={tdTowerArtwork(tower.kind,tower.level)} x={-104} y={-138} width={208} height={208} fallback={<><circle r="36" className={`td-tower-${tower.kind}`}/><image href={tdTile(TD_TOWERS[tower.kind].tile)} x="-95" y="-95" width="190" height="190" transform={`rotate(${tower.angle*180/Math.PI})`}/></>}/><text x="-30" y="94" className="td-level">Lv.{tower.level}</text></>}
    {selected===i&&<ellipse data-testid="tower-selection" cx="0" cy="22" rx="70" ry="38" className="td-selection-ring"/>}
    {buildEffect?.pad===i&&<TDSprite key={buildEffect.at} id="fx-upgrade-burst" x={-120} y={-150} width={240} className="td-build-effect"/>}
   </g>})}
   {state.enemies.map(e=>{const p=routePoint(e.distance,state.mapId),size=e.kind==='boss'?225:e.kind==='armored'?165:160;return <g key={e.id} transform={`translate(${p.x*100},${p.y*100})`}>
    <TDSprite id={tdEnemyArtwork(e.kind)} x={-size/2} y={-size*.64} width={size} fallback={<><circle r={e.kind==='boss'?35:22} className={`td-enemy td-enemy-${e.kind}`}/><image href={tdTile(TD_ENEMIES[e.kind].tile)} x={-size/2} y={-size/2} width={size} height={size}/></>}/>
    {e.slowUntil>state.time&&<circle r="42" className="td-frozen"/>}<rect x="-35" y={-size*.52} width="70" height="12" className="td-hp-back"/><rect x="-35" y={-size*.52} width={70*e.hp/e.maxHp} height="12" className="td-hp"/>
   </g>})}
   {state.shots.map((s,i)=>{const p=s.position??s.from;return <circle key={s.id??`${s.at}-${i}`} className={`td-shot td-shot-${s.kind}`} cx={p.x*100} cy={p.y*100} r={s.kind==='cannon'?18:10}/>})}
   {state.events?.filter(e=>e.type==='impact'&&state.time-e.at<e.lifetime).map(e=>{const size=e.kind==='cannon'?240:140;return <TDSprite key={e.id} id={e.kind==='cannon'?'fx-cannon-blast':e.kind==='frost'?'fx-frost-burst':'fx-hit-burst'} x={e.position.x*100-size/2} y={e.position.y*100-size/2} width={size} fallback={<circle cx={e.position.x*100} cy={e.position.y*100} r={size/3}/>}/>})}
  </svg>
  {map.pads.map((p,i)=><span key={i} aria-hidden="true" className="td-world-pin" data-selected={selected===i} style={{left:`${(p.x*100+60)/(width+120)*100}%`,top:`${(p.y*100+100)/(height+200)*100}%`}}>{i+1}</span>)}
 </div>
}
