import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PetRoom } from '../../src/screens/pet-room/PetRoom'
import { careDay, createHome, petHomeKey } from '../../src/screens/pet-room/pet-engine'

// Uses the actual room and storage code, in a dedicated local developer scope.
// Never reads/writes an account or the guest game. Reload keeps this test room.
const scope = 'preview:pet-room-keepsakes-20261023'
function Preview() {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('개발 체험 방 · 실제 계정과 따로 이 브라우저에 저장해요')
  function enter() {
    if (!localStorage.getItem(petHomeKey(scope))) {
      let home = createHome(careDay(), 1, scope)
      for (let seed = 1; seed < 1000; seed++) {
        const candidate = createHome(careDay(), seed, scope)
        if (candidate.visitors.includes('cat')) { home = candidate; home.selected = 'cat'; break }
      }
      localStorage.setItem(petHomeKey(scope), JSON.stringify(home))
    }
    setOpen(true)
  }
  return <><p className="preview-note" role="status">{notice}</p>{open
    ? <PetRoom persistenceScope={scope} journal={{ date: careDay(), status: 'missing' }} onBack={() => setOpen(false)} returnLabel="체험 안내로" onOpenJournal={() => setNotice('체험 방에서는 실제 일지를 열지 않아요. 펫 돌보기와 방 꾸미기를 확인할 수 있어요.')} onOldGame={() => setNotice('이 체험에서는 우리 집 친구들만 열어요.')} />
    : <main className="pet-home" style={{ padding: 24 }}><h1>우리 집 친구들</h1><p style={{ margin: '16px 0', lineHeight: 1.6 }}>친구를 돌보고, 같이 쉬고, 추억이 담긴 소품으로 방을 꾸며 봐.</p><button type="button" className="pet-primary" onClick={enter}>체험 방 들어가기</button><p style={{ marginTop: 16, fontSize: 13 }}>별도의 테스트 기록을 사용해요. 이미 열었던 체험 방은 이어서 시작해요.</p></main>}</>
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Preview />)
