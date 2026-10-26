import React from 'react'
import { createRoot } from 'react-dom/client'
import { SleepInnEntry } from '../../src/screens/sleep-inn/SleepInnEntry'
import { careDay, createHome, petHomeKey, sleepTogether, wakeTogether } from '../../src/screens/pet-room/pet-engine'
import { activeObservationNight } from '../../src/screens/pet-room/pet-observation'
import { initializeCanonicalJournalBrowserFixture } from './canonical-journal-browser'
import '../../../colors_and_type.css'
import '../../../colors_and_type_journal.css'
import '../../src/styles/app.css'

// Explicit synthetic controls, served by Vite for visual QA only. Never imported by production.
await initializeCanonicalJournalBrowserFixture()
function makeHome(day: string, seed = 31) {
  const home = createHome(day, seed)
  for (const id of ['otter', 'cat', 'seal'] as const) home.pets[id] = { metOn: day, caredDays: [], actions: { pet: [], feed: [], play: [], bed: [] }, adoptedOn: null }
  home.visitors = ['otter', 'cat', 'seal']; home.selected = 'otter'
  return home
}
function Preview() {
  const [open, setOpen] = React.useState(false)
  const today = careDay()
  const previous = new Date(); previous.setDate(previous.getDate() - 1)
  function begin(morning = false) {
    let home = makeHome(today)
    if (morning) {
      for (let seed = 1; seed < 1000; seed++) {
        home = wakeTogether(sleepTogether(makeHome(careDay(previous), seed), careDay(previous), today), today)
        if (activeObservationNight(home)?.results.some(result => result.sceneId === 'otter-ball')
          && activeObservationNight(home)?.results.some(result => result.sceneId === 'cat-box')) break
      }
    }
    localStorage.setItem(petHomeKey('guest'), JSON.stringify(home)); setOpen(true)
  }
  return <main style={{ padding: 20, maxWidth: 680, margin: 'auto' }}>
    <p>개발 검수 · 합성 예시 · 실제 계정 기록 없음</p><h1>친구들의 밤</h1>
    <div style={{ display: 'grid', gap: 12 }}>
      <button style={{ minHeight: 48 }} onClick={() => begin()}>잠자리 준비 예시 열기</button>
      <button style={{ minHeight: 48 }} onClick={() => begin(true)}>아침 예시 열기</button>
      <button style={{ minHeight: 48 }} onClick={() => setOpen(true)}>저장한 방 다시 열기</button>
    </div>
    {open && <SleepInnEntry date={today} onBack={() => setOpen(false)} returnLabel="예시 선택으로" />}
  </main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview /></React.StrictMode>)
