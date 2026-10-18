import React, { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, BookOpen, Check, ChevronRight, Moon, Sun, X } from 'lucide-react'
import type { SleepInnGameProps } from '../sleep-inn/types'
import { CARE_LABEL, PETS, POSE_FRAME, petAsset, petById, type CareAction, type PetId, type PetPose } from './pet-catalog'
import { adoptPet, atHome, canAdopt, careDay, careFor, createHome, finishMorning, invitePet, loadHome, persistHome, refreshVisitors, restAgain, sleepTogether, wakeTogether, type HomeLoad, type PetBond, type PetHome } from './pet-engine'
import { careVoice, PET_VOICES } from './pet-personality'
import { memoriesFor, nextCare, nextMemory } from './pet-memories'
import './pet-room.css'

const asset = `${import.meta.env.BASE_URL}games/pet-room-v1/`
const framePosition = (frame: number) => `${(frame % 3) * 50}% ${Math.floor(frame / 3) * 100}%`

export function PetSprite({ id, pose = 'awake', className = '' }: { id: PetId; pose?: PetPose; className?: string }) {
  return <span aria-hidden="true" className={`pet-sprite ${className}`} style={{ backgroundImage: `url("${petAsset(id)}")`, backgroundPosition: framePosition(POSE_FRAME[pose]) }} />
}
function ActionArt({ frame }: { frame: number }) {
  return <span aria-hidden="true" className="pet-action-art" style={{ backgroundImage: `url("${asset}actions.webp")`, backgroundPosition: framePosition(frame) }} />
}
function MemoryAlbum({ id, bond }: { id: PetId; bond: PetBond }) {
  const memories = memoriesFor(id, bond)
  const next = nextMemory(bond)
  return <section className="pet-memories" aria-label={`${petById(id).name}과의 추억`}>
    <h3>우리 추억 <span>{memories.length}</span></h3>
    <ol>{memories.map(memory => <li key={memory.key}>
      <PetSprite id={id} pose={memory.pose} />
      <div><time dateTime={memory.date}>{memory.date.replaceAll('-', '.')}</time><strong>{memory.title}</strong><p>{memory.note}</p></div>
    </li>)}</ol>
    {next && <p className="pet-small">입양 뒤 {next.done}일을 돌봤어요. {next.target}일이 되면 새 추억이 남아요.<br />입양 다음 날부터 세어요. 매일 이어서 오지 않아도 괜찮아요.</p>}
  </section>
}
function readHome(scope: string): HomeLoad {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1
  try { return loadHome(window.localStorage, scope, careDay(), seed) }
  catch { return { home: createHome(careDay(), seed), raw: null, error: '기기 저장을 열지 못했어요. 다시 불러와 주세요.' } }
}

export function PetRoom(props: SleepInnGameProps & { onOldGame: () => void }) {
  return <PetRoomSession key={props.persistenceScope} {...props} />
}

function PetRoomSession({ journal, persistenceScope, onBack, onOpenJournal, returnLabel = '돌아가기', onCanExitReady, onOldGame }: SleepInnGameProps & { onOldGame: () => void }) {
  const [initial] = useState(() => readHome(persistenceScope))
  const saved = useRef(initial)
  const [home, setHome] = useState(initial.home)
  const [error, setError] = useState(initial.error)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<'room' | 'friends'>('room')
  const [filter, setFilter] = useState<'all' | 'known' | 'ready' | 'family'>('all')
  const [details, setDetails] = useState<PetId | null>(null)
  const [adopted, setAdopted] = useState<PetId | null>(null)
  const [reaction, setReaction] = useState<{ id: PetId; pose: PetPose; key: number } | null>(null)
  const [stirred, setStirred] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interactions = useRef<Partial<Record<string, number>>>({})
  const modalOpener = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const roomTabRef = useRef<HTMLButtonElement>(null)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const detailRef = useRef<PetId | null>(null)
  detailRef.current = details

  function commit(next: PetHome, notice = '') {
    if (saved.current.error) return false
    try {
      const result = persistHome(window.localStorage, persistenceScope, next, saved.current.raw)
      if (!result.ok) { saved.current = { ...saved.current, error: result.error }; setError(result.error); return false }
      saved.current = { home: result.home, raw: result.raw, error: null }
      setHome(result.home); setError(null)
      if (notice) setMessage(notice)
      return true
    } catch { setError('저장하지 못했어요. 최신 기록을 다시 불러와 주세요.'); return false }
  }
  useEffect(() => {
    const current = saved.current
    const refreshed = refreshVisitors(current.home, careDay())
    if (!current.error && (current.raw === null || refreshed !== current.home)) commit(refreshed)
    const checkDay = () => {
      if (document.visibilityState !== 'visible') return
      const next = refreshVisitors(saved.current.home, careDay())
      if (next !== saved.current.home) commit(next)
    }
    document.addEventListener('visibilitychange', checkDay)
    window.addEventListener('focus', checkDay)
    return () => { document.removeEventListener('visibilitychange', checkDay); window.removeEventListener('focus', checkDay); if (timer.current) clearTimeout(timer.current) }
  // Account changes remount the whole session. No journal date is used for pet care.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    onCanExitReady?.(() => {
      if (detailRef.current) { closeDetails(); return false }
      return true // Every successful action was already saved; failed actions never replace that state.
    })
    return () => onCanExitReady?.(null)
  }, [onCanExitReady])
  useEffect(() => {
    if (contentRef.current) contentRef.current.inert = !!details
    if (details) detailHeading.current?.focus({ preventScroll: true })
  }, [details])

  function reload() {
    const next = readHome(persistenceScope)
    saved.current = next; setHome(next.home); setError(next.error); setMessage(''); setReaction(null); setSpeech(null); setStirred(false)
    if (!next.error) commit(refreshVisitors(next.home, careDay()), '저장된 펫 기록을 불러왔어요.')
  }
  function reactTo(id: PetId, pose: PetPose) {
    if (timer.current) clearTimeout(timer.current)
    setReaction({ id, pose, key: Date.now() })
    timer.current = setTimeout(() => setReaction(null), 2300)
  }
  function care(action: Exclude<CareAction, 'bed'>) {
    // Keep the pet the user can see. A new day is refreshed on entry/focus or waking,
    // never halfway through a care action that would otherwise target an unseen visitor.
    const current = saved.current.home
    if (current.sleeping || current.morning) return
    const id = current.selected
    const already = current.pets[id]!.actions[action].includes(careDay())
    const next = careFor(current, id, action, careDay())
    const turn = interactions.current[`${id}:${action}`] ?? 0
    const beforeMemories = memoriesFor(id, current.pets[id]!).length
    const newMemory = memoriesFor(id, next.pets[id]!).length > beforeMemories
    if (commit(next, newMemory ? '우리 추억에 새 장면이 남았어요.' : already ? '오늘 돌본 건 저장했어요. 더 놀아도 좋아요.' : `${petById(id).name}과 돌본 하루를 저장했어요.`)) {
      reactTo(id, action === 'pet' ? 'happy' : action === 'feed' ? 'eating' : 'playing')
      setSpeech(careVoice(id, action, turn))
      interactions.current[`${id}:${action}`] = turn + 1
    }
  }
  const [speech, setSpeech] = useState<string | null>(null)
  function select(id: PetId) {
    if (home.sleeping || home.morning) return false
    if (!commit(invitePet(saved.current.home, id))) return false
    setSpeech(null); setReaction(null); setTab('room')
    return true
  }
  function startSleep() {
    // The bedtime button refers to the guests currently in this room, even after midnight.
    const current = saved.current.home
    if (commit(sleepTogether(current, careDay()), '잠자리 준비를 기록했어요. 이제 화면을 꺼도 괜찮아요.')) { setStirred(false); setReaction(null); setSpeech(null); setTab('room') }
  }
  function wake() {
    const before = saved.current.home
    const next = wakeTogether(before, careDay())
    if (next !== before && commit(next, '같이 잠자리를 폈던 친구들이 인사해요.')) {
      setReaction(null); setStirred(false); setSpeech(null)
    }
  }
  function greetMorning() {
    const next = finishMorning(saved.current.home, careDay())
    if (next !== saved.current.home && commit(next, `${petById(next.selected).name}은 오늘도 방에 남아요. 같이 놀고 쉬어요.`)) {
      setSpeech(PET_VOICES[next.selected].wake); reactTo(next.selected, 'happy')
    }
  }
  function backToSleep() {
    if (commit(restAgain(saved.current.home), '조금 더 쉬어도 돼요. 화면은 꺼 두세요.')) { setSpeech(null); setReaction(null); setStirred(false) }
  }
  function openDetails(id: PetId) { modalOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setDetails(id); setAdopted(null) }
  function closeDetails() {
    if (contentRef.current) contentRef.current.inert = false
    setDetails(null); setAdopted(null); modalOpener.current?.focus({ preventScroll: true })
  }
  function returnToRoom(id: PetId) {
    if (home.sleeping || home.morning) setTab('room')
    else if (!select(id)) return
    // The friend card will unmount when the tab changes. Return focus to a stable control.
    modalOpener.current = roomTabRef.current
    closeDetails()
  }
  function adopt(id: PetId) {
    const next = adoptPet(saved.current.home, id, careDay())
    if (next === saved.current.home) return
    if (commit(next, `${petById(id).name}, 이제 우리 집 식구예요!`)) { setAdopted(id); reactTo(id, 'happy'); setSpeech(PET_VOICES[id].adopted) }
  }
  const selected = petById(home.selected)
  const bond = home.pets[selected.id]!
  const sleeping = !!home.sleeping
  const morning = !!home.morning
  const present = home.sleeping?.pets ?? home.morning?.pets ?? atHome(home)
  const scenePets = [home.selected, ...present.filter(id => id !== home.selected)].slice(0, 3)
  const myPets = PETS.filter(pet => home.pets[pet.id]?.adoptedOn)
  const shownPose = sleeping ? stirred ? 'awake' : 'sleeping' : morning ? 'waking' : reaction?.id === selected.id ? reaction.pose : 'awake'
  const detailPet = details ? petById(details) : null
  const detailBond = details ? home.pets[details] : undefined
  const careSuggestion = nextCare(selected.id, bond, careDay())
  const memoryGoal = nextMemory(bond)
  const filteredPets = PETS.filter(pet => filter === 'all' || (filter === 'known' && home.pets[pet.id]) || (filter === 'ready' && canAdopt(home, pet.id)) || (filter === 'family' && home.pets[pet.id]?.adoptedOn))
  return <div className={`pet-home${sleeping ? ' pet-home--night' : ''}`}>
    <div ref={contentRef} className="pet-home__content">
    <header className="pet-home__header">
      <button type="button" className="pet-icon-button" aria-label={returnLabel} onClick={onBack}><ArrowLeft size={22} /></button>
      <div><span>내 펫과 함께 쉬는 방</span><h1>우리 집 친구들</h1></div>
      <button type="button" className="pet-icon-button" aria-label="수면 일지 열기" onClick={onOpenJournal}><BookOpen size={22} /></button>
    </header>
    {error && <div role="alert" className="pet-home__error"><p>{error}</p><button type="button" onClick={reload}>다시 불러오기</button></div>}
    <nav className="pet-home__tabs" aria-label="펫 메뉴">
      <button ref={roomTabRef} type="button" aria-current={tab === 'room' ? 'page' : undefined} onClick={() => setTab('room')}><ActionArt frame={4} />우리 방</button>
      <button type="button" aria-current={tab === 'friends' ? 'page' : undefined} onClick={() => setTab('friends')}><ActionArt frame={5} />친구들 <span>{Object.keys(home.pets).length}/12</span></button>
    </nav>
    {tab === 'room' ? <>
      {!sleeping && !morning && <div className="pet-bedtime-entry"><button type="button" disabled={!!error} className="pet-primary" onClick={startSleep}><ActionArt frame={3} /><span>같이 자기<small>친구들 재우고, 나도 폰 내려놓기</small></span></button></div>}
      {morning && <section className="pet-morning" aria-label="함께 잔 친구들과 아침 인사"><strong>{selected.name}도 일어났네!</strong><p>같이 쉬었던 친구들이 아직 옆에 있어요.</p><button type="button" disabled={!!error} className="pet-primary" onClick={greetMorning}>오늘도 같이 지내기</button><button type="button" disabled={!!error} className="pet-text-button" onClick={backToSleep}>조금 더 자기</button></section>}
      <section className="pet-scene" aria-label={sleeping ? '친구들이 함께 자는 방' : '동물 친구들이 놀러 온 방'}>
        <img className="pet-scene__background" src={`${asset}room.webp`} alt="" draggable={false} />
        <div className="pet-scene__badge">{sleeping ? <><Moon size={14} /> {stirred ? '눈을 떴어요' : '새근새근 자는 중'}</> : <><Sun size={14} /> {morning ? '다시 만났네' : bond.adoptedOn ? '우리 집에서 함께' : '오늘 놀러 온 친구들'}</>}</div>
        <div className="pet-scene__speech" aria-live="polite">{sleeping ? stirred ? '응…? 나도 눈이 떠졌어. 다시 잘까?' : PET_VOICES[selected.id].bed : morning ? PET_VOICES[selected.id].wake : speech ?? selected.hello}</div>
        {scenePets.map((id, index) => <button type="button" key={id} disabled={!!error || morning} className={`pet-scene__pet pet-scene__pet--${index}${reaction?.id === id ? ' pet-scene__pet--react' : ''}`} aria-label={sleeping ? `${petById(id).name} 살짝 깨우기` : morning ? `${petById(id).name} 아침 인사` : `${petById(id).name} ${index === 0 ? '쓰다듬기' : '선택하기'}`}
          onClick={() => sleeping ? setStirred(true) : index === 0 ? care('pet') : select(id)}>
          <PetSprite key={reaction?.id === id ? reaction.key : id} id={id} pose={index === 0 ? shownPose : sleeping ? stirred ? 'awake' : 'sleeping' : morning ? 'waking' : 'awake'} />
          <span className="pet-scene__pet-name">{petById(id).name}{home.pets[id]?.adoptedOn && <Check size={12} />}</span>
        </button>)}
      </section>
      <section className="pet-selected" aria-label={`${selected.name} 돌보기`}>
        <div className="pet-selected__heading"><div><span>{selected.animal} · {bond.adoptedOn ? '우리 집 식구' : '방문 친구'}</span><h2>{selected.name} <small>{bond.caredDays.length}일 돌봤어요</small></h2></div><button type="button" className="pet-text-button" onClick={() => openDetails(selected.id)}>{bond.adoptedOn ? '우리 추억' : '입양 조건'}<ChevronRight size={17} /></button></div>
        {!sleeping && !morning ? <>
          <p className="pet-favorite-hint">{selected.name}이 좋아해요 · {selected.favorite}</p>
          <div className="pet-care-actions">
            {(['pet', 'feed', 'play'] as const).map((action, index) => <button type="button" key={action} disabled={!!error} className={PET_VOICES[selected.id].favorite === action ? 'pet-care-favorite' : ''} onClick={() => care(action)}><ActionArt frame={index} /><strong>{action === 'pet' ? '쓰다듬기' : action === 'feed' ? '간식 주기' : '같이 놀기'}</strong>{bond.actions[action].includes(careDay()) && <span className="pet-action-done"><Check size={12} />오늘 했어요</span>}</button>)}
          </div>
          <button type="button" className="pet-next-step" onClick={() => openDetails(selected.id)}><span>{canAdopt(home, selected.id) ? '이제 우리 집으로 입양할 수 있어요!' : bond.adoptedOn ? memoryGoal ? `입양 뒤 ${memoryGoal.done}일을 돌봤어요 · ${memoryGoal.target}일에 새 추억` : '같이 지낸 날들을 다시 볼까요?' : careSuggestion ? `다음 미션: ${careSuggestion.text}` : '오늘 미션은 다 했어요. 편히 쉬어도 돼요.'}</span><ChevronRight size={18} /></button>
        </> : sleeping ? <div className="pet-sleep-actions">
          {stirred && <button type="button" className="pet-primary" onClick={() => setStirred(false)}><Moon size={20} /> 다시 같이 자기</button>}
          <p>폰을 내려놓고 쉬어요. 방은 이대로 남아 있어요.</p>
          <button type="button" className="pet-secondary" disabled={!!error} onClick={wake}><Sun size={18} /> 다 잤어, 일어나자</button>
          <small>이 화면 밖의 폰 사용이나 실제 수면은 측정하지 않아요.</small>
        </div> : null}
        <p className="pet-save-status" role="status">{message || (sleeping ? '잠자리 준비를 저장했어요. 화면은 꺼도 돼요.' : morning ? '아침 인사는 수면 시간으로 기록되지 않아요.' : bond.adoptedOn ? `${selected.name}의 집은 이제 여기예요.` : '돌보고 같이 쉬면서 친해져요. 30일 돌보기 또는 미션으로 입양해요.')}</p>
      </section>
      {!sleeping && !morning && <section className="pet-housemates" aria-label="방에 있는 친구 선택"><h2>같이 있는 친구 <span>{present.length}</span></h2><div>{present.map(id => <button key={id} type="button" disabled={!!error} aria-pressed={selected.id === id} onClick={() => select(id)}><PetSprite id={id} /><span>{petById(id).name}</span><small>{home.pets[id]?.adoptedOn ? '우리 집' : '놀러 왔어요'}</small></button>)}</div></section>}
    </> : <section className="pet-friends">
      <div className="pet-friends__intro"><h2>다시 만나고 싶은 친구가 있나요?</h2><p>한 번 만난 친구는 언제든 초대해요.<br />못 온 날이 있어도 함께한 날은 사라지지 않아요.</p></div>
      <div className="pet-friends__count"><strong>우리 집 식구 {myPets.length}</strong><span>만난 친구 {Object.keys(home.pets).length} / 12</span></div>
      <div className="pet-filters" role="group" aria-label="친구 목록 고르기">{([['all', '모두'], ['known', '만난 친구'], ['ready', '입양 가능'], ['family', '우리 집']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      {!filteredPets.length && <p className="pet-friends__empty">{filter === 'ready' ? '아직 입양할 친구가 없어요. 만난 친구의 입양 조건을 확인해 봐요.' : '아직 우리 집 식구가 없어요. 친해진 친구를 입양하면 여기 모여요.'}</p>}
      <div className="pet-friends__grid">{filteredPets.map(pet => {
        const record = home.pets[pet.id]
        return <button key={pet.id} type="button" className={`pet-friend${!record ? ' pet-friend--new' : ''}`} onClick={() => openDetails(pet.id)} style={{ '--pet-accent': pet.accent } as CSSProperties}>
          <PetSprite id={pet.id} pose={record?.adoptedOn ? 'happy' : 'awake'} /><strong>{pet.name}</strong><span>{pet.animal}</span><small>{record?.adoptedOn ? '우리 집 식구' : record ? canAdopt(home, pet.id) ? '입양할 수 있어요!' : `${record.caredDays.length}일 함께했어요` : '아직 안 만났어요'}</small>
        </button>
      })}</div>
      <p className="pet-small">하루에 최대 3명이 무작위로 놀러 와요. 아직 못 만난 친구부터 와요. 새로고침해도 오늘 친구는 같아요.</p>
    </section>}
    <section className="pet-journal-link"><div><BookOpen size={20} /><div><strong>내 수면 일지</strong><span>{journal.status === 'recorded' ? `${journal.date} · ${journal.sleepH ? `${journal.sleepH}시간 기록했어요` : '기록이 있어요'}` : journal.status === 'draft' ? '작성 중인 일지로 돌아가요' : '얼마나 잤는지는 일지에 직접 적어요'}</span></div></div><button type="button" onClick={onOpenJournal}>일지 열기<ChevronRight size={16} /></button></section>
    <footer className="pet-home__footer"><span>펫 기록은 이 브라우저에 저장돼요. 다른 기기에는 이어지지 않아요.</span><button type="button" className="pet-secondary" onClick={onBack}>{returnLabel}</button><button type="button" onClick={onOldGame}>예전 여관 퍼즐 열기</button></footer>
    </div>
    {detailPet && <div className="pet-detail-backdrop" onClick={event => { if (event.target === event.currentTarget) closeDetails() }}>
      <section className="pet-detail" role="dialog" aria-modal="true" aria-labelledby="pet-detail-title" onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDetails() }
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
          const first = buttons[0]; const last = buttons[buttons.length - 1]
          if (event.shiftKey && (document.activeElement === first || document.activeElement === detailHeading.current)) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }
      }}>
        <button type="button" className="pet-detail__close pet-icon-button" aria-label="친구 설명 닫기" onClick={closeDetails}><X size={22} /></button>
        {error && <div role="alert" className="pet-home__error"><p>{error}</p><button type="button" onClick={() => { closeDetails(); reload() }}>다시 불러오기</button></div>}
        <PetSprite id={detailPet.id} pose={adopted === detailPet.id || detailBond?.adoptedOn ? 'happy' : 'awake'} className="pet-detail__portrait" />
        <span className="pet-eyebrow">{detailPet.animal}</span><h2 id="pet-detail-title" ref={detailHeading} tabIndex={-1}>{adopted === detailPet.id ? `${detailPet.name}, 우리 집에 온 걸 환영해!` : detailPet.name}</h2><p>{detailBond?.adoptedOn ? PET_VOICES[detailPet.id].adopted : detailPet.hello}</p>
        <div className="pet-detail__favorite">좋아하는 것 · {detailPet.favorite}</div>
        {!detailBond ? <><p>아직 만나지 못했어요.<br />새 친구가 놀러 오면 여기서 돌볼 수 있어요.</p><button className="pet-primary" type="button" onClick={closeDetails}>기다려 볼게</button></> : detailBond.adoptedOn ? <>
          <div className="pet-adoption-receipt"><ActionArt frame={4} /><strong>우리 집 식구가 됐어요</strong><span>{detailBond.adoptedOn}부터 함께해요</span><small>며칠 쉬어도 떠나지 않아요.</small></div>
          <MemoryAlbum id={detailPet.id} bond={detailBond} />
          <button className="pet-primary" type="button" disabled={!sleeping && !morning && !!error} onClick={() => returnToRoom(detailPet.id)}>{sleeping ? '잠든 방으로 돌아가기' : morning ? '아침 방으로 돌아가기' : '함께 방으로 가기'}</button>
        </> : <>
          <div className="pet-adoption-path"><strong>30일 돌보기 <span>{detailBond.caredDays.length} / 30일</span></strong><progress max={30} value={detailBond.caredDays.length} aria-label={`${detailPet.name} 돌본 날`} /><small>연속으로 안 와도 돼요. 하루에 한 번 기록해요.</small></div>
          <p className="pet-or">또는 아래 미션 3개를 모두 끝내기</p>
          <ul className="pet-missions">{detailPet.missions.map(mission => { const count = Math.min(mission.days, detailBond.actions[mission.action].length); return <li key={mission.action}><span>{CARE_LABEL[mission.action]}</span><strong>{count >= mission.days && <Check size={15} />}{count} / {mission.days}일</strong></li> })}</ul>
          <p className="pet-small">미션도 같은 날은 한 번만 세어요. 입양에 결제나 추첨은 없어요.</p>
          {sleeping || morning ? <><button type="button" className="pet-primary" onClick={() => returnToRoom(detailPet.id)}>{sleeping ? '잠든 방으로 돌아가기' : '아침 방으로 돌아가기'}</button><p className="pet-small">아침 인사를 나눈 뒤에 초대하거나 입양해요.</p></> : canAdopt(home, detailPet.id) ? <button type="button" disabled={!!error} className="pet-primary" onClick={() => adopt(detailPet.id)}><ActionArt frame={4} />우리 집으로 입양하기</button> : <button type="button" disabled={!!error} className="pet-primary" onClick={() => returnToRoom(detailPet.id)}>{present.includes(detailPet.id) ? `${detailPet.name} 돌보러 가기` : '지금 방으로 초대하기'}</button>}
          <MemoryAlbum id={detailPet.id} bond={detailBond} />
        </>}
      </section>
    </div>}
  </div>
}
