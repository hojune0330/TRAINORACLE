import React from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import { onLocalJournalScopeChange } from '../domain/account/local-journal-ownership'
import { capturePetJournalScope, PET_JOURNAL_EVENT, pendingPetJournalError, readPetJournalProgress, retryPetJournalSave, type SavedPetJournalRef } from '../domain/pet-journal-progress'
import { careDay, petHomeKey } from '../screens/pet-room/pet-engine'

const SleepInnEntry = React.lazy(() => import('../screens/sleep-inn/SleepInnEntry').then(module => ({ default: module.SleepInnEntry })))

/** An optional shortcut after storage acknowledgement, not another save or reward. */
export function PetJournalSaveLink({ journal }: { readonly journal: SavedPetJournalRef }) {
  const [ticket] = React.useState(capturePetJournalScope)
  const [revision, refresh] = React.useReducer(value => value + 1, 0)
  const [opened, setOpened] = React.useState(false)
  const [retrying, setRetrying] = React.useState(false)
  const alive = React.useRef(true)
  React.useEffect(() => {
    alive.current = true
    const update = () => refresh()
    const changed = (event: StorageEvent) => { if (event.key === petHomeKey(ticket.owner)) update() }
    const visibility = () => { if (document.visibilityState === 'visible') update() }
    const stopScope = onLocalJournalScopeChange(update)
    window.addEventListener(PET_JOURNAL_EVENT, update)
    window.addEventListener('storage', changed)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      alive.current = false; stopScope()
      window.removeEventListener(PET_JOURNAL_EVENT, update)
      window.removeEventListener('storage', changed)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [ticket])
  const today = careDay()
  const progress = React.useMemo(() => readPetJournalProgress(ticket, { today }), [ticket, today, revision])
  const error = pendingPetJournalError(ticket.owner)
  if (progress.status === 'STALE') return null
  const currentDay = journal.date === today
  const ready = progress.status === 'READY'
  const canMeet = ready && progress.canMeet
  const summary = error ? '일지는 저장됐어요. 친구 진행은 반영하지 못했어요.'
    : !currentDay ? (ready && canMeet ? `친구 만남 기회 ${progress.credits}번 · 이 날짜는 오늘 진행에 더해지지 않아요.` : '이 날짜는 오늘 친구 진행에 더해지지 않아요.')
      : ready && progress.recordedToday ? (progress.credits > 0 ? `친구 만남 기회 ${progress.credits}번이 있어요` : `일지로 만나는 친구 · ${progress.days % 7}/7일`)
        : progress.status === 'UNAVAILABLE' ? '일지는 저장됐어요. 친구 진행을 확인하지 못했어요.'
          : '친구 진행은 방에서 확인할 수 있어요.'
  const retry = async () => {
    setRetrying(true)
    await retryPetJournalSave(ticket.owner)
    if (alive.current) { setRetrying(false); refresh() }
  }
  return <>
    <div className="journal-save-friends" aria-label="일지와 친구들">
      <p aria-live="polite">{summary}</p>
      <div className="journal-save-friends__actions">
        {error && <button type="button" disabled={retrying} onClick={() => { void retry() }}>{retrying ? '친구 진행 확인 중' : '친구 진행 다시 확인'}</button>}
        <button type="button" onClick={() => setOpened(true)}>{canMeet ? '친구 만나기' : '우리 집 친구들'}<ChevronRight size={16} aria-hidden="true" /></button>
      </div>
      {error && <details><summary>친구 진행 안내</summary><p>{error}</p></details>}
    </div>
    {opened && createPortal(<React.Suspense fallback={<p role="status">친구 방을 여는 중이에요.</p>}>
      <SleepInnEntry date={journal.date} sourceJournal={{ entryId: journal.id }} startWithJournalMeeting={canMeet} onBack={() => { setOpened(false); refresh() }} returnLabel="저장 완료로 돌아가기" />
    </React.Suspense>, document.body)}
  </>
}
