import { expect, it } from 'vitest'
import { newSoloPush, startSoloPush, advanceSoloPush } from './solo-push'
import { storeSoloRecord, readSoloRecords, bestSoloRecord, SOLO_RECORDS_KEY, SURVIVAL_RECORDS_KEY } from './solo-party-storage'
import { roomSeries } from '../../screens/treadmill/arena-party'
import type { ArenaSnapshot } from '../../screens/treadmill/arena-types'

it('finishes both survival rounds using friend rules without turning back into push', () => {
  const s = newSoloPush('survival')
  for (let round = 1; round <= 2; round++) {
    startSoloPush(s); expect(s.game.mode).toBe('survival')
    for (let n = 0; n < 5700; n++) advanceSoloPush(s, 1 / 60, false)
    expect(s.results).toHaveLength(round); expect(s.game.players.every(p => p.kos === 0)).toBe(true)
  }
  expect(s.phase).toBe('finished'); expect(s.game.players[0]!.falls).toBeGreaterThan(3)
})
it('stores survival separately from older clients and compares falls before successful jumps', () => {
  const values = new Map<string,string>()
  const storage = {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}}
  const base = {version:1 as const, completedAt:'2026-10-15T00:00:00.000Z',missed:0,falls:2,wins:2}
  storeSoloRecord(storage,{...base,id:'old',mode:'push',success:4})
  const old = storage.getItem(SOLO_RECORDS_KEY)
  storeSoloRecord(storage,{...base,id:'jump',mode:'survival',success:70,falls:3})
  storeSoloRecord(storage,{...base,id:'steady',mode:'survival',success:55})
  expect(storage.getItem(SOLO_RECORDS_KEY)).toBe(old)
  expect(JSON.parse(storage.getItem(SURVIVAL_RECORDS_KEY)!)).toHaveLength(2)
  const records=readSoloRecords(storage); expect(records).toHaveLength(3)
  expect(bestSoloRecord(records,'survival')!.id).toBe('steady')
  expect(bestSoloRecord(records,'push')!.id).toBe('old')
})
it('room comparison excludes earlier partners and distinguishes joint ranks from wins', () => {
  const standing=(id:string,rank:number)=>({id,rank,name:id,kos:0,falls:0,dodges:0})
  const s:ArenaSnapshot={type:'state',room:'test',host:'a',game:null,members:['a','b'].map(id=>({id,name:id,ready:false,connected:true})),history:[
    {round:3,mode:'survival',standings:[standing('a',1),standing('b',1)]},
    {round:2,mode:'push',standings:[standing('a',1),standing('b',2)]},
    {round:1,standings:[standing('a',1),standing('old',2)]},
  ]}
  expect(roomSeries(s)).toEqual({rounds:2,players:[{id:'a',name:'a',wins:1,ties:1},{id:'b',name:'b',wins:0,ties:1}]})
})
