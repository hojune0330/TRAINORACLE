# Shared lounge deletion delivery

Implementation is local until migration, worker deployment, secret injection,
scheduling, and a real two-app deletion round trip have all been verified.
Current source: official main `99f2291` (ported from `4ce25ed`), additive outbox `0063`. Earlier local
0057/57-migration test evidence is historical and is not current-source proof.

- Migration `0063` enqueues atomically on the existing account deletion request.
  The current session/expected-user checks, immediate-due account deletion,
  and atomic storage withdrawal remain unchanged.
- Queue stores only subject UUID, stable request UUID, status, and delivery/lease
  times/lease UUID. It has no account foreign key, so unresolved minimum references
  survive the account purge. No email, journal, health data, message, or token is
  stored. A validated remote COMMIT acknowledgement immediately removes the row.
- The worker uses only three service-role-only RPCs; direct queue access is revoked
  even from service_role. A 2-minute claim lease prevents concurrent processing,
  8-second requests time out, and a failed delivery backs off 5 minutes. Lost ACKs
  retry the same request UUID. An expired lease can be safely reclaimed.
- This sequential Edge worker claims at most **3** rows per invocation and rejects
  an oversized RPC response before sending. Its conservative I/O timeout budget
  is `8 + 3 * (8 + 8 + 8) = 80` seconds, below the 120-second SQL lease and the
  [official Supabase free-plan 150-second wall-clock limit](https://supabase.com/docs/guides/functions/limits)
  (checked 2026-10-06). This is a timeout budget, not measured production latency
  or CPU proof. SQL's general RPC ceiling of 10 remains; this worker asks for 3.
- Receiver: `POST /api/lounge/internal/identity-deletion` on the AthleteTime API
  origin, not the public Cloudflare Worker. Exact payload:
  `{version:1,requestId,issuer:"trainoracle",subject}`. Success is only the exact
  `{version:1,requestId,status:"completed"}` response after COMMIT.
- The receiver must be independently available while the lounge is closed. It
  serializes deletion and entry/link using the same issuer/subject lock and fresh
  TrainOracle admission inspection. Other issuer identities are preserved.

## Operator activation gate

1. Preflight the actual migration ledger, queue constraints/indexes, function
   execution/table privileges, and backup/restore before applying `0063`.
2. Deploy the `lounge-identity-deletion` Edge Function with `verify_jwt=false`.
   Its handler uses a separate private operator key, denies browser Origin, and
   exposes counts only. Do not reuse a user JWT or account grant.
3. Inject these server-only settings through approved secret management; never
   send their values in chat, logs, Git, screenshots, or build-time VITE variables:
   `TRAINORACLE_LOUNGE_DELETION_INVOKE_KEY` (fresh 64 lowercase hex),
   `LOUNGE_TRAINORACLE_DELETION_KEY` (different fresh 64 hex; same receiver setting),
   `TRAINORACLE_LOUNGE_DELETION_ENDPOINT` (exact HTTPS receiver URL), and the
   platform's server `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. The function
   only uses the platform key for the three scoped RPCs, not direct tables.
4. Configure an approved free scheduled operator POST with empty `{}` body,
   dedicated invoke key, and no browser Origin. Do not edit `.github/workflows/`
   from this project agent. Record the actual scheduler and run evidence; merely
   deploying the function is not scheduling. Run it at least daily, and alert on
   failed runs or sustained pending counts. Do not treat a failed request as empty.
5. Verify actual deletion, lost-ACK replay, receiver outage/recovery, concurrent
   reentry, preservation of other linked issuer accounts, and delivery after the
   local purge. Keep public cutover closed until these gates pass.

No new cron/scheduler, secret, production SQL, account deletion, or network transfer
is executed by creating this implementation. Do not restore/reuse an old subject
while its account-deletion request remains blocked.
