import {useEffect, useRef, useState} from 'react'
import type {MutableRefObject} from 'react'
import {TD_PADS, TD_TOWERS} from '../../domain/minigame/tower-defense'
import type {TowerDefense} from '../../domain/minigame/tower-defense'
import {FIELD_WIDTH, FIELD_HEIGHT, fieldPoint} from './defense/coordinates'
import {TowerDefenseBoard as DefenseFallbackBoard} from './DefenseFallbackBoard'
export {tdTile} from './TowerDefenseArtwork'

export function TowerDefenseBoard({state,live,selected,onSelect,paused,sound}:{state:TowerDefense;live:MutableRefObject<TowerDefense|null>;selected:number;onSelect:(pad:number)=>void;paused:boolean;sound:boolean}) {
 const mount=useRef<HTMLDivElement>(null),latest=useRef({selected,paused,sound}),[ready,setReady]=useState(false),[fallback,setFallback]=useState(false),[missing,setMissing]=useState(0)
 latest.current={selected,paused,sound}
 useEffect(()=>{
  let cancelled=false,game:{destroy:(removeCanvas:boolean)=>void}|undefined
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches||!!mount.current?.closest('[data-reduced-motion="true"]')
  import('./defense/DefenseScene').then(({createDefenseGame})=>{
   if(cancelled||!mount.current)return
   game=createDefenseGame(mount.current,{state:()=>live.current,selected:()=>latest.current.selected,paused:()=>latest.current.paused,sound:()=>latest.current.sound,reduced,
    ready:files=>{if(!cancelled){setReady(true);setMissing(files.length)}}})
  }).catch(()=>{if(!cancelled)setFallback(true)})
  return()=>{cancelled=true;game?.destroy(true)}
 },[live])
 if(fallback)return <><p className="td-render-note" role="status">그래픽을 불러오지 못해 간소한 전장으로 표시해요.</p><DefenseFallbackBoard state={state} selected={selected} onSelect={onSelect}/></>
 return <div className="td-board td-battlefield" data-ready={ready} data-missing-assets={missing}>
  <div className="td-canvas" ref={mount}/>
  {!ready&&<div className="td-loading" role="status">숲길 전장 준비 중…</div>}
  <p className="sr-only">왼쪽 입구에서 굽은 길을 따라 오른쪽 기지로 향하는 전장. 번호를 눌러 건설하거나 강화하세요.</p>
  {TD_PADS.map((p,i)=>{const f=fieldPoint(p),t=state.towers.find(t=>t.pad===i);return <button key={i} className="td-pad" style={{left:`${f.x/FIELD_WIDTH*100}%`,top:`${f.y/FIELD_HEIGHT*100}%`}} aria-label={`${i+1}번 건설 지점`} aria-description={t?`${TD_TOWERS[t.kind].name} ${t.level}레벨`:'타워를 지을 수 있는 빈 지점'} aria-pressed={selected===i} onClick={()=>onSelect(i)}><span>{i+1}</span></button>})}
  {state.towers.some(t=>t.pad===selected)&&<span data-testid="tower-range" className="td-range-caption">{selected+1}번 타워 공격 범위</span>}
  <span className="td-field-caption">숲길 관문 <b>01</b></span>
 </div>
}
