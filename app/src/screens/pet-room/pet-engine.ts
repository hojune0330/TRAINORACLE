import { z } from 'zod'
import { CARE_ACTIONS, LEGACY_PET_IDS, PET_IDS, petById, type CareAction, type PetId } from './pet-catalog'

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
})
const daysSchema = z.array(daySchema).max(36600).refine(days => new Set(days).size === days.length)
const petSchema = z.object({
  metOn: daySchema, caredDays: daysSchema,
  actions: z.object({ pet: daysSchema, feed: daysSchema, play: daysSchema, bed: daysSchema }).strict(),
  adoptedOn: daySchema.nullable(),
}).strict()
const legacySchema = z.object({
  version: z.literal(1), revision: z.number().int().nonnegative(), seed: z.number().int().min(1).max(0xffffffff),
  day: daySchema, visitors: z.array(z.enum(LEGACY_PET_IDS)).max(3).refine(ids => new Set(ids).size === ids.length),
  invited: z.enum(LEGACY_PET_IDS).nullable(), selected: z.enum(LEGACY_PET_IDS),
  pets: z.partialRecord(z.enum(LEGACY_PET_IDS), petSchema),
  sleeping: z.object({ day: daySchema, pets: z.array(z.enum(LEGACY_PET_IDS)).min(1).max(12) }).strict().nullable(),
  // Optional on disk for homes saved before the morning handoff was added.
  morning: z.object({ day: daySchema, bedDay: daySchema, pets: z.array(z.enum(LEGACY_PET_IDS)).min(1).max(12) }).strict().nullable().default(null),
}).strict()
const schema = legacySchema.extend({
  version: z.literal(2), scope: z.string().min(1).max(256),
  visitors: z.array(z.enum(PET_IDS)).max(3).refine(ids => new Set(ids).size === ids.length),
  invited: z.enum(PET_IDS).nullable(), selected: z.enum(PET_IDS),
  pets: z.partialRecord(z.enum(PET_IDS), petSchema),
  sleeping: z.object({ day: daySchema, pets: z.array(z.enum(PET_IDS)).min(1).max(PET_IDS.length) }).strict().nullable(),
  morning: z.object({ day: daySchema, bedDay: daySchema, pets: z.array(z.enum(PET_IDS)).min(1).max(PET_IDS.length) }).strict().nullable().default(null),
  journal: z.object({ days: daysSchema, claimed: z.number().int().nonnegative(), pending: z.object({ ordinal: z.number().int().positive(), id: z.enum(PET_IDS) }).strict().nullable() }).strict(),
}).strict()
export type PetHome = z.infer<typeof schema>
export type PetBond = z.infer<typeof petSchema>
export const careDay = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
export const legacyPetHomeKey = (scope: string) => `trainoracle:pet-home:v1:${encodeURIComponent(scope)}`
export const petHomeKey = (scope: string) => `trainoracle:pet-home:v2:${encodeURIComponent(scope)}`
const freshBond = (day: string): PetBond => ({ metOn: day, caredDays: [], actions: { pet: [], feed: [], play: [], bed: [] }, adoptedOn: null })

function hash(value: string) {
  let n = 2166136261
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619)
  return n >>> 0
}
/** A seed saved once per home. Reloading never buys another draw. No paid rarity. */
function visitorsFor(home: PetHome, day: string): PetId[] {
  return PET_IDS.filter(id => !home.pets[id]?.adoptedOn)
    .map(id => ({ id, seen: !!home.pets[id], rank: hash(`${home.seed}:${day}:${id}`) }))
    .sort((a, b) => Number(a.seen) - Number(b.seen) || a.rank - b.rank).slice(0, 3).map(item => item.id)
}
export function createHome(day: string, seed: number, scope = 'guest'): PetHome {
  daySchema.parse(day)
  const home: PetHome = { version: 2, scope, journal: { days: [], claimed: 0, pending: null }, revision: 0, seed: Math.max(1, seed >>> 0), day, visitors: [], invited: null, selected: 'otter', pets: {}, sleeping: null, morning: null }
  home.visitors = visitorsFor(home, day)
  home.selected = home.visitors[0]!
  for (const id of home.visitors) home.pets[id] = freshBond(day)
  return home
}
export function parseHome(raw: string): PetHome | null {
  try {
    const parsed = schema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const home = parsed.data
    const earned = Math.floor(home.journal.days.length / 7)
    if (home.journal.claimed > earned || home.journal.pending && (home.journal.pending.ordinal !== home.journal.claimed + 1 || earned <= home.journal.claimed || home.pets[home.journal.pending.id]?.adoptedOn)) return null
    if (!home.pets[home.selected] || home.visitors.some(id => !home.pets[id]) || home.invited && !home.pets[home.invited]
      || home.sleeping?.pets.some(id => !home.pets[id]) || home.morning?.pets.some(id => !home.pets[id])
      || home.sleeping && home.morning) return null
    const resting = home.sleeping ?? home.morning
    if (resting && (!resting.pets.includes(home.selected) || new Set(resting.pets).size !== resting.pets.length)) return null
    return home
  } catch { return null }
}
export function atHome(home: PetHome): PetId[] {
  return [...new Set([...PET_IDS.filter(id => home.pets[id]?.adoptedOn), ...home.visitors, ...(home.invited ? [home.invited] : [])])]
}
export function refreshVisitors(home: PetHome, day: string): PetHome {
  // Keep the same companions through bedtime AND their morning greeting.
  if (!daySchema.safeParse(day).success || day <= home.day || home.sleeping || home.morning) return home
  const visitors = visitorsFor(home, day)
  const pets = { ...home.pets }
  for (const id of visitors) pets[id] ??= freshBond(day)
  const next = { ...home, day, visitors, pets }
  if (!atHome(next).includes(next.selected)) next.selected = atHome(next)[0]!
  return next
}
export function canAdopt(home: PetHome, id: PetId): boolean {
  const bond = home.pets[id]
  return !!bond && !bond.adoptedOn && (bond.caredDays.length >= 30
    || petById(id).missions.every(mission => bond.actions[mission.action].length >= mission.days))
}
const appendDay = (days: string[], day: string) => days.includes(day) ? days : [...days, day]
export function careFor(home: PetHome, id: PetId, action: CareAction, day: string): PetHome {
  if (!daySchema.safeParse(day).success || day < home.day || home.sleeping || home.morning || !atHome(home).includes(id) || !CARE_ACTIONS.includes(action)) return home
  const bond = home.pets[id]
  if (!bond) return home
  const days = appendDay(bond.caredDays, day)
  const actions = appendDay(bond.actions[action], day)
  if (days === bond.caredDays && actions === bond.actions[action]) return home
  return { ...home, pets: { ...home.pets, [id]: { ...bond, caredDays: days, actions: { ...bond.actions, [action]: actions } } } }
}
export function invitePet(home: PetHome, id: PetId): PetHome {
  if (home.sleeping || home.morning || !home.pets[id]) return home
  return { ...home, invited: home.pets[id]?.adoptedOn || home.visitors.includes(id) ? home.invited : id, selected: id }
}
export function adoptPet(home: PetHome, id: PetId, day: string): PetHome {
  if (!daySchema.safeParse(day).success || day < home.day || home.sleeping || home.morning || !canAdopt(home, id)) return home
  return { ...home, selected: id, journal: { ...home.journal, pending: home.journal.pending?.id === id ? null : home.journal.pending }, pets: { ...home.pets, [id]: { ...home.pets[id]!, adoptedOn: day } } }
}
export const journalFriendCredits = (home: PetHome) => Math.floor(home.journal.days.length / 7) - home.journal.claimed
/** Confirmed current-day saves only. Rest, evening, race and pain checks are equal;
 * no text, health values, volume or streak is accepted by this boundary. */
export function confirmJournalDay(home: PetHome, ref: { date: string; kind: string }, today: string): PetHome {
  if (!['post-session', 'evening', 'race'].includes(ref.kind) || !daySchema.safeParse(today).success || ref.date !== today || today < home.day || home.journal.days.some(day => day > today) || home.journal.days.includes(today)) return home
  return { ...home, journal: { ...home.journal, days: [...home.journal.days, today] } }
}
/** One saved proposal for the next opportunity; switching modes never rerolls it. */
export function proposeJournalFriend(home: PetHome): PetHome {
  if (journalFriendCredits(home) < 1 || home.sleeping || home.morning || home.journal.pending) return home
  const candidates = PET_IDS.filter(id => !home.pets[id]?.adoptedOn)
  const ordinal = home.journal.claimed + 1
  const id = candidates.map(id => ({ id, rank: hash(`${home.seed}:journal:${ordinal}:${id}`) })).sort((a, b) => a.rank - b.rank)[0]?.id
  return id ? { ...home, journal: { ...home.journal, pending: { ordinal, id } } } : home
}
/** Ownership and credit are persisted together by persistHome, after explicit confirmation. */
export function adoptJournalFriend(home: PetHome, id: PetId, day: string): PetHome {
  if (journalFriendCredits(home) < 1 || !PET_IDS.includes(id) || home.pets[id]?.adoptedOn || home.sleeping || home.morning || !daySchema.safeParse(day).success || day < home.day || home.journal.days.some(savedDay => savedDay > day)) return home
  const bond = home.pets[id] ?? freshBond(day)
  return { ...home, selected: id, journal: { ...home.journal, claimed: home.journal.claimed + 1, pending: null }, pets: { ...home.pets, [id]: { ...bond, adoptedOn: day } } }
}
export function sleepTogether(home: PetHome, day: string): PetHome {
  if (home.sleeping || home.morning || !daySchema.safeParse(day).success || day < home.day) return home
  const ids = atHome(home)
  let next = home
  for (const id of ids) next = careFor(next, id, 'bed', day)
  return { ...next, sleeping: { day, pets: ids } }
}
export function wakeTogether(home: PetHome, day: string): PetHome {
  if (!home.sleeping || !daySchema.safeParse(day).success || day < home.sleeping.day) return home
  return { ...home, sleeping: null, morning: { day, bedDay: home.sleeping.day, pets: home.sleeping.pets } }
}
/** Greeting is not a sleep measurement or a care reward. The chosen friend stays. */
export function finishMorning(home: PetHome, day: string): PetHome {
  if (!home.morning || !daySchema.safeParse(day).success || day < home.morning.day) return home
  const companion = home.selected
  const next = refreshVisitors({ ...home, morning: null }, day)
  return invitePet(next, companion)
}
/** Returning to bed reuses the existing preparation, with no extra day or mission credit. */
export function restAgain(home: PetHome): PetHome {
  if (!home.morning) return home
  return { ...home, morning: null, sleeping: { day: home.morning.bedDay, pets: home.morning.pets } }
}
export type HomeStorage = Pick<Storage, 'getItem' | 'setItem'>
export type HomeLoad = { home: PetHome; raw: string | null; error: string | null }
export function loadHome(storage: HomeStorage, scope: string, day: string, seed: number): HomeLoad {
  const fallback = createHome(day, seed, scope)
  try {
    const raw = storage.getItem(petHomeKey(scope))
    if (raw === null) {
      const legacyRaw = storage.getItem(legacyPetHomeKey(scope))
      if (legacyRaw === null) return { home: fallback, raw: null, error: null }
      const legacy = legacySchema.safeParse(JSON.parse(legacyRaw))
      const migrated = legacy.success ? { ...legacy.data, version: 2, scope, journal: { days: [], claimed: 0, pending: null } } : null
      const verified = migrated && parseHome(JSON.stringify(migrated))
      if (!verified) return { home: fallback, raw: null, error: '이전 펫 기록을 읽지 못했어요. 기존 기록은 그대로 두었어요.' }
      if (verified.day > day) return { home: verified, raw: null, error: '기기의 날짜가 펫 기록보다 이전이에요. 날짜를 확인한 뒤 다시 불러와 주세요.' }
      if (storage.getItem(petHomeKey(scope)) !== null || storage.getItem(legacyPetHomeKey(scope)) !== legacyRaw) return { home: verified, raw: null, error: '이전 펫 기록이 바뀌었어요. 다시 불러와 주세요.' }
      const nextRaw = JSON.stringify(verified)
      storage.setItem(petHomeKey(scope), nextRaw)
      if (storage.getItem(petHomeKey(scope)) !== nextRaw) return { home: verified, raw: null, error: '이전 펫 기록의 새 저장을 확인하지 못했어요. 다시 불러와 주세요.' }
      return { home: verified, raw: nextRaw, error: null }
    }
    const home = parseHome(raw)
    if (home?.scope === scope && (home.day > day || home.journal.days.some(savedDay => savedDay > day))) return { home, raw, error: '기기의 날짜가 펫 기록보다 이전이에요. 날짜를 확인한 뒤 다시 불러와 주세요.' }
    return home && home.scope === scope ? { home, raw, error: null } : { home: fallback, raw, error: '펫 기록을 읽지 못했어요. 저장된 기록은 그대로 두었어요.' }
  } catch { return { home: fallback, raw: null, error: '기기 저장을 열지 못했어요. 저장을 다시 시도해 주세요.' } }
}
/** Write first, show success second. A stale tab must not replace newer care/adoption. */
export function persistHome(storage: HomeStorage, scope: string, home: PetHome, expected: string | null):
  { ok: true; home: PetHome; raw: string } | { ok: false; error: string } {
  try {
    const current = storage.getItem(petHomeKey(scope))
    if (current !== expected) return { ok: false, error: '다른 창에서 펫 기록이 바뀌었어요. 최신 기록을 불러와 주세요.' }
    if (home.scope !== scope || current !== null && parseHome(current)?.scope !== scope) return { ok: false, error: '저장된 펫 기록을 확인하지 못했어요. 기존 기록은 그대로 두었어요.' }
    if (current === null && storage.getItem(legacyPetHomeKey(scope)) !== null) return { ok: false, error: '이전 펫 기록을 먼저 불러와 주세요.' }
    const next = { ...home, revision: home.revision + 1 }
    const raw = JSON.stringify(next)
    if (!parseHome(raw)) return { ok: false, error: '펫 기록을 확인하지 못해 저장하지 않았어요.' }
    storage.setItem(petHomeKey(scope), raw)
    if (storage.getItem(petHomeKey(scope)) !== raw) return { ok: false, error: '펫 기록의 저장을 확인하지 못했어요. 최신 기록을 다시 불러와 주세요.' }
    return { ok: true, home: next, raw }
  } catch { return { ok: false, error: '저장 공간을 확인해 주세요. 방금 한 행동은 저장되지 않았어요.' } }
}
