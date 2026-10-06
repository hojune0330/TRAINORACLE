import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 });
const sourceSha = git('rev-parse', 'HEAD').trim();
const shared = ['account-journal-handler', 'account-journal-crypto', 'account-journal-record-validator',
  'account-journal-comparison-original', 'account-plan-collection-handler', 'account-plan-collection-validator',
  'account-state-validator', 'oracle-profile-comparison-handler', 'oracle-profile-comparison-validator'];
const routes = new Map(shared.map(name => [`/source/${name}`, `supabase/functions/_shared/${name}.mjs`]));
for (const name of ['account-journal', 'oracle-profile-comparison']) {
  routes.set(`/source/${name}-index`, `supabase/functions/${name}/index.ts`);
}
for (const path of git('ls-tree', '-r', '--name-only', 'HEAD', '--', 'supabase/migrations').trim().split('\n')) {
  const name = path.split('/').at(-1);
  if (/^00(5[1-9]|60)_/.test(name)) routes.set(`/source/${name.slice(0, -4)}`, path);
}
const server = createServer((request, response) => {
  const path = routes.get(request.url);
  if (request.method !== 'GET' || !path) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" });
  const source = git('show', `${sourceSha}:${path}`).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  response.end(`<!doctype html><meta charset="utf-8"><title>Committed source preview</title><h1>${path}</h1><p>${sourceSha}</p><pre>${source}</pre>`);
});
server.listen(Number(process.argv[2] ?? 4462), '127.0.0.1', () => {
  console.log(`Committed public source only: ${sourceSha}; ${routes.size} allowlisted files; loopback only.`);
});
