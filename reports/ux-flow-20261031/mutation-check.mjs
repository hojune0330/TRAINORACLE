import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const root = fileURLToPath(new URL('../../', import.meta.url))
const changes = [
  ['app/src/AppShell.tsx', 'onOpenOracle={topic => openOracle(topic, "personal")}', 'onOpenOracle={openOracle}'],
  ['app/src/screens/ImportActivities.tsx', 'onRestart={() => { reviewSnapshot.current = stage;', 'onRestart={() => { reviewSnapshot.current = null;'],
  ['app/src/screens/import-activities/ImportStages.tsx', '"계정 저장 확인 중" : "이 브라우저에 저장 중"', '"계정 저장 확인 중" : "계정 저장 확인 중"'],
  ['app/src/screens/LogDetail.tsx', 'snapshot.complete && initialEntryId !== undefined && targetKey === undefined', 'false && snapshot.complete && initialEntryId !== undefined && targetKey === undefined'],
]
const originals = []
try {
  for (const [path, before, after] of changes) {
    const file = root + path
    const original = await readFile(file)
    const text = original.toString('utf8')
    assert.equal(text.split(before).length, 2, `unique mutation: ${path}`)
    originals.push([file, original])
    await writeFile(file, text.replace(before, after))
  }
  const run = spawnSync(process.execPath, [
    'node_modules/vitest/vitest.mjs', 'run', '--configLoader', 'runner', '--cache', 'false',
    'src/AppShell.oracle-exploration.contract.test.tsx', 'src/screens/ImportActivities.flow.contract.test.tsx',
    'src/screens/LogDetail.revisit-preservation.contract.test.tsx', '--no-file-parallelism', '--maxWorkers', '1',
    '-t', 'opens the personal empty|retains exact choices|does not label a device|reports a missing exact',
  ], { cwd: root + 'app', encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, timeout: 180000 })
  const output = (run.stdout ?? '') + (run.stderr ?? '')
  await writeFile(new URL('./mutation.log', import.meta.url), output)
  assert.equal(run.status, 1, 'all injected defects must fail')
  const names = [
    'opens the personal empty result from Home and shows examples only after explicit selection',
    'retains exact choices and excludes across file preparation, a failed replacement and resume without saving',
    'does not label a device write as account confirmation',
    'reports a missing exact destination without opening another same-day journal',
  ]
  for (const name of names) assert.ok(output.includes(`> ${name}`), `named failure: ${name}`)
  console.log(JSON.stringify({ injectedDefects: 4, namedFailures: names, mutationExitCode: run.status }))
} finally {
  for (const [file, original] of originals) await writeFile(file, original)
  console.log('Restored all product files byte-for-byte')
}
