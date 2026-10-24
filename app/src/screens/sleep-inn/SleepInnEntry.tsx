import React from 'react'
import { entriesForDate, loadEntries, loadEntriesForPlanSafety, todayISO, type EveningEntry, type JournalEntry } from '../../domain/journal-store'
import { activeLocalAccount, localJournalScopeGeneration, onLocalJournalScopeChange } from '../../domain/account/local-journal-ownership'
import { readAccountJournalPrivateEntry } from '../../domain/account/account-journal-projection'
import { canEditJournalEntry } from '../../domain/journal-edit-policy'
import { LOCAL_JOURNALS_CHANGED } from '../../domain/journal-change-events'
import { registerBrowserBackLayer } from '../../navigation/browserNavigation'
import { LogEntry } from '../LogEntry'
import { SleepInnGame } from './SleepInnGame'
import { PetRoom } from '../pet-room/PetRoom'
import { PETS } from '../pet-room/pet-catalog'
import { selectSleepJournal, sleepJournalChoices, sleepJournalProjection } from './sleep-inn-journal'
import type { SleepInnJournalContext } from './types'
import { hasSleepInnInviteFragment } from './social'

const SavedLogDetail = React.lazy(() => import('../LogDetail').then(module => ({ default: module.LogDetail })))

export interface SleepInnEntryProps {
  readonly date: string
  readonly entryId?: string | undefined
  readonly draft?: SleepInnJournalContext | undefined
  /** Read the originating saved journal without replacing its completion/form. */
  readonly sourceJournal?: { readonly entryId?: string | undefined } | undefined
  readonly startWithJournalMeeting?: boolean | undefined
  readonly onBack: () => void
  readonly returnLabel?: string | undefined
  readonly onJournalSaved?: ((entry: JournalEntry) => void) | undefined
}

const dialogStyle: React.CSSProperties = { width: 'min(100%, 960px)', maxWidth: '100vw', height: '100dvh', maxHeight: '100dvh',
  margin: 'auto', padding: 0, border: 0, background: 'var(--paper)', color: 'var(--ink)', overflowY: 'auto' }

/** This modal owns navigation only. The journal remains the sole owner of sleep writes. */
export function SleepInnEntry(props: SleepInnEntryProps) {
  const [scope] = React.useState(localJournalScopeGeneration)
  const [changed, setChanged] = React.useState(false)
  React.useLayoutEffect(() => onLocalJournalScopeChange(() => setChanged(true)), [])
  // Never carry a previous account's journal or game state into the next scope.
  if (changed || scope !== localJournalScopeGeneration()) return <ScopeChanged onBack={props.onBack} />
  return <SleepInnEntryScoped {...props} />
}

function ScopeChanged({ onBack }: { onBack: () => void }) {
  React.useEffect(() => onBack(), [onBack])
  return null
}

/** Share the lounge/form Back stack rather than layering an independent reader history listener. */
function useSleepInnDialog(dialog: React.RefObject<HTMLDialogElement | null>, onBack: () => void, canExit: React.MutableRefObject<(() => boolean) | null>) {
  const id = React.useId()
  const onBackRef = React.useRef(onBack)
  onBackRef.current = onBack
  const layerRef = React.useRef<ReturnType<typeof registerBrowserBackLayer> | null>(null)
  React.useLayoutEffect(() => {
    const element = dialog.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const region = opener?.closest<HTMLElement>('.app-scroll-region, .plan-day-reader__body')
    const top = region?.scrollTop ?? 0
    const overflow = document.body.style.overflow
    const layer = registerBrowserBackLayer({ id: `sleep-inn-${id}`, canClose: () => canExit.current?.() ?? true, onClose: () => onBackRef.current() })
    layerRef.current = layer
    document.body.style.overflow = 'hidden'
    element?.showModal()
    return () => {
      layerRef.current = null
      layer.dispose()
      if (element?.open) element.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
      if (region?.isConnected) region.scrollTop = top
    }
  }, [dialog, id, canExit])
  return React.useCallback(() => layerRef.current?.close(), [])
}

function SleepInnEntryScoped({ date, entryId, draft, sourceJournal, startWithJournalMeeting, onBack, returnLabel = '일지로 돌아가기', onJournalSaved }: SleepInnEntryProps) {
  const [fromOldInvite] = React.useState(hasSleepInnInviteFragment)
  const [oldGame, setOldGame] = React.useState(hasSleepInnInviteFragment)
  const dialog = React.useRef<HTMLDialogElement>(null)
  const editorExit = React.useRef<(() => void) | null>(null)
  const readerExit = React.useRef<(() => void) | null>(null)
  const gameReturn = React.useRef<{ focus: HTMLElement | null; scrollTop: number } | null>(null)
  const restoringGame = React.useRef(false)
  const gameCanExit = React.useRef<(() => boolean) | null>(null)
  const registerGameCanExit = React.useCallback((callback: (() => boolean) | null) => { gameCanExit.current = callback }, [])
  // undefined permits the initial single-record choice; null is an explicit disconnect.
  const [selectedId, setSelectedId] = React.useState<string | null | undefined>(entryId)
  const [revision, refresh] = React.useReducer(value => value + 1, 0)
  const [editing, setEditing] = React.useState<{ entry?: EveningEntry } | null>(null)
  const [reading, setReading] = React.useState(false)
  const [receipt, setReceipt] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const close = useSleepInnDialog(dialog, onBack, gameCanExit)
  React.useLayoutEffect(() => {
    if (editing !== null || reading || !restoringGame.current) return
    restoringGame.current = false
    const frame = window.requestAnimationFrame(() => {
      const target = gameReturn.current
      if (!target || !dialog.current?.isConnected) return
      if (target.focus?.isConnected) target.focus.focus({ preventScroll: true })
      dialog.current.scrollTop = target.scrollTop
      gameReturn.current = null
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editing, reading])
  React.useEffect(() => {
    const update = () => refresh()
    window.addEventListener(LOCAL_JOURNALS_CHANGED, update)
    window.addEventListener('trainoracle:account-journals-changed', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(LOCAL_JOURNALS_CHANGED, update)
      window.removeEventListener('trainoracle:account-journals-changed', update)
      window.removeEventListener('storage', update)
    }
  }, [])
  const snapshot = React.useMemo(() => {
    // A saved-reader shortcut carries navigation metadata only. Do not infer a
    // different same-day sleep record or read body fields for this connection.
    if (sourceJournal) return { available: true, entries: [] }
    const read = loadEntriesForPlanSafety()
    return { available: read.status === 'complete', entries: sleepJournalChoices(read.status === 'complete' ? read.entries : [], date) }
  }, [date, revision, sourceJournal])
  const disconnected = selectedId === null
  const selected = disconnected ? undefined : selectSleepJournal(snapshot.entries, selectedId)
  const requiresSelection = !selected && (snapshot.entries.length > 1 || disconnected && snapshot.entries.length > 0)
  const selectedMissing = typeof selectedId === 'string' && selected === undefined
  const context = draft ?? (disconnected && snapshot.available
    ? { date, status: 'missing' as const, sourceLabel: '일지 연결 안 함' }
    : sleepJournalProjection(date, selected, snapshot.available && !selectedMissing))
  const openJournal = () => {
    if (sourceJournal) {
      gameReturn.current = { focus: document.activeElement instanceof HTMLElement ? document.activeElement : null, scrollTop: dialog.current?.scrollTop ?? 0 }
      setReading(true); return
    }
    if (draft) { close(); return }
    if (!snapshot.available || selectedMissing) { setNotice('일지를 다시 확인한 뒤 열어 주세요.'); return }
    if (requiresSelection) { setNotice('먼저 연결할 일지를 골라 주세요.'); return }
    // Reread the exact entry at the moment editing begins, preserving private memo semantics.
    const current = selected ? readAccountJournalPrivateEntry(selected.id) ?? loadEntries().find(entry => entry.id === selected.id) : undefined
    if (selected && (!current || current.kind !== 'evening' || current.date !== date
      || current.memoPurpose === 'PRIVATE_SELF_ONLY' && current.note === ''
      || !canEditJournalEntry(readAccountJournalPrivateEntry(current.id) ? { ...current, syncState: 'local' } : current))) {
      setNotice('이 일지는 여기서 수정할 수 없어요. 일지에서 확인해 주세요.'); return
    }
    gameReturn.current = { focus: document.activeElement instanceof HTMLElement ? document.activeElement : null, scrollTop: dialog.current?.scrollTop ?? 0 }
    setNotice(null); setReceipt(null)
    setEditing(current?.kind === 'evening' ? { entry: current } : {})
  }
  const returnFromEditor = () => { restoringGame.current = true; setEditing(null); refresh() }
  const returnFromReader = () => { restoringGame.current = true; setReading(false) }
  return <dialog ref={dialog} aria-label={oldGame ? '꿈손님 여관' : '우리 집 친구들'} style={dialogStyle}
    onCancel={event => { event.preventDefault(); if (reading) readerExit.current?.(); else if (editing) editorExit.current?.(); else close() }}>
    <div hidden={editing !== null || reading}>
      {!draft && !sourceJournal && (snapshot.entries.length > 1 || selectedMissing || disconnected) && <section style={{ padding: 'var(--space-4)' }} aria-label="연결할 일지 선택">
        {selectedMissing && <p role="status">연결했던 일지를 찾을 수 없어요. 다른 기록을 고르거나 연결을 해제해 주세요.</p>}
        <label htmlFor="sleep-inn-journal-choice">{date}의 컨디션 기록</label>
        <select id="sleep-inn-journal-choice" value={selected?.id ?? ''} style={{ display: 'block', minHeight: 44, width: '100%' }}
          onChange={event => { setSelectedId(event.target.value || null); setNotice(null) }}>
          <option value="">연결할 일지를 골라 주세요</option>
          {snapshot.entries.map((entry, index) => <option key={`${entry.id}-${index}`} value={entry.id}>
            {index + 1}번째 기록 · {entry.sleepH > 0 ? `${entry.sleepH}시간` : '시간 미입력'} · {new Date(entry.savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </option>)}
        </select>
        {selectedMissing && <button type="button" className="quick-log__secondary" style={{ minHeight: 44 }} onClick={() => { setSelectedId(null); setNotice(null) }}>기록 연결 해제</button>}
      </section>}
      {receipt && <p role="status" style={{ padding: 'var(--space-4)' }}>{receipt}</p>}
      {notice && <p role="alert" style={{ padding: 'var(--space-4)' }}>{notice}</p>}
      {oldGame ? <SleepInnGame journal={context} persistenceScope={activeLocalAccount() ?? 'guest'} onBack={fromOldInvite ? close : () => setOldGame(false)}
        onOpenJournal={openJournal} returnLabel={fromOldInvite ? returnLabel : '우리 방으로 돌아가기'} onCanExitReady={registerGameCanExit} />
        : <PetRoom journal={context} persistenceScope={activeLocalAccount() ?? 'guest'} onBack={close}
          onOpenJournal={openJournal} journalLinkLabel={sourceJournal ? sourceJournal.entryId ? '저장한 일지 보기' : '이날 일지 보기' : undefined} startWithJournalMeeting={startWithJournalMeeting} returnLabel={returnLabel} onCanExitReady={registerGameCanExit} onOldGame={() => setOldGame(true)} />}
    </div>
    {reading && sourceJournal && <PetSourceJournalReader date={date} entryId={sourceJournal.entryId} onBack={returnFromReader} exitRef={readerExit} />}
    {editing !== null && <LogEntry entryType="evening" targetDate={date} initialEntry={editing.entry}
      initialSection="sleep" embedded onNavigationReady={exit => { editorExit.current = exit }}
      onBack={returnFromEditor} onExit={returnFromEditor}
      onDone={(_kind, saved, reviewMessage, storageMessage) => {
        if (!saved || saved.kind !== 'evening' || saved.date !== date) return
        setSelectedId(saved.id); setReceipt([storageMessage ?? '이 기기에 일지를 저장했어요.', reviewMessage].filter(Boolean).join(' '))
        onJournalSaved?.(saved); returnFromEditor()
      }} />}
  </dialog>
}

/** Reuse the existing reader and Back-layer contract inside the same dialog.
 * Reading never submits the underlying form or grants another journal day. */
function PetSourceJournalReader({ date, entryId, onBack, exitRef }: {
  readonly date: string; readonly entryId?: string | undefined; readonly onBack: () => void
  readonly exitRef: React.MutableRefObject<(() => void) | null>
}) {
  const id = React.useId()
  const backRef = React.useRef<HTMLButtonElement>(null)
  const onBackRef = React.useRef(onBack)
  onBackRef.current = onBack
  const layerRef = React.useRef<ReturnType<typeof registerBrowserBackLayer> | null>(null)
  const [revision, refresh] = React.useReducer(value => value + 1, 0)
  React.useEffect(() => {
    const update = () => refresh()
    window.addEventListener(LOCAL_JOURNALS_CHANGED, update)
    window.addEventListener('trainoracle:account-journals-changed', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(LOCAL_JOURNALS_CHANGED, update)
      window.removeEventListener('trainoracle:account-journals-changed', update)
      window.removeEventListener('storage', update)
    }
  }, [])
  // Identity-only guard: a missing exact record must not silently show another
  // same-day entry. Actual private rendering stays in the established reader.
  const source = React.useMemo(() => entryId ? entriesForDate(date).find(entry => entry.id === entryId) : undefined, [date, entryId, revision])
  React.useLayoutEffect(() => {
    const layer = registerBrowserBackLayer({ id: `pet-source-journal-${id}`, canClose: () => true, onClose: () => onBackRef.current() })
    layerRef.current = layer; exitRef.current = layer.close
    // This explicit navigation starts at its return control once. The reader
    // does not schedule later entry alignment over the user's reading/scroll.
    const dialog = backRef.current?.closest('dialog')
    if (dialog) dialog.scrollTop = 0
    backRef.current?.focus({ preventScroll: true })
    return () => { exitRef.current = null; layerRef.current = null; layer.dispose() }
  }, [id, exitRef])
  return <section aria-label={entryId ? '저장한 일지' : '이날 일지'} style={{ minHeight: '100%', padding: 'var(--space-4)' }}>
    <button ref={backRef} type="button" className="quick-log__secondary" style={{ minHeight: 44 }} onClick={() => layerRef.current?.close()}>친구 방으로 돌아가기</button>
    <React.Suspense fallback={<p role="status">일지를 여는 중이에요.</p>}>
      {entryId && !source ? <p role="status">저장한 일지를 지금 찾을 수 없어요. 친구 방으로 돌아가 일지에서 다시 확인해 주세요.</p>
        : <SavedLogDetail date={date} initialEntryId={entryId} entries={source ? [source] : undefined} alignInitialEntry={false} readOnly readerControls={null} />}
    </React.Suspense>
  </section>
}

/** Mount-time date selection: midnight never silently moves an already opened game. */
export function SleepInnLoungeEntry({ onJournalSaved, initialOpen = false, onOpened, onVisibilityChange }: {
  onJournalSaved?: ((entry: JournalEntry) => void) | undefined
  initialOpen?: boolean
  onOpened?: (() => void) | undefined
  onVisibilityChange?: ((visible: boolean) => void) | undefined
}) {
  const [date, setDate] = React.useState<string | null>(() => hasSleepInnInviteFragment() || initialOpen ? todayISO() : null)
  React.useLayoutEffect(() => {
    onVisibilityChange?.(date !== null)
    return () => onVisibilityChange?.(false)
  }, [date, onVisibilityChange])
  React.useEffect(() => { if (date) onOpened?.() }, [date, onOpened])
  return <>
    <button type="button" className="game-lounge__game" onClick={() => setDate(todayISO())}>
      <span className="game-lounge-art" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}games/pet-room-v1/room.webp`} alt="" draggable={false} /></span>
      <span className="game-lounge__game-copy"><strong>우리 집 친구들</strong><span>놀러 온 동물을 돌보고, 함께 자요</span><small>{PETS.length}명의 친구 · 일지와 돌봄으로 입양</small></span>
    </button>
    {date && <SleepInnEntry date={date} onBack={() => setDate(null)} onJournalSaved={onJournalSaved} returnLabel="다른 게임 보기" />}
  </>
}
