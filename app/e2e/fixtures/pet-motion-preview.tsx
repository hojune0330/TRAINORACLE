import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PetSprite } from '../../src/screens/pet-room/PetArt'
import { PetCareScene } from '../../src/screens/pet-room/PetCareScene'
import { PetBedtimeScene } from '../../src/screens/pet-room/PetBedtimeScene'
import { PET_MOTION_CATALOG } from '../../src/screens/pet-room/pet-motion-catalog'
import { petById, type PetId } from '../../src/screens/pet-room/pet-catalog'
import type { PetMotion } from '../../src/screens/pet-room/pet-motion'
import '../../src/screens/pet-room/pet-room.css'
import '../../src/screens/pet-room/pet-activities.css'

// This developer entry uses the real game components and never saves records.
function Preview() {
  const [id, setId] = useState<PetId>('cat')
  const [motion, setMotion] = useState<PetMotion>('idle')
  const [replay, setReplay] = useState(0)
  const [scene, setScene] = useState<'pet' | 'feed' | 'play' | 'bed' | null>(null)
  const [completed, setCompleted] = useState(0)
  const [company, setCompany] = useState(1)
  const [useFallback, setUseFallback] = useState(false)
  const shownId = useFallback ? 'mouse' : id
  const companions = [shownId, ...(['cat', 'puppy', 'rabbit'] as PetId[]).filter(friend => friend !== shownId)].slice(0, company)
  const names: Record<PetMotion, string> = { idle: '가만히 있기', walk: '걷기', 'walk-left': '왼쪽 걷기', 'walk-right': '오른쪽 걷기', pet: '쓰다듬기', eat: '간식 먹기', play: '공놀이', 'lie-down': '눕기', sleep: '잠자기', wake: '일어나기', hello: '인사' }
  return <main className="pet-home" style={{ padding: 20 }}>
    <h1>우리 집 친구들 · 동작 확인</h1><p style={{ margin: '12px 0' }}>개발 중인 화면이에요. 여기서 한 행동은 돌봄이나 일지에 저장하지 않아요.</p>
    <label>친구 <select value={id} onChange={e => setId(e.target.value as PetId)}>{(Object.keys(PET_MOTION_CATALOG) as PetId[]).map(pet => <option key={pet} value={pet}>{petById(pet).name} · {petById(pet).animal}</option>)}</select></label>
    <label style={{ marginLeft: 16 }}>같이 자기 <select value={company} onChange={e => setCompany(Number(e.target.value))}>{[1, 2, 3].map(count => <option key={count} value={count}>{count}명</option>)}</select></label>
    <label style={{ display: 'block', marginTop: 12 }}><input type="checkbox" checked={useFallback} onChange={e => setUseFallback(e.target.checked)} /> 기존 그림 친구로도 확인하기</label>
    <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'center', gap: 18, background: '#f0e5d4', borderRadius: 24, margin: '18px 0' }}>
      <PetSprite id={id} motion={motion} replay={replay} className="pet-motion-preview-large" /><PetSprite id={id} motion={motion} replay={replay} className="pet-motion-preview-small" />
    </div>
    <p>{PET_MOTION_CATALOG[id]?.[motion] ? `${names[motion]} · 만든 동작 재생 중` : '이 동작은 아직 제작 중이에요. 기존 그림을 보여 줘요.'}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '16px 0' }}>{Object.entries(names).map(([key, label]) => <button type="button" className="pet-icon-button" key={key} onClick={() => { setMotion(key as PetMotion); setReplay(v => v + 1) }}>{label}</button>)}</div>
    <p>게임 장면에서 확인</p><div style={{ display: 'grid', gap: 8, margin: '12px 0' }}>{(['pet', 'feed', 'play', 'bed'] as const).map(key => <button type="button" className="pet-secondary" key={key} onClick={() => setScene(key)}>{{ pet: '쓰다듬으러 가기', feed: '간식 주기', play: '공놀이하기', bed: '같이 잘 준비' }[key]}</button>)}</div>
    <p aria-live="polite">이 화면에서 마친 동작 {completed}번 · 저장 없음</p>
    {scene && scene !== 'bed' && <PetCareScene key={`${shownId}:${scene}`} id={shownId} action={scene} turn={0} onComplete={() => { setCompleted(v => v + 1); return true }} onClose={() => setScene(null)} error={null} onReload={() => {}} />}
    {scene === 'bed' && <PetBedtimeScene companions={companions} onFinish={() => { setMotion('sleep'); setReplay(v => v + 1); setCompleted(v => v + 1); setScene(null) }} onClose={() => setScene(null)} error={null} onReload={() => {}} />}
    <style>{'.pet-motion-preview-large { width: 256px } .pet-motion-preview-small { width: 64px; margin-bottom: 25px } @media(max-width: 420px) { .pet-motion-preview-large { width: 220px } }'}</style>
  </main>
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Preview />)
