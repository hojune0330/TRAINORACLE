import {STARLIGHT_WORLD} from './fantasy-world.ts'

export type TDMapId='forest'|'starlight'
export type TDMapPoint={x:number;y:number}
export type TDMap={
 readonly id:TDMapId;readonly name:string
 readonly bounds:{readonly width:number;readonly height:number}
 readonly path:readonly TDMapPoint[];readonly pads:readonly TDMapPoint[];readonly length:number
 readonly waveStartDistances:readonly number[]
 readonly regions:readonly {readonly id:string;readonly name:string;readonly center:TDMapPoint}[]
}
const map=(data:Omit<TDMap,'length'>):TDMap=>({...data,length:data.path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-data.path[i]!.x,p.y-data.path[i]!.y),0)})

/** Released layouts are immutable: pad indices and path distances are persisted state. */
export const TD_MAPS:Readonly<Record<TDMapId,TDMap>>={
 forest:map({id:'forest',name:'숲길 관문',bounds:{width:12,height:10},
  path:[{x:0,y:2},{x:3,y:2},{x:3,y:6},{x:7,y:6},{x:7,y:2},{x:10,y:2},{x:10,y:8},{x:12,y:8}],
  pads:[{x:1.5,y:3.6},{x:4.5,y:3.5},{x:5.5,y:5},{x:8.5,y:3.6},{x:8.5,y:6.7},{x:4.5,y:7.6},{x:1.5,y:6.2},{x:10.5,y:5.5}],regions:[],waveStartDistances:[0,0,0,0,0,0]}),
 starlight:map({id:'starlight',name:STARLIGHT_WORLD.name,bounds:{width:24,height:16},
  // Three bends offer early coverage, a central double road and a final interception area.
  // Units and tower ranges retain their original scale; this is not a stretched old board.
  path:[{x:0,y:3.5},{x:5,y:3.5},{x:5,y:8},{x:10,y:8},{x:10,y:4},{x:15.5,y:4},{x:15.5,y:9},{x:20,y:9},{x:20,y:12},{x:24,y:12}],
  pads:[{x:1.8,y:5.1},{x:3.6,y:5.7},{x:6.5,y:6},{x:7.8,y:9.6},
   {x:8.4,y:5.8},{x:11.7,y:6.1},{x:12.7,y:2.4},{x:14,y:6.5},
   {x:17.2,y:6.4},{x:17.6,y:10.6},{x:18.4,y:7.3},{x:21.6,y:10.5},
   {x:22.4,y:13.7},{x:18.4,y:13.5}],regions:STARLIGHT_WORLD.regions,waveStartDistances:[0,0,14.5,14.5,29.5,29.5]}),
}
export function getTDMap(source?:TDMapId|{mapId?:TDMapId}):TDMap{
 const id=(typeof source==='string'?source:source?.mapId)??'forest'
 const result=TD_MAPS[id]
 if(!result)throw Error('알 수 없는 방어 맵이에요.')
 return result
}
