import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const app = fileURLToPath(new URL('../', import.meta.url))
const fixture = {
  id: 'synthetic-body', kind: 'evening', date: '2026-10-12', savedAt: '2026-10-12T00:00:00Z', syncState: 'local',
  sleepH: 0, sleepQuality: 0, weightKg: '', restingHr: '', painParts: {}, mood: 0, note: '',
  fieldProvenance: { painParts: { provenance: 'EXPLICIT' } },
  bodyPartMetadata: { schemaVersion: 1, observations: [{ id: 'other_11111111-1111-4111-8111-111111111111',
    labelSnapshot: 'SYNTHETIC_PRIVATE_LABEL', severity: 4, note: 'SYNTHETIC_PRIVATE_NOTE' }] },
}
const mutations = [
  {
    name: 'other 4 remains in numeric safety', file: 'body-part-metadata.ts',
    before: 'if (metadata !== null) metadata.observations.forEach((item, index) => { parts[`other_${index + 1}`] = item.severity })',
    after: 'if (metadata !== null) {}',
    check: 'assert.equal(Object.values(m.journalPainPartsForSafety(entry)).includes(4), true)',
  },
  {
    name: 'default export excludes private body labels', file: 'safe-export.ts',
    before: 'painParts: journalPainPartsForSafety(entry),',
    after: 'bodyPartMetadata: entry.bodyPartMetadata, painParts: journalPainPartsForSafety(entry),',
    check: "assert.equal(JSON.stringify(m.toExportJournalEntry(entry)).includes('SYNTHETIC_PRIVATE_LABEL'), false)",
  },
  {
    name: 'private companion requires JOURNAL v4', file: 'account-journal-record-schema.ts',
    before: 'if (entry.bodyPartMetadata !== undefined && candidate.version !== 4) return null',
    after: '',
    check: "assert.equal(m.parseAccountJournalRecord({version:2,state:'FINALIZED',kind:'JOURNAL',entry}), null)",
  },
  {
    name: 'older edit cannot erase supported companion', file: 'body-part-metadata.ts',
    before: 'return previous.bodyPartMetadata === undefined || next.bodyPartMetadata !== undefined',
    after: 'return true',
    check: "const previous={version:4,state:'FINALIZED',kind:'JOURNAL',entry}; const next=structuredClone(previous); delete next.entry.bodyPartMetadata; assert.equal(m.validateAccountJournalRecordUpdate(previous,next), false)",
  },
  {
    name: 'supported companion survives a later save', file: 'journal-local-storage.ts',
    before: 'if (!journalWriteRetainsBodyMetadata(previous, entries)) return false',
    after: '',
    check: `const values=new Map(); const storage={get length(){return values.size},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()}; const initialized=await m.initializeCanonicalJournalStorage(storage,undefined,operation=>operation()); assert.equal(initialized.status,'ready'); const raw=JSON.stringify([entry]); storage.setItem(m.JOURNAL_STORAGE_KEY,raw); const replacement={...entry}; delete replacement.bodyPartMetadata; assert.equal(m.writeJournalEntries(storage,[replacement],raw),false); assert.equal(storage.getItem(m.JOURNAL_STORAGE_KEY),raw)`,
  },
]

async function bundle(mutation) {
  return build({
    absWorkingDir: app,
    stdin: { contents: `export * from './src/domain/body-part-metadata.ts';
      export { toExportJournalEntry } from './src/domain/safe-export.ts';
      export { parseAccountJournalRecord, validateAccountJournalRecordUpdate } from './src/domain/account/account-journal-record-schema.ts';
      export { writeJournalEntries, JOURNAL_STORAGE_KEY } from './src/domain/journal-local-storage.ts';
      export { initializeCanonicalJournalStorage } from './src/domain/canonical-journal-storage.ts';`, resolveDir: app, loader: 'ts' },
    tsconfig: `${app}/tsconfig.json`, bundle: true, write: false, platform: 'node', format: 'esm',
    define: { navigator: 'undefined' }, minify: true,
    plugins: mutation ? [{ name: 'in-memory-body-contract-fault', setup(builder) {
      builder.onLoad({ filter: /\.ts$/ }, async args => {
        if (!args.path.endsWith(`/${mutation.file}`) && !args.path.endsWith(`\\${mutation.file}`)) return null
        const original = await readFile(args.path, 'utf8')
        assert.ok(original.includes(mutation.before), 'mutation must replace an observed guard')
        return { contents: original.replace(mutation.before, mutation.after), loader: 'ts' }
      })
    } }] : [],
  })
}

const baseline = await bundle()
function run(result, mutation) {
  const url = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
  const code = `import assert from 'node:assert/strict'; import {test} from 'node:test'; import {webcrypto} from 'node:crypto';
    globalThis.crypto ??= webcrypto;
    const m=await import(${JSON.stringify(url)}); const entry=${JSON.stringify(fixture)};
    test(${JSON.stringify(mutation.name)},async()=>{${mutation.check}});`
  return spawnSync(process.execPath, ['--input-type=module', '--test-reporter=tap'], {
    input: code, encoding: 'utf8', timeout: 30000,
    // A native test-worker child otherwise emits internal binary events instead
    // of the named TAP failure this evidence check intentionally inspects.
    env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  })
}

for (const mutation of mutations) {
  test(`named mutation kill: ${mutation.name}`, async () => {
    const positive = run(baseline, mutation)
    assert.equal(positive.status, 0, positive.stderr || positive.stdout)
    const negative = run(await bundle(mutation), mutation)
    assert.notEqual(negative.status, 0)
    assert.match(negative.stdout, new RegExp(`not ok \\d+ - ${mutation.name}`))
  })
}
