/** Classic route-defense rules. Source comparisons: docs/phase2/TOWER_DEFENSE_REFERENCE_REBUILD.md.
 * Simulation values are our own, not claimed to be any reference game's balance. */
export type TowerKind = 'rapid' | 'cannon' | 'frost'
export type EnemyKind = 'scout' | 'swift' | 'armored' | 'boss'
export type Branch = 'power' | 'reach'
export type Point = {x:number;y:number}
export const TD_VERSION = 1
export const TD_PATH: readonly Point[] = [{x:0,y:2},{x:3,y:2},{x:3,y:6},{x:7,y:6},{x:7,y:2},{x:10,y:2},{x:10,y:8},{x:12,y:8}]
export const TD_PADS: readonly Point[] = [{x:1.5,y:3.6},{x:4.5,y:3.5},{x:5.5,y:5},{x:8.5,y:3.6},{x:8.5,y:6.7},{x:4.5,y:7.6},{x:1.5,y:6.2},{x:10.5,y:5.5}]
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
export type Tower = {pad:number;kind:TowerKind;level:1|2|3;branch:Branch|null;spent:number;cooldown:number;angle:number;kills:number}
export type Enemy = {id:number;kind:EnemyKind;distance:number;hp:number;maxHp:number;slowUntil:number}
export type Shot = {from:Point;to:Point;kind:TowerKind;at:number}
export type TowerDefense = {version:1;phase:'prepare'|'wave'|'won'|'lost';wave:number;time:number;waveTime:number;
 gold:number;lives:number;kills:number;leaks:number;spawned:number;nextSpawn:number;nextId:number;towers:Tower[];enemies:Enemy[];shots:Shot[]}
export function newTowerDefense():TowerDefense{return {version:TD_VERSION,phase:'prepare',wave:0,time:0,waveTime:0,gold:180,lives:20,kills:0,leaks:0,spawned:0,nextSpawn:0,nextId:1,towers:[],enemies:[],shots:[]}}
export const TD_LENGTH=TD_PATH.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-TD_PATH[i]!.x,p.y-TD_PATH[i]!.y),0)
export function routePoint(distance:number):Point {
 let left=Math.max(0,distance)
 for(let i=1;i<TD_PATH.length;i++){const a=TD_PATH[i-1]!,b=TD_PATH[i]!,len=Math.hypot(b.x-a.x,b.y-a.y)
  if(left<=len)return {x:a.x+(b.x-a.x)*left/len,y:a.y+(b.y-a.y)*left/len};left-=len}
 return {...TD_PATH[TD_PATH.length-1]!}
}
export function towerStats(t:Pick<Tower,'kind'|'level'|'branch'>){const base=TD_TOWERS[t.kind],level=t.level-1
 return {range:base.range+(t.branch==='reach'?.8:0)+(level===2?.2:0),
  damage:base.damage*(level? t.branch==='power'?1.8:1.25:1)*(level===2?1.65:1),interval:base.interval*(level===2?.85:1)}}
export function upgradeCost(t:Tower){return Math.round(TD_TOWERS[t.kind].cost*(t.level===1?.85:1.35))}
export function sellValue(t:Tower){return Math.floor(t.spent*.7)}
export function buildTower(s:TowerDefense,pad:number,kind:TowerKind):boolean {
 if(!['prepare','wave'].includes(s.phase)||!Number.isInteger(pad)||!TD_PADS[pad]||!Object.hasOwn(TD_TOWERS,kind)||s.towers.some(t=>t.pad===pad)||s.gold<TD_TOWERS[kind].cost)return false
 s.gold-=TD_TOWERS[kind].cost;s.towers.push({pad,kind,level:1,branch:null,spent:TD_TOWERS[kind].cost,cooldown:0,angle:0,kills:0});return true
}
export function upgradeTower(s:TowerDefense,pad:number,branch:Branch='power'):boolean {
 const t=s.towers.find(t=>t.pad===pad)
 if(!['prepare','wave'].includes(s.phase)||!t||t.level===3||!['power','reach'].includes(branch)||s.gold<upgradeCost(t))return false
 const cost=upgradeCost(t);s.gold-=cost;t.spent+=cost;if(t.level===1)t.branch=branch;t.level++;return true
}
export function sellTower(s:TowerDefense,pad:number):boolean{
 const t=s.towers.find(t=>t.pad===pad);if(!['prepare','wave'].includes(s.phase)||!t)return false
 s.gold+=sellValue(t);s.towers=s.towers.filter(t=>t!==t);return true
}
export function startTowerWave(s:TowerDefense):boolean{
 if(s.phase!=='prepare'||s.wave>=TD_WAVES.length)return false
 s.phase='wave';s.wave++;s.waveTime=0;s.spawned=0;s.nextSpawn=.5;s.enemies=[];s.shots=[];return true
}
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
export function stepTowerDefense(s:TowerDefense,dt:number){
 if(s.phase!=='wave'||!Number.isFinite(dt)||dt<=0)return
 dt=Math.min(dt,.1);s.time+=dt;s.waveTime+=dt;s.shots=s.shots.filter(e=>s.time-e.at<.28)
 const wave=TD_WAVES[s.wave-1]!
 while(s.spawned<wave.units.length&&s.waveTime>=s.nextSpawn){const kind=wave.units[s.spawned]!,base=TD_ENEMIES[kind]
  const hp=base.hp*(1+(s.wave-1)*.11);s.enemies.push({id:s.nextId++,kind,distance:0,hp,maxHp:hp,slowUntil:0});s.spawned++;s.nextSpawn+=wave.interval}
 for(const e of s.enemies){e.distance+=TD_ENEMIES[e.kind].speed*(s.time<e.slowUntil?.5:1)*dt
  if(e.distance>=TD_LENGTH){s.lives=Math.max(0,s.lives-TD_ENEMIES[e.kind].leak);s.leaks++;e.hp=0}}
 s.enemies=s.enemies.filter(e=>e.hp>0)
 if(s.lives<=0){s.phase='lost';s.shots=[];return}
 for(const t of s.towers){t.cooldown=Math.max(0,t.cooldown-dt);const stats=towerStats(t),from=TD_PADS[t.pad]!
  const target=s.enemies.filter(e=>e.hp>0&&dist(from,routePoint(e.distance))<=stats.range).sort((a,b)=>b.distance-a.distance)[0]
  if(!target)continue
  const to=routePoint(target.distance);t.angle=Math.atan2(to.y-from.y,to.x-from.x)+Math.PI/2
  if(t.cooldown>0)continue;t.cooldown=stats.interval;s.shots.push({from,to,kind:t.kind,at:s.time})
  const hits=t.kind==='cannon'?s.enemies.filter(e=>e.hp>0&&dist(routePoint(e.distance),to)<=.85):[target]
  for(const e of hits){const armor=['armored','boss'].includes(e.kind)&&t.kind!=='cannon'?.35:1;e.hp-=stats.damage*armor
   if(t.kind==='frost')e.slowUntil=s.time+1.7
   if(e.hp<=0){s.gold+=TD_ENEMIES[e.kind].gold;s.kills++;t.kills++}}
 }
 s.enemies=s.enemies.filter(e=>e.hp>0)
 if(s.spawned===wave.units.length&&s.enemies.length===0){s.gold+=40;s.phase=s.wave===TD_WAVES.length?'won':'prepare';s.shots=[]}
}
