// Native IndexedDB/Web Crypto in an isolated, external-request-blocked browser.
// The Vite harness injects defects in memory; application files never change.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const cwd=new URL('../',import.meta.url);
const files=['account-journal-draft-buffer.ts','account-journal-api.ts','account-journal-record-service.ts'];
const hashes=()=>files.map(file=>createHash('sha256').update(readFileSync(new URL(`src/domain/account/${file}`,cwd))).digest('hex'));
const before=hashes();
const cases=[
  ['omit-generation','dirty pre-withdrawal draft never borrows a later consent when queued after reload'],
  ['existing-retry','existing pending retry without its pin remains local after regrant without a prior read'],
];
const specs=suite=>[...(suite.specs??[]),...(suite.suites??[]).flatMap(specs)];
for(const [defect,name] of cases) {
  const result=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.account-draft-buffer.config.ts',
    '--grep',name,'--reporter=json','--timeout=90000'],{cwd,env:{...process.env,DRAFT_CONSENT_MUTATION:defect},encoding:'utf8',timeout:180000});
  assert.equal(result.status,1,`${defect}: expected a test failure`);
  // Vite may emit a dependency-optimizer notice before Playwright's JSON.
  const start=result.stdout.search(/^\{\s*"config":/mu);
  assert.ok(start>=0,'Playwright JSON report required');
  const report=JSON.parse(result.stdout.slice(start));
  const named=report.suites.flatMap(specs).find(spec=>spec.title===name);
  assert.ok(named?.tests.some(test=>test.results.some(run=>run.status==='failed'
    && run.errors.some(error=>error.message?.includes('toEqual')))),`${defect}: named assertion did not detect the defect`);
  assert.deepEqual(hashes(),before);console.log(`DETECTED ${defect}: ${name}`);
}
const normal=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.account-draft-buffer.config.ts',
  '--grep','dirty pre-withdrawal|existing pending retry','--timeout=90000'],{cwd,env:{...process.env,DRAFT_CONSENT_MUTATION:''},encoding:'utf8',timeout:180000});
process.stdout.write(normal.stdout);process.stderr.write(normal.stderr);assert.equal(normal.status,0);
assert.deepEqual(hashes(),before);console.log('UNCHANGED source SHA256',JSON.stringify(Object.fromEntries(files.map((file,i)=>[file,before[i]]))));
