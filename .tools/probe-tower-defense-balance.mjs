#!/usr/bin/env node
/** Optional balance experiment, not a CI gate or a claim that the game is fun.
 * Run with Node 24.19+: node .tools/probe-tower-defense-balance.mjs
 * Uses the real domain functions and earned gold only. No state or economy injection.
 */
import {createHash} from 'node:crypto'
import {readFile,writeFile} from 'node:fs/promises'
import {
 newTowerDefense,buildTower,upgradeTower,startTowerWave,stepTowerDefense,TD_VERSION,TD_WAVES,
} from '../app/src/domain/minigame/tower-defense.ts'

const source=new URL('../app/src/domain/minigame/tower-defense.ts',import.meta.url)
const output=new URL('../docs/phase2/defense-balance-v5.json',import.meta.url)
const dt=1/60,maxStepsPerWave=12000
const priority=[1,2,3,4,7,0,5,6]
const mixedPlan=[
 [{action:'build',pad:1,kind:'rapid'},{action:'build',pad:2,kind:'cannon'}],
 [{action:'build',pad:0,kind:'frost'}],
 [{action:'upgrade',pad:2,branch:'power'}],
 [{action:'upgrade',pad:1,branch:'power'},{action:'upgrade',pad:2,branch:'power'}],
 [{action:'build',pad:3,kind:'cannon'},{action:'upgrade',pad:3,branch:'power'}],
 [{action:'upgrade',pad:3,branch:'power'},{action:'upgrade',pad:1,branch:'power'}],
]
const policies=[
 {id:'mixed',description:'Scripted mixed build: construct or upgrade before each wave in the listed order.',
  plan:mixedPlan.map((actions,index)=>({beforeWave:index+1,actions:actions.map(a=>({...a,pad:a.pad+1}))}))},
 ...['rapid','cannon','frost'].map(kind=>({id:`${kind}-only`,kind,
  description:'Before every wave, attempt construction at each priority pad once. Then visit existing towers in construction order and repeatedly attempt the power branch upgrade until unaffordable or max level.',
  buildPriority:priority.map(p=>p+1),upgradeBranch:'power'})),
]

function applyAction(state,action,receipts){
 const before=state.gold
 const accepted=action.action==='build'?buildTower(state,action.pad,action.kind):upgradeTower(state,action.pad,action.branch)
 if(accepted){const tower=state.towers.find(t=>t.pad===action.pad)
  receipts.push({action:action.action,pad:action.pad+1,kind:tower.kind,level:tower.level,branch:tower.branch,cost:before-state.gold,goldAfter:state.gold})}
 return accepted
}
function run(policy){
 const state=newTowerDefense(),waves=[]
 for(let index=0;index<TD_WAVES.length;index++){
  const actions=[]
  if(policy.id==='mixed'){
   for(const action of mixedPlan[index])if(!applyAction(state,action,actions))throw Error(`Mixed policy action rejected before wave ${index+1}: ${JSON.stringify(action)}`)
  }else{
   for(const pad of priority)applyAction(state,{action:'build',pad,kind:policy.kind},actions)
   for(const tower of state.towers)while(applyAction(state,{action:'upgrade',pad:tower.pad,branch:'power'},actions)){/* Only earned gold is spent. */}
  }
  if(!startTowerWave(state))throw Error(`Cannot start wave ${index+1} for ${policy.id}`)
  let steps=0
  while(state.phase==='wave'&&steps<maxStepsPerWave){stepTowerDefense(state,dt);steps++}
  if(state.phase==='wave')throw Error(`Wave ${index+1} exceeded the experiment step limit for ${policy.id}`)
  waves.push({wave:state.wave,name:TD_WAVES[index].name,actions,phase:state.phase,lives:state.lives,
   kills:state.kills,leaks:state.leaks,gold:state.gold,totalSpent:state.towers.reduce((sum,t)=>sum+t.spent,0),
   elapsedSeconds:state.time,waveSeconds:state.waveTime,steps,shotsFired:state.stats.shotsFired,
   shotsHit:state.stats.shotsHit,damageDealt:state.stats.damageDealt})
  if(state.phase==='lost')break
 }
 const last=waves.at(-1)
 return {policy:policy.id,result:state.phase,finalWave:state.wave,lives:state.lives,kills:state.kills,leaks:state.leaks,
  gold:state.gold,totalSpent:last.totalSpent,elapsedSeconds:state.time,shotsFired:state.stats.shotsFired,
  shotsHit:state.stats.shotsHit,damageDealt:state.stats.damageDealt,waves}
}

const report={
 formatVersion:1,generatedAt:new Date().toISOString(),runtime:process.version,
 source:{path:'app/src/domain/minigame/tower-defense.ts',sha256:createHash('sha256').update(await readFile(source)).digest('hex')},
 simulation:{rulesVersion:TD_VERSION,dtSeconds:dt,maxStepsPerWave,startingGold:180,startingLives:20,
  timeBasis:'Simulation seconds advanced by the real fixed-step domain, not elapsed wall time or a player completion-time claim.',
  padNumbering:'All reported pad numbers are the 1-based numbers shown in the game.'},
 interpretation:'These deterministic policies demonstrate viable outcomes, tradeoffs and economy under the current rules. They do not establish optimal play, player retention or fun. This probe is not a CI gate.',
 policies,results:policies.map(run),
}
await writeFile(output,`${JSON.stringify(report,null,2)}\n`,'utf8')
console.log(JSON.stringify({output:'docs/phase2/defense-balance-v5.json',sourceSha256:report.source.sha256,
 results:report.results.map(({policy,result,finalWave,lives,kills,leaks,gold,totalSpent,elapsedSeconds,shotsFired,shotsHit,damageDealt})=>
  ({policy,result,finalWave,lives,kills,leaks,gold,totalSpent,elapsedSeconds,shotsFired,shotsHit,damageDealt}))},null,2))
