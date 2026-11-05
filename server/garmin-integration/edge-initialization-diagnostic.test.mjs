import {test} from 'node:test';
import assert from 'node:assert/strict';
import {edgeRpc} from './edge-environment.mjs';
test('initialization diagnostics expose only fixed SQL classifications, never response text',async()=>{
  for(const [problem,expected] of [
    [{code:'42501',message:'private-material',details:'private-material'},'EDGE_DB_PERMISSION_DENIED'],
    [{code:'P0001',message:'EDGE_GATEWAY_INVALID',hint:'private-material'},'EDGE_GATEWAY_INVALID'],
    [{code:'P0001',message:'EDGE_GATEWAY_INVALID private-material'},'EDGE_CONFIGURATION_PENDING'],
    [{code:'private-material',message:'private-material'},'EDGE_CONFIGURATION_PENDING'],
  ]){
    await assert.rejects(edgeRpc({SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'},'garmin_edge_bootstrap',{input:{action:'metadata'}},{fetchImpl:async()=>Response.json(problem,{status:400})}),error=>{
      assert.equal(error.code,expected);assert.equal(error.message.includes('private-material'),false);return true;
    });
  }
});
