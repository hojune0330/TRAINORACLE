import {describe,it,expect} from 'vitest'
import {newTowerDefense,buildTower,upgradeTower,sellTower,startTowerWave,stepTowerDefense,TD_WAVES,TD_LENGTH,TD_EVENT_LIMIT,routePoint,getTDMap,getTDWaveEntry} from './tower-defense'
import type {TowerDefense,Enemy,EnemyKind,TowerKind} from './tower-defense'
import {saveTD,loadTD,recordTD,readTDRecords,TD_SAVE,TD_RECORDS,tdSaveKey} from './tower-defense-storage'
const wave=(s:TowerDefense)=>{expect(startTowerWave(s)).toBe(true);let n=0;while(s.phase==='wave'&&n++<12000)stepTowerDefense(s,1/60);expect(n).toBeLessThan(12000)}
const storage=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)}}}
describe('classic tower defense',()=>{
 it('makes inaction a real defeat with no kill income',()=>{const s=newTowerDefense();wave(s);expect(s.lives).toBe(12);expect(s.gold).toBe(220);wave(s);expect(s.phase).toBe('lost');expect(s.kills).toBe(0);expect(s.lives).toBe(0)})
 it('rejects duplicate and unaffordable builds, caps upgrades and refunds only invested gold',()=>{const s=newTowerDefense();expect(buildTower(s,1,'cannon')).toBe(true);expect(buildTower(s,1,'rapid')).toBe(false);expect(buildTower(s,3,'frost')).toBe(false);expect(upgradeTower(s,1)).toBe(false);expect(sellTower(s,1)).toBe(true);expect(s.gold).toBe(147);expect(sellTower(s,1)).toBe(false);expect(buildTower(s,0,'rapid')).toBe(true);expect(upgradeTower(s,0,'reach')).toBe(true);expect(s.towers[0]?.level).toBe(2);expect(s.towers[0]?.branch).toBe('reach')})
 it('rewards coverage of two road stretches over a short corner by the armor wave',()=>{const a=newTowerDefense(),b=newTowerDefense();buildTower(a,3,'rapid');buildTower(b,6,'rapid');for(let i=0;i<3;i++){wave(a);wave(b)}expect(a.kills).toBeGreaterThan(b.kills);expect(a.lives).toBeGreaterThan(b.lives);expect(b.phase).toBe('lost')})
 it('completes a funded mixed build without adding gold or changing rules',()=>{const s=newTowerDefense();const reports:unknown[]=[];buildTower(s,1,'rapid');buildTower(s,2,'cannon');
  for(let i=0;i<6;i++){if(i===1)buildTower(s,0,'frost');if(i===2)upgradeTower(s,2,'power');if(i===3){upgradeTower(s,1,'power');upgradeTower(s,2)}if(i===4){buildTower(s,3,'cannon');upgradeTower(s,3,'power')}if(i===5){upgradeTower(s,3);upgradeTower(s,1)}wave(s);reports.push({wave:s.wave,lives:s.lives,kills:s.kills,gold:s.gold,time:Math.round(s.time)});if(s.phase==='lost')break}
  console.log('mixed build balance',reports);expect(s.phase).toBe('won');expect(s.kills+s.leaks).toBe(TD_WAVES.reduce((n,w)=>n+w.units.length,0));expect(s.lives).toBe(20)
  expect(s.stats!.shotsFired).toBeGreaterThan(s.stats!.shotsHit)
  expect(s.stats!.damageDealt).toBeCloseTo(8165.83)
  expect(s.towers.reduce((n,t)=>n+t.kills,0)).toBe(s.kills)
  expect(s.towers.reduce((n,t)=>n+t.damageDealt!,0)).toBeCloseTo(s.stats!.damageDealt)
 })
 it('makes a funded rapid-only build leak armor while preserving a viable six-wave alternative',()=>{
  const s=newTowerDefense()
  for(let i=0;i<6;i++){
   for(const pad of [1,2,3,4,7,0,5,6])buildTower(s,pad,'rapid')
   for(const t of s.towers)while(upgradeTower(s,t.pad,'power')){/* Spend only earned money. */}
   wave(s)
   if(i===2){expect(s.leaks).toBeGreaterThan(0);expect(s.lives).toBeLessThan(20)}
  }
  expect(s.phase).toBe('won');expect(s.lives).toBe(16);expect(s.kills).toBe(98);expect(s.gold).toBeGreaterThanOrEqual(0)
 })
 it('does not advance while prepared, after defeat, or with invalid dt',()=>{const s=newTowerDefense();stepTowerDefense(s,1);expect(s.time).toBe(0);startTowerWave(s);stepTowerDefense(s,NaN);stepTowerDefense(s,-1);expect(s.time).toBe(0);expect(routePoint(TD_LENGTH)).toEqual({x:12,y:8})})
 it('saves and restores real economy and upgrades without affecting legacy saves',()=>{const store=storage(),s=newTowerDefense();store.setItem('trainoracle.solo-party.checkpoint.v2','legacy');buildTower(s,1,'rapid');upgradeTower(s,1,'reach');wave(s);saveTD(store,s,'run');const loaded=loadTD(store)!;expect(loaded.state.gold).toBe(s.gold);expect(loaded.state.towers[0]?.branch).toBe('reach');expect(loaded.state.phase).toBe('prepare');expect(store.getItem('trainoracle.solo-party.checkpoint.v2')).toBe('legacy');startTowerWave(s);expect(()=>saveTD(store,s,'run')).toThrow()})
 it('preserves malformed storage and records results only once',()=>{const store=storage(),s=newTowerDefense();store.setItem(TD_SAVE,'broken');expect(()=>saveTD(store,s,'run')).toThrow();expect(store.getItem(TD_SAVE)).toBe('broken');s.phase='lost';s.lives=0;recordTD(store,s,'run');recordTD(store,s,'run');expect(readTDRecords(store)).toHaveLength(1);expect(store.getItem(TD_SAVE)).toBe('broken');store.setItem(TD_RECORDS,'invalid');expect(()=>recordTD(store,s,'other')).toThrow();expect(store.getItem(TD_RECORDS)).toBe('invalid')})
})

describe('separate, larger defense worlds',()=>{
 it('sells only the selected tower and preserves other towers and their investment',()=>{
  const s=newTowerDefense('starlight');buildTower(s,1,'rapid');buildTower(s,2,'cannon')
  const cannon=s.towers[1];expect(sellTower(s,1)).toBe(true)
  expect(s.gold).toBe(49);expect(s.towers).toEqual([cannon]);expect(sellTower(s,1)).toBe(false)
  expect(sellTower(s,2)).toBe(true);expect(s.gold).toBe(126);expect(s.towers).toHaveLength(0)
 })
 it('keeps the original map as the default and uses real world units for the new map',()=>{
  const legacy=newTowerDefense(),fresh=newTowerDefense('starlight'),map=getTDMap(fresh)
  expect(getTDMap(legacy).id).toBe('forest');expect(legacy.mapId).toBeUndefined()
  expect(routePoint(TD_LENGTH)).toEqual({x:12,y:8});expect(getTDMap().pads).toHaveLength(8)
  expect(map.bounds).toEqual({width:24,height:16});expect(map.pads).toHaveLength(14)
  expect(map.length).toBe(40.5);expect(routePoint(map.length,fresh.mapId)).toEqual({x:24,y:12})
  expect(map.regions.map(r=>r.id)).toEqual(['spring','bridge','gate'])
  expect(buildTower(legacy,13,'rapid')).toBe(false);expect(buildTower(fresh,13,'rapid')).toBe(true)
 })
 it('announces relay entrances before combat and spawns there while leaving legacy waves unchanged',()=>{
  const s=newTowerDefense('starlight');s.wave=2
  expect(getTDWaveEntry(s)).toMatchObject({wave:3,distance:14.5,position:{x:10,y:8},regionId:'bridge'})
  startTowerWave(s);expect(getTDWaveEntry(s)).toMatchObject({wave:3,distance:14.5})
  advance(s,.55);expect(s.enemies[0]!.distance).toBeGreaterThan(14.5);expect(s.enemies[0]!.distance).toBeLessThan(15)
  const old=newTowerDefense();old.wave=4;expect(getTDWaveEntry(old)).toMatchObject({wave:5,distance:0,position:{x:0,y:2}})
  s.phase='prepare';s.wave=4;expect(getTDWaveEntry(s)).toMatchObject({wave:5,distance:29.5,position:{x:16,y:9},regionId:'gate'})
 })
 it('requires moving investment beyond the first region and permits a legal six-wave relay defense',()=>{
  const held=newTowerDefense('starlight');buildTower(held,1,'rapid');buildTower(held,2,'cannon');wave(held)
  buildTower(held,0,'frost');wave(held);upgradeTower(held,2,'power');wave(held)
  expect(held.phase).toBe('lost');expect(held.wave).toBe(3);expect(held.kills).toBe(20);expect(held.leaks).toBe(10)

  const s=newTowerDefense('starlight');let spent=0,refunded=0,earned=0
  const action=(perform:()=>boolean)=>{const before=s.gold;expect(perform()).toBe(true);const cost=before-s.gold;if(cost>0)spent+=cost;else refunded-=cost;expect(s.gold).toBeGreaterThanOrEqual(0)}
  action(()=>buildTower(s,1,'rapid'));action(()=>buildTower(s,2,'cannon'))
  for(let i=0;i<6;i++){
   if(i===1)action(()=>upgradeTower(s,1,'power'))
   if(i===2){action(()=>sellTower(s,1));action(()=>sellTower(s,2));action(()=>buildTower(s,4,'rapid'));action(()=>buildTower(s,5,'cannon'));action(()=>upgradeTower(s,5,'power'))}
   if(i===3){action(()=>buildTower(s,7,'frost'));action(()=>upgradeTower(s,5,'power'))}
   if(i===4){action(()=>sellTower(s,4));action(()=>sellTower(s,5));action(()=>sellTower(s,7));action(()=>buildTower(s,10,'rapid'));action(()=>buildTower(s,11,'cannon'));action(()=>buildTower(s,9,'frost'));action(()=>upgradeTower(s,11,'power'));action(()=>upgradeTower(s,11,'power'));action(()=>upgradeTower(s,10,'power'))}
   if(i===5){action(()=>upgradeTower(s,10,'power'));action(()=>buildTower(s,12,'cannon'))}
   const beforeWave=s.gold;wave(s);earned+=s.gold-beforeWave
  }
  expect(s.phase).toBe('won');expect(s.kills).toBe(100);expect(s.leaks).toBe(0)
  expect(s.lives).toBe(20);expect(s.time).toBeCloseTo(133.75,1)
  expect(refunded).toBe(523);expect(spent).toBe(1521)
  expect(s.gold).toBe(492);expect(s.gold).toBe(180+earned+refunded-spent)
 })
 it('continues past the legacy exit and leaks only at the new map exit',()=>{
  const s=newTowerDefense('starlight');startTowerWave(s);s.spawned=TD_WAVES[0]!.units.length
  s.enemies=[enemy(100,'scout',TD_LENGTH+.2)];stepTowerDefense(s,.1)
  expect(s.lives).toBe(20);expect(s.enemies).toHaveLength(1);expect(s.leaks).toBe(0)
  s.enemies[0]!.distance=getTDMap(s).length-.001;stepTowerDefense(s,1/60)
  expect(s.lives).toBe(19);expect(s.leaks).toBe(1)
  expect(s.events?.find(e=>e.type==='leak')?.position).toEqual({x:24,y:12})
 })
 it('fires and lands projectiles on a remote pad using the new path coordinates',()=>{
  const s=newTowerDefense('starlight');buildTower(s,11,'cannon');startTowerWave(s)
  s.spawned=TD_WAVES[0]!.units.length;s.enemies=[enemy(100,'armored',35,105)]
  stepTowerDefense(s,1/60)
  expect(s.shots[0]?.from).toEqual(getTDMap(s).pads[11]);expect(s.shots[0]?.to.x).toBe(20)
  advance(s,.4);expect(s.enemies[0]!.hp).toBe(75)
  const event=s.events?.find(e=>e.type==='hit');expect(event?.position.x).toBe(20);expect(event?.position.y).toBeGreaterThan(10.5)
 })
 it('retains both map checkpoints and their results even when run ids happen to match',()=>{
  const store=storage(),old=newTowerDefense(),fresh=newTowerDefense('starlight')
  buildTower(old,1,'rapid');upgradeTower(old,1,'reach');buildTower(fresh,13,'rapid');upgradeTower(fresh,13,'reach')
  saveTD(store,old,'same-id');const legacyBytes=store.getItem(TD_SAVE)
  saveTD(store,fresh,'same-id')
  expect(store.getItem(TD_SAVE)).toBe(legacyBytes);expect(loadTD(store)!.state.mapId).toBeUndefined()
  expect(loadTD(store,'starlight')!.state).toMatchObject({mapId:'starlight',gold:50,towers:[{pad:13,level:2,branch:'reach'}]})
  fresh.phase='lost';fresh.lives=0;recordTD(store,fresh,'same-id');recordTD(store,fresh,'same-id')
  expect(readTDRecords(store,'starlight')).toHaveLength(1);expect(readTDRecords(store)).toHaveLength(0)
  expect(loadTD(store,'starlight')).toBeNull();expect(store.getItem(TD_SAVE)).toBe(legacyBytes)
 })
 it('rejects unknown maps, wrong slots and new-only pads in a legacy checkpoint without changing bytes',()=>{
  const store=storage(),fresh=newTowerDefense('starlight');buildTower(fresh,13,'rapid');saveTD(store,fresh,'fresh')
  const key=tdSaveKey('starlight'),saved=store.getItem(key)!,parsed=JSON.parse(saved)
  store.setItem(key,JSON.stringify({...parsed,mapId:'future-map'}));const unknown=store.getItem(key)
  expect(()=>loadTD(store,'starlight')).toThrow();expect(()=>saveTD(store,fresh,'replace')).toThrow();expect(store.getItem(key)).toBe(unknown)
  store.setItem(key,JSON.stringify({...parsed,mapId:undefined,towers:[]}));expect(()=>loadTD(store,'starlight')).toThrow()
  store.setItem(TD_SAVE,JSON.stringify({...parsed,mapId:undefined}));const invalidLegacy=store.getItem(TD_SAVE)
  expect(()=>loadTD(store)).toThrow();expect(store.getItem(TD_SAVE)).toBe(invalidLegacy)
 })
})

const advance=(s:TowerDefense,seconds:number)=>{for(let i=0;i<Math.ceil(seconds*60);i++)stepTowerDefense(s,1/60)}
const enemy=(id:number,kind:EnemyKind='scout',distance=1.5,hp=40):Enemy=>({id,kind,distance,hp,maxHp:hp,slowUntil:0})
function encounter(kind:TowerKind='rapid',units:Enemy[]=[enemy(100)]){
 const s=newTowerDefense();buildTower(s,0,kind);startTowerWave(s)
 s.spawned=TD_WAVES[0]!.units.length;s.enemies=units
 return s
}
describe('projectile combat and presentation events',()=>{
 it('moves a projectile before dealing damage and exposes aim and muzzle timing',()=>{
  const s=encounter();stepTowerDefense(s,1/60)
  const shot=s.shots[0]!,tower=s.towers[0]!,before={...shot.position!}
  expect(s.enemies[0]!.hp).toBe(40);expect(s.stats?.damageDealt).toBe(0)
  expect(tower.lastFiredAt).toBe(s.time);expect(tower.aimTargetId).toBe(100)
  stepTowerDefense(s,1/60)
  expect(s.shots[0]!.position).not.toEqual(before);expect(s.enemies[0]!.hp).toBe(40)
  advance(s,.2)
  expect(s.enemies[0]!.hp).toBe(28);expect(s.stats).toEqual({shotsFired:1,shotsHit:1,damageDealt:12})
  expect(tower.damageDealt).toBe(12)
  expect(s.events).toEqual(expect.arrayContaining([expect.objectContaining({type:'hit',enemyId:100,enemyKind:'scout',kind:'rapid',amount:12})]))
 })
 it('commits cannon landing to a predicted ground point and damages whoever is actually there',()=>{
  const s=encounter('cannon',[enemy(100,'scout',2,200)]);stepTowerDefense(s,1/60)
  const shot=s.shots[0]!,landing={...shot.to}
  expect(landing.x).toBeGreaterThan(2);expect(s.enemies[0]!.hp).toBe(200)
  s.enemies[0]!.distance=20 // Original target has left the landing area after launch.
  s.enemies.push(enemy(101,'scout',landing.x,200));s.towers[0]!.cooldown=10
  advance(s,shot.duration!+.04)
  expect(shot.to).toEqual(landing)
  expect(s.enemies.find(e=>e.id===100)!.hp).toBe(200)
  expect(s.enemies.find(e=>e.id===101)!.hp).toBe(170)
  expect(s.events).toEqual(expect.arrayContaining([expect.objectContaining({type:'impact',kind:'cannon',position:landing})]))
 })
 it('does not damage a target that runs out of a committed cannon splash',()=>{
  const s=encounter('cannon',[enemy(100,'scout',2,200)]);stepTowerDefense(s,1/60)
  s.enemies[0]!.distance=20;s.towers[0]!.cooldown=10;advance(s,.4)
  expect(s.enemies[0]!.hp).toBe(200);expect(s.stats?.shotsHit).toBe(0)
  expect(s.events?.some(e=>e.type==='miss'&&e.kind==='cannon')).toBe(true)
 })
 it('grants one kill and one bounty when two shots arrive at the same dying enemy',()=>{
  const s=encounter('rapid',[enemy(100,'scout',1.5,6)]);stepTowerDefense(s,1/60)
  s.shots.push({...structuredClone(s.shots[0]!),id:999});s.towers[0]!.cooldown=10
  const gold=s.gold;advance(s,.2)
  expect(s.gold).toBe(gold+8);expect(s.kills).toBe(1);expect(s.towers[0]!.kills).toBe(1)
  expect(s.stats?.damageDealt).toBe(6);expect(s.stats?.shotsHit).toBe(1)
  expect(s.events?.filter(e=>e.type==='kill')).toHaveLength(1)
  expect(s.events?.find(e=>e.type==='kill')).toMatchObject({enemyKind:'scout',bounty:8})
  expect(s.shots).toHaveLength(0)
  expect(s.phase).toBe('wave') // Death is visible before the next preparation screen.
  advance(s,1);expect(s.phase).toBe('prepare');expect(s.gold).toBe(gold+8+40);expect(s.events).toHaveLength(0)
 })
 it('does not retarget a homing shot after its original target dies',()=>{
  const s=encounter('rapid',[enemy(100,'scout',1.5,6),enemy(101,'scout',1.4,40)]);stepTowerDefense(s,1/60)
  s.shots.push({...structuredClone(s.shots[0]!),id:999});s.towers[0]!.cooldown=10;advance(s,.2)
  expect(s.enemies).toHaveLength(1);expect(s.enemies[0]).toMatchObject({id:101,hp:40})
  expect(s.events?.some(e=>e.type==='miss')).toBe(true)
 })
 it('keeps in-flight ownership separate when a sold tower is rebuilt on the same pad',()=>{
  const s=encounter('rapid',[enemy(100,'scout',1.5,6)]);stepTowerDefense(s,1/60)
  const owner=s.towers[0]!.id;sellTower(s,0);expect(buildTower(s,0,'rapid')).toBe(true)
  expect(s.towers[0]!.id).not.toBe(owner);s.towers[0]!.cooldown=10;advance(s,.2)
  expect(s.kills).toBe(1);expect(s.towers[0]!.kills).toBe(0);expect(s.towers[0]!.damageDealt).toBe(0)
  expect(s.events?.find(e=>e.type==='kill')?.towerId).toBe(owner)
 })
 it('applies armor and frost on arrival, with actual damage rather than overkill in statistics',()=>{
  const rapid=encounter('rapid',[enemy(100,'armored',1.5,105)]),cannon=encounter('cannon',[enemy(100,'armored',1.5,105)])
  advance(rapid,.35);advance(cannon,.35)
  expect(rapid.enemies[0]!.hp).toBeCloseTo(100.8);expect(cannon.enemies[0]!.hp).toBe(75)
  const frost=encounter('frost');stepTowerDefense(frost,1/60)
  expect(frost.enemies[0]!.slowUntil).toBe(0);advance(frost,.3)
  expect(frost.enemies[0]!.hp).toBe(37);expect(frost.enemies[0]!.slowUntil).toBeGreaterThan(frost.time)
  const distance=frost.enemies[0]!.distance;frost.towers[0]!.cooldown=10;advance(frost,.5)
  expect(frost.enemies[0]!.distance-distance).toBeCloseTo(.75*.5*.5)
 })
 it('cancels all shots on base defeat and emits a leak without awarding kill income',()=>{
  const s=encounter('rapid',[enemy(100),enemy(101,'boss',TD_LENGTH-.01,650)])
  s.lives=10;stepTowerDefense(s,1/60);expect(s.shots).toHaveLength(1)
  const gold=s.gold;stepTowerDefense(s,1/60)
  expect(s.phase).toBe('lost');expect(s.shots).toHaveLength(0);expect(s.kills).toBe(0);expect(s.gold).toBe(gold)
  expect(s.events?.find(e=>e.type==='leak')).toMatchObject({enemyId:101,enemyKind:'boss',amount:10})
  const time=s.time;advance(s,5);expect(s.time).toBe(time);expect(s.gold).toBe(gold)
 })
 it('bounds event history and removes expired effects',()=>{
  const s=encounter('cannon',Array.from({length:100},(_,i)=>enemy(100+i,'scout',2,1)))
  advance(s,.4)
  expect(s.kills).toBe(100);expect(s.events!.length).toBeLessThanOrEqual(TD_EVENT_LIMIT)
  expect(new Set(s.events!.map(e=>e.id)).size).toBe(s.events!.length)
  advance(s,1.2);expect(s.events).toHaveLength(0);expect(s.shots).toHaveLength(0)
 })
 it('restores old v1 checkpoints and persists new damage summaries without transient combat state',()=>{
  const store=storage(),s=encounter();advance(s,15)
  // Finish this single-target encounter, keeping the normal prepare-only checkpoint boundary.
  expect(s.phase).toBe('prepare');saveTD(store,s,'combat')
  const raw=JSON.parse(store.getItem(TD_SAVE)!)
  expect(raw).not.toHaveProperty('events');expect(raw).not.toHaveProperty('shots');expect(raw.towers[0]).not.toHaveProperty('id')
  expect(loadTD(store)!.state.stats).toEqual(s.stats)
  expect(loadTD(store)!.state.towers[0]!.damageDealt).toBe(s.towers[0]!.damageDealt)
  delete raw.stats;delete raw.towers[0].damageDealt;delete raw.towers[0].shotsFired
  store.setItem(TD_SAVE,JSON.stringify(raw));const legacy=loadTD(store)!.state
  expect(legacy.stats).toEqual({shotsFired:0,shotsHit:0,damageDealt:0});expect(legacy.towers[0]!.damageDealt).toBe(0)
  expect(startTowerWave(legacy)).toBe(true);advance(legacy,1);expect(legacy.enemies.length).toBeGreaterThan(0)
 })
 it('rejects an invalid combat summary before replacing an existing valid checkpoint',()=>{
  const store=storage(),s=newTowerDefense();buildTower(s,0,'rapid');saveTD(store,s,'kept')
  const before=store.getItem(TD_SAVE);s.stats!.damageDealt=Number.NaN
  expect(()=>saveTD(store,s,'invalid')).toThrow();expect(store.getItem(TD_SAVE)).toBe(before)
  expect(loadTD(store)!.id).toBe('kept')
 })
})
