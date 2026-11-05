import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildGarminEdgeBundle} from './build-garmin-edge-bundle.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('deployment graph includes the real entrypoint and generated validators with no operational files',async()=>{
  const {payload,manifest}=await buildGarminEdgeBundle();
  const names=payload.files.map(file=>file.name);
  assert.equal(payload.verify_jwt,true);
  for(const name of [payload.entrypoint_path,'server/garmin-integration/edge-environment.mjs','server/garmin-ingress/signed-ingress.mjs','supabase/functions/_shared/account-journal-record-validator.mjs','supabase/functions/_shared/account-state-validator.mjs','deno.json'])assert.ok(names.includes(name),name);
  assert.ok(!names.some(name=>/node_modules|\.env|\.test\.|^tmp\//.test(name)));
  assert.equal(manifest.sourceBytes,payload.files.reduce((sum,file)=>sum+Buffer.byteLength(file.content),0));
  assert.ok(manifest.sourceBytes<5_000_000);
});
test('graph rejects unpinned and computed imports instead of silently omitting required files',async()=>{
  const directory=await mkdtemp(resolve(root,'tmp','edge-bundle-test-'));
  const entry=resolve(directory,'supabase/functions/garmin-integration/index.ts');
  await mkdir(dirname(entry),{recursive:true});
  try{
    for(const source of ['import "https://unreviewed.example.test/code.ts";','import "node:fs";','const path="./runtime.mjs"; await import(path);']){
      await writeFile(entry,source);await assert.rejects(buildGarminEdgeBundle({root:directory}),/EDGE_BUNDLE_/);
    }
  }finally{assert.ok(directory.startsWith(resolve(root,'tmp')+'\\')||directory.startsWith(resolve(root,'tmp')+'/'));await rm(directory,{recursive:true});}
});
