import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SleepInnSocial } from './SleepInnSocial'
import { solveLayouts } from './engine'
import { decodeInvitation, encodeInvitation, type ShareableRoom } from './social'

const room: ShareableRoom = { chapter: 1, layout: ['fox', 'screen', 'turtle', 'moth', 'lamp', 'stone'], lampMode: 'soft', lampDirection: 'north', stoneMode: 'small' }
beforeEach(() => { window.history.replaceState({}, '', '/'); window.localStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('sleep inn asynchronous room visits', () => {
  it('renders an expanded visit in the actual room with connected upgraded artwork and cell labels', () => {
    const context = { chapter: 5 as const, lampMode: 'hooded' as const, lampDirection: 'south' as const, stoneMode: 'long' as const }
    const card: ShareableRoom = { ...context, layout: solveLayouts(context)[0]! }
    render(<SleepInnSocial cards={[card]} />)
    fireEvent.click(screen.getByText('내 방 초대장 만들기'))
    fireEvent.click(screen.getByRole('button', { name: '5장 엽서 1' }))
    const preview = screen.getByRole('group', { name: '공유된 방 배치' })
    expect(within(preview).getByRole('img', { name: '꿈손님 여관 객실' })).toHaveAttribute('src', expect.stringContaining('/games/sleep-inn/room.png'))
    expect(preview.querySelector('img[src$="hooded-lamp-south.png"]')).toBeInTheDocument()
    expect(preview.querySelector('img[src$="tripo/sealed-letter-south.png"]')).toBeInTheDocument()
    expect(preview.querySelectorAll('img[src$="long-warm-stone-south.png"]')).toHaveLength(1)
    expect(within(preview).getByText('D2')).toBeVisible()
    expect(within(preview).getByLabelText('가림등 아래 방향')).toBeVisible()
    expect(screen.getByText('공유한 완성 방 · 읽기 전용')).toBeVisible()
  })

  it('requires share preview confirmation and survives clipboard rejection with selectable code', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<SleepInnSocial cards={[room]} />)
    fireEvent.click(screen.getByText('내 방 초대장 만들기'))
    fireEvent.click(screen.getByRole('button', { name: '1장 엽서 1' }))
    expect(screen.queryByLabelText(/전달할/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '이 방으로 초대장 만들기' }))
    const output = screen.getByLabelText(/전달할/) as HTMLTextAreaElement
    expect(decodeInvitation(output.value).ok).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /복사$/ }))
    expect(await screen.findByText(/복사 권한이 없어 코드를 선택했어요/)).toBeVisible()
    expect(document.activeElement).toBe(output)
    expect(output.selectionEnd).toBe(output.value.length)
  })

  it('exchanges a room and reply between independent UI sessions without copying or mutating either journey', () => {
    window.localStorage.setItem('trainoracle:sleep-inn:v1:owner-a', 'original-a')
    const sender = render(<SleepInnSocial cards={[room]} />)
    fireEvent.click(screen.getByText('내 방 초대장 만들기'))
    fireEvent.click(screen.getByRole('button', { name: '1장 엽서 1' }))
    fireEvent.click(screen.getByRole('button', { name: '이 방으로 초대장 만들기' }))
    const invite = (screen.getByLabelText(/전달할/) as HTMLTextAreaElement).value
    sender.unmount()

    window.localStorage.setItem('trainoracle:sleep-inn:v1:owner-b', 'original-b')
    const visitor = render(<SleepInnSocial cards={[]} />)
    fireEvent.change(screen.getByLabelText('받은 초대장 또는 답장'), { target: { value: invite } })
    fireEvent.click(screen.getByRole('button', { name: '초대장 미리보기' }))
    expect(screen.queryByLabelText('방문 중인 방')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '친구 방 둘러보기' }))
    expect(within(screen.getByLabelText('방문 중인 방')).getByText('모루')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '자리 배치가 멋져요' }))
    fireEvent.click(screen.getByRole('button', { name: '이 인사로 답장 만들기' }))
    const reply = (screen.getByLabelText(/전달할/) as HTMLTextAreaElement).value
    expect(reply).not.toBe(invite)
    visitor.unmount()

    render(<SleepInnSocial cards={[room]} />)
    fireEvent.change(screen.getByLabelText('받은 초대장 또는 답장'), { target: { value: reply } })
    fireEvent.click(screen.getByRole('button', { name: '초대장 미리보기' }))
    fireEvent.click(screen.getByRole('button', { name: '답장 열기' }))
    expect(within(screen.getByLabelText('받은 인사')).getByText('자리 배치가 멋져요')).toBeVisible()
    expect(window.localStorage.getItem('trainoracle:sleep-inn:v1:owner-a')).toBe('original-a')
    expect(window.localStorage.getItem('trainoracle:sleep-inn:v1:owner-b')).toBe('original-b')
    expect(window.localStorage.length).toBe(2)
  })

  it('prefills a fragment but requires explicit preview and visit, and rejects malformed updates', () => {
    const code = encodeInvitation(room)!
    window.history.replaceState({}, '', `/#sleep-inn=${code}`)
    render(<SleepInnSocial cards={[]} />)
    expect(screen.getByLabelText('받은 초대장 또는 답장')).toHaveValue(`#sleep-inn=${code}`)
    expect(screen.queryByRole('button', { name: '친구 방 둘러보기' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '초대장 미리보기' }))
    expect(screen.getByRole('button', { name: '친구 방 둘러보기' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('받은 초대장 또는 답장'), { target: { value: '<script>alert(1)</script>' } })
    fireEvent.click(screen.getByRole('button', { name: '초대장 미리보기' }))
    expect(screen.getByRole('alert')).toHaveTextContent('이 초대장을 읽을 수 없어요')
    expect(screen.queryByRole('button', { name: '친구 방 둘러보기' })).not.toBeInTheDocument()
    expect(screen.getByText(/보낸 사람은 확인되지 않아요/)).toBeVisible()
  })
})
