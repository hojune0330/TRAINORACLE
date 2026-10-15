import { test } from 'node:test';
import assert from 'node:assert/strict';

test('survival keeps dash movement but never attacks another player; ranks falls before dodges', () => {
  const s = newRound(['a', 'b'], 1, RULES, 'survival'); s.phase = 'playing'; s.time = 5; s.nextHazard = 100;
  const [a, b] = s.players; a.x = b.x = .5; a.protectedUntil = b.protectedUntil = 0;
  command(s, 'a', { action: 'dash', run: true }); step(s, 1 / 30);
  assert.ok(a.x > .5); assert.equal(b.vx, 0); assert.equal(b.lastHit, null);
  a.falls = 1; a.dodges = 20; b.falls = 0; b.dodges = 2; finish(s);
  assert.equal(s.standings[0].id, 'b'); assert.equal(s.standings[0].rank, 1);
  a.falls = b.falls; finish(s); assert.equal(s.standings[0].id, 'a');
  b.dodges = a.dodges; finish(s); assert.deepEqual(s.standings.map(p => p.rank), [1, 1]);
});

test('survival has denser paired hazards with unchanged jump clearance and unlimited idle respawns', () => {
  const survival = newRound(['a', 'b'], 1, RULES, 'survival'), push = newRound(['a', 'b']);
  for (let frame = 0; frame < 30 * 70; frame++) { step(survival, 1 / 30); step(push, 1 / 30); }
  assert.ok(survival.hazardId > push.hazardId); assert.ok(survival.players[0].falls > 5);
  assert.equal(survival.players[0].kos, 0);
  const p = survival.players[0]; p.state = 'alive'; p.protectedUntil = 0; p.hitUntil = 0; p.x = .5; p.y = 40;
  survival.hazards = [{ id: 999, x: .5, kind: 'hurdle', checked: [] }]; survival.nextHazard = 1000;
  const dodges = p.dodges; step(survival, 1 / 30); assert.equal(p.dodges, dodges + 1);
});
import { RULES, newRound, command, step, finish } from './engine.mjs';
function advance(s, seconds) { for (let t = 0; t < seconds - .000001; t += 1 / 30) step(s, Math.min(1 / 30, seconds - t)); }
function playing() { const s = newRound(['a', 'b']); advance(s, 3.05); return s; }
test('unlimited respawns preserve score and time after twelve falls', () => {
  const s = playing(), p = s.players[0], other = s.players[1];
  for (let i = 1; i <= 12; i++) {
    p.x = .01; p.lastHit = { id: other.id, time: s.time }; step(s, 1 / 30);
    assert.equal(p.state, 'respawning'); assert.equal(p.falls, i); assert.equal(other.kos, i);
    const time = s.time; advance(s, 1.9); assert.equal(p.falls, i); assert.equal(p.state, 'respawning');
    advance(s, .2); assert.equal(p.state, 'alive'); assert.ok(p.x > .45); assert.ok(p.energy > 99);
    assert.ok(s.time > time); assert.equal(p.running, false); assert.equal(p.lastHit, null);
  }
  assert.equal(s.phase, 'playing'); assert.equal(p.falls, 12);
});
test('simultaneous dashes hit both; a dash cannot repeatedly hit a body', () => {
  const s = playing(); advance(s, 2.1);
  for (const p of s.players) { p.x = .5; command(s, p.id, { action: 'dash' }); }
  step(s, 1 / 30);
  assert.ok(s.players.every(p => p.vx < -1 && p.lastHit));
  const hitTime = s.players[0].lastHit.time; advance(s, .2);
  assert.equal(s.players[0].lastHit.time, hitTime);
});
test('spawn protection blocks outgoing and incoming push; jumping avoids a push', () => {
  const s = playing(), [a, b] = s.players; a.x = b.x = .5;
  command(s, a.id, { action: 'dash' }); assert.equal(a.dashUntil, 0);
  a.protectedUntil = 0; command(s, a.id, { action: 'dash' }); step(s, 1 / 30); assert.equal(b.lastHit, null);
  advance(s, 3); a.x = b.x = .5; b.y = 70; command(s, a.id, { action: 'dash' }); step(s, 1 / 30);
  assert.equal(b.lastHit, null);
});
test('expired attacker gets no credit and match ends only at deadline with joint ranks', () => {
  const s = playing(), [a, b] = s.players; advance(s, 4);
  a.x = .01; a.lastHit = { id: b.id, time: 0 }; step(s, 1 / 30); assert.equal(b.kos, 0);
  a.falls = b.falls = 7; a.kos = b.kos = 2; s.time = s.duration - .01;
  step(s, 1 / 30); assert.equal(s.phase, 'finished'); assert.deepEqual(s.standings.map(p => p.rank), [1, 1]);
  const frozen = JSON.stringify(s); command(s, a.id, { action: 'dash', run: true }); advance(s, 5); assert.equal(JSON.stringify(s), frozen);
});
test('disconnect abort has no winner; stale held input expires', () => {
  const s = playing(); command(s, 'a', { run: true }); advance(s, .6);
  assert.equal(s.players[0].running, false); finish(s, true); assert.deepEqual(s.standings, []);
});
