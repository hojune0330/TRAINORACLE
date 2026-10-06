import { createClient } from 'npm:@supabase/supabase-js@2.109.0';
import { createLoungeDeletionHandler, createLoungeDeletionRepository, createLoungeDeletionWorker } from '../_shared/lounge-identity-deletion-worker.mjs';

// Server-only credentials injected by the approved operator. Never print env,
// payloads, exceptions, subjects or keys; this endpoint returns counts only.
Deno.serve((request: Request) => createLoungeDeletionHandler({
  invokeKey: Deno.env.get('TRAINORACLE_LOUNGE_DELETION_INVOKE_KEY'),
  worker: async () => {
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return createLoungeDeletionWorker({ repository: createLoungeDeletionRepository(client),
      endpoint: Deno.env.get('TRAINORACLE_LOUNGE_DELETION_ENDPOINT'),
      deletionKey: Deno.env.get('LOUNGE_TRAINORACLE_DELETION_KEY'),
    })();
  },
})(request));
