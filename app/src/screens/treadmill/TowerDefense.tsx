import React from 'react'
import {ArrowLeft,Pause,Volume2,VolumeX,Shield,Coins,Check,Target,Zap} from 'lucide-react'
import {newTowerDefense,buildTower,upgradeTower,sellTower,startTowerWave,stepTowerDefense,TD_TOWERS,TD_WAVES,TD_ENEMIES,getTDMap,getTDWaveEntry,towerStats,sellValue} from '../../domain/minigame/tower-defense'
import type {TDMapId,TowerKind,Branch,TowerDefense as State} from '../../domain/minigame/tower-defense'
import {loadTD,saveTD,readTDRecords,recordTD} from '../../domain/minigame/tower-defense-storage'
import {useTaskFlowBack} from '../../hooks/useTaskFlowBack'
import {TowerDefenseBoard} from './TowerDefenseBoard'
import {TDArtwork,TDTowerArtwork,tdTowerArtwork,tdEnemyArtwork} from './TowerDefenseArtwork'
import {tdStageName,tdBranchName,tdUpgradePreview} from './TowerDefenseGrowth'
import './tower-defense.css'

export function TowerDefense({onBack,entry,mapId='starlight',onRun}:{onBack:()=>void;entry?:'new'|'resume';mapId?:TDMapId;onRun?:()=>void}){
 const current=React.useRef<State|null>(null),id=React.useRef(''),recorded=React.useRef(false)
 const [view,setView]=React.useState<State|null>(null),[selected,setSelected]=React.useState(0),[paused,setPaused]=React.useState(false),[speed,setSpeed]=React.useState(1)
 const [sound,setSound]=React.useState(true),[guide,setGuide]=React.useState(false)
 const [saved,setSaved]=React.useState<ReturnType<typeof loadTD>>(null),[notice,setNotice]=React.useState(''),[best,setBest]=React.useState(0)
 const [growth,setGrowth]=React.useState<{pad:number;kind:TowerKind;at:number;change:NonNullable<ReturnType<typeof tdUpgradePreview>>}|null>(null)
 const dialog=React.useRef<HTMLDialogElement>(null)
 const sync=React.useCallback(()=>setView(current.current?structuredClone(current.current):null),[])
 React.useEffect(()=>{try{setSaved(loadTD(localStorage,mapId));setBest(Math.max(0,...readTDRecords(localStorage,mapId).filter(r=>r.won).map(r=>r.lives)))}catch{setNotice('이전 저장을 읽지 못했어요. 기존 데이터는 보존해요.')}},[])
 const finished=view?.phase==='won'||view?.phase==='lost'
 const back=()=>{if(view&&!finished)setPaused(true);else onBack()}
 useTaskFlowBack({enabled:true,onBack:back})
 React.useEffect(()=>{if(paused)dialog.current?.showModal();else dialog.current?.close()},[paused])
 React.useEffect(()=>{const hidden=()=>{if(document.hidden&&current.current?.phase==='wave')setPaused(true)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&current.current){e.preventDefault();setPaused(true)}};document.addEventListener('visibilitychange',hidden);window.addEventListener('keydown',key);return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('keydown',key)}},[])
 React.useEffect(()=>{
  if(view?.phase!=='wave'||paused)return
  let raf=0,last=performance.now(),carry=0,paint=0
  const frame=(now:number)=>{const s=current.current;if(!s)return;carry+=Math.min(.1,Math.max(0,(now-last)/1000))*speed;last=now
   while(carry>=1/60){stepTowerDefense(s,1/60);carry-=1/60}
   // The scene reads the live simulation at display rate. React only updates the HUD.
   if(now-paint>100||s.phase!=='wave'){sync();paint=now}
   if(s.phase==='wave')raf=requestAnimationFrame(frame)
  };raf=requestAnimationFrame(frame);return()=>cancelAnimationFrame(raf)
 },[view?.phase,paused,speed,sync])
 React.useEffect(()=>{if(!finished||!view||recorded.current)return;recorded.current=true;try{recordTD(localStorage,view,id.current);setNotice('결과를 이 기기에 저장했어요.')}catch{setNotice('결과를 저장하지 못했어요. 아래 기록을 확인해 주세요.')}},[finished,view])
 React.useEffect(()=>{if(!growth)return;const timeout=window.setTimeout(()=>setGrowth(null),2800);return()=>window.clearTimeout(timeout)},[growth])
 const start=(s:State=newTowerDefense(mapId),runId:string=crypto.randomUUID())=>{current.current=structuredClone(s);id.current=runId;recorded.current=false;setSelected(0);setSpeed(1);setNotice('');setGrowth(null);setPaused(false);sync()}
 // Explicit lounge action only. Opening an information card never creates a run.
 const entered=React.useRef(false)
 React.useEffect(()=>{if(!entry||entered.current)return;entered.current=true
  if(entry==='new'){start();return}
  try{const checkpoint=loadTD(localStorage,mapId);if(checkpoint)start(checkpoint.state,checkpoint.id);else setNotice('저장한 방어전을 찾지 못했어요. 새 방어전을 시작할 수 있어요.')}
  catch{setNotice('저장한 방어전을 읽지 못했어요. 기존 저장은 보존했어요.')}
  // The entry is a one-time action, never replayed on a render or storage change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[entry])
 const act=(fn:(s:State)=>boolean,message:string)=>{if(!current.current||paused)return;if(fn(current.current))setNotice(message);sync()}
 const reinforce=(branch:Branch)=>{
  const s=current.current,t=s?.towers.find(candidate=>candidate.pad===selected)
  if(!s||!t||paused)return
  const change=tdUpgradePreview(t,branch,s.gold)
  if(change&&upgradeTower(s,selected,branch)){
   setGrowth({pad:selected,kind:t.kind,at:performance.now(),change});setNotice('');sync()
  }
 }
 const save=()=>{if(!current.current)return;try{saveTD(localStorage,current.current,id.current);onBack()}catch{setNotice('저장하지 못했어요. 기존 저장은 보존하며 현재 판을 계속할 수 있어요.')}}
 const tower=view?.towers.find(t=>t.pad===selected),stats=tower?towerStats(tower):null
 const next=TD_WAVES[view?.phase==='wave'?(view.wave-1):(view?.wave??0)]
 const entryInfo=view?getTDWaveEntry(view):null
 return <div className="td-workspace"><section className="treadmill-game tower-defense" data-map={mapId} data-phase={view?.phase??'intro'} data-wave={view?.wave??0} data-gold={view?.gold??0} data-lives={view?.lives??20} data-time={view?.time.toFixed(2)??0}>
  <header className="treadmill-game__header"><button className="treadmill-game__icon" aria-label="디펜스 나가기" onClick={back}><ArrowLeft size={20}/></button><div className="treadmill-game__title"><span>{getTDMap(mapId).name} · 혼자 도전</span><h1>타워 디펜스</h1></div><button className="treadmill-game__icon" aria-label={sound?'게임 소리 끄기':'게임 소리 켜기'} aria-pressed={sound} onClick={()=>setSound(!sound)}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button>{view&&!finished&&<button className="treadmill-game__icon" aria-label="디펜스 일시정지" onClick={()=>setPaused(true)}><Pause size={20}/></button>}</header>
  {!view?<div className="td-panel td-intro">
   <div className="td-intro-art" aria-hidden="true">{(Object.keys(TD_TOWERS) as TowerKind[]).map(kind=><TDArtwork key={kind} id={tdTowerArtwork(kind)} size={80} fallbackTile={TD_TOWERS[kind].tile}/>)}</div>
   <h2>길목을 지키고, 6웨이브를 막으세요</h2><p>기지 체력 20 · 시작 골드 180. 적이 출구에 도착하면 기지 체력을 잃어요. 체력이 0이면 패배합니다.</p>
   <ol><li>번호가 있는 건설 지점을 누르고 타워를 선택하세요.</li><li>지도를 드래그하거나 두 손가락으로 확대해 길목을 살펴보세요.</li><li>웨이브를 시작하면 타워가 자동으로 공격해요.</li><li>처치 골드와 웨이브 보상 40으로 새 타워를 짓거나 강화하세요.</li></ol>
   <p>연사탑은 빠른 적, 포격탑은 장갑과 무리, 냉각탑은 감속을 맡아요. 같은 타워도 길을 오래 바라보는 자리에 놓으면 더 많이 공격해요.</p>
   {best>0&&<strong>최고 완주 · 기지 체력 {best}/20</strong>}
   {saved&&<button className="treadmill-game__cta" onClick={()=>start(saved.state,saved.id)}>{saved.state.wave+1}웨이브 준비 이어하기</button>}
   <button className={saved?'treadmill-game__ghost':'treadmill-game__cta'} onClick={()=>start()}>새 방어전 시작</button>
   {saved&&<small>새 판은 별도로 시작해요. 저장하고 나가기를 누르면 이전 이어하기가 새 판으로 바뀝니다.</small>}
   <small>바탕·대체 에셋: <a href="https://kenney.nl/assets/tower-defense-top-down" target="_blank" rel="noreferrer">Kenney · CC0</a> · <a href={`${import.meta.env.BASE_URL}game/kenney-td/License.txt`} target="_blank" rel="noreferrer">라이선스</a></small>
  </div>:<>
   <div className="td-hud"><strong><Shield size={17}/> 기지 {view.lives}/20</strong><strong><Coins size={17}/> 골드 {view.gold}</strong><span>{view.wave}/6 웨이브</span><button aria-label={`전투 속도 ${speed}배`} onClick={()=>setSpeed(speed===1?2:1)} disabled={finished}>{speed}×</button></div>
   {!finished&&<div className="td-round-strip"><div><strong>{view.phase==='wave'?`${view.wave}웨이브 · ${next!.name}`:view.wave===0?'첫 방어선을 만드세요':`${view.wave}웨이브 방어 완료`}</strong><span>{view.phase==='wave'?`남은 적 ${next!.units.length-view.spawned+view.enemies.length} · 처치 ${view.kills}`:view.wave>0?'정비 보상 +40골드 · 다음 적을 확인하세요':'빈 지점 선택 → 타워 건설 → 웨이브 시작'}</span></div>{view.phase==='prepare'&&<button className="treadmill-game__cta" onClick={()=>act(startTowerWave,`${view.wave+1}웨이브 시작`)}>{view.wave+1}웨이브 시작</button>}</div>}
   {mapId==='starlight'&&!finished&&<p className="td-entry-notice">{view.phase==='prepare'?'다음 침입':'현재 침입'}: <strong>{entryInfo?.regionName}</strong> · 2웨이브마다 입구가 바뀌어요</p>}
   <TowerDefenseBoard key={id.current} state={view} live={current} selected={selected} onSelect={setSelected} paused={paused} sound={sound}/>
   {finished?<div className="td-panel td-result"><TDArtwork id={view.phase==='won'?'reward-victory-medal':'td-base-gate'} size={100} className="td-result-art"/><h2>{view.phase==='won'?'6웨이브 방어 성공!':'기지가 함락됐어요'}</h2><strong>{view.phase==='won'?`완주 등급 ${view.lives===20?'★★★':view.lives>=15?'★★':'★'}`:`${view.wave}웨이브에서 종료`}</strong><p>남은 체력 {view.lives}/20 · 막은 적 {view.kills} · 놓친 적 {view.leaks}</p><p>{view.phase==='won'?'체력 20이면 별 3개, 15 이상이면 2개, 완주하면 1개예요.':'연사만으로는 장갑병을 막기 어려워요. 포격과 감속을 굽은 길에 겹쳐 보세요.'}</p><button className="treadmill-game__cta" onClick={()=>start()}>새 배치로 다시 도전</button><button className="treadmill-game__ghost" onClick={onBack}>게임 소개로</button>{mapId==='starlight'&&onRun&&<button className="treadmill-game__ghost" onClick={onRun}>이 숲을 달려보기</button>}</div>:<>
    <div className="td-wave td-panel"><button className="td-intel-toggle" onClick={()=>setGuide(!guide)} aria-expanded={guide}><strong>{view.phase==='wave'?'교전 중':'다음 적'} · {next!.name}</strong><span>{guide?'접기':'상성 보기'}</span></button><div className="td-enemy-list">{(Object.keys(TD_ENEMIES) as (keyof typeof TD_ENEMIES)[]).map(k=>{const count=next!.units.filter(u=>u===k).length;return count>0&&<span key={k}><TDArtwork id={tdEnemyArtwork(k)} size={32} fallbackTile={TD_ENEMIES[k].tile}/>{TD_ENEMIES[k].name} {count}</span>})}</div>{guide&&<p>{next!.hint}</p>}</div>
    <div className="td-panel td-build"><h2>{selected+1}번 지점 {tower?`${TD_TOWERS[tower.kind].name} Lv.${tower.level}`:'· 타워 건설'}</h2>
     {!tower?<div className="td-shop">{(Object.keys(TD_TOWERS) as TowerKind[]).map(kind=>{const t=TD_TOWERS[kind];return <button key={kind} disabled={view.gold<t.cost} onClick={()=>act(s=>buildTower(s,selected,kind),`${selected+1}번 ${t.name} 건설 완료`)}><TDArtwork id={tdTowerArtwork(kind)} size={64} fallbackTile={t.tile}/><span><strong>{t.name} · {t.cost}골드</strong><small>{t.role}</small><small>{view.gold<t.cost?`${t.cost-view.gold}골드 부족`:`피해 ${t.damage} · 사거리 ${t.range}`}</small></span></button>})}</div>:<>
      <ol className="td-growth-steps" aria-label="타워 성장 단계">{[1,2,3].map(level=><li key={level} aria-current={tower.level===level?'step':undefined} data-complete={tower.level>level}>{tower.level>level?<Check size={13}/>:<span>{level}</span>}{tdStageName(level)}</li>)}</ol>
      <div className="td-current-tower"><TDTowerArtwork kind={tower.kind} level={tower.level} branch={tower.branch} size={88} fallbackTile={TD_TOWERS[tower.kind].tile}/><div><strong className="td-branch-label">{tower.branch==='reach'?<Target size={15}/>:tower.branch==='power'?<Zap size={15}/>:null}{tdBranchName(tower.branch)} · {tdStageName(tower.level)}</strong><p>{TD_TOWERS[tower.kind].role}</p><p>피해 {stats!.damage.toFixed(1)} · 간격 {stats!.interval.toFixed(2)}초<br/>사거리 {stats!.range.toFixed(2)} · 처치 {tower.kills}</p></div></div>
      {growth?.pad===selected&&growth.kind===tower.kind&&growth.change.level===tower.level&&<div className="td-upgrade-confirmation" role="status" key={growth.at}>
       <span className="td-upgrade-spark"><TDArtwork id="fx-upgrade-burst" size={64}/></span>
       <div><strong><Check size={16}/>{tdStageName(tower.level)} 완료 · {tdBranchName(tower.branch)}</strong><p>피해 {growth.change.before.damage.toFixed(1)} → {growth.change.after.damage.toFixed(1)} · 사거리 {growth.change.before.range.toFixed(2)} → {growth.change.after.range.toFixed(2)}</p><small>{growth.change.cost}골드 사용 · 강화 직후 {growth.change.remaining}골드</small></div>
      </div>}
      {tower.level<3?<>
       <p className="td-upgrade-guide">{tower.level===1?'하나를 고르면 최종 단계까지 그 방향으로 성장해요.':'선택한 특화를 유지하며 피해·사거리·공격 속도를 높여요.'}</p>
       {tower.kind==='frost'&&<p className="td-upgrade-rule">감속 세기와 지속 시간은 강화해도 같아요.</p>}
       <div className="td-upgrades" data-final={tower.level===2}>{(tower.level===1?['power','reach']:[tower.branch!]).map(b=>{
        const preview=tdUpgradePreview(tower,b as Branch,view.gold)!
        return <button key={b} data-branch={preview.branch} disabled={!preview.affordable} onClick={()=>reinforce(b as Branch)}>
         <strong>{tower.level===1?tdBranchName(preview.branch):'최종 강화'} · {preview.cost}골드</strong>
         <span className="td-upgrade-image"><TDTowerArtwork kind={tower.kind} level={preview.level} branch={preview.branch} size={80} fallbackTile={TD_TOWERS[tower.kind].tile}/><span>{tdStageName(preview.level)} Lv.{preview.level}</span></span>
         <span className="td-upgrade-role">{tower.level===2?'더 빠르고 강하게, 닿는 길도 조금 넓게':preview.branch==='power'?'같은 길목에 더 큰 한 발':'더 넓은 길목을 먼저 공격'}</span>
         <TowerStatChanges before={preview.before} after={preview.after}/>
         <small className="td-upgrade-tradeoff">{tower.level===2?`${tdBranchName(preview.branch)} 유지 · 이 타워의 마지막 강화`:preview.branch==='power'?'사거리는 그대로 · 넓은 길 커버는 포기':'화력 특화보다 한 발 피해가 낮아요'}</small>
         <span className="td-upgrade-budget">{preview.affordable?`강화 후 ${preview.remaining}골드`:`${-preview.remaining}골드 더 필요`}</span>
        </button>
       })}</div>
      </>:<div className="td-max-level"><Check size={18}/><div><strong>최대 레벨 · 최종 단계 완료</strong><p>{tdBranchName(tower.branch)} Lv.3 · 이 타워의 강화를 모두 마쳤어요.</p></div></div>}
      <button className="treadmill-game__ghost" onClick={()=>act(s=>sellTower(s,selected),'타워를 판매했어요.')}>판매 · {sellValue(tower)}골드 회수 (70%)</button>
     </>}
    </div>
   </>}
  </>}
  {notice&&<p className="td-notice" role="status">{notice}</p>}
  <dialog ref={dialog} className="td-dialog treadmill-game" onCancel={e=>{e.preventDefault();setPaused(false)}}><h2>잠깐 쉬는 중</h2><p>전투와 적의 이동이 멈췄어요.</p><button autoFocus className="treadmill-game__cta" onClick={()=>setPaused(false)}>디펜스 계속하기</button>{view?.phase==='prepare'?<><button className="treadmill-game__ghost" onClick={save}>저장하고 나가기</button><small>현재 준비 상태로 이전 이어하기를 바꿔요.</small></>:<p>웨이브를 마친 준비 화면에서 저장할 수 있어요.</p>}<button className="treadmill-game__ghost" onClick={onBack}>이번 진행을 저장하지 않고 나가기</button>{paused&&notice&&<p role="status">{notice}</p>}</dialog>
 </section></div>
}

function TowerStatChanges({before,after}:{before:ReturnType<typeof towerStats>;after:ReturnType<typeof towerStats>}){
 return <span className="td-stat-changes">{([
  ['피해',before.damage.toFixed(1),after.damage.toFixed(1)],
  ['사거리',before.range.toFixed(2),after.range.toFixed(2)],
  ['간격',`${before.interval.toFixed(2)}초`,`${after.interval.toFixed(2)}초`],
 ] as const).map(([label,from,to])=><span key={label}><span>{label}</span><span>{from} → <b>{to}</b>{from===to&&<small> 유지</small>}</span></span>)}</span>
}
