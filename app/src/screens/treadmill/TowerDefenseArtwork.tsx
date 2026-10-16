import {useState} from 'react'
import type {ReactNode} from 'react'
import type {EnemyKind,TowerKind} from '../../domain/minigame/tower-defense'

export type TDArtworkId = `td-${TowerKind}-tower` | `td-${TowerKind}-tower-upgraded` | `td-enemy-${EnemyKind}` | 'td-base-gate' | 'td-build-pad'
 | 'fx-hit-burst' | 'fx-cannon-blast' | 'fx-frost-burst' | 'fx-upgrade-burst' | 'reward-star' | 'reward-victory-medal'
export const tdTile=(n:number)=>`${import.meta.env.BASE_URL}game/kenney-td/tile${n}.png`
export const tdArtwork=(id:TDArtworkId)=>`${import.meta.env.BASE_URL}game/image-library-v1/${id.startsWith('td-')?'defense':'fx'}/${id}.webp`
export const tdTowerArtwork=(kind:TowerKind,level=1):TDArtworkId=>`td-${kind}-tower${level>1?'-upgraded':''}`
export const tdEnemyArtwork=(kind:EnemyKind):TDArtworkId=>`td-enemy-${kind}`
export const tdPreview=(id:TDArtworkId)=>{
 const kind=id.match(/^td-(rapid|cannon|frost)-tower/)?.[1]??id.match(/^td-enemy-(scout|swift|armored|boss)$/)?.[1]
 return kind?`${import.meta.env.BASE_URL}game/defense-v5/${kind}-preview.webp`:tdArtwork(id)
}

/** Decorative only: loading or failed artwork always leaves the prior image/geometry visible. */
export function TDArtwork({id,size,fallbackTile,className=''}:{id:TDArtworkId;size:number;fallbackTile?:number;className?:string}){
 const src=tdPreview(id),[ready,setReady]=useState(''),[failed,setFailed]=useState('')
 return <span className={`td-artwork ${className}`} aria-hidden="true" style={{display:'inline-grid',position:'relative',width:size,height:size,flexShrink:0}}>
  {ready!==src&&fallbackTile!==undefined&&<img src={tdTile(fallbackTile)} alt="" width={size} height={size} style={{width:'100%',height:'100%',objectFit:'contain'}} onError={e=>{e.currentTarget.style.visibility='hidden'}}/>}
  {failed!==src&&<img key={src} src={src} alt="" width={size} height={size} onLoad={()=>setReady(src)} onError={()=>setFailed(src)} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',opacity:ready===src?1:0}}/>}
 </span>
}

export function TDSprite({id,x,y,width,height=width,fallback,className=''}:{id:TDArtworkId;x:number;y:number;width:number;height?:number;fallback?:ReactNode;className?:string}){
 const src=tdArtwork(id),[ready,setReady]=useState(''),[failed,setFailed]=useState('')
 return <g className={className} aria-hidden="true" data-artwork={id}>
  {ready!==src&&fallback}
  {failed!==src&&<image key={src} href={src} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid meet" opacity={ready===src?1:0} onLoad={()=>setReady(src)} onError={()=>setFailed(src)}/>}
 </g>
}
