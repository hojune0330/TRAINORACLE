import { isPuzzleContext, isSolved, isValidLayout, type Piece } from './engine'

/** This boundary deliberately does not accept journal, account, name, or timestamp fields. */
export interface ShareableRoom {
  chapter: 1 | 2 | 3 | 4 | 5
  layout: readonly Piece[]
  lampMode: 'soft' | 'hooded'
  lampDirection: 'north' | 'east' | 'south' | 'west'
  stoneMode: 'small' | 'long'
}
export const STAMPS = {
  cozy: '포근한 방이네요',
  clever: '자리 배치가 멋져요',
  welcome: '초대해 줘서 고마워요',
} as const
export type VisitStamp = keyof typeof STAMPS
export type InnInvitation = { version: 1; kind: 'visit'; room: ShareableRoom }
  | { version: 1; kind: 'reply'; room: ShareableRoom; stamp: VisitStamp }
export type InvitationResult = { ok: true; invitation: InnInvitation; code: string }
  | { ok: false; message: string }
export const MAX_INVITATION_LENGTH = 2_048
const MAX_INPUT_LENGTH = 4_096
const ROOM_KEYS = ['chapter', 'layout', 'lampMode', 'lampDirection', 'stoneMode']
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

/** Always construct a new whitelist object; never spread a completed postcard or journal. */
export function projectShareableRoom(value: unknown): ShareableRoom | null {
  if (!object(value) || !isPuzzleContext(value) || !Array.isArray(value.layout)) return null
  const room: ShareableRoom = {
    chapter: value.chapter as ShareableRoom['chapter'], layout: [...value.layout],
    lampMode: value.lampMode as ShareableRoom['lampMode'], lampDirection: value.lampDirection as ShareableRoom['lampDirection'],
    stoneMode: value.stoneMode as ShareableRoom['stoneMode'],
  }
  if (!isValidLayout(room.layout, room) || !isSolved([...room.layout], room)) return null
  return room
}

// Accidental corruption check only. This is not a signature or sender authentication.
function checksum(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, '0')
}
export function encodeInvitation(source: unknown, stamp?: VisitStamp): string | null {
  const room = projectShareableRoom(source)
  if (!room || stamp !== undefined && !Object.hasOwn(STAMPS, stamp)) return null
  const invitation: InnInvitation = stamp === undefined ? { version: 1, kind: 'visit', room } : { version: 1, kind: 'reply', room, stamp }
  const json = JSON.stringify(invitation)
  const body = btoa(json).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  return `INN1.${body}.${checksum(json)}`
}

function invitationCode(input: string): string | null {
  const text = input.trim()
  if (text.startsWith('INN')) return text.length <= MAX_INVITATION_LENGTH ? text : null
  if (text.startsWith('#')) {
    const params = new URLSearchParams(text.slice(1))
    return params.size === 1 && params.getAll('sleep-inn').length === 1 ? params.get('sleep-inn') : null
  }
  try {
    const url = new URL(text)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    return invitationCode(url.hash)
  } catch { return null }
}

export function decodeInvitation(input: string): InvitationResult {
  const fail = (): InvitationResult => ({ ok: false, message: '이 초대장을 읽을 수 없어요. 전체 링크나 INN1.로 시작하는 코드를 다시 받아 주세요.' })
  if (typeof input !== 'string' || input.length > MAX_INPUT_LENGTH) return fail()
  const code = invitationCode(input)
  if (!code || code.length > MAX_INVITATION_LENGTH) return fail()
  const match = /^INN1\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(code)
  if (!match) return fail()
  try {
    const json = atob(match[1]!.replaceAll('-', '+').replaceAll('_', '/'))
    if (checksum(json) !== match[2]) return fail()
    const raw: unknown = JSON.parse(json)
    if (!object(raw) || raw.version !== 1 || !['visit', 'reply'].includes(raw.kind as string)
      || !exactKeys(raw, raw.kind === 'visit' ? ['version', 'kind', 'room'] : ['version', 'kind', 'room', 'stamp'])
      || !object(raw.room) || !exactKeys(raw.room, ROOM_KEYS)) return fail()
    const room = projectShareableRoom(raw.room)
    if (!room || raw.kind === 'reply' && (typeof raw.stamp !== 'string' || !Object.hasOwn(STAMPS, raw.stamp))) return fail()
    const stamp = raw.kind === 'reply' ? raw.stamp as VisitStamp : undefined
    // A single canonical wire format excludes hidden/duplicate fields and alternate encodings.
    if (encodeInvitation(room, stamp) !== code) return fail()
    const invitation: InnInvitation = stamp === undefined ? { version: 1, kind: 'visit', room } : { version: 1, kind: 'reply', room, stamp }
    return { ok: true, invitation, code }
  } catch { return fail() }
}

export function hasSleepInnInviteFragment(fragment = window.location.hash): boolean {
  return new URLSearchParams(fragment.replace(/^#/, '')).has('sleep-inn')
}

/** Preserve deployment subpath, remove unrelated route/private query data, keep payload in fragment. */
export function invitationLink(code: string, base = window.location.href): string | null {
  if (!decodeInvitation(code).ok) return null
  try {
    const url = new URL(base)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    url.search = '?app=1&games=lounge'
    url.hash = new URLSearchParams({ 'sleep-inn': code }).toString()
    return url.href
  } catch { return null }
}

export function isLocalInvitationLink(link: string): boolean {
  try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(link).hostname) } catch { return true }
}
