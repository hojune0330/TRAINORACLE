# Oracle V2 Release Preparation

SOURCE PREPARATION ONLY. No remote inventory, production SQL, key registration,
function deployment, or authenticated production verification was performed.

## Access Block

This session has no DB password, management access token, or Supabase CLI on
PATH. Existing `../backup-tools/gateway-key-input.ps1` prompts for a password;
it is not a stored credential source. The local `pg` dependency and TLS CA exist
at `../backup-tools/runtime-deps/node_modules/pg` and `../backup-tools/supabase-ca.crt`.
Existing operator metadata names project `texspxlpjungyarkvtkc`; independently
confirm the target. Do not use its old gateway provisioner: it can overwrite
existing journal keys. Preserve remote Edge secrets without extracting them.

## Candidate

Integrate main's auth migrations 0051-0056. Oracle SQL has moved unchanged to
0057 running_profile_account_storage, 0058 oracle_v2_account_compatibility,
0059 oracle_v2_explicit_restart, 0060 oracle_profile_comparison_grants.
Never push the old colliding migration directory or repair history to it.

Use PowerShell 7. Copy only the NON-SECRET metadata fields from
`oracle-v2-release-config.example.json` into an operator-reviewed config.
Set `$config`, `$project`, `$inventory`, and `$stage` to the appropriate public
metadata and fresh output paths. Verified Node runtime: v24.19.0 at the path below.

```powershell
$ops = './supabase/operations'
$node = 'C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
& "$ops/oracle-v2-release-operator.ps1" inventory $config $project $inventory
& $node "$ops/oracle-v2-release.mjs" stage $inventory $project $stage
```

Inventory is read-only, returning ledger identities/hashes, function hashes/ACLs,
schema fingerprint and capability flags, not source definitions, user data or
key bytes. Passwords enter through private stdin, not arguments or secret files.

LIMITATION: automated staging currently requires baseline ledger evidence for
0001-0056. Missing manual migration ledger rows do NOT prove missing SQL. In
that case stop automated staging and prove the current schema against main;
do not replay the baseline or invent ledger rows. A schema-only approval path
is not implemented. PostgreSQL execution of the generated release SQL has NOT
been rehearsed in this turn; unit/mock tests are not deployment readiness.

After that review/rehearsal, authorized parent-only execution entry points are:

```powershell
& "$ops/oracle-v2-release-operator.ps1" apply $config $project $stage -ConfirmSqlApply
& "$ops/oracle-v2-release-operator.ps1" verify $config $project './oracle-verification.json'
& "$ops/oracle-v2-release-operator.ps1" provision-key $config $project 'NEW_UNIQUE_KEY_ID' -ConfirmFirstProvision
```

Apply guards the source candidate and current DB fingerprint, then commits
missing Oracle SQL with its ledger atomically. First-time key provisioning
refuses an existing Edge secret or DB key ID, requires comparison OFF, and sends
the same new 32-byte key via a bound DB parameter and an HTTPS body in memory.
It does not rotate keys or touch journal keys. Freeze concurrent secret changes:
Management API publication is not a cross-service transaction or create-only CAS.
An uncertain publication retains the DB key and requires operator reconciliation.
Do not blindly retry or delete keys. Real API publication has not been tested here.

The parent must deploy integrated `account-journal` plus its generated validator
and `oracle-profile-comparison` through an authorized deployment channel.
This tool does not deploy functions. Keep all encryption keyring and journal
attestation secrets; add only the separate comparison secret when absent.

Review generated `verify.sql` metadata and test real authenticated V1/V2 saves,
stale-client refusal, delete/restart CAS, bilateral consent and withdrawal.
Comparison stays OFF until separately approved. `stop-comparison.sql` only
turns comparison OFF: preserve V2 reading, withdrawals, ciphertext, history,
keys and auth metadata. Do not roll back to a V1-only validator.
