import { createClient } from 'npm:@supabase/supabase-js@2.109.0';
import { importJournalKeyring } from '../_shared/account-journal-handler.mjs';
import { createProfileComparisonHandler, createProfileComparisonRepository, importProfileComparisonAttestor } from '../_shared/oracle-profile-comparison-handler.mjs';

Deno.serve((request: Request) => createProfileComparisonHandler({
  allowedOrigins: (Deno.env.get('TRAINORACLE_JOURNAL_ALLOWED_ORIGINS') ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
  getMaterial: () => importJournalKeyring(Deno.env.get('TRAINORACLE_JOURNAL_KEYRING_JSON')),
  authenticate: async (token: string) => {
    // User JWT, never service-role authority. Both verification calls bind the exact token.
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const user = await client.auth.getUser(token);
    if (user.error || !user.data.user) return null;
    const claims = await client.auth.getClaims(token);
    const sessionId = claims.data?.claims?.session_id;
    if (claims.error || claims.data?.claims?.sub !== user.data.user.id || typeof sessionId !== 'string'
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(sessionId)) return null;
    const ownerId = user.data.user.id;
    const attest = await importProfileComparisonAttestor(Deno.env.get('TRAINORACLE_PROFILE_COMPARISON_ATTESTATION_JSON'));
    return { ownerId, sessionId, repo: createProfileComparisonRepository(client, { ownerId, sessionId, attest }) };
  },
})(request));
