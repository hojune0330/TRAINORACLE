// Deploy only after the source project, recipient pins and exact transfer are
// approved. No automatic deployment hook; no key values or request logs.
import {createSealedExportHandler} from './export-handler.mjs';
import {SECRET_NAME} from './protocol.mjs';
let handler;
try{
  const config=JSON.parse(Deno.env.get('TRAINORACLE_JOURNAL_MIGRATION_EXPORT_CONFIG_JSON')??'null');
  if(Deno.env.get('SUPABASE_URL')!==`https://${config?.pins?.sourceProjectRef}.supabase.co`)throw 0;
  handler=createSealedExportHandler({config,readKeyring:()=>Deno.env.get(SECRET_NAME)});
}catch{handler=()=>Response.json({error:'MIGRATION_UNAVAILABLE'},{status:503,headers:{'cache-control':'no-store','pragma':'no-cache'}});}
Deno.serve(handler);
