import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const paths=['account-journal-handler.mjs','account-plan-collection-handler.mjs','coros-workout-storage.mjs'];
const hashes=()=>paths.map(file=>createHash('sha256').update(readFileSync(new URL(`../../functions/_shared/${file}`,import.meta.url))).digest('hex'));
const before=hashes();
for(const [mutation,name] of [
  ['journal-cors','journal preflight accepts the pinned revision header and rejects unknown headers before auth'],
  ['plan-cors','plan collection preflight accepts the pinned revision header and rejects unknown headers before auth'],
  ['workout-rebind','workout digest work never silently upgrades the initially observed connection generation'],
]) {
  const result=spawnSync(process.execPath,['--test','--test-reporter=spec','storage-transport-boundaries.test.mjs'],{
    cwd:new URL('.',import.meta.url),env:{...process.env,STORAGE_TRANSPORT_MUTATION:mutation},encoding:'utf8',timeout:30000,
  });
  assert.equal(result.status,1);assert.ok((result.stdout+result.stderr).includes(`✖ ${name}`),`missing named defect: ${mutation}`);
  assert.deepEqual(hashes(),before);console.log(`DETECTED ${mutation}: ${name}`);
}
const result=spawnSync(process.execPath,['--test','storage-transport-boundaries.test.mjs'],{
  cwd:new URL('.',import.meta.url),env:{...process.env,STORAGE_TRANSPORT_MUTATION:''},encoding:'utf8',timeout:30000,
});
process.stdout.write(result.stdout);process.stderr.write(result.stderr);assert.equal(result.status,0);
assert.deepEqual(hashes(),before);console.log('UNCHANGED source SHA256',JSON.stringify(Object.fromEntries(paths.map((file,i)=>[file,before[i]]))));
