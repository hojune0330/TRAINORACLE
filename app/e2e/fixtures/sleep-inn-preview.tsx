import React from 'react'
import { createRoot } from 'react-dom/client'
import { SleepInnEntry } from '../../src/screens/sleep-inn/SleepInnEntry'
import { EveningCheckin } from '../../src/screens/log-entry/EveningCheckin'
import { loadEntries, saveEntry, type EveningEntry } from '../../src/domain/journal-store'
import { initializeCanonicalJournalBrowserFixture } from './canonical-journal-browser'
import '../../../colors_and_type.css'
import '../../../colors_and_type_journal.css'
import '../../src/styles/app.css'

// Dev-only, visible synthetic fixture. The production entry never imports this module.
await initializeCanonicalJournalBrowserFixture()
const id = 'synthetic-sleep-inn-preview'
const date = '2026-10-09'
const sample: EveningEntry = { id, date, kind: 'evening', savedAt: '2026-10-09T01:00:00Z', syncState: 'local',
  sleepH: 6, sleepQuality: 3, mood: 4, weightKg: '65', restingHr: '52', painParts: {}, note: '',
  fieldProvenance: { sleepH: { provenance: 'EXPLICIT' }, sleepQuality: { provenance: 'EXPLICIT' }, mood: { provenance: 'EXPLICIT' },
    weightKg: { provenance: 'EXPLICIT' }, restingHr: { provenance: 'EXPLICIT' }, painParts: { provenance: 'MISSING' } } }

function Preview() {
  const [mode, setMode] = React.useState<'home' | 'game' | 'draft'>('home')
  const [message, setMessage] = React.useState('실제 계정 연결 없이 합성 기록으로 검수합니다.')
  const [record, setRecord] = React.useState<EveningEntry | undefined>()
  const refresh = () => setRecord(loadEntries().find(entry => entry.id === id) as EveningEntry | undefined)
  if (mode === 'draft') return <EveningCheckin targetDate={date} onBack={() => setMode('home')} onExit={() => setMode('home')}
    onDone={() => { setMode('home'); refresh() }} />
  return <main style={{ maxWidth: 660, margin: 'auto', padding: 24 }}>
    <p>개발 검수 · 합성 예시 · 미배포</p><h1>꿈손님 여관</h1>
    <p>기존 일지 저장과 실제 게임 화면을 함께 확인하는 페이지입니다. 예시 날짜: {date}.</p>
    <p role="status">{message}</p>
    <div style={{ display: 'grid', gap: 12 }}>
      <button style={{ minHeight: 48 }} onClick={() => {
        const current = loadEntries().find(entry => entry.id === id)
        if (!current) setMessage(saveEntry(sample).ok ? '합성 일지 1건을 이 기기에 만들었어요.' : '합성 일지를 저장하지 못했어요.')
        refresh(); setMode('game')
      }}>10월 9일 합성 일지에서 게임 열기</button>
      <button style={{ minHeight: 48 }} onClick={() => setMode('draft')}>새 일지의 미완성 입력 왕복 확인</button>
      <button style={{ minHeight: 48 }} onClick={refresh}>합성 기록 결과 확인</button>
    </div>
    {record && <pre style={{ whiteSpace: 'pre-wrap' }} aria-label="합성 기록 결과">{JSON.stringify({ id: record.id, date: record.date,
      sleepH: record.sleepH, sleepQuality: record.sleepQuality, mood: record.mood, weightKg: record.weightKg, restingHr: record.restingHr }, null, 2)}</pre>}
    {mode === 'game' && <SleepInnEntry date={date} entryId={id} onBack={() => { setMode('home'); refresh() }}
      onJournalSaved={() => { setMessage('기존 일지의 실제 저장 완료 콜백을 확인했어요.'); refresh() }} returnLabel="검수 시작 화면으로" />}
  </main>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview /></React.StrictMode>)
