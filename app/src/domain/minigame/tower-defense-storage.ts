import {z} from 'zod'
import {newTowerDefense,normalizeTowerDefenseCombat,getTDMap,TD_MAPS,TD_TOWERS,upgradeCost} from './tower-defense'
import type {TowerDefense,Tower,TDMapId} from './tower-defense'
export const TD_SAVE='trainoracle.tower-defense.checkpoint.v1',TD_RECORDS='trainoracle.tower-defense.records.v1'
/** A v1 reader ignores unknown object fields, so never put a new map in its legacy slot. */
export function tdSaveKey(mapId:TDMapId='forest'){return mapId==='forest'?TD_SAVE:`${TD_SAVE}.${getTDMap(mapId).id}`}
export function tdRecordsKey(mapId:TDMapId='forest'){return mapId==='forest'?TD_RECORDS:`${TD_RECORDS}.${getTDMap(mapId).id}`}
const mapId=z.enum(['forest','starlight']).optional(),maxPads=Math.max(...Object.values(TD_MAPS).map(m=>m.pads.length))
const counter=z.number().min(0).max(10000000)
const combatStats=z.object({shotsFired:counter.int(),shotsHit:counter.int(),damageDealt:counter})
const tower=z.object({pad:z.number().int().min(0).max(maxPads-1),kind:z.enum(['rapid','cannon','frost']),level:z.union([z.literal(1),z.literal(2),z.literal(3)]),branch:z.enum(['power','reach']).nullable(),spent:z.number().int(),kills:z.number().int().min(0).max(200),damageDealt:counter.optional(),shotsFired:counter.int().optional()})
const checkpoint=z.object({version:z.literal(1),mapId,id:z.string().min(1).max(100),wave:z.number().int().min(0).max(5),gold:z.number().int().min(0).max(20000),lives:z.number().int().min(1).max(20),kills:z.number().int().min(0).max(200),leaks:z.number().int().min(0).max(200),time:z.number().min(0).max(100000),towers:z.array(tower).max(maxPads),stats:combatStats.optional()}).superRefine((data,ctx)=>{
 const pads=getTDMap(data).pads
 if(data.towers.length>pads.length||data.towers.some(t=>!pads[t.pad]))ctx.addIssue({code:'custom',message:'저장된 맵의 건설 지점과 맞지 않아요.'})
})
const record=z.object({mapId,id:z.string().min(1).max(100),won:z.boolean(),wave:z.number().int().min(0).max(6),lives:z.number().int().min(0).max(20),kills:z.number().int().min(0).max(200),leaks:z.number().int().min(0).max(200),at:z.string().max(60)})
export type TDRecord=z.infer<typeof record>
export function loadTD(storage:Pick<Storage,'getItem'>,map:TDMapId='forest'):{id:string;state:TowerDefense}|null{
 const raw=storage.getItem(tdSaveKey(map));if(!raw)return null
 const data=checkpoint.parse(JSON.parse(raw)),seen=new Set<number>()
 if(getTDMap(data).id!==map)throw Error('저장된 맵과 이어하기 위치가 맞지 않아요.')
 for(const t of data.towers){if(seen.has(t.pad)||(t.level===1)!==(t.branch===null))throw Error('저장된 타워 구성을 읽을 수 없어요.');seen.add(t.pad)
  let spent=TD_TOWERS[t.kind].cost;for(let level=1;level<t.level;level++)spent+=upgradeCost({...t,level} as Tower)
  if(spent!==t.spent)throw Error('저장된 건설 비용을 읽을 수 없어요.')}
 return {id:data.id,state:normalizeTowerDefenseCombat({...newTowerDefense(map),...data,phase:'prepare',towers:data.towers.map(t=>({...t,cooldown:0,angle:0}))})}
}
export function saveTD(storage:Pick<Storage,'getItem'|'setItem'>,state:TowerDefense,id:string){
 if(state.phase!=='prepare')throw Error('웨이브 준비 중에 저장할 수 있어요.')
 const map=getTDMap(state).id,key=tdSaveKey(map)
 loadTD(storage,map) // Preserve unknown/corrupt prior data instead of silently overwriting it.
 const value=JSON.stringify(checkpoint.parse({...state,id}));storage.setItem(key,value)
 if(storage.getItem(key)!==value)throw Error('저장이 확인되지 않았어요.')
}
export function readTDRecords(storage:Pick<Storage,'getItem'>,map:TDMapId='forest'):TDRecord[]{
 const raw=storage.getItem(tdRecordsKey(map)),rows=raw?z.array(record).max(20).parse(JSON.parse(raw)):[]
 if(rows.some(r=>getTDMap(r).id!==map))throw Error('기록된 맵과 기록 위치가 맞지 않아요.')
 return rows
}
export function recordTD(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,state:TowerDefense,id:string){
 if(!['won','lost'].includes(state.phase))throw Error('경기가 끝나지 않았어요.')
 const map=getTDMap(state).id,key=tdRecordsKey(map),rows=readTDRecords(storage,map);if(!rows.some(r=>r.id===id)){const value=JSON.stringify([...rows,record.parse({mapId:state.mapId,id,won:state.phase==='won',wave:state.wave,lives:state.lives,kills:state.kills,leaks:state.leaks,at:new Date().toISOString()})].slice(-20));storage.setItem(key,value);if(storage.getItem(key)!==value)throw Error('기록 저장이 확인되지 않았어요.')}
 // Never delete a different saved run.
 try{if(loadTD(storage,map)?.id===id)storage.removeItem(tdSaveKey(map))}catch{/* The existing invalid checkpoint remains available for recovery. */}
}
