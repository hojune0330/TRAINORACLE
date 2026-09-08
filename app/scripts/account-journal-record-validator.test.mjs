import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildAccountJournalRecordValidator } from './build-account-journal-record-validator.mjs'

const app = new URL('../', import.meta.url)
const generatedUrl = new URL('../../supabase/functions/_shared/account-journal-record-validator.mjs', import.meta.url)
const bundle = await build({
  stdin: { contents: `
    export * from './src/domain/account/account-journal-record-schema.ts';
    export { waitingJournal } from './src/test/progressive-journal-fixture.ts';
    export { privateEntry } from './src/domain/private-memo-test-fixtures.ts';
    export { parseJournalEntryForWrite } from './src/domain/journal-schema.ts';
  `, resolveDir: fileURLToPath(app), loader: 'ts' },
  tsconfig: fileURLToPath(new URL('tsconfig.json', app)),
  bundle: true, write: false, platform: 'node', format: 'esm',
})
const source = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const server = await import(generatedUrl.href)
const record = (entry = source.waitingJournal()) => ({ version: 2, state: 'FINALIZED', kind: 'JOURNAL', entry })
const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)])) : value

for (const [name, validate] of [
  ['source', source.validateAccountJournalRecord],
  ['generated server', server.validateAccountJournalRecord],
  ['union-ready schema', value => source.accountJournalRecordSchema.safeParse(value).success],
]) {
  test(`${name}: accepts existing quick and private journal fixtures without mutation`, () => {
    for (const entry of [source.waitingJournal(), source.privateEntry('p', 'Synthetic private body')]) {
      const value = record(entry)
      const before = structuredClone(value)
      assert.notEqual(source.parseJournalEntryForWrite(entry), null)
      assert.equal(validate(value), true)
      assert.equal(validate(reverseKeys(value)), true)
      assert.deepEqual(value, before)
    }
  })
  const invalid = [
    ['draft', value => { value.state = 'DRAFT' }],
    ['version', value => { value.version = 1 }],
    ['plan document', value => { value.kind = 'PLAN' }],
    ['envelope unknown', value => { value.body = 'Synthetic private body' }],
    ['entry unknown', value => { value.entry.unknown = true }],
    ['unknown undefined', value => { value.entry.unknown = undefined }],
    ['nested unknown', value => { value.entry.fieldProvenance.rpe.extra = true }],
    ['purpose transform', value => { value.entry.memoPurpose = 'INVALID' }],
    ['missing memo purpose', value => { value.entry.memo = 'Synthetic private body' }],
    ['impossible date', value => { value.entry.date = '2026-02-30' }],
    ['empty identity', value => { value.entry.id = '' }],
    ['synced write', value => { value.entry.syncState = 'synced' }],
    ['effort conflict', value => { value.entry.rpe = 6; value.entry.rpeBand = 'RPE_5_6' }],
    ['body unanswered', value => { value.entry.painCheckStatus = 'UNANSWERED' }],
    ['body signal without level', value => { value.entry.painCheckStatus = 'SIGNAL_REPORTED' }],
    ['objective data missing', value => { value.entry.objectiveDataState = 'CONFIRMED' }],
    ['plan link missing', value => { value.entry.planExecutionRelation = 'AS_PLANNED' }],
    ['wrong provenance field', value => { value.entry.fieldProvenance.memo = { provenance: 'EXPLICIT' } }],
    ['wrong derivation input', value => { value.entry.fieldProvenance.planExecutionRelation.derivedFrom = ['memo'] }],
    ['wrong derivation rule', value => { value.entry.fieldProvenance.planExecutionRelation.derivationRuleId = 'INVALID' }],
    ['rest with performance', value => { value.entry.activityOutcome = 'RESTED' }],
    ['nonfinite', value => { value.entry.rpe = Infinity }],
    ['cycle', value => { value.entry.loop = value }],
  ]
  for (const [label, mutate] of invalid) test(`${name}: rejects ${label}`, () => {
    const value = record()
    mutate(value)
    assert.equal(validate(value), false)
  })
  test(`${name}: rejects accessors without invoking them or exposing errors`, () => {
    const value = record()
    let invoked = false
    Object.defineProperty(value.entry, 'memo', { enumerable: true, get() { invoked = true; throw new Error('Synthetic private body') } })
    assert.equal(validate(value), false)
    assert.equal(invoked, false)
  })
}

test('schema reports only a fixed generic issue without body or field paths', () => {
  const result = source.accountJournalRecordSchema.safeParse({ ...record(), privateField: 'Synthetic private body' })
  assert.equal(result.success, false)
  assert.deepEqual(result.error.issues, [{ code: 'custom', message: 'Invalid account journal record', path: [] }])
})

for (const [name, validate] of [['source', source.validateAccountJournalRecordUpdate], ['server', server.validateAccountJournalRecordUpdate]]) {
  test(`${name}: edits preserve identity, date and immutable provenance`, () => {
    const previous = record(source.privateEntry('p', 'Synthetic old body'))
    const next = structuredClone(previous)
    next.entry.memo = 'Synthetic changed body'
    assert.equal(validate(previous, next), true)
    for (const field of ['id', 'date']) {
      const changed = structuredClone(next)
      changed.entry[field] = field === 'id' ? 'other' : '2026-09-07'
      assert.equal(server.validateAccountJournalRecord(changed), true)
      assert.equal(validate(previous, changed), false)
    }
    assert.equal(validate(null, next), false)
    const invented = structuredClone(next)
    invented.entry.fieldProvenance = {}
    assert.equal(server.validateAccountJournalRecord(invented), true)
    assert.equal(validate(previous, invented), false)
  })
}

test('generated bytes are reproducible and all runtime imports are bundled', async () => {
  const result = await buildAccountJournalRecordValidator()
  assert.equal(await readFile(generatedUrl, 'utf8'), result.outputFiles[0].text)
  assert.equal(Object.values(result.metafile.outputs).flatMap(output => output.imports).length, 0)
  assert.deepEqual(Object.keys(server), ['validateAccountJournalRecord', 'validateAccountJournalRecordUpdate'])
  const inputs = Object.keys(result.metafile.inputs).filter(name => !name.includes('node_modules/')).sort()
  assert.deepEqual(inputs, [
    'app/account-journal-record-server-entry.ts',
    'app/src/domain/account/account-journal-record-schema.ts',
    'app/src/domain/dates.ts', 'app/src/domain/field-provenance.ts',
    'app/src/domain/intensity-assessment.ts', 'app/src/domain/intensity-summary.ts',
    'app/src/domain/journal-edit-policy.ts', 'app/src/domain/journal-schema.ts', 'app/src/domain/numeric-input.ts',
    'app/src/domain/planned-session-link.ts', 'impl/src/plan-generator/candidate-identity.ts',
  ])
})

test('server import and validation never evaluate browser, DOM, storage or network globals', () => {
  const code = `
    for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'WebSocket']) {
      Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error('Forbidden global: ' + key) } });
    }
    const { validateAccountJournalRecord } = await import(${JSON.stringify(generatedUrl.href)});
    if (!validateAccountJournalRecord(${JSON.stringify(record())})) process.exit(1);
    if (validateAccountJournalRecord({})) process.exit(2);
  `
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' })
  assert.equal(child.status, 0, child.stderr)
  assert.equal(child.stdout, '')
})

test('canonical guard mutation is killed by the unknown-field rejection assertion', async () => {
  const codecUrl = new URL('src/domain/account/account-journal-record-schema.ts', app)
  const original = await readFile(codecUrl, 'utf8')
  const guard = 'if (input !== canonicalJson(JSON.parse(JSON.stringify(record)))) return null'
  assert.equal(original.includes(guard), true)
  const mutant = await build({
    stdin: {
      contents: original.replace(guard, ''),
      resolveDir: fileURLToPath(new URL('./', codecUrl)), loader: 'ts',
    },
    tsconfig: fileURLToPath(new URL('tsconfig.json', app)),
    bundle: true, write: false, platform: 'node', format: 'esm',
  })
  const mutated = await import(`data:text/javascript;base64,${Buffer.from(mutant.outputFiles[0].text).toString('base64')}`)
  const value = record()
  value.entry.unknown = true
  assert.equal(source.validateAccountJournalRecord(value), false)
  assert.throws(() => assert.equal(mutated.validateAccountJournalRecord(value), false), { code: 'ERR_ASSERTION' })
})
