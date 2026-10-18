import { describe, expect, it } from 'vitest'
import { solveLayouts } from './engine'
import { decodeInvitation, encodeInvitation, hasSleepInnInviteFragment, invitationLink, MAX_INVITATION_LENGTH, projectShareableRoom, type ShareableRoom } from './social'

const room = (): ShareableRoom => ({ chapter: 1, layout: ['fox', 'screen', 'turtle', 'moth', 'lamp', 'stone'], lampMode: 'soft', lampDirection: 'north', stoneMode: 'small' })

// Recalculate corruption check to verify schema guards independently of that check.
function wire(value: unknown) {
  const json = JSON.stringify(value)
  let hash = 0x811c9dc5
  for (let i = 0; i < json.length; i++) hash = Math.imul(hash ^ json.charCodeAt(i), 0x01000193)
  return `INN1.${btoa(json).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}.${(hash >>> 0).toString(16).padStart(8, '0')}`
}

describe('sleep inn portable postcards', () => {
  it('round-trips the same completed room through two independent consumers, including a fixed stamp reply', () => {
    const sender = room()
    const code = encodeInvitation(sender)!
    const guest = decodeInvitation(code)
    expect(guest.ok).toBe(true)
    if (!guest.ok) throw new Error('valid invitation rejected')
    expect(guest.invitation.room).toEqual(sender)
    expect(guest.invitation.room).not.toBe(sender)
    const reply = decodeInvitation(encodeInvitation(guest.invitation.room, 'clever')!)
    expect(reply.ok && reply.invitation.kind === 'reply' && reply.invitation.stamp).toBe('clever')
    expect(reply.ok && reply.invitation.room).toEqual(sender)
    expect(sender.layout).toEqual(room().layout)
  })

  it('whitelists only game fields even when handed a full record with health, owner, date, and notes', () => {
    const privateSource = { ...room(), journeyId: 'journey-private', date: '2026-10-18', accountId: 'account-private', journalId: 'journal-private', sleepH: 7.5, sleepQuality: 3, note: 'private note', displayName: 'private name', nested: { journal: 'secret' } }
    const code = encodeInvitation(privateSource)!
    const raw = atob(code.split('.')[1]!.replaceAll('-', '+').replaceAll('_', '/'))
    expect(raw).not.toMatch(/private|date|accountId|journal|sleepH|sleepQuality|note|displayName|nested/)
    expect(Object.keys(JSON.parse(raw).room)).toEqual(['chapter', 'layout', 'lampMode', 'lampDirection', 'stoneMode'])
    expect(projectShareableRoom(privateSource)).toEqual(room())
  })

  it('rejects corruption, future versions, excessive input, invalid pieces and extra/private decoded fields', () => {
    const valid = { version: 1, kind: 'visit', room: room() }
    const code = encodeInvitation(room())!
    const failures = [
      code.replace(/.$/, code.endsWith('0') ? '1' : '0'), code.replace('INN1.', 'INN2.'),
      'INN1.' + 'a'.repeat(MAX_INVITATION_LENGTH), ' '.repeat(4097),
      wire({ ...valid, version: 2 }), wire({ ...valid, author: 'verified user' }),
      wire({ ...valid, room: { ...room(), sleepH: 8 } }),
      wire({ ...valid, room: { ...room(), layout: ['fox', 'screen', 'turtle', 'moth', 'lamp', '<script>'] } }),
      wire({ ...valid, room: { ...room(), layout: ['fox', 'fox', 'turtle', 'moth', 'lamp', 'stone'] } }),
      wire({ ...valid, room: { ...room(), chapter: 6 } }),
      wire({ ...valid, room: { ...room(), lampDirection: 'javascript:alert(1)' } }),
      wire({ ...valid, room: { ...room(), lampDirection: 'east' } }),
      wire({ version: 1, kind: 'reply', room: room(), stamp: '<img src=x onerror=alert(1)>' }),
      wire({ version: 1, kind: 'reply', room: room(), stamp: 'constructor' }),
    ]
    for (const invalid of failures) expect(decodeInvitation(invalid).ok, invalid.slice(0, 80)).toBe(false)
    expect(decodeInvitation(code).ok).toBe(true)
  })

  it('shares only valid completed layouts and never returns an arbitrary source property', () => {
    expect(encodeInvitation({ ...room(), layout: ['fox', 'turtle', 'moth', 'lamp', 'screen', 'stone'] })).toBeNull()
    expect(encodeInvitation({ ...room(), stoneMode: 'long' })).toBeNull()
    expect(encodeInvitation({ ...room(), chapter: 5 })).toBeNull()
  })

  it('preserves the expanded eight-cell room, lamp direction and two-cell stone without hidden metadata', () => {
    const context = { chapter: 5 as const, lampMode: 'hooded' as const, lampDirection: 'south' as const, stoneMode: 'long' as const }
    const solution = solveLayouts(context)[0]
    expect(solution).toBeDefined()
    const expanded = { ...context, layout: solution! }
    const result = decodeInvitation(encodeInvitation(expanded)!)
    expect(result.ok && result.invitation.room).toEqual(expanded)
    expect(result.ok && result.invitation.room.layout).toHaveLength(8)
    expect(encodeInvitation({ ...expanded, layout: [...solution!].reverse() })).toBeNull()
  })

  it('preserves deployment subpaths but strips private query/hash values from the generated link', () => {
    const code = encodeInvitation(room())!
    const url = invitationLink(code, 'https://example.com/TRAINORACLE/previews/release/?account=secret&date=private#token=secret')!
    const parsed = new URL(url)
    expect(parsed.pathname).toBe('/TRAINORACLE/previews/release/')
    expect(parsed.search).toBe('?app=1&games=lounge')
    expect(parsed.hash).toBe(`#sleep-inn=${code}`)
    expect(url).not.toMatch(/secret|private|account|token/)
    expect(decodeInvitation(url).ok).toBe(true)
    expect(hasSleepInnInviteFragment(parsed.hash)).toBe(true)
    expect(invitationLink(code, 'javascript:alert(1)')).toBeNull()
  })

  it('rejects ambiguous fragments and unsafe URL schemes without navigating or following a URL', () => {
    const code = encodeInvitation(room())!
    for (const bad of [`#sleep-inn=${code}&sleep-inn=${code}`, `#sleep-inn=${code}&note=private`, `javascript:alert(1)#sleep-inn=${code}`, `https://user:password@example.com/#sleep-inn=${code}`, `<a href="https://example.com/#sleep-inn=${code}">open</a>`]) {
      expect(decodeInvitation(bad).ok).toBe(false)
    }
    expect(decodeInvitation(`#sleep-inn=${code}`).ok).toBe(true)
  })
})
