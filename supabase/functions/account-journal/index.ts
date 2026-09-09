import { createClient } from 'npm:@supabase/supabase-js@2.109.0';
import { createAccountJournalHandler, createAccountJournalRepository, importJournalKeyring, importJournalAttestor,
  validateAccountJournalDocument } from '../_shared/account-journal-handler.mjs';

// Strict draft, finalized journal and account-state documents with compiled pure validators.
// ACCOUNT_JOURNAL_V2 remains operationally OFF until actual server readiness is verified.
// Runtime configuration: SUPABASE_URL, SUPABASE_ANON_KEY,
// TRAINORACLE_JOURNAL_ALLOWED_ORIGINS (comma-separated exact origins),
// TRAINORACLE_JOURNAL_KEYRING_JSON ({activeKeyId,keys:{id:base64_32_bytes}}).
// TRAINORACLE_JOURNAL_ATTESTATION_JSON ({keyId,key:base64_32_bytes}), separate key.
// Never use a service-role key or log requests/errors. Generated server validators
// contain only pure schemas/catalog rules, never browser storage or app runtime code.
Deno.serve((request: Request) => createAccountJournalHandler({
  allowedOrigins: (Deno.env.get('TRAINORACLE_JOURNAL_ALLOWED_ORIGINS') ?? '')
    .split(',').map((origin: string) => origin.trim()).filter(Boolean),
  validateDocument: validateAccountJournalDocument,
  getMaterial: async () => {
    await importJournalAttestor(Deno.env.get('TRAINORACLE_JOURNAL_ATTESTATION_JSON'));
    return importJournalKeyring(Deno.env.get('TRAINORACLE_JOURNAL_KEYRING_JSON'));
  },
  authenticate: async (token: string) => {
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    // Import only after identity and repository feature checks, never from clients.
    const attest = async (ownerId: string, action: string, input: unknown) =>
      (await importJournalAttestor(Deno.env.get('TRAINORACLE_JOURNAL_ATTESTATION_JSON')))(ownerId, action, input);
    return { ownerId: data.user.id, repo: createAccountJournalRepository(client, { ownerId: data.user.id, attest }) };
  },
})(request));
