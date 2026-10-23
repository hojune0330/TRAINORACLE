import React, { useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react'
import { PETS, petById, type PetId } from './pet-catalog'
import { adoptJournalFriend, careDay, journalFriendCredits, proposeJournalFriend, type PetHome } from './pet-engine'
import { PetSprite } from './PetArt'
import { PetOverlay } from './PetOverlay'

export function FriendPages({ page, count, onChange }: { page: number; count: number; onChange: (page: number) => void }) {
  const pages = Math.ceil(count / 12)
  return pages > 1 ? <nav className="pet-friend-pages" aria-label="친구 목록 페이지"><button type="button" aria-label="이전 친구 12명" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={18} /></button><span aria-live="polite">{page + 1} / {pages}</span><button type="button" aria-label="다음 친구 12명" disabled={page >= pages - 1} onClick={() => onChange(page + 1)}><ChevronRight size={18} /></button></nav> : null
}

export function PetJournalProgress({ home, unavailable, onMeet, pendingError, onRetry }: { home: PetHome; unavailable: boolean; onMeet: () => void; pendingError: string | null; onRetry: () => void }) {
  const credits = journalFriendCredits(home)
  const allOwned = PETS.every(pet => home.pets[pet.id]?.adoptedOn)
  return <section className="pet-journal-friends" aria-label="일지로 만나는 친구">
    <div className="pet-journal-friends__heading"><BookOpen size={20} /><h2>일지로 만나는 친구</h2></div>
    {!unavailable && <><p>{credits > 0 ? `친구를 만날 기회 ${credits}번이 기다려요` : `일지 쓴 날 ${home.journal.days.length % 7} / 7일`}</p><progress max={7} value={credits > 0 ? 7 : home.journal.days.length % 7} aria-label="다음 친구를 만날 때까지 기록한 날" />
      {allOwned ? <p>모든 친구와 함께해요. 남은 만남 {credits}번은 보관돼요.</p> : credits > 0 ? <><button className="pet-primary" type="button" disabled={!!home.sleeping || !!home.morning} onClick={onMeet}>친구 만나기<ChevronRight size={18} /></button>{(home.sleeping || home.morning) && <p>아침 인사를 나눈 뒤에 친구를 만나요.</p>}</> : <p>연속이 아니어도 괜찮아요. 하루 한 번 쌓여요.</p>}</>}
    {unavailable && <p>저장된 친구 기록을 다시 불러온 뒤에 진행을 확인해요.</p>}
    {pendingError && <div role="alert"><p>{pendingError}</p><button type="button" className="pet-secondary" onClick={onRetry}>날짜 반영 다시 시도</button></div>}
    <details><summary>어떻게 만나나요?</summary><p>이 기능 적용 후, 당일 날짜의 일지를 저장한 날부터 세어요. 7일마다 원하는 친구를 고르거나 랜덤으로 제안받을 수 있어요. 이전 날짜·미래 날짜를 적은 기록은 쌓이지 않아요.</p><p>훈련·휴식·컨디션·경기 기록을 똑같이 세며, 하루에 여러 번 또는 길게 적어도 하루예요. 운동량·통증·메모 내용은 사용하지 않아요. 못 쓴 날이나 지운 날 때문에 입양한 친구가 떠나지 않아요.</p><p>랜덤 제안은 다시 열어도 같고, 원하는 친구로 바꿔 골라도 기회가 사라지지 않아요. 마지막 입양 버튼으로 저장을 마칠 때만 한 번 사용해요. 만남과 친구는 이 브라우저에만 보관돼요.</p><p>날짜 반영에 실패한 뒤 앱을 새로 열었다면, 오늘 같은 일지를 다시 저장해 주세요. 다른 날의 기록을 소급해서 쌓지는 않아요.</p></details>
  </section>
}

export function PetJournalMeeting({ home, commit, onClose, onGoToRoom, error, onReload }: { home: PetHome; commit: (home: PetHome, notice?: string) => boolean; onClose: () => void; onGoToRoom?: () => void; error: string | null; onReload: () => void }) {
  const [mode, setMode] = useState<'menu' | 'choose' | 'random' | 'done'>('menu')
  const [selected, setSelected] = useState<PetId | null>(null)
  const [page, setPage] = useState(0)
  const [adopted, setAdopted] = useState<PetId | null>(null)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [mode])
  const choices = PETS.filter(pet => !home.pets[pet.id]?.adoptedOn)
  const target = mode === 'random' ? home.journal.pending?.id ?? null : selected
  const friend = target ? petById(target) : null
  function random() {
    const next = proposeJournalFriend(home)
    if (next === home ? !!home.journal.pending : commit(next)) { setMode('random'); setSelected(null) }
  }
  function adopt() {
    if (!target) return
    const next = adoptJournalFriend(home, target, careDay())
    if (next !== home && commit(next, `${petById(target).name}, 이제 우리 집 식구예요!`)) { setAdopted(target); setMode('done') }
  }
  const transition = (next: 'menu' | 'choose') => { setMode(next); setPage(0); setSelected(null) }
  const confirm = <button type="button" className="pet-primary" disabled={!!error || !friend || !!home.pets[friend.id]?.adoptedOn} onClick={adopt}>{friend ? `${friend.name}, 우리 집으로 입양하기` : '친구를 골라 주세요'}</button>
  return <PetOverlay title="일지로 친구 만나기" onClose={onClose} contained>
    <div className="pet-meeting">
      {error && <div role="alert" className="pet-home__error"><p>{error}</p><button type="button" onClick={onReload}>다시 불러오기</button></div>}
      {mode === 'done' && adopted ? <><PetSprite id={adopted} pose="happy" motion="hello" className="pet-meeting__portrait" /><h3 ref={title} tabIndex={-1}>{petById(adopted).name}, 우리 집에 온 걸 환영해!</h3><p>{petById(adopted).hello}</p><p>우리 집 식구가 됐어요. 쉬어 간 날에도 여기 남아요.</p><button type="button" className="pet-primary" onClick={onGoToRoom ?? onClose}>친구와 방으로 가기</button></> : <>
        <h3 ref={title} tabIndex={-1}>{mode === 'menu' ? '어떤 만남이 좋을까요?' : mode === 'choose' ? '함께 지낼 친구를 골라요' : '이 친구가 인사하러 왔어요'}</h3>
        <p>남은 만남 {journalFriendCredits(home)}번 · 입양을 마칠 때만 사용해요.</p>
        {mode === 'menu' ? <div className="pet-meeting__modes"><button type="button" className="pet-secondary" disabled={!!error || !choices.length} onClick={() => transition('choose')}><Check size={18} />직접 고르기</button><button type="button" className="pet-secondary" disabled={!!error || !choices.length} onClick={random}><Shuffle size={18} />{home.journal.pending ? '랜덤 친구 다시 보기' : '랜덤 친구 만나기'}</button></div> : mode === 'choose' ? <>
          <div className="pet-friends__grid pet-meeting__choices" role="group" aria-label="입양할 친구 선택">{choices.slice(page * 12, (page + 1) * 12).map(pet => <button type="button" className="pet-friend" key={pet.id} aria-label={`${pet.name} · ${pet.animal}`} aria-pressed={selected === pet.id} disabled={!!error} onClick={() => setSelected(pet.id)}><PetSprite id={pet.id} /><strong>{pet.name}</strong><span>{pet.animal}</span><span className="pet-meeting__check">{selected === pet.id && <Check size={18} />}</span></button>)}</div>
          <FriendPages page={page} count={choices.length} onChange={next => { setPage(next); setSelected(null) }} />
        </> : friend ? <div className="pet-meeting__reveal"><PetSprite id={friend.id} motion="idle" className="pet-meeting__portrait" /><strong>{friend.name} · {friend.animal}</strong><p>{friend.hello}</p></div> : <p>다른 경로로 이미 입양한 친구예요. 원하는 친구를 다시 골라 주세요.</p>}
        {mode !== 'menu' && <>{mode !== 'choose' && confirm}<button type="button" className="pet-secondary" onClick={() => transition(mode === 'random' ? 'choose' : 'menu')}>{mode === 'random' ? '직접 고르기로 바꾸기' : '만나는 방법 다시 고르기'}</button></>}
        <button type="button" className="pet-text-button" onClick={onClose}>나중에 만날게</button>
      </>}
    </div>
    {mode === 'choose' && <footer className="pet-meeting__confirm" aria-label="선택한 친구 입양 확인">{confirm}</footer>}
  </PetOverlay>
}
