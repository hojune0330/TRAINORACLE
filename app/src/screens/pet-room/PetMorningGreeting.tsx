import React, { useState } from 'react'
import type { SleepInnJournalContext } from '../sleep-inn/types'
import type { PetId } from './pet-catalog'
import { petById } from './pet-catalog'
import { PetSprite, PropArt, petRoomAsset } from './PetArt'
import { PetOverlay } from './PetOverlay'

export function morningGreeting(journal: SleepInnJournalContext | undefined, wakeDate: string) {
  if (!journal || journal.date !== wakeDate || journal.status !== 'recorded') return '일어났네! 어떻게 잤어?'
  if (!journal.sleepQualityExplicit) return '일어났네! 오늘도 같이 있어 줘서 좋아.'
  if ((journal.sleepQuality ?? 0) >= 4) return '잘 잤다니 좋다 ㅎㅎ 오늘은 뭐 하고 놀까?'
  if ((journal.sleepQuality ?? 0) >= 1 && (journal.sleepQuality ?? 0) <= 2) return '잠을 잘 못 잤구나. 피곤하겠다. 내 옆에서 잠깐 쉴래?'
  return '일어났네! 오늘도 같이 있어 줘서 좋아.'
}

export function PetMorningGreeting({ id, wakeDate, journal, onRecord, onRest, onDismiss }: {
  id: PetId; wakeDate: string; journal?: SleepInnJournalContext | undefined
  onRecord?: (() => void) | undefined; onRest: () => void; onDismiss: () => void
}) {
  const recorded = journal?.date === wakeDate && journal.status === 'recorded'
  return <section className="pet-morning-greeting" aria-label="내 수면 기록과 아침 인사">
    <div className="pet-morning-greeting__friend"><PetSprite id={id} pose="happy" motion="hello" /><div><small>{petById(id).name}의 아침 인사</small><p>{morningGreeting(journal, wakeDate)}</p></div></div>
    <small>{wakeDate.replaceAll('-', '.')} 아침 · {recorded ? '일지에 남긴 수면을 보고 인사해요.' : '수면은 일지에 직접 적어요.'}</small>
    <div className="pet-morning-greeting__actions">
      {onRecord && <button type="button" className="pet-primary" onClick={onRecord}>{recorded ? '수면 기록 보기·수정' : '어떻게 잤는지 적기'}</button>}
      <button type="button" className="pet-secondary" onClick={onRest}>같이 쉬기</button>
      <button type="button" className="pet-text-button" onClick={onDismiss}>나중에 할게</button>
    </div>
  </section>
}

/** An optional rest: no measured sleep, care credit or timer. */
export function PetQuietRest({ id, onClose }: { id: PetId; onClose: () => void }) {
  const [pats, setPats] = useState(0)
  return <PetOverlay title="옆에서 잠깐 쉬자" onClose={onClose}>
    <p className="pet-activity__instruction" aria-live="polite">{pats ? '응, 여기 같이 있을게.' : '내 옆에 쿠션 놨어. 편하게 쉬어.'}</p>
    <div className="pet-quiet-rest">
      <img className="pet-quiet-rest__room" src={petRoomAsset('room.webp')} alt="" />
      <PropArt item="pillow" className="pet-quiet-rest__cushion" />
      <button type="button" aria-label={petById(id).name + ' 토닥이기'} onClick={() => setPats(value => value + 1)}><PetSprite id={id} pose={pats ? 'happy' : 'sleeping'} className={pats ? '' : 'pet-sprite--sleeping-still'} motion={pats ? 'pet' : undefined} replay={pats} /></button>
    </div>
    <p className="pet-small">정해진 시간은 없어요. 언제든 나가도 돼요.</p>
    <button type="button" className="pet-primary" onClick={onClose}>방으로 돌아가기</button>
  </PetOverlay>
}
