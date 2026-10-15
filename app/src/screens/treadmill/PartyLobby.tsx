import React from 'react'
import { Copy, Share2, Trophy, Check, Users } from 'lucide-react'
import type { ArenaMode, ArenaSnapshot } from './arena-types'
import { PARTY_MODES, PARTY_REACTIONS, modeOf, roomSeries } from './arena-party'
import { GameModeArtwork } from './GameModeArtwork'

type Props = { snapshot: ArenaSnapshot; self: string; connected: boolean; inviteUrl: string; copied: boolean;
  send: (message: object) => void; onCopy: () => void; onShare: () => void }
export function PartyLobby({ snapshot: s, self, connected, inviteUrl, copied, send, onCopy, onShare }: Props) {
  const [muted, setMuted] = React.useState(false)
  const member = s.members.find(m => m.id === self), isHost = s.host === self, mode = modeOf(s.mode)
  const game = s.game, ready = s.members.filter(m => m.ready && m.connected).length, series = roomSeries(s)
  return <div className="arena-lobby arena-lobby--party"><div className="arena-room-scroll">
    {game?.phase === 'finished' ? <>
      <h2><Trophy size={24} /> 경기 종료</h2>
      <p>{PARTY_MODES[modeOf(game.mode)].name} · {game.round}판 결과</p>
      <ol className="arena-results" aria-label="최종 순위">{game.standings.map(p => <li key={p.id} data-rank={p.rank}>
        <strong>{p.rank}위 · {s.members.find(m => m.id === p.id)?.name ?? '러너'}{p.id === self ? ' (나)' : ''}</strong>
        <span>{game.mode === 'survival' ? `낙하 ${p.falls} · 점프 회피 ${p.dodges}` : `밀어냄 ${p.kos} · 낙하 ${p.falls}`}</span>
      </li>)}</ol>
      <p className="arena-note">{PARTY_MODES[modeOf(game.mode)].ranking}. 같으면 공동 순위예요.</p>
    </> : game?.phase === 'interrupted' ? <><h2>경기가 중단됐어요</h2><p>참가자 이탈 또는 서버 지연으로 승패를 정하지 않았어요. 다시 준비하면 같은 방에서 만날 수 있어요.</p></>
      : <><h2><Users size={24} /> 우리끼리 한 판</h2><p>친구를 초대하고, 같은 방에서 종목을 바꿔 즐겨요.</p></>}
    {series.rounds > 0 && <div className="arena-series" aria-label="이 멤버들의 최근 전적"><strong>이 멤버들과 최근 {series.rounds}판</strong>
      <span>{series.players.map(p => `${p.name} ${p.wins}승`).join(' : ')} · 공동 {series.players[0]?.ties ?? 0}판</span></div>}
    <ul className="arena-members" aria-label="참가자 자리">{s.members.map(m => <li key={m.id} data-self={m.id === self}>
      <span className="arena-seat" aria-hidden="true">{m.name.slice(0,1)}</span><strong>{m.name}{m.id === self ? ' (나)' : ''}{m.id === s.host ? ' · 방장' : ''}</strong>
      <span>{!m.connected ? '재접속 대기' : m.ready ? '준비 완료' : '준비 중'}{m.vote ? ` · ${PARTY_MODES[m.vote].name}에 투표` : ''}</span>
      <span className="arena-bubble" role="status">{!muted && m.reaction ? PARTY_REACTIONS[m.reaction] : ''}</span>
    </li>)}{s.members.length < 2 && <li><strong>친구 자리</strong><span>아래 링크로 초대해 주세요.</span></li>}</ul>
    <div className="arena-actions"><button className="treadmill-game__ghost" onClick={onCopy}><Copy size={16} />{copied ? '복사했어요' : '초대 링크 복사'}</button>
      {typeof navigator.share === 'function' && <button className="treadmill-game__ghost" onClick={onShare}><Share2 size={16} />공유</button>}</div>
    <input className="arena-invite" aria-label="초대 링크" readOnly value={inviteUrl} onFocus={e => e.currentTarget.select()} />
    {s.partyVersion === 2 && <>
      <div className="arena-mode-picker" aria-label="다음 종목 고르기"><h3>다음에는 무엇을 할까요?</h3>
        <p className="arena-note">각자 투표하고 방장이 종목을 정해요. 종목이 바뀌면 두 명 모두 다시 준비해 주세요.</p>
        {(Object.keys(PARTY_MODES) as ArenaMode[]).map(key => <div className="arena-mode" key={key} data-selected={mode === key}>
          <GameModeArtwork mode={key} /><div><strong>{PARTY_MODES[key].name} {mode === key && <span><Check size={14} /> 선택됨</span>}</strong>
            <p>{PARTY_MODES[key].goal}</p><small>90초 · 무한 리젠 · {s.members.filter(m => m.vote === key).length}표</small></div>
          <div className="arena-mode-actions"><button disabled={!connected} aria-pressed={member?.vote === key} onClick={() => send({type:'vote',mode:key})}>{PARTY_MODES[key].name} 투표</button>
            {isHost && <button disabled={!connected || mode === key || (key === 'survival' && s.members.some(m => m.partyVersion !== 2))} onClick={() => send({type:'mode',mode:key})}>{mode === key ? '선택됨' : `${PARTY_MODES[key].name} 선택`}</button>}</div>
        </div>)}
        {s.members.some(m => m.partyVersion !== 2) && <p className="arena-note">장애물 생존은 최신 초대 링크에서 함께 접속해 주세요. 현재 밀어내기는 이용할 수 있어요.</p>}
      </div>
    </>}
    {s.partyVersion === 2 && <details className="arena-social"><summary>친구에게 반응 보내기</summary>
      <div className="arena-reactions" role="group" aria-label="짧은 반응">{(Object.keys(PARTY_REACTIONS) as (keyof typeof PARTY_REACTIONS)[]).map(kind =>
        <button key={kind} disabled={!connected} onClick={() => send({type:'reaction',kind})}>{PARTY_REACTIONS[kind]}</button>)}</div>
      <button className="arena-mute" aria-pressed={muted} onClick={() => setMuted(v => !v)}>{muted ? '친구 반응 다시 보기' : '친구 반응 숨기기'}</button>
    </details>}
    <details><summary>조작과 순위 기준</summary><p className="arena-note">꾹 눌러 달리기 · 위로 쓸어 점프 · 두 번 눌러 {mode === 'survival' ? '대시' : '밀치기'}. 손을 떼지 않고 내렸다 올려도 점프해요.<br />{PARTY_MODES[mode].ranking}. 같으면 공동 순위예요.<br />키보드 → 달리기 · Space/↑ 점프 · D 대시</p></details>
    {s.history.length > 0 && <details><summary>이 방 최근 {s.history.length}판 비교</summary>{s.history.map(r => <p key={r.round}>{r.round}판 · {PARTY_MODES[modeOf(r.mode)].name}<br />{r.standings.map(p => `${p.name} ${p.rank}위 (${r.mode === 'survival' ? `${p.dodges}회피` : `${p.kos}밀어냄`}/${p.falls}낙하)`).join(' · ')}</p>)}</details>}
    <p className="arena-note">초대받은 두 명만 입장해요. 이 방의 최근 5판만 비교하며 서버가 재시작되면 사라져요.</p>
    </div>
    <div className="arena-ready"><strong>{PARTY_MODES[mode].name} · {ready}/2명 준비</strong>
      <p className="arena-note">{s.members.length < 2 ? '친구가 입장하면 함께 출발할 수 있어요.' : ready < 2 ? '두 명 모두 준비 완료를 눌러 주세요.' : isHost ? '모두 준비됐어요. 함께 출발을 눌러 주세요.' : '방장이 출발하면 경기가 시작돼요.'}</p>
      <button className="treadmill-game__cta" disabled={!connected} onClick={() => send({type:'ready',ready:!member?.ready})}>{member?.ready ? '준비 취소' : game ? '한 판 더 · 준비' : '준비 완료'}</button>
      {isHost && <button className="treadmill-game__ghost" disabled={!connected || ready !== 2 || s.members.length !== 2} onClick={() => send({type:'start'})}>함께 출발</button>}
    </div>
  </div>
}
