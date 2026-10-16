import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { newRound, command, step, finish, publicRound, RULES } from './engine.mjs';

const secret = () => randomBytes(24).toString('base64url');
const equal = (a, b) => typeof b === 'string' && /^[A-Za-z0-9_-]{32}$/.test(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 128_000) ws.send(JSON.stringify(data)); };
export function createArenaServer({ origins = ['http://127.0.0.1:4225'], rules = RULES, now = () => performance.now(), tick = true } = {}) {
  const rooms = new Map(), quotas = new Map();
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.url !== '/health') { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, version: 1, rooms: rooms.size }));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/' || !origins.includes(req.headers.origin) || wss.clients.size >= 250) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  const snapshot = room => ({ type: 'state', room: room.id, host: room.host,
    members: room.members.map(m => ({ id: m.id, name: m.name, ready: m.ready, connected: !!m.ws })),
    game: publicRound(room.game), history: room.game && ['playing', 'countdown'].includes(room.game.phase) ? [] : room.history });
  const broadcast = room => { const data = snapshot(room); for (const m of room.members) if (m.ws) send(m.ws, data); };
  const stop = room => { if (room.game && ['countdown', 'playing'].includes(room.game.phase)) finish(room.game, true); };
  function advance(dt) {
    const time = now();
    for (const [id, room] of rooms) {
      const previousPhase = room.game?.phase;
      if (time - room.created > 24 * 3600_000 || room.members.every(m => !m.ws && time - m.gone > 60_000)) {
        for (const m of room.members) m.ws?.close(4004, 'Room expired'); rooms.delete(id); continue;
      }
      for (const m of room.members) if (m.ws && time - m.lastSeen >= 5000) {
        const stale = m.ws; m.ws = null; m.gone = m.lastSeen; stale.terminate();
      }
      for (const m of room.members) if (!m.ws && time - m.gone >= 5000) {
        stop(room); room.members = room.members.filter(p => p !== m);
        if (room.host === m.id) room.host = room.members[0]?.id;
      }
      if (room.game) {
        // A stalled authority must not grant extra time or resolve a large unseen hit burst.
        if (dt > .5) stop(room);
        else for (let remaining = dt; remaining > .000001; remaining -= 1 / 30) step(room.game, Math.min(remaining, 1 / 30));
        if (room.game.phase === 'finished' && room.recorded !== room.game.round) {
          room.recorded = room.game.round;
          room.history.unshift({ round: room.game.round, standings: room.game.standings.map(p => ({ ...p, name: room.members.find(m => m.id === p.id)?.name ?? '러너' })) });
          room.history = room.history.slice(0, 5);
        }
      }
      room.sinceBroadcast = (room.sinceBroadcast ?? 0) + dt;
      const interval = room.game && ['playing', 'countdown'].includes(room.game.phase) ? 1 / 15 : 1;
      if (room.sinceBroadcast >= interval || previousPhase !== room.game?.phase) { room.sinceBroadcast = 0; broadcast(room); }
    }
    for (const [key, q] of quotas) if (time - q.since > 60_000) quotas.delete(key);
  }
  wss.on('connection', (ws, req) => {
    let member, room, count = 0, countAt = now(), lastSeq = -1;
    const authTimeout = setTimeout(() => { if (!member) ws.close(4001, 'Join required'); }, 10_000);
    ws.on('error', () => {});
    ws.on('message', raw => {
      if (now() - countAt > 1000) { count = 0; countAt = now(); }
      if (++count > 45) { ws.close(4008, 'Too many inputs'); return; }
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { ws.close(4002, 'Invalid message'); return; }
      if (!msg || typeof msg !== 'object') return;
      const error = code => send(ws, { type: 'error', code });
      if (!member) {
        if (msg.type !== 'join') return error('join-required');
        if (msg.room && !/^[A-Za-z0-9_-]{24}$/.test(msg.room)) return error('room-missing');
        room = msg.room ? rooms.get(msg.room) : null;
        if (msg.room && !room) return error('room-missing');
        if (!room) {
          const ip = req.socket.remoteAddress ?? 'unknown';
          const quota = quotas.get(ip) ?? { since: now(), count: 0 };
          if (quota.count >= 6 || rooms.size >= 100) return error('capacity');
          quota.count++; quotas.set(ip, quota);
          room = { id: randomBytes(18).toString('base64url'), members: [], host: null, game: null, history: [], created: now(), round: 0, sinceBroadcast: 0 };
          rooms.set(room.id, room);
        }
        const existing = room.members.find(m => equal(m.token, msg.token));
        if (existing) {
          const previous = existing.ws; existing.ws = ws; existing.lastSeen = now(); member = existing;
          previous?.close(4009, 'Reconnected elsewhere');
        } else {
          if (room.members.length >= 2) return error('room-full');
          if (room.game && ['playing', 'countdown'].includes(room.game.phase)) return error('in-progress');
          const name = typeof msg.name === 'string' ? msg.name.replace(/[\p{C}]/gu, '').trim().slice(0, 12) : '';
          member = { id: secret(), token: secret(), name: name || `러너 ${room.members.length + 1}`, ready: false, ws, gone: 0, lastSeen: now() };
          room.members.push(member); room.host ??= member.id;
        }
        clearTimeout(authTimeout);
        send(ws, { type: 'joined', room: room.id, id: member.id, token: member.token }); broadcast(room); return;
      }
      if (member.ws !== ws || !room.members.includes(member)) return;
      member.lastSeen = now();
      if (msg.type === 'leave') {
        stop(room); room.members = room.members.filter(m => m !== member);
        if (room.host === member.id) room.host = room.members[0]?.id;
        broadcast(room); ws.close(1000, 'Left'); return;
      }
      if (msg.type === 'ready' && (!room.game || ['finished', 'interrupted'].includes(room.game.phase))) {
        member.ready = msg.ready === true; broadcast(room); return;
      }
      if (msg.type === 'start' && room.host === member.id && room.members.length === 2 && room.members.every(m => m.ready && m.ws)
        && (!room.game || ['finished', 'interrupted'].includes(room.game.phase))) {
        room.game = newRound(room.members.map(m => m.id), ++room.round, rules);
        room.members.forEach(m => { m.ready = false; }); broadcast(room); return;
      }
      if (msg.type === 'input' && Number.isSafeInteger(msg.seq) && msg.seq > lastSeq && room.game) {
        lastSeq = msg.seq; command(room.game, member.id, { run: msg.run === true, action: msg.action });
      }
    });
    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (member?.ws !== ws) return;
      member.ws = null; member.gone = now(); member.ready = false;
      const body = room.game?.players.find(p => p.id === member.id); if (body) body.running = false;
      broadcast(room);
    });
  });
  let previous = now();
  const timer = tick ? setInterval(() => { const t = now(); advance((t - previous) / 1000); previous = t; }, 1000 / 30) : null;
  return { server, advance, rooms, async close() {
    if (timer) clearInterval(timer);
    for (const client of wss.clients) client.terminate();
    await new Promise(resolve => wss.close(resolve));
    if (server.listening) await new Promise(resolve => server.close(resolve));
  } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origins = (process.env.ARENA_ORIGINS ?? 'http://127.0.0.1:4225').split(',');
  const arena = createArenaServer({ origins });
  arena.server.listen(Number(process.env.PORT ?? 4310), process.env.HOST ?? '127.0.0.1', () => console.log('Friend arena listening'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void arena.close().then(() => process.exit(0)); });
}
