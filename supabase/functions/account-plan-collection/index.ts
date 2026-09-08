import { createClient } from 'npm:@supabase/supabase-js@2.109.0';
import { createAccountPlanCollectionHandler, createAccountPlanCollectionRepository } from '../_shared/account-plan-collection-handler.mjs';
import { importJournalKeyring, importJournalAttestor } from '../_shared/account-journal-handler.mjs';

// Reuse journal consent/feature gates and runtime key injection. Never log payloads.
Deno.serve((request: Request) => createAccountPlanCollectionHandler({
  allowedOrigins: (Deno.env.get('TRAINORACLE_JOURNAL_ALLOWED_ORIGINS') ?? '')
    .split(',').map((origin: string) => origin.trim()).filter(Boolean),
  getMaterial: async () => importJournalKeyring(Deno.env.get('TRAINORACLE_JOURNAL_KEYRING_JSON')),
  authenticate: async (token: string) => {
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    const attest = async (ownerId: string, action: string, input: unknown) =>
      (await importJournalAttestor(Deno.env.get('TRAINORACLE_JOURNAL_ATTESTATION_JSON')))(ownerId, action, input);
    return { ownerId: data.user.id,
      repo: createAccountPlanCollectionRepository(client, { ownerId: data.user.id, attest }) };
  },
})(request));
