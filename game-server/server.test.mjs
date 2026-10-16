import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createArenaServer } from './server.mjs';
import { RULES } from './engine.mjs';
const origin = 'http://127.0.0.1:4225';
async function client(url) {
  const ws = new WebSocket(url, { origin }), inbox = [];
  ws.on('message', raw => inbox.push(JSON.parse(raw)));
  await once(ws, 'open');
  return { ws, send: value => ws.send(JSON.stringify(value)), async wait(type, predicate = () => true) {
    for (let i = 0; i < 200; i++) {
      const index = inbox.findIndex(m => m.type === type && predicate(m));
      if (index >= 0) return inbox.splice(index, 1)[0];
      await new Promise(r => setTimeout(r, 5));
    }
    throw Error(`Missing ${type}`);
  } };
}
test('two real sockets share authority, push credits, unlimited respawns, finish and rematch', async t => {
  const arena = createArenaServer({ tick: false });
  await new Promise(r => arena.server.listen(0, '127.0.0.1', r));
  t.after(() => arena.close());
  const url = `ws://127.0.0.1:${arena.server.address().port}`;
  const a = await client(url); a.send({ type: 'join', name: '토리' }); const aj = await a.wait('joined');
  const b = await client(url); b.send({ type: 'join', room: aj.room, name: '하나' }); const bj = await b.wait('joined');
  const third = await client(url); third.send({ type: 'join', room: aj.room, token: '한'.repeat(32) });
  assert.equal((await third.wait('error')).code, 'room-full');
  a.send({ type: 'ready', ready: true }); b.send({ type: 'ready', ready: true });
  await a.wait('state', s => s.members.every(m => m.ready));
  b.send({ type: 'start' }); await new Promise(r => setTimeout(r, 20));
  assert.equal(arena.rooms.get(aj.room).game, null);
  a.send({ type: 'start' }); await a.wait('state', s => !!s.game); await b.wait('state', s => !!s.game);
  const room = arena.rooms.get(aj.room);
  for (let i = 0; i < 160; i++) arena.advance(1 / 30);
  // Set positions only on the test authority. No client message accepts position/score.
  const [pa, pb] = room.game.players; pa.x = .15; pb.x = .14;
  a.send({ type: 'input', seq: 1, action: 'dash', x: 999, kos: 99 });
  await new Promise(r => setTimeout(r, 20));
  for (let i = 0; i < 30; i++) arena.advance(1 / 30);
  assert.equal(pb.falls, 1); assert.equal(pa.kos, 1); assert.equal(pb.state, 'respawning');
  for (let i = 0; i < 70; i++) arena.advance(1 / 30);
  assert.equal(pb.state, 'alive'); assert.equal(pb.falls, 1);
  room.game.time = RULES.duration - .01; arena.advance(1 / 30);
  const ar = await a.wait('state', s => s.game?.phase === 'finished');
  const br = await b.wait('state', s => s.game?.phase === 'finished');
  assert.deepEqual(ar.game.standings, br.game.standings); assert.equal(ar.history.length, 1);
  a.send({ type: 'ready', ready: true }); b.send({ type: 'ready', ready: true }); await a.wait('state', s => s.members.every(m => m.ready));
  a.send({ type: 'start' }); const again = await a.wait('state', s => s.game?.round === 2);
  assert.equal(again.room, aj.room); assert.ok(again.game.players.every(p => !p.kos && !p.falls));
  const replacement = await client(url); replacement.send({ type: 'join', room: aj.room, token: bj.token });
  const rejoin = await replacement.wait('joined'); assert.equal(rejoin.id, bj.id);
  assert.equal((await replacement.wait('state')).game.round, 2);
  replacement.send({ type: 'leave' }); const stopped = await a.wait('state', s => s.game?.phase === 'interrupted');
  assert.deepEqual(stopped.game.standings, []);
});
test('unapproved web origin cannot open a game socket', async t => {
  const arena = createArenaServer({ tick: false }); await new Promise(r => arena.server.listen(0, '127.0.0.1', r)); t.after(() => arena.close());
  const ws = new WebSocket(`ws://127.0.0.1:${arena.server.address().port}`, { origin: 'https://unrelated.example' });
  await once(ws, 'error'); assert.notEqual(ws.readyState, WebSocket.OPEN);
});

test('party votes do not silently switch modes; host changes clear readiness and survive rematches', async t => {
  let clock = 0;
  const arena = createArenaServer({ tick: false, now: () => clock });
  await new Promise(r => arena.server.listen(0, '127.0.0.1', r)); t.after(() => arena.close());
  const url = `ws://127.0.0.1:${arena.server.address().port}`;
  const a = await client(url); a.send({ type: 'join', name: '토리', partyVersion: 2 }); const aj = await a.wait('joined');
  const b = await client(url); b.send({ type: 'join', room: aj.room, name: '하나', partyVersion: 2 }); const bj = await b.wait('joined');
  const room = arena.rooms.get(aj.room);
  a.send({ type: 'ready', ready: true }); b.send({ type: 'ready', ready: true }); await a.wait('state', s => s.members.every(m => m.ready));
  b.send({ type: 'vote', mode: 'survival' });
  const vote = await a.wait('state', s => s.members.some(m => m.vote === 'survival'));
  assert.equal(vote.mode, 'push'); assert.equal(vote.partyVersion, 2);
  b.send({ type: 'mode', mode: 'survival' }); await new Promise(r => setTimeout(r, 20)); assert.equal(room.mode, 'push');
  a.send({ type: 'mode', mode: 'survival' });
  const selected = await b.wait('state', s => s.mode === 'survival'); assert.ok(selected.members.every(m => !m.ready));
  a.send({ type: 'start' }); await new Promise(r => setTimeout(r, 20)); assert.equal(room.game, null);
  b.send({ type: 'reaction', kind: 'hello' }); const hello = await a.wait('state', s => s.members.find(m => m.id === bj.id)?.reaction === 'hello');
  assert.equal(hello.members.find(m => m.id === bj.id).reaction, 'hello');
  b.send({ type: 'reaction', kind: 'again' }); await new Promise(r => setTimeout(r, 20)); assert.equal(room.members[1].reaction.kind, 'hello');
  clock = 1600; b.send({ type: 'reaction', kind: '<script>bad</script>' }); await new Promise(r => setTimeout(r, 20)); assert.equal(room.members[1].reaction.kind, 'hello');
  a.send({ type: 'ready', ready: true }); b.send({ type: 'ready', ready: true }); await a.wait('state', s => s.mode === 'survival' && s.members.every(m => m.ready));
  a.send({ type: 'start' }); const start = await b.wait('state', s => s.game?.mode === 'survival'); assert.equal(start.room, aj.room);
  a.send({ type: 'mode', mode: 'push' }); await new Promise(r => setTimeout(r, 20)); assert.equal(room.mode, 'survival');
  room.game.time = RULES.duration - .01; arena.advance(1 / 30);
  const result = await a.wait('state', s => s.game?.phase === 'finished'); assert.equal(result.history[0].mode, 'survival');
  assert.ok(result.members.every(m => !m.reaction));
  a.send({ type: 'mode', mode: 'push' }); await b.wait('state', s => s.mode === 'push');
  a.send({ type: 'ready', ready: true }); b.send({ type: 'ready', ready: true }); await a.wait('state', s => s.mode === 'push' && s.members.every(m => m.ready));
  a.send({ type: 'start' }); const next = await b.wait('state', s => s.game?.round === 2);
  assert.equal(next.game.mode, 'push'); assert.equal(next.room, aj.room);
});

test('older clients retain push support and cannot unknowingly start survival', async t => {
  const arena = createArenaServer({ tick: false }); await new Promise(r => arena.server.listen(0, '127.0.0.1', r)); t.after(() => arena.close());
  const url = `ws://127.0.0.1:${arena.server.address().port}`;
  const a = await client(url); a.send({type:'join',partyVersion:2}); const aj=await a.wait('joined');
  const old = await client(url); old.send({type:'join',room:aj.room}); await old.wait('joined');
  a.send({type:'mode',mode:'survival'}); assert.equal((await a.wait('error')).code,'client-update');
  assert.equal(arena.rooms.get(aj.room).mode,'push');
});
test('five seconds without heartbeats interrupts instead of granting a disconnect victory', async t => {
  let clock = 0;
  const arena = createArenaServer({ tick: false, now: () => clock });
  await new Promise(r => arena.server.listen(0, '127.0.0.1', r)); t.after(() => arena.close());
  const url = `ws://127.0.0.1:${arena.server.address().port}`;
  const a = await client(url); a.send({ type: 'join' }); const aj = await a.wait('joined');
  const b = await client(url); b.send({ type: 'join', room: aj.room }); await b.wait('joined');
  a.send({ type: 'ready', ready: true }); b.send({ type: 'ready', ready: true }); await a.wait('state', s => s.members.every(m => m.ready));
  a.send({ type: 'start' }); await a.wait('state', s => !!s.game);
  clock = 5100; a.send({ type: 'input', seq: 1 }); await new Promise(r => setTimeout(r, 20)); arena.advance(1 / 30);
  const state = await a.wait('state', s => s.game?.phase === 'interrupted');
  assert.equal(state.members.length, 1); assert.deepEqual(state.game.standings, []);
});
