import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(resolve(root, 'production-plan.json'), 'utf8'));
const draft = process.argv.includes('--draft');
const entries = plan.assets.map(a => {
  const file = resolve(root, a.file);
  const generated = existsSync(file);
  if (!generated && !draft) throw Error('Missing asset: ' + a.id);
  let agent = {};
  const agentFile = resolve(root, a.group, 'assets.json');
  if (existsSync(agentFile)) {
    const data = JSON.parse(readFileSync(agentFile, 'utf8'));
    agent = (Array.isArray(data) ? data : data.assets ?? []).find(x => x.id === a.id) ?? {};
  }
  const qaFile = resolve(root, 'file-audit.json');
  const audit = existsSync(qaFile) ? JSON.parse(readFileSync(qaFile, 'utf8')).assets.find(x => x.id === a.id) : null;
  return { ...a, status: generated ? 'image-produced' : 'pending', bytes: generated ? statSync(file).size : 0,
    sha256: generated ? createHash('sha256').update(readFileSync(file)).digest('hex') : null,
    visualReview: agent.qaNotes ?? null, fileAudit: audit ?? null };
});
const manifest = { ...plan, builtAt: new Date().toISOString(), generatedCount: entries.filter(x => x.bytes).length, assets: entries };
writeFileSync(resolve(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const tokensPath = resolve(root, '../../colors_and_type.css');
const tokenText = readFileSync(tokensPath, 'utf8');
const tokenNames = ['bg','surface','surface-2','ink','ink-2','ink-3','line','brand'];
const lines = tokenText.split(/\r?\n/).filter(l => /^\s*--/.test(l) && (l.includes('--game-') || tokenNames.some(n => l.trimStart().startsWith('--' + n + ':'))));
writeFileSync(resolve(root, 'tokens.css'), '/* Copied from repository colors_and_type.css for this review gallery. */\n:root {\n' + lines.join('\n') + '\n}\n');
const template = readFileSync(resolve(root, 'gallery-template.html'), 'utf8');
writeFileSync(resolve(root, 'index.html'), template.replace('/* ASSET_MANIFEST */', JSON.stringify(manifest).replace(/</g, '\\u003c')));
console.log(JSON.stringify({ planned: entries.length, generated: manifest.generatedCount, bytes: entries.reduce((s,a) => s+a.bytes,0) }));
