// Deliberate regression probes required by AGENTS.md. Restores exact input bytes.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const root = fileURLToPath(new URL('../../../', import.meta.url))
const cases = [
  { file: 'app/src/screens/ImportedRecords.tsx', test: 'src/screens/ImportedRecords.contract.test.tsx',
    name: 'lists every actual imported journal and opens an exact same-day or different-day identity without writing',
    from: 'imported.map((entry, index)', to: 'imported.slice(0, 1).map((entry, index)' },
  { file: 'app/src/screens/LogDetail.tsx', test: 'src/screens/LogDetail.revisit-preservation.contract.test.tsx',
    name: 'keeps unconfirmed imported time and kind honest without changing legacy stored values',
    from: 'const unknownImportedKind = imported &&', to: 'const unknownImportedKind = false && imported &&' },
  { file: 'app/src/screens/ImportActivities.tsx', test: 'src/screens/ImportActivities.flow.contract.test.tsx',
    name: 'restores a same-scope review across unmounts but refuses an A-B-A lifetime',
    from: 'React.useState<Stage>(restored?.stage ?? { step: "pick" })', to: 'React.useState<Stage>({ step: "pick" })' },
  { file: 'app/src/screens/ImportedRecords.tsx', test: 'src/screens/ImportedRecords.contract.test.tsx',
    name: 'requires an exact current account acknowledgement and never promotes pending copies',
    from: '(!confirmed || confirmed.some(record => record.id === entry.id && record.date === entry.date && record.savedAt === entry.savedAt))', to: 'true' },
]
const summary = []
for (const item of cases) {
  const file = root + item.file, original = readFileSync(file)
  const hash = createHash('sha256').update(original).digest('hex')
  assert.ok(original.toString().includes(item.from), `Mutation target missing: ${item.file}`)
  try {
    writeFileSync(file, original.toString().replace(item.from, item.to))
    const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--configLoader', 'runner', '--cache', 'false', item.test,
      '-t', item.name, '--no-file-parallelism', '--maxWorkers', '1'], { cwd: root + 'app', env: { ...process.env, TZ: 'UTC', NO_COLOR: '1' }, encoding: 'utf8', timeout: 90000 })
    const output = (run.stdout ?? '') + (run.stderr ?? '')
    writeFileSync(new URL(`./defect-${summary.length + 1}.log`, import.meta.url), output)
    assert.equal(run.error, undefined)
    assert.equal(run.status, 1)
    assert.ok(output.includes('FAIL') && output.includes(item.name), `Expected named failure: ${item.name}`)
    summary.push({ file: item.file, name: item.name, detected: true, exitCode: run.status, sha256: hash })
  } finally {
    writeFileSync(file, original)
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), hash)
  }
}
writeFileSync(new URL('./defect-results.json', import.meta.url), JSON.stringify({ cases: summary, exactBytesRestored: true }, null, 2))
console.log(JSON.stringify({ detected: summary.length, exactBytesRestored: true }))
