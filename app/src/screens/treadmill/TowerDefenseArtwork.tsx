import {useState} from 'react'
import type {ReactNode} from 'react'
import type {EnemyKind,TowerKind,Branch} from '../../domain/minigame/tower-defense'
import {tdGrowthShapes} from './TowerDefenseGrowth'

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

export function TDGrowthLayer({level,branch,layer}:{level:number;branch:Branch|null;layer:'back'|'front'}){
 return <>{tdGrowthShapes(level,branch).filter(shape=>shape.layer===layer).map((shape,i)=>{
  const props={className:`td-growth-shape td-growth-${shape.tone}`}
  return shape.type==='circle'?<circle key={i} {...props} cx={shape.x} cy={shape.y} r={shape.r}/>:
   shape.type==='line'?<polyline key={i} {...props} className={`${props.className} td-growth-line`} points={shape.points.map(p=>p.join(',')).join(' ')}/>:
   <polygon key={i} {...props} points={shape.points.map(p=>p.join(',')).join(' ')}/>
 })}</>
}

/** Upgrade parts stay visible even when an image is loading or unavailable. */
export function TDTowerArtwork({kind,level=1,branch=null,size,fallbackTile}:{kind:TowerKind;level?:number;branch?:Branch|null;size:number;fallbackTile?:number}){
 return <span className="td-tower-art" data-level={level} data-branch={branch??'base'} aria-hidden="true" style={{width:size,height:size}}>
  <svg viewBox="0 0 128 128" className="td-growth-back"><TDGrowthLayer level={level} branch={branch} layer="back"/></svg>
  <TDArtwork id={tdTowerArtwork(kind,level)} size={size} fallbackTile={fallbackTile}/>
  <svg viewBox="0 0 128 128" className="td-growth-front"><TDGrowthLayer level={level} branch={branch} layer="front"/></svg>
 </span>
}

export function TDSprite({id,x,y,width,height=width,fallback,className=''}:{id:TDArtworkId;x:number;y:number;width:number;height?:number;fallback?:ReactNode;className?:string}){
 const src=id.includes('-tower')?tdPreview(id):tdArtwork(id),[ready,setReady]=useState(''),[failed,setFailed]=useState('')
 return <g className={className} aria-hidden="true" data-artwork={id}>
  {ready!==src&&fallback}
  {failed!==src&&<image key={src} href={src} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid meet" opacity={ready===src?1:0} onLoad={()=>setReady(src)} onError={()=>setFailed(src)}/>}
 </g>
}

export function TDTowerSprite({kind,level,branch,x,y,width,fallback}:{kind:TowerKind;level:number;branch:Branch|null;x:number;y:number;width:number;fallback:ReactNode}){
 return <g data-level={level} data-branch={branch??'base'}>
  <g transform={`translate(${x},${y}) scale(${width/128})`}><TDGrowthLayer level={level} branch={branch} layer="back"/></g>
  <TDSprite id={tdTowerArtwork(kind,level)} x={x} y={y} width={width} fallback={fallback}/>
  <g transform={`translate(${x},${y}) scale(${width/128})`}><TDGrowthLayer level={level} branch={branch} layer="front"/></g>
 </g>
}
