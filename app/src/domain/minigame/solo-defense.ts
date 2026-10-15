// Game-only fixed course v1. Units are simulation units, not exercise prescriptions.
export const DEFENSE_RULES = { version: 1, duration: 60, waves: 3, install: 3, upgrade: 4, totalEnemies: 48 } as const
export const FACILITIES = {
  cannon: { name: '공 발사기', detail: '가장 가까운 적 공격', levels: ['초당 피해 1', '초당 피해 2'] },
  fan: { name: '바람 장치', detail: '범위 안 모든 적 감속', levels: ['속도 −25%', '속도 −40%'] },
  flag: { name: '보급 깃발', detail: '근처에서 쉴 때 회복 증가', levels: ['회복 ×1.25', '회복 ×1.5'] },
} as const
export type FacilityKind = keyof typeof FACILITIES
export type Facility = { kind: FacilityKind; level: 1 | 2; cooldown: number }
export type DefenseEnemy = { id: number; kind: 'normal' | 'rush' | 'armor'; x: number; hp: number; maxHp: number; resist: number; touched: boolean }
export type DefenseRunner = { x: number; y: number; vy: number; energy: number; falls: number; respawn: number; protected: number; hit: number; dash: number; cooldown: number; running: boolean }
export type DefenseTotals = { killed: number; passed: number; unresolved: number; collected: number; pushed: number }
export type SoloDefense = {
  mode: 'defense'; phase: 'prepare' | 'countdown' | 'playing' | 'finished'; wave: number; time: number; countdown: number;
  budget: number; facilities: (Facility | null)[]; runner: DefenseRunner; enemies: DefenseEnemy[]; spawned: number;
  collectedIds: number[]; totals: DefenseTotals; shots: { from: number; to: number; life: number }[];
}
export const facilityX = (slot: number) => [.28, .5, .72][slot] ?? .5
export const waveCount = (wave: number) => [12, 16, 20][wave - 1] ?? 0
export function defenseSpawns(wave: number) {
  const count = waveCount(wave), groupSize = count / 4
  return Array.from({ length: count }, (_, i) => ({ id: wave * 100 + i,
    time: 3 + Math.floor(i / groupSize) * 12 + (i % groupSize) * .65,
    kind: (wave === 3 && i % 5 === 4 ? 'armor' : wave > 1 && i % (wave === 2 ? 4 : 5) === 2 ? 'rush' : 'normal') as DefenseEnemy['kind'] }))
}
const freshRunner = (): DefenseRunner => ({ x: .5, y: 0, vy: 0, energy: 100, falls: 0, respawn: 0, protected: 2, hit: 0, dash: 0, cooldown: 0, running: false })
export function newSoloDefense(): SoloDefense {
  return { mode: 'defense', phase: 'prepare', wave: 1, time: 0, countdown: 3, budget: 6,
    facilities: [null, null, null], runner: freshRunner(), enemies: [], spawned: 0, collectedIds: [],
    totals: { killed: 0, passed: 0, unresolved: 0, collected: 0, pushed: 0 }, shots: [] }
}
/** Preparation edits happen on a UI draft. Invalid/duplicate purchases never spend budget. */
export function buyFacility(s: SoloDefense, slot: number, kind: FacilityKind): boolean {
  if (s.phase !== 'prepare' || !Number.isInteger(slot) || slot < 0 || slot > 2 || !Object.hasOwn(FACILITIES, kind)) return false
  const old = s.facilities[slot], cost = old ? DEFENSE_RULES.upgrade : DEFENSE_RULES.install
  if (s.budget < cost || (old && (old.kind !== kind || old.level === 2))) return false
  s.facilities[slot] = { kind, level: old ? 2 : 1, cooldown: 0 }; s.budget -= cost
  return true
}
export function startDefenseWave(s: SoloDefense) {
  if (s.phase !== 'prepare') return
  if (s.wave === 1 && s.facilities.every(f => !f)) buyFacility(s, 0, 'cannon')
  const falls = s.runner.falls
  s.runner = { ...freshRunner(), falls }; s.phase = 'countdown'; s.countdown = 3; s.time = 0
  s.enemies = []; s.spawned = 0; s.shots = []; s.facilities.forEach(f => { if (f) f.cooldown = 0 })
}
export function defenseInput(s: SoloDefense, run: boolean, action?: 'jump' | 'dash') {
  const p = s.runner
  if (s.phase !== 'playing' || p.respawn > 0) return
  p.running = run
  if (action === 'jump' && p.y === 0 && p.energy >= 8) { p.vy = 470; p.energy -= 8 }
  if (action === 'dash' && p.y === 0 && p.energy >= 20 && p.cooldown <= 0 && p.protected <= 0) {
    p.energy -= 20; p.dash = .25; p.cooldown = 2.5
    const targets = s.enemies.filter(e => e.hp > 0 && e.resist <= 0 && Math.abs(e.x - p.x) < .14).sort((a, b) => a.x - b.x).slice(0, 3)
    for (const e of targets) { e.hp--; e.x = Math.min(1.1, e.x + (e.kind === 'armor' ? .07 : .14)); e.resist = 1; s.totals.pushed++ }
  }
}
export function defenseSupplies(s: SoloDefense) {
  return [0, 1].map(i => ({ id: s.wave * 10 + i, x: 1.08 - (s.time - (12 + i * 24)) * .075,
    active: s.time >= 12 + i * 24 && !s.collectedIds.includes(s.wave * 10 + i) })).filter(c => c.active && c.x > .055)
}
export function advanceSoloDefense(s: SoloDefense, dt: number, run: boolean) {
  dt = Math.min(1 / 30, Math.max(0, dt))
  if (s.phase === 'countdown') { s.countdown -= dt; if (s.countdown <= 0) s.phase = 'playing'; return }
  if (s.phase !== 'playing') return
  dt = Math.min(dt, DEFENSE_RULES.duration - s.time); s.time += dt
  const p = s.runner
  for (const key of ['protected', 'hit', 'dash', 'cooldown'] as const) p[key] = Math.max(0, p[key] - dt)
  if (p.respawn > 0) {
    p.respawn = Math.max(0, p.respawn - dt)
    if (p.respawn === 0) s.runner = { ...freshRunner(), falls: p.falls }
  } else {
    p.running = run && p.energy > 0
    let recovery = 1
    s.facilities.forEach((f, i) => { if (f?.kind === 'flag' && Math.abs(facilityX(i) - p.x) < .18) recovery = Math.max(recovery, f.level === 2 ? 1.5 : 1.25) })
    p.energy = Math.max(0, Math.min(100, p.energy + (p.running ? -9 : 20 * recovery) * dt))
    p.x = Math.min(.86, p.x + ((p.running ? .18 : 0) - .085 + (p.dash > 0 ? .38 : 0)) * dt)
    if (p.y > 0 || p.vy !== 0) { p.y = Math.max(0, p.y + p.vy * dt); p.vy -= 1150 * dt; if (p.y === 0) p.vy = 0 }
    if (p.x < .055) { p.falls++; p.respawn = 2; p.running = false; p.dash = 0 }
  }
  for (const spawn of defenseSpawns(s.wave)) if (s.time >= spawn.time && spawn.id >= s.wave * 100 + s.spawned) {
    const hp = spawn.kind === 'armor' ? 6 : spawn.kind === 'rush' ? 2 : 3
    s.enemies.push({ id: spawn.id, kind: spawn.kind, x: 1.12, hp, maxHp: hp, resist: 0, touched: false }); s.spawned++
  }
  for (const e of s.enemies) {
    e.resist = Math.max(0, e.resist - dt)
    let slow = 0
    s.facilities.forEach((f, i) => { if (f?.kind === 'fan' && Math.abs(facilityX(i) - e.x) < .18) slow = Math.max(slow, f.level === 2 ? .4 : .25) })
    e.x -= .09 * (e.kind === 'rush' ? 1.4 : 1) * (1 - slow) * dt
    if (e.hp > 0 && !e.touched && p.respawn <= 0 && p.protected <= 0 && Math.abs(e.x - p.x) < .045) {
      e.touched = true
      if (p.y < 36 && p.hit <= 0) { p.x -= .09; p.energy = Math.max(0, p.energy - 8); p.hit = .65 }
    }
  }
  s.facilities.forEach((f, i) => {
    if (f?.kind !== 'cannon') return
    f.cooldown -= dt
    if (f.cooldown > 0) return
    const target = s.enemies.filter(e => e.hp > 0 && e.x > .055 && Math.abs(e.x - facilityX(i)) <= .16).sort((a, b) => a.x - b.x)[0]
    if (target) { target.hp -= f.level; f.cooldown = 1; s.shots.push({ from: facilityX(i), to: target.x, life: .18 }) }
  })
  s.enemies = s.enemies.filter(e => {
    if (e.hp <= 0) { s.totals.killed++; return false }
    if (e.x <= .055) { s.totals.passed++; return false }
    return true
  })
  for (const c of defenseSupplies(s)) if (p.running && p.respawn <= 0 && p.protected <= 0 && p.y < 36 && Math.abs(c.x - p.x) < .065) {
    s.collectedIds.push(c.id); s.budget++; s.totals.collected++
  }
  s.shots = s.shots.map(b => ({ ...b, life: b.life - dt })).filter(b => b.life > 0)
  if (s.time >= DEFENSE_RULES.duration) {
    s.totals.unresolved += s.enemies.length; s.enemies = []; s.shots = []; p.running = false
    if (s.wave === 3) s.phase = 'finished'
    else { s.wave++; s.budget += 4; s.phase = 'prepare' }
  }
}
