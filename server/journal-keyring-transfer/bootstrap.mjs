import {pathToFileURL} from 'node:url';
import {startGarminDeployment} from '../garmin-integration/deployment.mjs';
import {SECRET_NAME,exact,sha256,validatePins,openPinnedEnvelope,fail} from './protocol.mjs';

/** This loader consumes a pinned ciphertext already installed in this exact
 * service's protected environment. It has no export/import HTTP endpoint, no
 * network client, no filesystem writes and no management-platform credential. */
export async function environmentWithSealedKeyring(env){
  if(env.TRAINORACLE_JOURNAL_SEALED_ENABLED!=='true')return env;
  try{
    const config=JSON.parse(env.TRAINORACLE_JOURNAL_SEALED_CONFIG_JSON??'null');
    if(!exact(config,['pins','envelopeSha256']))fail();const pins=validatePins(config.pins);
    if(env.SUPABASE_URL!==`https://${pins.sourceProjectRef}.supabase.co`||env.RENDER_SERVICE_ID!==pins.destinationServiceId)fail();
    if(env[SECRET_NAME]!==undefined&&await sha256(env[SECRET_NAME])!==pins.keyringSha256)fail();
    const raw=await openPinnedEnvelope(env.TRAINORACLE_JOURNAL_SEALED_ENVELOPE_JSON,pins,config.envelopeSha256,env.TRAINORACLE_JOURNAL_RECIPIENT_PKCS8_BASE64);
    const result={...env,[SECRET_NAME]:raw};
    delete result.TRAINORACLE_JOURNAL_RECIPIENT_PKCS8_BASE64;
    delete result.TRAINORACLE_JOURNAL_SEALED_ENVELOPE_JSON;
    return result;
  }catch{fail();}
}
export async function startSealedGarminDeployment({env=process.env,...options}={}){
  return startGarminDeployment({...options,env:await environmentWithSealedKeyring(env)});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
    if(process.argv.length>2)fail();
    const deployment=await startSealedGarminDeployment({signal:controller.signal,onEvent:value=>process.stdout.write(`${JSON.stringify(value)}\n`)});
    if((await deployment.finished).failed)process.exitCode=1;
  }catch{process.stderr.write('JOURNAL_SEALED_BOOTSTRAP_INVALID\n');process.exitCode=1;}
  finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
