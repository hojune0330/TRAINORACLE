# Friend arena authority

First version: two guests, common 90-second timer, unlimited 2-second respawns,
2-second spawn protection, push-out score then fewer falls (ties share rank).
All numbers are prototype game balance, never training guidance.

## Local

Node 24.19+; `npm ci --prefix game-server`, `node game-server/server.mjs`.
Default bind `127.0.0.1:4310`, accepted browser origin `http://127.0.0.1:4225`.
Run the Vite app on 4225 with `VITE_FRIEND_ARENA_URL=ws://127.0.0.1:4310`.
`npm test --prefix game-server` runs authority and real-socket tests.
From app, `playwright test --config playwright.arena.config.ts` checks two isolated
browser contexts against these running servers for a full 90-second match.

## Deployment boundary

New Render **free** web service, one instance, Singapore. No database or paid upgrade.
Build: `npm ci --prefix game-server --ignore-scripts`.
Start: `node game-server/server.mjs`.
Environment: `NODE_VERSION=24.19.0`, `HOST=0.0.0.0`,
`ARENA_ORIGINS=https://hojune0330.github.io`; use platform `PORT`.
Health: `/health`. Auto-deploy off so unrelated app pushes do not interrupt matches.
Deploy the exact reviewed main revision and verify two clients before enabling the entry.
Pages packager accepts `--arena-url=wss://<verified-service-host>/` and preserves the
published setting on later releases. No account gate is opened by this setting.

Render supports WebSocket connections on the HTTP service port. Its free service can
sleep after 15 idle minutes and take about a minute to wake. The UI retries and does
not label an unconnected room as ready. Free compute is a preview, not an uptime SLA.
Workspace bandwidth/build quotas still apply; see
https://render.com/docs/websocket and https://render.com/docs/free .

## State, access and limits

- Random 144-bit invitation, independently random 192-bit member reconnect token.
  Only the invite is shareable. Reconnect token stays in tab session storage and is
  never broadcast, logged, placed in the URL or sent to account services.
- Server owns bodies, energy, hit windows, fall attribution, clocks and ranking.
  Clients send monotonically numbered run/jump/dash input, never scores/positions.
- One active socket per member; reconnect closes the old one. Five seconds without
  member traffic or five seconds disconnected interrupts the match without a winner.
- Only up to two members, 100 rooms, 250 sockets; 2 KiB message limit, 45 messages/s.
  Six creations/minute per direct network peer. Behind a reverse proxy this may group
  users; do not trust arbitrary forwarding headers. Adjust only after deployment review.
- 30 Hz simulation, up to 15 Hz active snapshots; 1 Hz idle snapshots. Old snapshots
  are dropped for a slow client instead of growing a send queue. No horizontal scaling:
  rooms are local to the one process. Server stalls over 500ms abort the match.
- Room records: last five rounds, in memory only. Empty rooms expire after a minute;
  absolute maximum lifetime 24h. Restart/redeploy loses rooms and history. Global
  leaderboard/account history is intentionally not implemented.
- Invitation is the room access capability. No user discovery, contact upload,
  health/training data, chat, purchase or notification is involved.

## Controls and ranking

Hold runs, release recovers while drifting backward; swipe upward jumps; double-tap
dashes into a nearby grounded opponent. Keyboard: right arrow, Space/up, D.
Ordinary contact passes through; visual depth is cosmetic. Both attacks use the same
pre-hit state. One target per dash, hit protection, mutual spawn protection; jump avoids
a grounded push. Hurdles/rocks push rather than instantly eliminate. A fall credits the
last opponent hit within 3s, once; stale attribution clears on respawn. End freezes all
input/respawns and ranks push-outs descending, falls ascending, shared rank on a tie.
