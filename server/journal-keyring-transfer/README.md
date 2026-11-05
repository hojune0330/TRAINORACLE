# Bounded sealed journal-keyring migration candidate

This candidate preserves `TRAINORACLE_JOURNAL_KEYRING_JSON` exactly, including
all historical AES keys. It does not replace a key, change a database row, issue
an attestation key, enable Garmin/account features, install a schedule, change the
existing start command, or deploy anything. All included tests use synthetic keys.

The existing Node Garmin confirmation and account-journal gateway require this
keyring. The existing Supabase Edge reads it from its own protected environment.
This candidate transfers it as a recipient-bound ciphertext and installs that
ciphertext in the exact company's Render service environment. No disk is needed.
The receiver's private key stays only in the company's protected environment;
it must never be sent to Supabase, a browser, a chat, a tool result or a log.

## Files and commands

- `protocol.mjs`: portable Web Crypto RSA-OAEP-3072/SHA-256 wrapping and AES-256-GCM,
  strict keyring/envelope validation, exact original-byte SHA-256 checks.
- `export-handler.mjs`: authenticated, bounded source handler with fingerprint
  and sealed-export modes. The request cannot choose a key, recipient or mode.
- `edge-entry.mjs`: optional temporary Supabase entrypoint; the only existing
  secret it reads is the fixed journal keyring, after authorization and expiry.
- `bootstrap.mjs`: optional Node entrypoint; decrypts only a pinned environment
  artifact in memory, then calls the existing deployment without changing it.
- `transfer.test.mjs`: synthetic real local HTTP, crypto, old-key decryption and
  restart tests; does not access hosted services, credentials or health records.

Focused verification:

```text
node --test server/journal-keyring-transfer/transfer.test.mjs
```

Optional company start command, only after operator review/provisioning:

```text
node server/journal-keyring-transfer/bootstrap.mjs
```

Without `TRAINORACLE_JOURNAL_SEALED_ENABLED=true`, this command delegates to the
current deployment as-is. No existing Blueprint/start command is changed here.

## Exact pins and source configuration

`pins` has exactly these fields:

```json
{
  "schemaVersion": "TRAINORACLE_JOURNAL_SEALED_V1",
  "secretName": "TRAINORACLE_JOURNAL_KEYRING_JSON",
  "sourceProjectRef": "abcdefghijklmnopqrst",
  "destinationServiceId": "srv-syntheticdestination",
  "migrationId": "12345678-1234-4234-8234-123456789abc",
  "validFrom": 0,
  "expiresAt": 600,
  "recipientSha256": "64 lowercase hex characters",
  "keyringSha256": null
}
```

This is a shape example, not runnable configuration. Replace the synthetic
project/service with the verified existing targets and use current integer UTC
seconds. The issuance window is at most 900 seconds. `recipientSha256` is the
SHA-256 of the recipient's DER SPKI public-key bytes. Only RSA-3072 with public
exponent 65537 and OAEP SHA-256 is supported. `migrationId` is a fresh UUIDv4.

Source environment `TRAINORACLE_JOURNAL_MIGRATION_EXPORT_CONFIG_JSON` is exactly
`{mode,pins,recipientSpkiBase64,authorizationSha256}`. The authorization digest
is SHA-256 of a fresh, cryptographically random 32-byte base64url bearer token
(43 characters). Provision/use that token only through an approved protected
operator channel, never a URL or a command containing a literal token. No public
anon key or ordinary user JWT substitutes for this narrow authorization.

The function also verifies its `SUPABASE_URL` equals the pinned source project.
Its only accepted request is `POST /functions/v1/journal-keyring-sealed-migration`,
`Content-Type: application/json`, exact body `{}`, and the dedicated bearer.
Browser Origin/cookies, query strings, other bodies and content encodings fail.
No CORS access, generic secret getter or configurable forwarding URL exists.
The exact internal `/journal-keyring-sealed-migration` path is also accepted
because the hosted gateway can strip `/functions/v1`; no suffix matching is used.
See https://supabase.com/docs/guides/functions/routing for hosted routing examples.
The deployment must let this custom authorization reach the handler; retaining a
Supabase gateway JWT check would reject the dedicated bearer. Changing that gate
is an explicit temporary-function deployment choice, not permission to omit the
handler authorization. Platform request/header logging must redact authorization.

## Operator sequence (not executed by this implementation)

1. Approve the exact existing Supabase source and company Render destination.
   Generate a fresh receiver keypair in an owner-controlled secure runtime and
   store its PKCS8 base64 private key directly in the company's protected secret
   setting `TRAINORACLE_JOURNAL_RECIPIENT_PKCS8_BASE64`. Export only the SPKI
   public key/fingerprint. Do not print or create plaintext temporary key files.
2. Review/deploy the three source files (`edge-entry.mjs`, `export-handler.mjs`,
   `protocol.mjs`) as the temporary function named above. Start with
   `mode=FINGERPRINT_ONLY`, `pins.keyringSha256=null`, fixed target/public key and
   the short issuance window. Existing Supabase secrets remain unchanged.
3. Invoke through authenticated TLS to the exact reviewed Supabase function.
   Fingerprint mode returns only `schemaVersion` and `rawSha256`; no key value,
   length, individual key IDs or per-key fingerprints are returned. Pin that
   authenticated raw SHA-256 independently in both source and receiver config.
   Do not take a digest from an arbitrary ciphertext or untrusted caller.
4. Set the source to `SEALED_EXPORT` with that exact digest, within a valid
   issuance window. It first verifies the raw keyring bytes match the pin, then
   returns a sealed envelope only. Preserve its response JSON bytes exactly and
   calculate their SHA-256. A changed keyring or expired window fails closed.
5. In the exact Render service, install only the sealed response as
   `TRAINORACLE_JOURNAL_SEALED_ENVELOPE_JSON`, and
   `TRAINORACLE_JOURNAL_SEALED_CONFIG_JSON={pins,envelopeSha256}` with independently
   checked pins. Set `TRAINORACLE_JOURNAL_SEALED_ENABLED=true` and use the optional
   bootstrap command. It checks `RENDER_SERVICE_ID`, `SUPABASE_URL`, the entire
   ciphertext digest, metadata/AAD, private recipient and exact plaintext digest.
   A conflicting existing plaintext keyring is rejected, never overwritten.
6. Verify protected startup and a synthetic historical-key encrypt/decrypt
   challenge without exposing values; restart and verify again. Actual existing
   account/health-record reads remain a separately authorized functional check.
   Then delete the temporary source function/config and retire its bearer token.
   Keep the old Supabase keyring and the receiver private key/sealed artifact.

This is **bounded sealed migration**, not an atomic global one-time function.
Source retries can return different encrypted envelopes for the same pinned
original value while the window is open. Only the exact operator-selected
envelope is accepted by Node. No multi-isolate nonce database is introduced.
Successful source deletion ends the temporary export path.

Expiry applies to source issuance, including a second check before response.
The stored envelope's `sealedAt` must fall inside that window. Startup deliberately
allows the already-pinned artifact after expiry so normal restart does not lose
the decryption key. There is no recipient import HTTP endpoint which could admit
a new expired artifact. Changing the accepted artifact requires protected env
configuration again. Deleting the receiver private key prevents subsequent boots.

## Digest evidence and limits

Do not assume a Supabase Dashboard/Management API `value` or `digest` is raw
SHA-256 just because it is 64 hex characters. The public Studio secrets query
passes `/v1/projects/{ref}/secrets` through without documenting a digest algorithm:
https://github.com/supabase/supabase/blob/master/apps/studio/data/secrets/secrets-query.ts
The CLI's separate config API ADR describes HMAC digests, which is not proof
about the Edge-secret endpoint either:
https://github.com/supabase/cli/blob/develop/docs/adr/0019-config-api-response-passthrough.md
The authenticated fingerprint stage avoids either assumption. Hashing always
uses the exact original UTF-8 string, before parsing/reserializing JSON.

The keyring limit is 49,152 bytes, envelope limit 72,000 bytes. A real target's
environment-variable capacity must accommodate its actual sealed artifact.
Typed plaintext buffers are cleared after use; JavaScript strings and platform
environment storage cannot promise complete memory zeroization. The running
application necessarily holds usable decryption material in memory.

The HMAC journal attestation key is separate from AES encryption. Existing Edge
signing may remain, and an authorized operator may register a separate Node
signing key through the existing key table; this candidate performs neither.
No package install or new DB is required. No transfer automatically grants AI use.

An approval-review rejection for secret movement must not be bypassed with this
function or another tool. Deployment, key provisioning and the exact cross-platform
transfer remain external operations for the approved owner to execute/review.
