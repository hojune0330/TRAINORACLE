import React, { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, BookOpen, Check, ChevronRight, Moon, Sun, X } from 'lucide-react'
import type { SleepInnGameProps } from '../sleep-inn/types'
import { CARE_LABEL, PETS, petById, type CareAction, type PetId, type PetPose } from './pet-catalog'
import { adoptPet, atHome, canAdopt, careDay, careFor, createHome, finishMorning, invitePet, journalFriendCredits, loadHome, persistHome, placeRoomDecoration, refreshVisitors, restAgain, sleepTogether, wakeTogether, type HomeLoad, type PetBond, type PetHome } from './pet-engine'
import { careVoice, PET_VOICES } from './pet-personality'
import { memoriesFor, nextMemory } from './pet-memories'
import { ActionArt, PetSprite, PropArt, petRoomAsset } from './PetArt'
import { PetCareScene } from './PetCareScene'
import { PetBedtimeScene } from './PetBedtimeScene'
import { PetStoryBook } from './PetStoryBook'
import { petStory } from './pet-story'
import { PET_JOURNAL_EVENT, pendingPetJournalError, retryPetJournalSave } from '../../domain/pet-journal-progress'
import { FriendPages, PetJournalMeeting, PetJournalProgress } from './PetJournalFriends'
import { acquirePetHomeLease } from '../../domain/pet-home-lock'
import { motionForPose } from './pet-motion'
import { DecorArt, PetRoomDecor } from './PetRoomDecor'
import { PetCareGoal } from './PetCareGoal'
import { ROOM_DECOR, roomKeepsakes, type RoomDecorId } from './pet-decor'
import { activeObservationNight, defaultObservationWakeDate, photographObservation, observationState } from './pet-observation'
import { PetNightSetup } from './PetNightSetup'
import { PetMorningObservation } from './PetMorningObservation'
import { PetObservationAlbum } from './PetObservationAlbum'
import { ObservationPlacementArt } from './PetObservationArt'
import { PetMorningGreeting, PetQuietRest, morningGreeting } from './PetMorningGreeting'
import './pet-room.css'
import './pet-activities.css'
import './pet-observation.css'

const asset = `${import.meta.env.BASE_URL}games/pet-room-v1/`
export { PetSprite } from './PetArt'
type Activity = { kind: 'care'; id: PetId; action: Exclude<CareAction, 'bed'>; turn: number } | { kind: 'bed'; wakeDate: string } | { kind: 'setup' } | { kind: 'album' } | { kind: 'rest' } | { kind: 'story'; id: PetId } | { kind: 'journal' } | { kind: 'decor' }
function MemoryAlbum({ id, bond }: { id: PetId; bond: PetBond }) {
  const memories = memoriesFor(id, bond)
  const next = nextMemory(bond)
  return <section className="pet-memories" aria-label={`${petById(id).name}의 추억`}>
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
  catch { return { home: createHome(careDay(), seed, scope), raw: null, error: '기기 저장을 열지 못했어요. 다시 불러와 주세요.' } }
}
function roomForToday(home: PetHome) {
  const today = careDay()
  const night = activeObservationNight(home)
  // Reveal an already stored scene on a later morning. This records no sleep measurement.
  if (home.sleeping && home.sleeping.day < today && night && !night.observedOn && night.wakeDate <= today) return wakeTogether(home, today)
  return refreshVisitors(home, today)
}
function nextWakeDate(home: PetHome) {
  let date = defaultObservationWakeDate()
  while (observationState(home).nights.some(night => night.wakeDate === date)) {
    const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + 1); date = careDay(next)
  }
  return date
}

export function PetRoom(props: SleepInnGameProps & { onOldGame: () => void }) {
  return <PetRoomLease key={props.persistenceScope} {...props} />
}
function PetRoomLease(props: SleepInnGameProps & { onOldGame: () => void }) {
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    const cancellation = new AbortController()
    let release: (() => void) | undefined
    void acquirePetHomeLease(props.persistenceScope, cancellation.signal).then(lease => {
      if (!alive) { if (lease.ok) lease.release(); return }
      if (lease.ok) { release = lease.release; setReady(true); setFailure(null) }
      else { setReady(false); setFailure(lease.error) }
    })
    return () => { alive = false; cancellation.abort(); release?.() }
  }, [props.persistenceScope, attempt])
  if (ready) return <PetRoomSession {...props} />
  return <div className="pet-home"><header className="pet-home__header"><h1>우리 집 친구들</h1></header>{failure ? <div role="alert" className="pet-home__error"><p>{failure}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>다시 열기</button></div> : <p role="status">친구 기록을 확인하고 있어요.</p>}<button type="button" className="pet-secondary" onClick={props.onBack}>{props.returnLabel ?? '돌아가기'}</button><button type="button" className="pet-text-button" onClick={props.onOldGame}>예전 여관 퍼즐 열기</button></div>
}

function PetRoomSession({ journal, persistenceScope, onBack, onOpenJournal, journalLinkLabel, startWithJournalMeeting, startWithBedtime, morningJournal, onMorningDateChange, onOpenMorningJournal, returnLabel = '돌아가기', onCanExitReady, onOldGame }: SleepInnGameProps & { onOldGame: () => void }) {
  const [initial] = useState(() => readHome(persistenceScope))
  const saved = useRef(initial)
  const sessionAlive = useRef(true)
  const [home, setHome] = useState(initial.home)
  const [error, setError] = useState(initial.error)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<'room' | 'friends'>('room')
  const [filter, setFilter] = useState<'all' | 'known' | 'ready' | 'family'>('all')
  const [friendsPage, setFriendsPage] = useState(0)
  const [journalError, setJournalError] = useState(() => pendingPetJournalError(persistenceScope))
  const [details, setDetails] = useState<PetId | null>(null)
  const [activity, setActivity] = useState<Activity | null>(() => !initial.error && !initial.home.sleeping && !initial.home.morning ? startWithBedtime ? { kind: 'setup' } : startWithJournalMeeting && journalFriendCredits(initial.home) > 0 && PETS.some(pet => !initial.home.pets[pet.id]?.adoptedOn) ? { kind: 'journal' } : null : null)
  const [greetingDate, setGreetingDate] = useState<string | null>(() => {
    const night = activeObservationNight(initial.home)
    return !initial.home.sleeping && !initial.home.morning && night?.observedOn === careDay() ? night.wakeDate : null
  })
  const observationNight = activeObservationNight(home)
  const morningDate = home.morning ? observationNight?.wakeDate ?? home.morning.day : greetingDate
  useEffect(() => { onMorningDateChange?.(morningDate) }, [morningDate, onMorningDateChange])
  const activityRef = useRef(activity)
  activityRef.current = activity
  const [adopted, setAdopted] = useState<PetId | null>(null)
  const [reaction, setReaction] = useState<{ id: PetId; pose: PetPose; key: number } | null>(null)
  const [stirred, setStirred] = useState(false)
  const [newKeepsake, setNewKeepsake] = useState<RoomDecorId | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interactions = useRef<Partial<Record<string, number>>>({})
  const modalOpener = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const roomTabRef = useRef<HTMLButtonElement>(null)
  const decorButton = useRef<HTMLButtonElement>(null)
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
    sessionAlive.current = true
    const current = saved.current
    const refreshed = roomForToday(current.home)
    if (!current.error && (current.raw === null || refreshed !== current.home)) commit(refreshed)
    const checkDay = () => {
      if (document.visibilityState !== 'visible' || activityRef.current) return
      setJournalError(pendingPetJournalError(persistenceScope))
      const next = roomForToday(saved.current.home)
      if (next !== saved.current.home) commit(next)
    }
    document.addEventListener('visibilitychange', checkDay)
    window.addEventListener('focus', checkDay)
    return () => { sessionAlive.current = false; document.removeEventListener('visibilitychange', checkDay); window.removeEventListener('focus', checkDay); if (timer.current) clearTimeout(timer.current) }
  // Account changes remount the whole session. No journal date is used for pet care.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const refreshProgress = () => {
      setJournalError(pendingPetJournalError(persistenceScope))
      const latest = readHome(persistenceScope)
      saved.current = latest; setHome(latest.home); setError(latest.error)
    }
    const changed = (event: StorageEvent) => { if (event.key === `trainoracle:pet-home:v2:${encodeURIComponent(persistenceScope)}`) refreshProgress() }
    window.addEventListener(PET_JOURNAL_EVENT, refreshProgress)
    window.addEventListener('storage', changed)
    return () => { window.removeEventListener(PET_JOURNAL_EVENT, refreshProgress); window.removeEventListener('storage', changed) }
  }, [persistenceScope])
  useEffect(() => {
    onCanExitReady?.(() => {
      if (detailRef.current) { closeDetails(); return false }
      if (activityRef.current) { closeActivity(); return false }
      return true // Every successful action was already saved; failed actions never replace that state.
    })
    return () => onCanExitReady?.(null)
  }, [onCanExitReady])
  useEffect(() => {
    if (contentRef.current) contentRef.current.inert = !!details || !!activity
    if (details) detailHeading.current?.focus({ preventScroll: true })
  }, [details, activity])

  function reload() {
    const next = readHome(persistenceScope)
    saved.current = next; setHome(next.home); setError(next.error); setMessage(''); setReaction(null); setSpeech(null); setStirred(false)
    if (!next.error) commit(roomForToday(next.home), '저장된 펫 기록을 불러왔어요.')
  }
  function reactTo(id: PetId, pose: PetPose) {
    if (timer.current) clearTimeout(timer.current)
    setReaction({ id, pose, key: Date.now() })
    timer.current = setTimeout(() => setReaction(null), 2300)
  }
  function beginActivity(next: Activity) {
    if (saved.current.error) return
    modalOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : roomTabRef.current
    activityRef.current = next; setActivity(next)
  }
  function closeActivity() {
    if (contentRef.current) contentRef.current.inert = false
    activityRef.current = null; setActivity(null)
    const current = saved.current.home
    const next = refreshVisitors(current, careDay())
    // Finish with the visible friend first, then welcome today's visitors. Keep this companion beside them.
    if (next !== current) commit(invitePet(next, current.selected), '새 친구들도 놀러 왔어요. 방금 함께한 친구도 옆에 있어요.')
    const focusTarget = modalOpener.current ?? roomTabRef.current
    focusTarget?.focus({ preventScroll: true })
  }
  function care(action: Exclude<CareAction, 'bed'>) {
    const current = saved.current.home
    if (current.sleeping || current.morning) return
    setNewKeepsake(null)
    beginActivity({ kind: 'care', id: current.selected, action, turn: interactions.current[`${current.selected}:${action}`] ?? 0 })
  }
  function finishCare(id: PetId, action: Exclude<CareAction, 'bed'>) {
    // Keep the pet the user can see. A new day is refreshed on entry/focus or waking,
    // never halfway through a care action that would otherwise target an unseen visitor.
    const current = saved.current.home
    if (current.sleeping || current.morning || current.selected !== id || !atHome(current).includes(id)) return false
    const already = current.pets[id]!.actions[action].includes(careDay())
    const next = careFor(current, id, action, careDay())
    const turn = interactions.current[`${id}:${action}`] ?? 0
    const beforeMemories = memoriesFor(id, current.pets[id]!).length
    const newMemory = memoriesFor(id, next.pets[id]!).length > beforeMemories
    if (commit(next, newMemory ? '우리 추억에 새 장면이 남았어요.' : already ? '오늘 돌본 건 저장했어요. 더 놀아도 좋아요.' : `${petById(id).name} 돌보기를 저장했어요.`)) {
      const earned = roomKeepsakes(next).find(item => !roomKeepsakes(current).some(old => old.id === item.id))
      setNewKeepsake(earned?.id ?? null)
      reactTo(id, action === 'pet' ? 'happy' : action === 'feed' ? 'eating' : 'playing')
      setSpeech(careVoice(id, action, turn))
      interactions.current[`${id}:${action}`] = turn + 1
      return true
    }
    return false
  }
  const [speech, setSpeech] = useState<string | null>(null)
  function select(id: PetId) {
    if (home.sleeping || home.morning) return false
    if (!commit(invitePet(saved.current.home, id))) return false
    setSpeech(null); setReaction(null); setTab('room')
    return true
  }
  function startSleep(wakeDate: string) {
    // The bedtime button refers to the guests currently in this room, even after midnight.
    const current = saved.current.home
    if (current.sleeping || current.morning) return
    const next = sleepTogether(current, careDay(), wakeDate)
    if (next === current) { setError('이 날짜의 잠자리는 이미 준비했어요. 방으로 돌아가 아침 장면을 확인해 주세요.'); return }
    const earned = roomKeepsakes(next).find(item => !roomKeepsakes(current).some(old => old.id === item.id))
    if (commit(next, earned ? `${ROOM_DECOR[earned.id].name}을 받았어요. 잘 자고 나서 방에 놓아 봐요.` : '잠자리 준비를 기록했어요. 이제 화면을 꺼도 괜찮아요.')) {
      setNewKeepsake(earned?.id ?? null); modalOpener.current = roomTabRef.current; closeActivity(); setStirred(false); setReaction(null); setSpeech(null); setTab('room'); setGreetingDate(null)
    }
  }
  function wake() {
    const before = saved.current.home
    const next = wakeTogether(before, careDay())
    if (next === before && observationNight && careDay() < observationNight.wakeDate) { setMessage(`${observationNight.wakeDate}에 아침 장면을 볼 수 있어요. 지금은 그대로 쉬게 둘게요.`); return }
    if (next !== before && commit(next, '밤에 놓아 둔 물건을 살펴봐요.')) {
      setReaction(null); setStirred(false); setSpeech(null)
    }
  }
  function greetMorning() {
    const wakeDate = activeObservationNight(saved.current.home)?.wakeDate ?? saved.current.home.morning?.day ?? careDay()
    const next = finishMorning(saved.current.home, careDay())
    if (next !== saved.current.home && commit(next, `${petById(next.selected).name}도 오늘 방에 남아요. 같이 놀고 쉬어요.`)) {
      setGreetingDate(wakeDate); setSpeech(morningGreeting(morningJournal, wakeDate)); reactTo(next.selected, 'happy')
    }
  }
  function savePhoto(resultId: string) {
    const current = saved.current.home
    const next = photographObservation(current, resultId)
    const authored = observationState(current).nights.some(night => night.results.some(result => result.id === resultId && result.sceneId))
    if (next !== current) commit(next, authored ? '사진첩에 남겼어요. 이 장면은 일지 스티커로도 쓸 수 있어요.' : '사진첩에 남겼어요. 친구가 쓴 물건도 함께 기억할게요.')
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
  function decorateAfterCare() {
    modalOpener.current = decorButton.current
    activityRef.current = { kind: 'decor' }; setActivity({ kind: 'decor' })
  }
  function playAgain() {
    const current = saved.current.home
    if (saved.current.error || current.sleeping || current.morning) return
    setNewKeepsake(null)
    const next: Activity = { kind: 'care', id: current.selected, action: 'play', turn: interactions.current[`${current.selected}:play`] ?? 0 }
    activityRef.current = next; setActivity(next)
  }
  function placeDecor(id: RoomDecorId | null) {
    const current = saved.current.home
    const next = placeRoomDecoration(current, id)
    if (next === current && current.roomDecoration !== id) return
    if (error || next !== current && !commit(next, id ? `${ROOM_DECOR[id].name}, 방에 놓았어요.` : '소품을 치웠어요. 언제든 다시 놓을 수 있어요.')) return
    setNewKeepsake(null); closeActivity()
  }
  function earnDecor(action: CareAction) {
    const current = saved.current.home
    if (saved.current.error || current.sleeping || current.morning) return
    modalOpener.current = decorButton.current
    setNewKeepsake(null)
    const next: Activity = action === 'bed' ? { kind: 'setup' } : { kind: 'care', id: current.selected, action, turn: interactions.current[`${current.selected}:${action}`] ?? 0 }
    activityRef.current = next; setActivity(next)
  }
  const bond = home.pets[selected.id]!
  const sleeping = !!home.sleeping
  const morning = !!home.morning
  const present = home.sleeping?.pets ?? home.morning?.pets ?? atHome(home)
  const scenePets = [home.selected, ...present.filter(id => id !== home.selected)].slice(0, 3)
  const myPets = PETS.filter(pet => home.pets[pet.id]?.adoptedOn)
  const shownPose = sleeping ? stirred ? 'awake' : 'sleeping' : morning ? 'waking' : reaction?.id === selected.id ? reaction.pose : 'awake'
  const detailPet = details ? petById(details) : null
  const detailBond = details ? home.pets[details] : undefined
  const keepsakes = roomKeepsakes(home)
  const stories = petStory(selected.id, bond).filter(scene => scene.date)
  const filteredPets = PETS.filter(pet => filter === 'all' || (filter === 'known' && home.pets[pet.id]) || (filter === 'ready' && canAdopt(home, pet.id)) || (filter === 'family' && home.pets[pet.id]?.adoptedOn))
  const roomTools = <div className="pet-room-tools"><span>{sleeping ? '화면을 꺼도 친구들은 쉬어요' : morning ? '잘 잤어? 오늘도 같이 지내자' : `좋아하는 것 · ${selected.favorite}`}</span><button ref={decorButton} type="button" disabled={!!error} onClick={() => beginActivity({ kind: 'decor' })}><DecorArt id={home.roomDecoration ?? 'paw-frame'} /><span>방 꾸미기<small>{newKeepsake ? '새 소품이 생겼어요' : `받은 소품 ${keepsakes.length}개`}</small></span></button></div>
  return <div className={`pet-home${sleeping ? ' pet-home--night' : ''}`}>
    <div ref={contentRef} className="pet-home__content">
    <header className="pet-home__header">
      <button type="button" className="pet-icon-button" aria-label={returnLabel} onClick={onBack}><ArrowLeft size={22} /></button>
      <div><span>내 펫과 함께 쉬는 방</span><h1>우리 집 친구들</h1></div>
      <button type="button" className="pet-icon-button" aria-label={journalLinkLabel ?? '수면 일지 열기'} onClick={onOpenJournal}><BookOpen size={22} /></button>
    </header>
    {error && <div role="alert" className="pet-home__error"><p>{error}</p><button type="button" onClick={reload}>다시 불러오기</button></div>}
    <nav className="pet-home__tabs" aria-label="펫 메뉴">
      <button ref={roomTabRef} type="button" aria-current={tab === 'room' ? 'page' : undefined} onClick={() => setTab('room')}><ActionArt frame={4} />우리 방</button>
      <button type="button" aria-current={tab === 'friends' ? 'page' : undefined} onClick={() => setTab('friends')}><ActionArt frame={5} />친구들 <span>{Object.keys(home.pets).length}/{PETS.length}</span></button>
    </nav>
    {journalError && <div role="alert" className="pet-home__error"><p>{journalError}</p><button type="button" onClick={() => { void retryPetJournalSave(persistenceScope).then(() => { if (sessionAlive.current) { setJournalError(pendingPetJournalError(persistenceScope)); reload() } }) }}>날짜 반영 다시 시도</button></div>}
    {tab === 'room' ? <>
      {greetingDate && !sleeping && !morning && <PetMorningGreeting id={home.selected} wakeDate={greetingDate} journal={morningJournal} onRecord={onOpenMorningJournal ? () => onOpenMorningJournal(greetingDate) : undefined} onRest={() => beginActivity({ kind: 'rest' })} onDismiss={() => setGreetingDate(null)} />}
      {!sleeping && !morning && <div className="pet-bedtime-entry"><button type="button" disabled={!!error} className="pet-primary" onClick={() => beginActivity({ kind: 'setup' })}><ActionArt frame={3} /><span>같이 자기<small>물건을 놓고, 아침에 어떻게 잤는지 봐요</small></span></button>
        {observationState(home).nights.length > 0 && <button type="button" className="pet-secondary" disabled={!!error} onClick={() => startSleep(nextWakeDate(saved.current.home))}>그대로 재우기 · {nextWakeDate(home).slice(5).replace('-', '/')} 아침에 보기</button>}
      </div>}
      {morning && (observationNight?.observedOn ? <PetMorningObservation home={home} onPhotograph={savePhoto} onFinish={greetMorning} onRest={backToSleep} onOpenAlbum={() => beginActivity({ kind: 'album' })} error={error} />
        : <section className="pet-morning" aria-label="함께 잔 친구들과 아침 인사"><PetSprite id={home.selected} pose="waking" /><h2>잘 쉬었니?</h2><p>같이 잠들었던 친구들이 여기 있어요.</p><button type="button" className="pet-primary" disabled={!!error} onClick={greetMorning}>나도 일어났어</button><button type="button" className="pet-secondary" disabled={!!error} onClick={backToSleep}>조금 더 같이 쉬기</button></section>)}
      {!morning && <section className="pet-scene" data-companions={scenePets.length} aria-label={sleeping ? '친구들이 함께 자는 방' : '동물 친구들이 놀러 온 방'}>
        <img className="pet-scene__background" src={sleeping ? petRoomAsset('room-sleep-v2.webp') : `${asset}room.webp`} alt="" draggable={false} />
        <div className="pet-scene__badge">{sleeping ? <><Moon size={14} /> {stirred ? '눈을 떴어요' : '새근새근 자는 중'}</> : <><Sun size={14} /> {morning ? '다시 만났네' : bond.adoptedOn ? '우리 집에서 함께' : '오늘 놀러 온 친구들'}</>}</div>
        <div className="pet-scene__speech" aria-live="polite">{sleeping ? stirred ? '응…? 나도 눈이 떠졌어. 다시 잘까?' : PET_VOICES[selected.id].bed : morning ? PET_VOICES[selected.id].wake : speech ?? selected.hello}</div>
        <ObservationPlacementArt placements={sleeping && observationNight ? observationNight.placements : observationState(home).placements} />
        {scenePets.map((id, index) => <button type="button" key={id} disabled={!!error || morning} className={`pet-scene__pet pet-scene__pet--${index}${reaction?.id === id ? ' pet-scene__pet--react' : ''}`} aria-label={sleeping ? `${petById(id).name} 살짝 깨우기` : morning ? `${petById(id).name} 아침 인사` : `${petById(id).name} ${index === 0 ? '쓰다듬기' : '선택하기'}`}
          onClick={() => sleeping ? setStirred(true) : index === 0 ? care('pet') : select(id)}>
          {sleeping && <PropArt item="blanket" className="pet-scene__blanket" />}<PetSprite id={id} pose={index === 0 ? shownPose : sleeping ? stirred ? 'awake' : 'sleeping' : morning ? 'waking' : 'awake'} className={sleeping && !stirred ? 'pet-sprite--sleeping-still' : ''} motion={sleeping ? stirred ? 'wake' : undefined : morning ? 'wake' : index === 0 ? motionForPose(shownPose) : 'idle'} replay={reaction?.id === id ? reaction.key : undefined} active={!activity && !details} />
          <span className="pet-scene__pet-name">{petById(id).name}{home.pets[id]?.adoptedOn && <Check size={12} />}</span>
        </button>)}
        {home.roomDecoration && <button type="button" className="pet-scene__keepsake" aria-label={`${ROOM_DECOR[home.roomDecoration].name} 추억 보기`} onClick={() => { if (!sleeping && !morning) setSpeech(ROOM_DECOR[home.roomDecoration!].reply); beginActivity({ kind: 'decor' }) }}><DecorArt id={home.roomDecoration} /></button>}
      </section>}
      {(sleeping || morning) && present.length > 3 && <section className="pet-resting-friends" aria-label="함께 쉬는 친구 모두"><p>{present.length}명이 함께 쉬고 있어요.</p><div>{present.map(id => <span key={id}><span>{petById(id).name}</span></span>)}</div></section>}
      <section className="pet-selected" aria-label={`${selected.name} 돌보기`}>
        <div className="pet-selected__heading"><div><span>{selected.animal} · {bond.adoptedOn ? '우리 집 식구' : '방문 친구'}</span><h2>{selected.name} <small>{bond.caredDays.length}일 돌봤어요</small></h2></div><button type="button" className="pet-text-button" onClick={() => openDetails(selected.id)}>{bond.adoptedOn ? '우리 추억' : '입양 조건'}<ChevronRight size={17} /></button></div>
        {!sleeping && !morning ? <>
          <div className="pet-care-actions">
            {(['pet', 'feed', 'play'] as const).map((action, index) => <button type="button" key={action} disabled={!!error} className={PET_VOICES[selected.id].favorite === action ? 'pet-care-favorite' : ''} onClick={() => care(action)}><ActionArt frame={index} /><strong>{action === 'pet' ? '쓰다듬기' : action === 'feed' ? '간식 주기' : '같이 놀기'}</strong>{bond.actions[action].includes(careDay()) && <span className="pet-action-done"><Check size={12} />오늘 했어요</span>}</button>)}
          </div>
          {roomTools}
          <PetCareGoal home={home} id={selected.id} today={careDay()} disabled={!!error} onCare={action => action === 'bed' ? beginActivity({ kind: 'setup' }) : care(action)} onAdopt={() => openDetails(selected.id)} />
          <button type="button" className="pet-story-entry" disabled={!!error} onClick={() => beginActivity({ kind: 'story', id: selected.id })}><ActionArt frame={5} /><span><strong>{selected.name} 이야기</strong><small>{stories[stories.length - 1]!.copy[0]} · {stories.length}/4장</small></span><ChevronRight size={18} /></button>
        </> : sleeping ? <div className="pet-sleep-actions">
          {stirred && <button type="button" className="pet-primary" onClick={() => setStirred(false)}><Moon size={20} /> 다시 같이 자기</button>}
          <p>폰을 내려놓고 쉬어요. 방은 이대로 남아 있어요.</p>
          <button type="button" className="pet-secondary" disabled={!!error} onClick={wake}><Sun size={18} />{observationNight && careDay() < observationNight.wakeDate ? `${observationNight.wakeDate.slice(5).replace('-', '/')}에 아침 보기` : '다 잤어, 일어나자'}</button>
          <small>이 화면 밖의 폰 사용이나 실제 수면은 측정하지 않아요.</small>
        </div> : null}
        {(message || sleeping || morning) && <p className="pet-save-status" role="status">{message || (sleeping ? '잠자리 준비를 저장했어요. 화면은 꺼도 돼요.' : '아침 인사는 수면 시간으로 기록되지 않아요.')}</p>}
      </section>
      {!sleeping && !morning && <section className="pet-housemates" aria-label="방에 있는 친구 선택"><h2>같이 있는 친구 <span>{present.length}</span></h2><div>{present.map(id => <button key={id} type="button" disabled={!!error} aria-pressed={selected.id === id} onClick={() => select(id)}><PetSprite id={id} /><span>{petById(id).name}</span><small>{home.pets[id]?.adoptedOn ? '우리 집' : '놀러 왔어요'}</small></button>)}</div></section>}
      {!sleeping && <button type="button" className="pet-secondary" onClick={() => beginActivity({ kind: 'album' })}><BookOpen size={18} />우리 아침 사진첩 · {observationState(home).photos.length}장</button>}
    </> : <section className="pet-friends">
      <div className="pet-friends__intro"><h2>다시 만나고 싶은 친구가 있나요?</h2><p>한 번 만난 친구는 언제든 초대해요.<br />못 온 날이 있어도 함께한 날은 사라지지 않아요.</p></div>
      <div className="pet-friends__count"><strong>우리 집 식구 {myPets.length}</strong><span>만난 친구 {Object.keys(home.pets).length} / {PETS.length}</span></div>
      <div className="pet-filters" role="group" aria-label="친구 목록 고르기">{([['all', '모두'], ['known', '만난 친구'], ['ready', '입양 가능'], ['family', '우리 집']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setFriendsPage(0) }}>{label}</button>)}</div>
      {!filteredPets.length && <p className="pet-friends__empty">{filter === 'ready' ? '돌봄 미션으로 바로 입양할 친구는 아직 없어요. 만난 친구의 입양 조건을 확인해 봐요.' : '아직 우리 집 식구가 없어요. 친해진 친구를 입양하면 여기 모여요.'}</p>}
      <div className="pet-friends__grid">{filteredPets.slice(friendsPage * 12, (friendsPage + 1) * 12).map(pet => {
        const record = home.pets[pet.id]
        return <button key={pet.id} type="button" className={`pet-friend${!record ? ' pet-friend--new' : ''}`} onClick={() => openDetails(pet.id)} style={{ '--pet-accent': pet.accent } as CSSProperties}>
          <PetSprite id={pet.id} pose={record?.adoptedOn ? 'happy' : 'awake'} /><strong>{pet.name}</strong><span>{pet.animal}</span><small>{record?.adoptedOn ? '우리 집 식구' : record ? canAdopt(home, pet.id) ? '입양할 수 있어요!' : `${record.caredDays.length}일 함께했어요` : '아직 안 만났어요'}</small>
        </button>
      })}</div>
      <FriendPages page={friendsPage} count={filteredPets.length} onChange={setFriendsPage} />
      <p className="pet-small">하루에 최대 3명이 무작위로 놀러 와요. 아직 못 만난 친구부터 와요. 새로고침해도 오늘 친구는 같아요.</p>
    </section>}
    {!sleeping && !morning && <PetJournalProgress home={home} unavailable={!!error} pendingError={null} onMeet={() => beginActivity({ kind: 'journal' })} onRetry={() => { void retryPetJournalSave(persistenceScope).then(() => { if (sessionAlive.current) { setJournalError(pendingPetJournalError(persistenceScope)); reload() } }) }} />}
    <section className="pet-journal-link"><div><BookOpen size={20} /><div><strong>{journalLinkLabel ? '연결된 일지' : '내 수면 일지'}</strong><span>{journalLinkLabel ? `${journal.date} · 읽고 나서 이 방으로 돌아와요` : journal.status === 'recorded' ? `${journal.date} · ${journal.sleepH ? `${journal.sleepH}시간 기록했어요` : '기록이 있어요'}` : journal.status === 'draft' ? '작성 중인 일지로 돌아가요' : '얼마나 잤는지는 일지에 직접 적어요'}</span></div></div><button type="button" onClick={onOpenJournal}>{journalLinkLabel ?? '일지 열기'}<ChevronRight size={16} /></button></section>
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
        <PetSprite id={detailPet.id} pose={adopted === detailPet.id || detailBond?.adoptedOn ? 'happy' : 'awake'} motion={adopted === detailPet.id ? 'hello' : 'idle'} className="pet-detail__portrait" />
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
          <p className="pet-small">미션도 같은 날은 한 번만 세어요. 입양에 결제나 실패 추첨은 없어요.</p>
          {sleeping || morning ? <><button type="button" className="pet-primary" onClick={() => returnToRoom(detailPet.id)}>{sleeping ? '잠든 방으로 돌아가기' : '아침 방으로 돌아가기'}</button><p className="pet-small">아침 인사를 나눈 뒤에 초대하거나 입양해요.</p></> : canAdopt(home, detailPet.id) ? <button type="button" disabled={!!error} className="pet-primary" onClick={() => adopt(detailPet.id)}><ActionArt frame={4} />우리 집으로 입양하기</button> : <button type="button" disabled={!!error} className="pet-primary" onClick={() => returnToRoom(detailPet.id)}>{present.includes(detailPet.id) ? `${detailPet.name} 돌보러 가기` : '지금 방으로 초대하기'}</button>}
          <MemoryAlbum id={detailPet.id} bond={detailBond} />
        </>}
      </section>
    </div>}
    {activity?.kind === 'care' && <PetCareScene key={`${activity.id}:${activity.action}:${activity.turn}`} id={activity.id} action={activity.action} turn={activity.turn} onComplete={() => finishCare(activity.id, activity.action)} onClose={closeActivity} error={error} onReload={() => { closeActivity(); reload() }} keepsake={newKeepsake} onDecorate={decorateAfterCare} onPlayAgain={playAgain} />}
    {activity?.kind === 'setup' && <PetNightSetup home={home} onCommit={commit} onContinue={wakeDate => { const next: Activity = { kind: 'bed', wakeDate }; activityRef.current = next; setActivity(next) }} onClose={closeActivity} error={error} onReload={() => { closeActivity(); reload() }} />}
    {activity?.kind === 'bed' && <PetBedtimeScene companions={[home.selected, ...present.filter(id => id !== home.selected)].slice(0, 3)} onFinish={() => startSleep(activity.wakeDate)} onClose={closeActivity} error={error} onReload={() => { closeActivity(); reload() }} decoration={home.roomDecoration} placements={observationState(home).placements} />}
    {activity?.kind === 'album' && <PetObservationAlbum home={home} onClose={closeActivity} />}
    {activity?.kind === 'rest' && <PetQuietRest id={home.selected} onClose={closeActivity} />}
    {activity?.kind === 'story' && <PetStoryBook id={activity.id} bond={home.pets[activity.id]!} onClose={closeActivity} />}
    {activity?.kind === 'decor' && <PetRoomDecor home={home} onPlace={placeDecor} onEarn={earnDecor} onClose={closeActivity} error={error} onReload={() => { closeActivity(); reload() }} />}
    {activity?.kind === 'journal' && <PetJournalMeeting home={home} commit={commit} onClose={closeActivity} onGoToRoom={() => { setTab('room'); modalOpener.current = roomTabRef.current; closeActivity() }} error={error} onReload={() => { closeActivity(); reload() }} />}
  </div>
}
