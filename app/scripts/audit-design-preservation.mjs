import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.argv[2] ?? '00ca7c5e2e7f70d7c0f18e3e351c2392c51af23f';
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const trackedChanges = git('diff', '--name-only', base).split(/\r?\n/).filter(Boolean);
const addedFiles = git('ls-files', '--others', '--exclude-standard').split(/\r?\n/).filter(Boolean);
const changed = [...new Set([...trackedChanges, ...addedFiles])];
const protectedChanges = changed.filter(p => /^(?:impl\/|app\/src\/domain\/|supabase\/)/u.test(p)
  || p === 'app/src/screens/plan-beta/labels.ts');

function words(source, filename) {
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = new Map();
  function visit(node) {
    if (ts.isJsxText(node) || ts.isStringLiteralLike(node)) {
      const value = node.text.replace(/\s+/gu, ' ').trim();
      if (/[가-힣]/u.test(value)) result.set(value, (result.get(value) ?? 0) + 1);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return result;
}

const wordingChanges = [];
for (const file of changed.filter(p => p.startsWith('app/src/') && p.endsWith('.tsx') && !p.includes('.test.'))) {
  let before;
  try { before = git('show', `${base}:${file}`); } catch { before = ''; }
  const oldWords = words(before, file);
  const newWords = words(readFileSync(path.join(repo, file), 'utf8'), file);
  const differences = [...new Set([...oldWords.keys(), ...newWords.keys()])]
    .filter(value => (oldWords.get(value) ?? 0) !== (newWords.get(value) ?? 0))
    .map(value => ({ value, before: oldWords.get(value) ?? 0, after: newWords.get(value) ?? 0 }));
  if (differences.length) wordingChanges.push({ file, differences });
}
console.log(JSON.stringify({ base, changedFiles: changed.length, protectedChanges, wordingChanges,
  limit: 'Source-diff check only. Runtime values, focus, behavior and visual layout require separate tests.' }, null, 2));
if (protectedChanges.length) process.exitCode = 1;
