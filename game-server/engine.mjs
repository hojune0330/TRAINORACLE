// Game-only prototype balance. No training/health/account data enters this engine.
export const RULES = Object.freeze({ duration: 90, countdown: 3, respawn: 2, protection: 2, creditWindow: 3 });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function newRound(ids, round = 1, rules = RULES) {
  return { round, phase: 'countdown', time: -rules.countdown, duration: rules.duration, rules,
    hazards: [], nextHazard: 3, hazardId: 0, standings: [],
    players: ids.map((id, i) => ({ id, slot: i, x: (i + round) % 2 ? .46 : .62, y: 0, vy: 0, vx: 0,
      energy: 100, running: false, inputAge: 1, kos: 0, falls: 0, dodges: 0, state: 'alive', respawnAt: 0,
      protectedUntil: rules.protection, hitUntil: 0, dashUntil: 0, cooldownUntil: 0, attacked: false, lastHit: null })) };
}
export function command(state, id, input) {
  const p = state.players.find(p => p.id === id);
  if (!p || state.phase !== 'playing' || p.state !== 'alive') return;
  if (typeof input.run === 'boolean') { p.running = input.run; p.inputAge = 0; }
  if (input.action === 'jump' && p.y === 0 && p.energy >= 8) { p.vy = 470; p.energy -= 8; }
  if (input.action === 'dash' && p.y === 0 && p.energy >= 20 && state.time >= p.cooldownUntil && state.time >= p.protectedUntil) {
    p.energy -= 20; p.dashUntil = state.time + .25; p.cooldownUntil = state.time + 2.5; p.attacked = false;
  }
}
function fall(state, p) {
  p.falls++;
  const attacker = p.lastHit && state.time - p.lastHit.time <= state.rules.creditWindow && state.players.find(a => a.id === p.lastHit.id);
  if (attacker) attacker.kos++;
  p.state = 'respawning'; p.respawnAt = state.time + state.rules.respawn;
  p.running = false; p.vx = 0; p.dashUntil = 0; p.lastHit = null;
}
export function finish(state, interrupted = false) {
  state.phase = interrupted ? 'interrupted' : 'finished';
  state.players.forEach(p => { p.running = false; p.dashUntil = 0; });
  const sorted = [...state.players].sort((a, b) => b.kos - a.kos || a.falls - b.falls);
  state.standings = interrupted ? [] : sorted.map((p, i) => ({ id: p.id, kos: p.kos, falls: p.falls, dodges: p.dodges,
    rank: sorted.findIndex(other => other.kos === p.kos && other.falls === p.falls) + 1 }));
}
/** Caller supplies fixed <= 1/30s steps. Both attacks resolve against the same pre-hit state. */
export function step(state, dt) {
  if (!['countdown', 'playing'].includes(state.phase)) return;
  if (state.time >= state.duration) { finish(state); return; }
  dt = Math.min(clamp(dt, 0, 1 / 30), state.duration - state.time);
  state.time = Math.min(state.duration, state.time + dt);
  if (state.time < 0) return;
  state.phase = 'playing';
  const t = state.time;
  for (const p of state.players) {
    if (p.state === 'respawning') {
      if (t >= p.respawnAt) {
        // Unlimited respawns: score and falls survive, only the body/input reset.
        p.state = 'alive'; p.x = p.slot === 0 ? .53 : .68; p.y = 0; p.vy = 0; p.vx = 0;
        p.energy = 100; p.running = false; p.inputAge = 1; p.lastHit = null;
        p.protectedUntil = t + state.rules.protection; p.hitUntil = 0; p.dashUntil = 0; p.cooldownUntil = t; p.attacked = false;
      }
      continue;
    }
    p.inputAge += dt;
    if (p.inputAge > .5) p.running = false;
    const run = p.running && p.energy > 0;
    p.energy = clamp(p.energy + (run ? -11 : 19) * dt, 0, 100);
    const mud = t >= 30 && t < 60;
    p.x += ((run ? (mud ? .13 : .16) : 0) - .085 + (t < p.dashUntil ? .38 : 0) + p.vx) * dt;
    p.vx *= Math.exp(-5 * dt); p.x = Math.min(.89, p.x);
    if (p.vy !== 0 || p.y > 0) { p.y = Math.max(0, p.y + p.vy * dt); p.vy -= 1150 * dt; if (p.y === 0) p.vy = 0; }
  }
  const hits = [];
  for (const a of state.players) {
    if (a.state !== 'alive' || t >= a.dashUntil || a.attacked || t < a.protectedUntil || a.y > 36) continue;
    const b = state.players.find(b => b.id !== a.id && b.state === 'alive' && t >= b.protectedUntil && t >= b.hitUntil && b.y < 36 && Math.abs(a.x - b.x) <= .115);
    if (b) hits.push([a, b]);
  }
  for (const [a, b] of hits) {
    a.attacked = true; b.vx = -1.25; b.hitUntil = t + .65; b.lastHit = { id: a.id, time: t };
  }
  if (t >= state.nextHazard) {
    state.hazards.push({ id: ++state.hazardId, x: 1.18, kind: state.hazardId % 2 ? 'hurdle' : 'rock', checked: [] });
    state.nextHazard += 3.8;
  }
  for (const h of state.hazards) {
    h.x -= .24 * dt;
    for (const p of state.players) {
      if (p.state !== 'alive' || h.checked.includes(p.id) || Math.abs(h.x - p.x) > .045) continue;
      h.checked.push(p.id);
      if (p.y >= (h.kind === 'hurdle' ? 36 : 25)) p.dodges++;
      else if (t >= p.protectedUntil && t >= p.hitUntil) { p.vx = -.48; p.hitUntil = t + .65; p.energy = Math.max(0, p.energy - 8); }
    }
  }
  state.hazards = state.hazards.filter(h => h.x > -.15);
  for (const p of state.players) if (p.state === 'alive' && p.x < .055) fall(state, p);
  if (state.time >= state.duration) finish(state);
}
export function publicRound(state) {
  if (!state) return null;
  const { rules, nextHazard, hazardId, ...result } = state;
  return { ...result, players: state.players.map(({ inputAge, lastHit, attacked, ...p }) => p),
    hazards: state.hazards.map(({ checked, ...h }) => h) };
}
