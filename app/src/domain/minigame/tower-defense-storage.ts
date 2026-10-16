import {z} from 'zod'
import {newTowerDefense,TD_PADS,TD_TOWERS,upgradeCost} from './tower-defense'
import type {TowerDefense,Tower} from './tower-defense'
export const TD_SAVE='trainoracle.tower-defense.checkpoint.v1',TD_RECORDS='trainoracle.tower-defense.records.v1'
const tower=z.object({pad:z.number().int().min(0).max(TD_PADS.length-1),kind:z.enum(['rapid','cannon','frost']),level:z.union([z.literal(1),z.literal(2),z.literal(3)]),branch:z.enum(['power','reach']).nullable(),spent:z.number().int(),kills:z.number().int().min(0).max(200)})
const checkpoint=z.object({version:z.literal(1),id:z.string().min(1).max(100),wave:z.number().int().min(0).max(5),gold:z.number().int().min(0).max(20000),lives:z.number().int().min(1).max(20),kills:z.number().int().min(0).max(200),leaks:z.number().int().min(0).max(200),time:z.number().min(0).max(100000),towers:z.array(tower).max(TD_PADS.length)})
const record=z.object({id:z.string().min(1).max(100),won:z.boolean(),wave:z.number().int().min(0).max(6),lives:z.number().int().min(0).max(20),kills:z.number().int().min(0).max(200),leaks:z.number().int().min(0).max(200),at:z.string().max(60)})
export type TDRecord=z.infer<typeof record>
export function loadTD(storage:Pick<Storage,'getItem'>):{id:string;state:TowerDefense}|null{
 const raw=storage.getItem(TD_SAVE);if(!raw)return null
 const data=checkpoint.parse(JSON.parse(raw)),seen=new Set<number>()
 for(const t of data.towers){if(seen.has(t.pad)||(t.level===1)!==(t.branch===null))throw Error('저장된 타워 구성을 읽을 수 없어요.');seen.add(t.pad)
  let spent=TD_TOWERS[t.kind].cost;for(let level=1;level<t.level;level++)spent+=upgradeCost({...t,level} as Tower)
  if(spent!==t.spent)throw Error('저장된 건설 비용을 읽을 수 없어요.')}
 return {id:data.id,state:{...newTowerDefense(),...data,phase:'prepare',towers:data.towers.map(t=>({...t,cooldown:0,angle:0}))}}
}
export function saveTD(storage:Pick<Storage,'getItem'|'setItem'>,state:TowerDefense,id:string){
 if(state.phase!=='prepare')throw Error('웨이브 준비 중에 저장할 수 있어요.')
 loadTD(storage) // Preserve unknown/corrupt prior data instead of silently overwriting it.
 const value=JSON.stringify(checkpoint.parse({...state,id}));storage.setItem(TD_SAVE,value)
 if(storage.getItem(TD_SAVE)!==value)throw Error('저장이 확인되지 않았어요.')
}
export function readTDRecords(storage:Pick<Storage,'getItem'>):TDRecord[]{const raw=storage.getItem(TD_RECORDS);return raw?z.array(record).max(20).parse(JSON.parse(raw)):[]}
export function recordTD(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,state:TowerDefense,id:string){
 if(!['won','lost'].includes(state.phase))throw Error('경기가 끝나지 않았어요.')
 const rows=readTDRecords(storage);if(!rows.some(r=>r.id===id)){const value=JSON.stringify([...rows,record.parse({id,won:state.phase==='won',wave:state.wave,lives:state.lives,kills:state.kills,leaks:state.leaks,at:new Date().toISOString()})].slice(-20));storage.setItem(TD_RECORDS,value);if(storage.getItem(TD_RECORDS)!==value)throw Error('기록 저장이 확인되지 않았어요.')}
 // Never delete a different saved run.
 try{if(loadTD(storage)?.id===id)storage.removeItem(TD_SAVE)}catch{/* The existing invalid checkpoint remains available for recovery. */}
}
