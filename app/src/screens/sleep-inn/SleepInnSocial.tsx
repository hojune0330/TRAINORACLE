import React from 'react'
import { DIRECTION_NAMES, PIECE_NAMES, getChapter, litCells } from './engine'
import { decodeInvitation, encodeInvitation, invitationLink, isLocalInvitationLink, STAMPS, type InnInvitation, type ShareableRoom, type VisitStamp } from './social'
import './sleep-inn-social.css'

export interface SleepInnSocialProps { cards: readonly ShareableRoom[] }
const spritePosition: Record<string, string> = { fox: '0% 0%', turtle: '50% 0%', moth: '100% 0%', screen: '0% 100%', lamp: '50% 100%', stone: '100% 100%', stoneTail: '100% 100%' }
const direction: Record<ShareableRoom['lampDirection'], string> = { north: '↑', east: '→', south: '↓', west: '←' }
const asset = `${import.meta.env.BASE_URL}games/sleep-inn/`

function SharedRoom({ room }: { room: ShareableRoom }) {
  const chapter = getChapter(room)
  const light = litCells([...room.layout], room)
  return <figure className="inn-social-room">
    <figcaption>{room.chapter}장 · {chapter.title}<small>공유한 완성 방 · 읽기 전용</small></figcaption>
    <div className={`inn-social-room__scene${chapter.cols === 4 ? ' inn-social-room__scene--expanded' : ''}`} role="group" aria-label="공유된 방 배치">
      <img className="inn-social-room__background" src={`${asset}room.png`} alt="꿈손님 여관 객실" draggable={false} />
      {room.layout.map((piece, index) => {
        const x = chapter.cols === 3 ? [26, 50, 74][index % 3]! : [20, 40, 60, 80][index % 4]!
        const back = index < chapter.cols
        const long = piece === 'stone' && room.stoneMode === 'long'
        const single = piece === 'letter' ? 'tripo/sealed-letter-south.png' : piece === 'lamp' && room.lampMode === 'hooded' ? `tripo/hooded-lamp-${room.lampDirection}.png` : long ? 'tripo/long-warm-stone-south.png' : null
        const wet = chapter.wetCells.includes(index)
        return <div className={`inn-social-room__cell${back ? ' inn-social-room__cell--back' : ''}${wet ? ' inn-social-room__cell--wet' : ''}${light.includes(index) ? ' inn-social-room__cell--lit' : ''}${long || piece === 'stoneTail' ? ' inn-social-room__cell--joined' : ''}`} key={index}
          style={{ left: `${x}%`, top: `${back ? 51 : 72}%`, zIndex: back ? 2 : 3 }} aria-label={`${chapter.cells[index]} ${PIECE_NAMES[piece]}`}>
          <span className="inn-social-room__floor" aria-hidden="true" />
          {single ? <img aria-hidden="true" className={`inn-social-room__sprite inn-social-room__sprite--single${long ? ' inn-social-room__sprite--long' : ''}`} src={`${asset}${single}`} alt="" draggable={false} />
            : piece !== 'empty' && piece !== 'stoneTail' ? <span aria-hidden="true" className="inn-social-room__sprite" style={{ backgroundImage: `url('${asset}pieces.png')`, backgroundPosition: spritePosition[piece] }} /> : null}
          <span className="inn-social-room__name"><span className="inn-social-room__coordinate">{chapter.cells[index]}</span><span>{piece === 'stoneTail' ? '온돌 끝' : PIECE_NAMES[piece]}</span></span>
          {piece === 'lamp' && room.lampMode === 'hooded' && <span className="inn-social-room__direction" aria-label={`가림등 ${DIRECTION_NAMES[room.lampDirection]} 방향`}>{direction[room.lampDirection]}</span>}
        </div>
      })}
    </div>
    <p>{room.lampMode === 'hooded' ? `가림등 ${DIRECTION_NAMES[room.lampDirection]} ${direction[room.lampDirection]}` : '부드러운 등불'} · {room.stoneMode === 'long' ? '연결된 두 칸 온돌자리' : '작은 온돌돌'}</p>
  </figure>
}

function ExportCard({ code, label }: { code: string; label: string }) {
  const [notice, setNotice] = React.useState('')
  const link = invitationLink(code)
  const local = link ? isLocalInvitationLink(link) : true
  // A local development URL is not useful to another phone. Export its portable code instead.
  const value = !local && link ? link : code
  const text = React.useRef<HTMLTextAreaElement>(null)
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable')
      await navigator.clipboard.writeText(value)
      setNotice('복사했어요. 친구에게 직접 전달해 주세요.')
    } catch {
      text.current?.focus(); text.current?.select()
      setNotice('복사 권한이 없어 코드를 선택했어요. 길게 눌러 복사하거나 파일로 저장하세요.')
    }
  }
  const download = () => {
    try {
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'dream-inn-postcard.txt'; anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
      setNotice('초대장 파일 저장을 요청했어요. 저장된 파일을 친구에게 직접 전달해 주세요.')
    } catch {
      text.current?.focus(); text.current?.select()
      setNotice('이 브라우저에서는 파일을 만들 수 없어요. 선택된 코드를 길게 눌러 복사해 주세요.')
    }
  }
  return <div className="inn-social-export">
    <p>{label} · 게임 속 방과 고른 인사만 들어 있어요.</p>
    <label>전달할 {local ? '코드' : '링크'}<textarea ref={text} readOnly value={value} rows={3} spellCheck={false} /></label>
    {local && <p className="inn-social-note">지금은 로컬 미리보기예요. 친구는 같은 버전의 게임에서 이 코드를 붙여 넣을 수 있어요.</p>}
    <div className="inn-social-actions"><button type="button" onClick={() => void copy()}>{local ? '코드 복사' : '링크 복사'}</button><button type="button" onClick={download}>코드 파일 저장</button></div>
    <p role="status">{notice}</p>
  </div>
}

/** Async exchange only: never sends a message, writes a journal, or replaces the active journey. */
export function SleepInnSocial({ cards }: SleepInnSocialProps) {
  const [selected, setSelected] = React.useState<number | null>(null)
  const [outbound, setOutbound] = React.useState<string | null>(null)
  const [input, setInput] = React.useState(() => new URLSearchParams(window.location.hash.slice(1)).has('sleep-inn') ? window.location.hash : '')
  const [candidate, setCandidate] = React.useState<InnInvitation | null>(null)
  const [visiting, setVisiting] = React.useState<InnInvitation | null>(null)
  const [error, setError] = React.useState('')
  const [stamp, setStamp] = React.useState<VisitStamp>('cozy')
  const [reply, setReply] = React.useState<string | null>(null)
  const selectedCard = selected === null ? undefined : cards[selected]
  const preview = () => {
    setCandidate(null); setVisiting(null); setReply(null)
    const result = decodeInvitation(input)
    if (result.ok) { setCandidate(result.invitation); setError('') } else setError(result.message)
  }
  return <section className="inn-social" aria-labelledby="inn-social-heading">
    <h2 id="inn-social-heading">친구 여관에 놀러 가기</h2>
    <p>완성한 방을 초대장으로 주고받아요. 친구와 같은 시간에 접속할 필요는 없어요.</p>
    <p className="inn-social-note">수면 기록·일지·이름은 공유하지 않아요. 초대장의 보낸 사람은 확인되지 않아요.</p>
    <details className="inn-social-share">
      <summary>내 방 초대장 만들기</summary>
      {cards.length === 0 ? <p>한 장을 완성하면 그 방을 초대장으로 만들 수 있어요. 받은 초대장은 지금도 열 수 있어요.</p> : <>
        <div className="inn-social-card-list" role="group" aria-label="공유할 완성 엽서">
          {cards.map((card, index) => <button type="button" key={index} aria-pressed={selected === index} onClick={() => { setSelected(index); setOutbound(null) }}>{card.chapter}장 엽서 {index + 1}</button>)}
        </div>
        {selectedCard && <><SharedRoom room={selectedCard} /><p>이 방 배치와 시설만 담아 초대장을 만들어요.</p>
          <button className="inn-button inn-button--primary" type="button" onClick={() => { const code = encodeInvitation(selectedCard); setOutbound(code); if (!code) setError('이 엽서는 공유할 수 없어요. 완성한 방을 다시 골라 주세요.') }}>이 방으로 초대장 만들기</button></>}
        {outbound && <ExportCard key={outbound} code={outbound} label="방 초대장" />}
      </>}
    </details>
    <label className="inn-social-import">받은 초대장 또는 답장<textarea value={input} rows={3} maxLength={4096} spellCheck={false} autoCapitalize="none" placeholder="전체 링크나 INN1.로 시작하는 코드" onChange={event => { setInput(event.target.value); setCandidate(null); setVisiting(null); setReply(null); setError('') }} /></label>
    <button type="button" className="inn-button" onClick={preview}>초대장 미리보기</button>
    {error && <p role="alert" className="inn-social-error">{error}</p>}
    {candidate && !visiting && <div className="inn-social-preview"><SharedRoom room={candidate.room} />
      <p>{candidate.kind === 'reply' ? '이 방에 남긴 인사가 들어 있어요.' : '이 방을 둘러볼까요?'} 내 여관의 진행은 바뀌지 않아요.</p>
      <button type="button" className="inn-button inn-button--primary" onClick={() => { setVisiting(candidate); setReply(null) }}>{candidate.kind === 'reply' ? '답장 열기' : '친구 방 둘러보기'}</button></div>}
    {visiting && <div className="inn-social-visit" aria-label={visiting.kind === 'reply' ? '받은 인사' : '방문 중인 방'}><SharedRoom room={visiting.room} />
      {visiting.kind === 'reply' ? <p className="inn-social-stamp">{STAMPS[visiting.stamp]}</p> : <>
        <p>방이 마음에 들었다면 인사를 골라 답장해 보세요.</p>
        <div className="inn-social-stamps" role="group" aria-label="답장 인사 고르기">{Object.entries(STAMPS).map(([id, label]) => <button type="button" key={id} aria-pressed={stamp === id} onClick={() => { setStamp(id as VisitStamp); setReply(null) }}>{label}</button>)}</div>
        <button type="button" className="inn-button" onClick={() => setReply(encodeInvitation(visiting.room, stamp))}>이 인사로 답장 만들기</button>
        {reply && <ExportCard key={reply} code={reply} label="친구에게 돌려줄 답장" />}
      </>}
      <button type="button" className="inn-text-button" onClick={() => { setVisiting(null); setCandidate(null); setReply(null) }}>방문 마치기</button>
    </div>}
  </section>
}
