import { createClient } from 'npm:@supabase/supabase-js@2.109.0';
import { createAccountJournalHandler, createAccountJournalRepository, importJournalKeyring,
  validateAccountJournalDocument } from '../_shared/account-journal-handler.mjs';

// DRAFT ONLY. ACCOUNT_JOURNAL_V2 remains deployed-off until separate operational approval.
// Runtime configuration: SUPABASE_URL, SUPABASE_ANON_KEY,
// TRAINORACLE_JOURNAL_ALLOWED_ORIGINS (comma-separated exact origins),
// TRAINORACLE_JOURNAL_KEYRING_JSON ({activeKeyId,keys:{id:base64_32_bytes}}).
// Never use a service-role key, log requests/errors, or import an app/generated bundle.
Deno.serve((request: Request) => createAccountJournalHandler({
  allowedOrigins: (Deno.env.get('TRAINORACLE_JOURNAL_ALLOWED_ORIGINS') ?? '')
    .split(',').map((origin: string) => origin.trim()).filter(Boolean),
  validateDocument: validateAccountJournalDocument,
  getMaterial: () => importJournalKeyring(Deno.env.get('TRAINORACLE_JOURNAL_KEYRING_JSON')),
  authenticate: async (token: string) => {
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return { ownerId: data.user.id, repo: createAccountJournalRepository(client) };
  },
})(request));
