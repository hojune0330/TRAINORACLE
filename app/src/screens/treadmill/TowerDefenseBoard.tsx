import {useEffect,useRef,useState,useCallback} from 'react'
import type {MutableRefObject,PointerEvent as PE} from 'react'
import {getTDMap,getTDWaveEntry,routePoint,TD_TOWERS} from '../../domain/minigame/tower-defense'
import type {TowerDefense} from '../../domain/minigame/tower-defense'
import {fieldSize,fieldPoint} from './defense/coordinates'
import {VIEW_WIDTH as VW,VIEW_HEIGHT as VH,constrainCamera,cameraRect,worldToView,zoomAt,overviewZoom} from './defense/world-camera'
import type {WorldCamera} from './defense/world-camera'
import {TowerDefenseBoard as DefenseFallbackBoard} from './DefenseFallbackBoard'
export {tdTile} from './TowerDefenseArtwork'

export function TowerDefenseBoard({state,live,selected,onSelect,paused,sound}:{state:TowerDefense;live:MutableRefObject<TowerDefense|null>;selected:number;onSelect:(pad:number)=>void;paused:boolean;sound:boolean}) {
 const map=getTDMap(state),world=fieldSize(map.id),mount=useRef<HTMLDivElement>(null),surface=useRef<HTMLDivElement>(null)
 const initial=()=>{
  const entry=getTDWaveEntry(state),region=map.regions.find(item=>item.id===entry.regionId)
  const target=map.id==='forest'?map.pads[0]!:region?.center??entry.position
  return constrainCamera({...fieldPoint(target),zoom:map.id==='forest'?overviewZoom(world):1,follow:false},world)
 }
 const [camera,setCamera]=useState<WorldCamera>(initial),cameraRef=useRef(camera)
 const latest=useRef({selected,paused,sound}),[ready,setReady]=useState(false),[fallback,setFallback]=useState(false),[missing,setMissing]=useState(0)
 latest.current={selected,paused,sound}
 const move=useCallback((next:WorldCamera)=>{const value=constrainCamera(next,fieldSize(map.id));cameraRef.current=value;setCamera(value)},[map.id])
 useEffect(()=>{move(initial())},[map.id]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  let cancelled=false,game:{destroy:(removeCanvas:boolean)=>void}|undefined
  setReady(false);setFallback(false)
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches||!!mount.current?.closest('[data-reduced-motion="true"]')
  import('./defense/DefenseScene').then(({createDefenseGame})=>{
   if(cancelled||!mount.current)return
   game=createDefenseGame(mount.current,{state:()=>live.current,camera:()=>cameraRef.current,selected:()=>latest.current.selected,paused:()=>latest.current.paused,sound:()=>latest.current.sound,reduced,
    ready:files=>{if(!cancelled){setReady(true);setMissing(files.length)}}})
  }).catch(()=>{if(!cancelled)setFallback(true)})
  return()=>{cancelled=true;game?.destroy(true)}
 },[live,map.id])
 useEffect(()=>{
  if(!camera.follow||paused)return
  let frame=0,last=0
  const tick=(now:number)=>{
   if(now-last>50){last=now;const s=live.current,lead=s?.enemies.reduce<TowerDefense['enemies'][number]|undefined>((a,e)=>!a||e.distance>a.distance?e:a,undefined)
    if(lead){const p=fieldPoint(routePoint(lead.distance,map.id)),c=cameraRef.current
     const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches||!!mount.current?.closest('[data-reduced-motion="true"]')
     const factor=reduced?1:.16;move({...c,x:c.x+(p.x-c.x)*factor,y:c.y+(p.y-c.y)*factor})}
   }frame=requestAnimationFrame(tick)
  };frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[camera.follow,paused,live,map.id,move])
 const pointers=useRef(new Map<number,{x:number;y:number}>()),gesture=useRef<{x:number;y:number;distance:number;camera:WorldCamera}|null>(null),dragged=useRef(false)
 const point=(event:PE)=>{const rect=surface.current!.getBoundingClientRect();return {x:(event.clientX-rect.left)/rect.width*VW,y:(event.clientY-rect.top)/rect.height*VH}}
 const baseline=()=>{const [a,b]=[...pointers.current.values()];gesture.current=a?{x:b?(a.x+b.x)/2:a.x,y:b?(a.y+b.y)/2:a.y,distance:b?Math.hypot(a.x-b.x,a.y-b.y):0,camera:{...cameraRef.current}}:null}
 const down=(event:PE)=>{if(event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);pointers.current.set(event.pointerId,point(event));if(pointers.current.size===1)dragged.current=false;baseline()}
 const drag=(event:PE)=>{
  if(!pointers.current.has(event.pointerId)||!gesture.current)return
  pointers.current.set(event.pointerId,point(event));const [a,b]=[...pointers.current.values()],g=gesture.current
  const x=b?(a!.x+b.x)/2:a!.x,y=b?(a!.y+b.y)/2:a!.y
  if(Math.hypot(x-g.x,y-g.y)<10&&!b&&!dragged.current)return
  dragged.current=true
  const next=b&&g.distance?zoomAt(g.camera,world,g.camera.zoom*Math.hypot(a!.x-b.x,a!.y-b.y)/g.distance,{x:g.x,y:g.y}):g.camera
  move({...next,x:next.x-(x-g.x)/next.zoom,y:next.y-(y-g.y)/next.zoom,follow:false})
 }
 const up=(event:PE)=>{
  if(!dragged.current&&event.type!=='pointercancel'&&pointers.current.size===1){const p=point(event),box=surface.current!.getBoundingClientRect()
   const nearest=map.pads.map((pad,i)=>({i,p:worldToView(fieldPoint(pad),cameraRef.current)})).sort((a,b)=>Math.hypot(a.p.x-p.x,a.p.y-p.y)-Math.hypot(b.p.x-p.x,b.p.y-p.y))[0]
   if(nearest&&Math.hypot((nearest.p.x-p.x)*box.width/VW,(nearest.p.y-p.y)*box.height/VH)<28)onSelect(nearest.i)}
  pointers.current.delete(event.pointerId);baseline()
 }
 const focus=(index:number)=>{onSelect(index);if(map.id!=='forest')move({...fieldPoint(map.pads[index]!),zoom:Math.max(1,cameraRef.current.zoom),follow:false})}
 const rect=cameraRect(camera),path=map.path.map(p=>{const f=fieldPoint(p);return `${f.x},${f.y}`}).join(' ')
 const padShortcuts=<div className="td-pad-list" aria-label="건설 지점 바로가기">{map.pads.map((_,i)=>{const t=state.towers.find(tower=>tower.pad===i);return <button key={i} className="td-pad-shortcut" aria-label={`${i+1}번 건설 지점`} aria-description={t?`${TD_TOWERS[t.kind].name} ${t.level}레벨`:'타워를 지을 수 있는 빈 지점'} aria-pressed={selected===i} onClick={()=>fallback?onSelect(i):focus(i)}>{i+1}{t&&<span aria-hidden="true">●</span>}</button>})}</div>
 if(fallback)return <div className="td-map-workspace"><p className="td-render-note" role="status">그래픽을 불러오지 못해 간소한 전장으로 표시해요. 아래 건설 지점 번호로 선택할 수 있어요.</p><DefenseFallbackBoard state={state} selected={selected}/>{padShortcuts}</div>
 return <div className="td-map-workspace">
  <div className="td-camera-tools" aria-label="전장 시점">
   <button aria-label="전장 확대" disabled={camera.zoom>=1.65} onClick={()=>move(zoomAt(camera,world,camera.zoom*1.25))}>＋</button>
   <button aria-label="전장 축소" disabled={camera.zoom<=overviewZoom(world)+.001} onClick={()=>move(zoomAt(camera,world,camera.zoom/1.25))}>−</button>
   <button onClick={()=>move({x:world.width/2,y:world.height/2,zoom:overviewZoom(world),follow:false})}>전체 지도</button>
   <button aria-pressed={camera.follow} onClick={()=>move({...camera,zoom:Math.max(.9,camera.zoom),follow:!camera.follow})}>선두 따라가기</button>
  </div>
  <div ref={surface} className="td-board td-battlefield" data-ready={ready} data-missing-assets={missing} data-map={map.id} data-camera-x={camera.x.toFixed(1)} data-camera-y={camera.y.toFixed(1)} data-camera-zoom={camera.zoom.toFixed(3)}
   onPointerDown={down} onPointerMove={drag} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={event=>{pointers.current.delete(event.pointerId);baseline()}}>
   <div className="td-canvas" ref={mount}/>
   {!ready&&<div className="td-loading" role="status">{map.name} 전장 준비 중…</div>}
   <p className="sr-only">드래그로 이동, 두 손가락으로 확대할 수 있어요. 아래 건설 지점 번호를 누르면 해당 위치로 이동해요.</p>
   {map.pads.map((p,i)=>{const f=worldToView(fieldPoint(p),camera),visible=f.x>35&&f.x<VW-35&&f.y>35&&f.y<VH-35
    return visible&&<span key={i} aria-hidden="true" className="td-world-pin" data-selected={selected===i} style={{left:`${f.x/VW*100}%`,top:`${f.y/VH*100}%`}}>{i+1}</span>})}
   {state.towers.some(t=>t.pad===selected)&&<span data-testid="tower-range" className="td-range-caption">{selected+1}번 타워 공격 범위</span>}
   <span className="td-field-caption">{map.name}</span>
  </div>
  <div className="td-map-navigator">
   <button className="td-minimap" aria-label="미니맵에서 시점 이동" onClick={event=>{const box=event.currentTarget.getBoundingClientRect();move({...camera,x:event.detail===0?world.width/2:(event.clientX-box.left)/box.width*world.width,y:event.detail===0?world.height/2:(event.clientY-box.top)/box.height*world.height,follow:false})}}>
    <svg viewBox={`0 0 ${world.width} ${world.height}`} preserveAspectRatio="none" aria-hidden="true">{map.id==='starlight'&&<image href={`${import.meta.env.BASE_URL}game/fantasy-world-v1/ground.webp`} width={world.width} height={world.height}/>}<polyline points={path} className="td-mini-path"/>{map.pads.map((p,i)=>{const f=fieldPoint(p);return <circle key={i} cx={f.x} cy={f.y} r={28} className={selected===i?'td-mini-selected':'td-mini-pad'}/>})}{state.enemies.map(e=>{const p=fieldPoint(routePoint(e.distance,map.id));return <circle key={e.id} cx={p.x} cy={p.y} r={20} className="td-mini-enemy"/>})}<rect x={Math.max(0,rect.x)} y={Math.max(0,rect.y)} width={Math.min(rect.width,world.width)} height={Math.min(rect.height,world.height)} className="td-mini-view"/></svg>
   </button>
   <div className="td-region-nav"><small>드래그 이동 · 두 손가락 확대</small><div>{map.regions.map(region=><button key={region.id} onClick={()=>move({...fieldPoint(region.center),zoom:1,follow:false})}>{region.name}</button>)}</div></div>
  </div>
  {padShortcuts}
 </div>
}
