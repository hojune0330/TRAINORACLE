// Synthetic, in-memory SQL defects only. Never rewrites a migration or connects
// to a hosted database. Report the named failing test, not just an exit code.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const migration=new URL('../../migrations/0058_storage_withdrawal_erasure.sql',import.meta.url);
const hash=()=>createHash('sha256').update(readFileSync(migration)).digest('hex');
const before=hash();
for(const [mutation,name] of [
  ['erase-body','0058 fulfils a prior 0057 withdrawal instead of leaving its ciphertext indefinitely'],
  ['regrant-replay','a never-stored old revision cannot create a fresh document after regrant; new consent revision can'],
  ['context-forgery','private erasure context cannot be forged by GUCs or API roles and immutable updates stay blocked'],
  ['workout-epoch','a workout job pinned before withdrawal cannot relink; a fresh generation succeeds and stays idempotent'],
]) {
  const result=spawnSync(process.execPath,['--test','--test-reporter=spec','storage-withdrawal-erasure.test.mjs'],{
    cwd:new URL('.',import.meta.url),env:{...process.env,STORAGE_ERASURE_MUTATION:mutation},encoding:'utf8',timeout:60000,
  });
  assert.equal(result.status,1,`${mutation}: expected test failure, not process failure`);
  assert.ok((result.stdout+result.stderr).includes(`✖ ${name}`),`${mutation}: named test did not detect the defect`);
  assert.equal(hash(),before,'migration bytes must remain unchanged');
  console.log(`DETECTED ${mutation}: ${name}`);
}
const normal=spawnSync(process.execPath,['--test','storage-withdrawal-erasure.test.mjs'],{
  cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:60000,env:{...process.env,STORAGE_ERASURE_MUTATION:''},
});
process.stdout.write(normal.stdout);process.stderr.write(normal.stderr);
assert.equal(normal.status,0);assert.equal(hash(),before);
console.log(`UNCHANGED migration SHA256 ${before}`);
