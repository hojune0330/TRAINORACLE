/** Classic route-defense rules. Source comparisons: docs/phase2/TOWER_DEFENSE_REFERENCE_REBUILD.md.
 * Simulation values are our own, not claimed to be any reference game's balance. */
import {getTDMap} from './tower-defense-maps.ts'
import type {TDMapId} from './tower-defense-maps.ts'
export {getTDMap,TD_MAPS} from './tower-defense-maps.ts'
export type {TDMapId,TDMap} from './tower-defense-maps.ts'
export type TowerKind = 'rapid' | 'cannon' | 'frost'
export type EnemyKind = 'scout' | 'swift' | 'armored' | 'boss'
export type Branch = 'power' | 'reach'
export type Point = {x:number;y:number}
export const TD_VERSION = 1
/** Legacy aliases stay fixed for old saves, callers and evidence probes. */
export const TD_PATH: readonly Point[] = getTDMap('forest').path
export const TD_PADS: readonly Point[] = getTDMap('forest').pads
export const TD_TOWERS = {
 rapid:{name:'연사탑',cost:70,damage:12,interval:.45,range:2.45,role:'빠른 적 · 단일 공격',tile:249},
 cannon:{name:'포격탑',cost:110,damage:30,interval:1.5,range:2.65,role:'장갑 관통 · 범위 공격',tile:250},
 frost:{name:'냉각탑',cost:85,damage:3,interval:.85,range:2.4,role:'이동 50% 감속 · 공격 보조',tile:203},
} as const
export const TD_ENEMIES = {
 scout:{name:'정찰병',hp:40,speed:.75,gold:8,leak:1,tile:245},
 swift:{name:'질주병',hp:32,speed:1.3,gold:9,leak:1,tile:247},
 armored:{name:'장갑병',hp:105,speed:.55,gold:15,leak:2,tile:246},
 boss:{name:'중장갑 대장',hp:650,speed:.4,gold:70,leak:10,tile:248},
} as const
const repeated = (kind:EnemyKind,n:number):EnemyKind[]=>Array.from({length:n},()=>kind)
export const TD_WAVES: readonly {name:string;hint:string;interval:number;units:readonly EnemyKind[]}[] = [
 {name:'정찰 부대',hint:'굴곡을 오래 바라보는 자리에 연사탑을 지으세요.',interval:1.5,units:repeated('scout',8)},
 {name:'빠른 침투',hint:'질주병이 빨라요. 냉각탑과 연사탑을 함께 배치하세요.',interval:1,units:[...repeated('swift',8),...repeated('scout',4)]},
 {name:'장갑 행렬',hint:'장갑병은 연사 피해를 65% 줄여요. 포격은 장갑을 관통해요.',interval:1.4,units:repeated('armored',10)},
 {name:'밀집 돌파',hint:'정찰병이 몰려와요. 냉각으로 모으고 포격으로 함께 맞히세요.',interval:.48,units:[...repeated('scout',22),...repeated('swift',6)]},
 {name:'혼성 부대',hint:'질주와 장갑이 섞여요. 출구까지 사각지대를 확인하세요.',interval:.95,units:Array.from({length:22},(_,i)=>i%3===0?'armored':i%3===1?'swift':'scout')},
 {name:'최종 공성',hint:'대장을 놓치면 기지 체력 10을 잃어요. 포격을 강화하세요.',interval:1.2,units:[...repeated('armored',7),'boss',...repeated('swift',12)]},
]
export type Tower = {pad:number;kind:TowerKind;level:1|2|3;branch:Branch|null;spent:number;cooldown:number;angle:number;kills:number;
 id?:number;aimTargetId?:number;lastFiredAt?:number;damageDealt?:number;shotsFired?:number}
export type Enemy = {id:number;kind:EnemyKind;distance:number;hp:number;maxHp:number;slowUntil:number;spawnedAt?:number;lastHitAt?:number}
/** Optional additions keep old in-memory fixtures and v1 checkpoints readable. New shots contain every flight field. */
export type Shot = {from:Point;to:Point;kind:TowerKind;at:number;id?:number;position?:Point;targetId?:number;towerId?:number;
 speed?:number;damage?:number;duration?:number;elapsed?:number;splashRadius?:number}
export type CombatEvent = {id:number;type:'hit'|'kill'|'leak'|'impact'|'miss';position:Point;at:number;lifetime:number;
 enemyId?:number;enemyKind?:EnemyKind;towerId?:number;kind?:TowerKind;amount?:number;bounty?:number}
export type CombatStats = {shotsFired:number;shotsHit:number;damageDealt:number}
export type TowerDefense = {version:1;phase:'prepare'|'wave'|'won'|'lost';wave:number;time:number;waveTime:number;
 gold:number;lives:number;kills:number;leaks:number;spawned:number;nextSpawn:number;nextId:number;towers:Tower[];enemies:Enemy[];shots:Shot[];
 events?:CombatEvent[];stats?:CombatStats;nextCombatId?:number;mapId?:TDMapId}
export const TD_EVENT_LIMIT=96
export function newTowerDefense(mapId:TDMapId='forest'):TowerDefense{getTDMap(mapId);return {version:TD_VERSION,...(mapId==='forest'?{}:{mapId}),phase:'prepare',wave:0,time:0,waveTime:0,gold:180,lives:20,kills:0,leaks:0,spawned:0,nextSpawn:0,nextId:1,towers:[],enemies:[],shots:[],events:[],stats:{shotsFired:0,shotsHit:0,damageDealt:0},nextCombatId:1}}
/** The save format intentionally excludes transient projectiles, aim and effects. */
export function normalizeTowerDefenseCombat(s:TowerDefense){
 s.events??=[];s.stats??={shotsFired:0,shotsHit:0,damageDealt:0};s.nextCombatId??=1
 for(const t of s.towers){t.id??=s.nextId++;t.damageDealt??=0;t.shotsFired??=0}
 return s
}
export const TD_LENGTH=getTDMap('forest').length
export function routePoint(distance:number,mapId?:TDMapId):Point {
 const path=getTDMap(mapId).path
 let left=Math.max(0,distance)
 for(let i=1;i<path.length;i++){const a=path[i-1]!,b=path[i]!,len=Math.hypot(b.x-a.x,b.y-a.y)
  if(left<=len)return {x:a.x+(b.x-a.x)*left/len,y:a.y+(b.y-a.y)*left/len};left-=len}
 return {...path[path.length-1]!}
}
/** Preparation previews the next announced entrance; active combat reports this wave's entrance. */
export function getTDWaveEntry(s:Pick<TowerDefense,'mapId'|'wave'|'phase'>,next=s.phase==='prepare'){
 const map=getTDMap(s),wave=Math.min(TD_WAVES.length,Math.max(1,s.wave+(next?1:0)))
 const distance=map.waveStartDistances[wave-1]??0,region=map.regions[Math.floor((wave-1)/2)]
 return {wave,distance,position:routePoint(distance,s.mapId),regionId:region?.id??map.id,regionName:region?.name??map.name}
}
export function towerStats(t:Pick<Tower,'kind'|'level'|'branch'>){const base=TD_TOWERS[t.kind],level=t.level-1
 return {range:base.range+(t.branch==='reach'?.8:0)+(level===2?.2:0),
  damage:base.damage*(level? t.branch==='power'?1.8:1.25:1)*(level===2?1.65:1),interval:base.interval*(level===2?.85:1)}}
export function upgradeCost(t:Tower){return Math.round(TD_TOWERS[t.kind].cost*(t.level===1?.85:1.35))}
export function sellValue(t:Tower){return Math.floor(t.spent*.7)}
export function buildTower(s:TowerDefense,pad:number,kind:TowerKind):boolean {
 if(!['prepare','wave'].includes(s.phase)||!Number.isInteger(pad)||!getTDMap(s).pads[pad]||!Object.hasOwn(TD_TOWERS,kind)||s.towers.some(t=>t.pad===pad)||s.gold<TD_TOWERS[kind].cost)return false
 normalizeTowerDefenseCombat(s)
 s.gold-=TD_TOWERS[kind].cost;s.towers.push({pad,kind,level:1,branch:null,spent:TD_TOWERS[kind].cost,cooldown:0,angle:0,kills:0,id:s.nextId++,damageDealt:0,shotsFired:0});return true
}
export function upgradeTower(s:TowerDefense,pad:number,branch:Branch='power'):boolean {
 const t=s.towers.find(t=>t.pad===pad)
 if(!['prepare','wave'].includes(s.phase)||!t||t.level===3||!['power','reach'].includes(branch)||s.gold<upgradeCost(t))return false
 const cost=upgradeCost(t);s.gold-=cost;t.spent+=cost;if(t.level===1)t.branch=branch;t.level++;return true
}
export function sellTower(s:TowerDefense,pad:number):boolean{
 const t=s.towers.find(t=>t.pad===pad);if(!['prepare','wave'].includes(s.phase)||!t)return false
 s.gold+=sellValue(t);s.towers=s.towers.filter(candidate=>candidate!==t);return true
}
export function startTowerWave(s:TowerDefense):boolean{
 if(s.phase!=='prepare'||s.wave>=TD_WAVES.length)return false
 normalizeTowerDefenseCombat(s)
 s.phase='wave';s.wave++;s.waveTime=0;s.spawned=0;s.nextSpawn=.5;s.enemies=[];s.shots=[];s.events=[];return true
}
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
const projectileSpeed:Record<TowerKind,number>={rapid:12,cannon:6.5,frost:7}
function emit(s:TowerDefense,event:Omit<CombatEvent,'id'|'at'>){
 s.events!.push({...event,position:{...event.position},id:s.nextCombatId!++,at:s.time})
 if(s.events!.length>TD_EVENT_LIMIT)s.events!.splice(0,s.events!.length-TD_EVENT_LIMIT)
}
function projectedDistance(e:Enemy,now:number,seconds:number,length:number){
 const slowed=Math.min(seconds,Math.max(0,e.slowUntil-now))
 return Math.min(length,e.distance+TD_ENEMIES[e.kind].speed*(seconds-slowed*.5))
}
function fire(s:TowerDefense,t:Tower,target:Enemy){
 const map=getTDMap(s),from={...map.pads[t.pad]!},stats=towerStats(t),speed=projectileSpeed[t.kind]
 let to=routePoint(target.distance,s.mapId),duration=dist(from,to)/speed
 if(t.kind==='cannon'){
  // A shell cannot follow a target after launch. Lead the current movement, then commit to this ground position.
  for(let i=0;i<3;i++){to=routePoint(projectedDistance(target,s.time,duration,map.length),s.mapId);duration=dist(from,to)/speed}
 }
 t.angle=Math.atan2(to.y-from.y,to.x-from.x)+Math.PI/2
 s.shots.push({id:s.nextCombatId!++,from,to,position:{...from},kind:t.kind,at:s.time,targetId:target.id,towerId:t.id,
  speed,damage:stats.damage,duration:Math.max(.01,duration),elapsed:0,splashRadius:t.kind==='cannon'?.85:0})
 t.cooldown=stats.interval;t.lastFiredAt=s.time;t.shotsFired!++;s.stats!.shotsFired++
}
function damageEnemy(s:TowerDefense,shot:Shot,e:Enemy){
 if(e.hp<=0)return false
 const armor=(e.kind==='armored'||e.kind==='boss')&&shot.kind!=='cannon'?.35:1
 const amount=Math.min(e.hp,shot.damage!*armor),owner=s.towers.find(t=>t.id===shot.towerId),position=routePoint(e.distance,s.mapId)
 e.hp=Math.max(0,e.hp-amount);e.lastHitAt=s.time;s.stats!.damageDealt+=amount
 if(owner)owner.damageDealt!+=amount
 if(shot.kind==='frost')e.slowUntil=s.time+1.7
 emit(s,{type:'hit',position,lifetime:.24,enemyId:e.id,enemyKind:e.kind,towerId:shot.towerId,kind:shot.kind,amount})
 if(e.hp===0){
  const bounty=TD_ENEMIES[e.kind].gold;s.gold+=bounty;s.kills++;if(owner)owner.kills++
  emit(s,{type:'kill',position,lifetime:.72,enemyId:e.id,enemyKind:e.kind,towerId:shot.towerId,kind:shot.kind,bounty})
 }
 return true
}
function moveProjectiles(s:TowerDefense,dt:number){
 const flying:Shot[]=[]
 for(const shot of s.shots){
  // Pre-upgrade shots were visual traces whose damage had already happened; never apply it again.
  if(!shot.position||shot.speed===undefined||shot.damage===undefined||shot.elapsed===undefined||shot.duration===undefined)continue
  shot.elapsed+=dt
  const target=s.enemies.find(e=>e.id===shot.targetId&&e.hp>0)
  if(shot.kind!=='cannon'&&target)shot.to=routePoint(target.distance,s.mapId)
  const remaining=dist(shot.position,shot.to),travel=shot.speed*dt
  if(shot.elapsed>=2&&remaining>travel){emit(s,{type:'miss',position:shot.position,lifetime:.28,kind:shot.kind,towerId:shot.towerId});continue}
  if(remaining>travel&&shot.elapsed<2){
   const fraction=travel/remaining
   shot.position={x:shot.position.x+(shot.to.x-shot.position.x)*fraction,y:shot.position.y+(shot.to.y-shot.position.y)*fraction}
   flying.push(shot);continue
  }
  shot.position={...shot.to}
  const hits=shot.kind==='cannon'?s.enemies.filter(e=>e.hp>0&&dist(routePoint(e.distance,s.mapId),shot.to)<=shot.splashRadius!):target?[target]:[]
  let hit=false
  for(const e of hits)hit=damageEnemy(s,shot,e)||hit
  if(hit)s.stats!.shotsHit++
  emit(s,{type:hit?'impact':'miss',position:shot.to,lifetime:shot.kind==='cannon'?.55:.28,kind:shot.kind,towerId:shot.towerId})
 }
 s.shots=flying
}
export function stepTowerDefense(s:TowerDefense,dt:number){
 if(s.phase!=='wave'||!Number.isFinite(dt)||dt<=0)return
 normalizeTowerDefenseCombat(s)
 dt=Math.min(dt,.1);s.time+=dt;s.waveTime+=dt;s.events=s.events!.filter(e=>s.time-e.at<e.lifetime)
 const wave=TD_WAVES[s.wave-1]!,map=getTDMap(s),entry=getTDWaveEntry(s,false)
 while(s.spawned<wave.units.length&&s.waveTime>=s.nextSpawn){const kind=wave.units[s.spawned]!,base=TD_ENEMIES[kind]
  const hp=base.hp*(1+(s.wave-1)*.11);s.enemies.push({id:s.nextId++,kind,distance:entry.distance,hp,maxHp:hp,slowUntil:0,spawnedAt:s.time});s.spawned++;s.nextSpawn+=wave.interval}
 for(const e of s.enemies){e.distance+=TD_ENEMIES[e.kind].speed*(s.time<e.slowUntil?.5:1)*dt
  if(e.distance>=map.length){
   const amount=Math.min(s.lives,TD_ENEMIES[e.kind].leak);s.lives=Math.max(0,s.lives-amount);s.leaks++;e.hp=0
   emit(s,{type:'leak',position:routePoint(map.length,s.mapId),lifetime:1.1,enemyId:e.id,enemyKind:e.kind,amount})
  }}
 s.enemies=s.enemies.filter(e=>e.hp>0)
 // Defeat immediately cancels remaining projectiles: a shell cannot earn gold after the base is gone.
 if(s.lives<=0){s.phase='lost';s.shots=[];return}
 moveProjectiles(s,dt)
 s.enemies=s.enemies.filter(e=>e.hp>0)
 for(const t of s.towers){t.cooldown=Math.max(0,t.cooldown-dt);const stats=towerStats(t),from=map.pads[t.pad]!
  const target=s.enemies.filter(e=>e.hp>0&&dist(from,routePoint(e.distance,s.mapId))<=stats.range).sort((a,b)=>b.distance-a.distance)[0]
  t.aimTargetId=target?.id
  if(!target)continue
  const to=routePoint(target.distance,s.mapId);t.angle=Math.atan2(to.y-from.y,to.x-from.x)+Math.PI/2
  if(t.cooldown<=0)fire(s,t,target)
 }
 // Let the last projectile and death effect finish before presenting the next build screen.
 if(s.spawned===wave.units.length&&s.enemies.length===0&&s.shots.length===0&&s.events!.length===0){s.gold+=40;s.phase=s.wave===TD_WAVES.length?'won':'prepare'}
}
