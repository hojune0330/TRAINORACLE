import { createClient } from 'npm:@supabase/supabase-js@2.109.0';
import { createAccountDataRightsHandler } from '../_shared/account-data-rights-handler.mjs';
import { importJournalKeyring } from '../_shared/account-journal-handler.mjs';

// Reuses server encryption material; no new key, provider or service-role access.
Deno.serve((request: Request)=>createAccountDataRightsHandler({
  allowedOrigins:(Deno.env.get('TRAINORACLE_JOURNAL_ALLOWED_ORIGINS')??'').split(',').map(v=>v.trim()).filter(Boolean),
  getMaterial:()=>importJournalKeyring(Deno.env.get('TRAINORACLE_JOURNAL_KEYRING_JSON')),
  authenticate:async(token: string)=>{
    const client=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_ANON_KEY')??'',{
      global:{headers:{Authorization:`Bearer ${token}`}},
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    });
    const {data,error}=await client.auth.getUser(token);
    if(error || !data.user) return null;
    const args=(input: {expectedUserId: string; expectedSessionId: string})=>({
      expected_user_id_input:input.expectedUserId,expected_session_id_input:input.expectedSessionId,
    });
    return {ownerId:data.user.id,
      read:async(input: {expectedUserId: string; expectedSessionId: string; collection: string; cursor: string})=>{
        const result=await client.rpc('read_account_data_rights_page',{...args(input),collection_input:input.collection,cursor_input:input.cursor});
        if(result.error) throw new Error('DATA_RIGHTS_UNAVAILABLE'); return result.data;
      },
      verify:async(input: {expectedUserId: string; expectedSessionId: string})=>{
        const result=await client.rpc('account_data_rights_identity',args(input));
        return !result.error && result.data===true;
      },
    };
  },
})(request));
