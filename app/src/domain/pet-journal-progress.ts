import { activeLocalAccount, localJournalScopeGeneration } from './account/local-journal-ownership'
import { careDay, confirmJournalDay, journalFriendCredits, loadHome, parseHome, petHomeKey, persistHome, type HomeStorage } from '../screens/pet-room/pet-engine'
import { withPetHomeWrite } from './pet-home-lock'
import { PET_IDS } from '../screens/pet-room/pet-catalog'

export const PET_JOURNAL_EVENT = 'trainoracle:pet-journal-progress'
export type PetJournalScope = { readonly owner: string; readonly generation: number }
type ConfirmedDay = { readonly date: string; readonly kind: string }
type PendingDay = { ref: ConfirmedDay; ticket: PetJournalScope; error: string }
/** Navigation metadata from an acknowledged journal save, never reward evidence. */
export type SavedPetJournalRef = { readonly id: string; readonly date: string; readonly kind: string }
export type PetJournalProgressRead =
  | { readonly status: 'READY'; readonly days: number; readonly credits: number; readonly canMeet: boolean; readonly recordedToday: boolean }
  | { readonly status: 'MISSING' | 'UNAVAILABLE' | 'STALE' }
// Only failed, already-confirmed receipts live here. They contain no entry ID,
// journal text or health field. They cannot survive an application reload.
const pending = new Map<string, PendingDay>()
export const capturePetJournalScope = (): PetJournalScope => ({ owner: activeLocalAccount() ?? 'guest', generation: localJournalScopeGeneration() })
const currentScope = (ticket: PetJournalScope) => ticket.owner === (activeLocalAccount() ?? 'guest') && ticket.generation === localJournalScopeGeneration()
const announce = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(PET_JOURNAL_EVENT)) }

/** Read-only completion UI projection. It must not initialize/migrate a home,
 * reconcile old/global counters, or grant a day just because a reader opened. */
export function readPetJournalProgress(ticket: PetJournalScope, options: { storage?: Pick<HomeStorage, 'getItem'>; today?: string } = {}): PetJournalProgressRead {
  if (!currentScope(ticket)) return { status: 'STALE' }
  try {
    const raw = (options.storage ?? window.localStorage).getItem(petHomeKey(ticket.owner))
    if (raw === null) return { status: 'MISSING' }
    const home = parseHome(raw)
    const today = options.today ?? careDay()
    if (!home || home.scope !== ticket.owner || home.day > today || home.journal.days.some(day => day > today)) return { status: 'UNAVAILABLE' }
    if (!currentScope(ticket)) return { status: 'STALE' }
    const credits = journalFriendCredits(home)
    return { status: 'READY', days: home.journal.days.length, credits, canMeet: credits > 0 && !home.sleeping && !home.morning && PET_IDS.some(id => !home.pets[id]?.adoptedOn), recordedToday: home.journal.days.includes(today) }
  } catch { return { status: 'UNAVAILABLE' } }
}
export const pendingPetJournalError = (scope: string) => {
  const receipt = pending.get(scope)
  if (!receipt) return null
  if (!currentScope(receipt.ticket) || receipt.ref.date !== careDay()) { pending.delete(scope); return null }
  return receipt.error
}

/** Invoke only from the confirmed-save continuation, with a ticket captured
 * before that continuation. This grants local game progress, never server points. */
function recordWithinLease(ref: ConfirmedDay, ticket: PetJournalScope, options: { storage?: HomeStorage; today?: string } = {}): 'RECORDED' | 'UNCHANGED' | 'STALE' | 'UNAVAILABLE' {
  if (!currentScope(ticket)) return 'STALE'
  const today = options.today ?? careDay()
  if (ref.date !== today || !['post-session', 'evening', 'race'].includes(ref.kind)) return 'UNCHANGED'
  try {
    const storage = options.storage ?? window.localStorage
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1
    const loaded = loadHome(storage, ticket.owner, today, seed)
    if (loaded.error) throw new Error(loaded.error)
    const next = confirmJournalDay(loaded.home, ref, today)
    if (!currentScope(ticket)) return 'STALE'
    if (next === loaded.home) { pending.delete(ticket.owner); return 'UNCHANGED' }
    const result = persistHome(storage, ticket.owner, next, loaded.raw)
    if (!result.ok) throw new Error(result.error)
    pending.delete(ticket.owner)
    announce()
    return 'RECORDED'
  } catch {
    pending.set(ticket.owner, { ref: { date: ref.date, kind: ref.kind }, ticket, error: '일지는 저장됐지만 친구 만나기 날짜를 반영하지 못했어요. 아래에서 다시 시도해 주세요. 앱을 새로 열었다면 오늘 같은 일지를 다시 저장해 주세요.' })
    announce()
    return 'UNAVAILABLE'
  }
}

export async function recordConfirmedPetJournalSave(ref: ConfirmedDay, ticket: PetJournalScope, options: { storage?: HomeStorage; today?: string } = {}) {
  if (!currentScope(ticket)) return 'STALE' as const
  const today = options.today ?? careDay()
  if (ref.date !== today || !['post-session', 'evening', 'race'].includes(ref.kind)) return 'UNCHANGED' as const
  try { return await withPetHomeWrite(ticket.owner, () => recordWithinLease(ref, ticket, { ...options, today })) }
  catch {
    if (!currentScope(ticket)) return 'STALE' as const
    pending.set(ticket.owner, { ref: { date: ref.date, kind: ref.kind }, ticket, error: '일지는 저장됐지만 친구 만나기 날짜를 반영하지 못했어요. 다른 창의 친구 방을 닫고 다시 시도해 주세요. 앱을 새로 열었다면 오늘 같은 일지를 다시 저장해 주세요.' })
    announce()
    return 'UNAVAILABLE' as const
  }
}

/** Explicit retry only; opening a game or calendar cannot grant a journal day. */
export async function retryPetJournalSave(scope: string): Promise<boolean> {
  const receipt = pending.get(scope)
  if (!receipt || !currentScope(receipt.ticket) || receipt.ref.date !== careDay()) { pending.delete(scope); return false }
  const result = await recordConfirmedPetJournalSave(receipt.ref, receipt.ticket)
  return result === 'RECORDED' || result === 'UNCHANGED'
}
