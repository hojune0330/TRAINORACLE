// Preparation only: no network, DB connection, secret loading or apply command.
// Root submits the reviewed request through the existing Supabase MCP connector.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_REF = 'texspxlpjungyarkvtkc';
export const BUNDLE_NAME = 'lounge_identity_closure_0039_0065_atomic';
const migrationRoot = new URL('../migrations/', import.meta.url);
export const normalizeSql = text => text.replace(/\r\n?/gu, '\n').trim();
export const digest = (text, algorithm = 'sha256') => createHash(algorithm).update(text).digest('hex');
const fail = code => { throw new Error(code); };
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const hash32 = value => typeof value === 'string' && /^[a-f0-9]{32}$/u.test(value);
const hash64 = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');

// Only our unapplied lounge file moved from 0064 to 0065. Upstream's 0064
// minigame migration is retained and is NOT part of this operating closure.
export const SOURCE_PINS = Object.freeze([
  ['0039_coros_daily_encrypted_inbox', '9b9c2a2f926aa517f9e121cdef97a062117bb1dbbff26c420ced9fda9193eebc'],
  ['0051_current_account_admission', 'bce153e6676680381c2fd3cdb5f0bf72ffcc2bbce6660d1fc89161b18151d9f6'],
  ['0053_supported_auth_method_gate', '5b5edc64d1372bdf696df7a7c6df89956ffd4d10ddf9f459207985253d807282'],
  ['0054_public_profile_admission_policies', '437f6933bf0c7b44b4acd067a2994d58ffc43cb4662101ee65d0cdbc1ccf8b57'],
  ['0055_session_bound_account_admission', 'd1b393ada51fd85688ab7ea97333a16d940f5cb9f3cf4b066d2afd4ff76ef007'],
  ['0056_remaining_auth_surface_gates', '045aa61855136ad77103bf7aa343b6c3a09fe9990b26dc3d9f1b683511bffa98'],
  ['0057_purpose_scoped_storage_consent', 'd3bdbc14f6ea727b66ea75929c513b7fe15e57469f7453795aab7843cd3339cf'],
  ['0058_storage_withdrawal_erasure', 'a13d1d6f5929d2ad9b746b090ba1b01a5dd00b5601277a2c5859429d53a8f366'],
  ['0065_lounge_grant_auth_channel_recheck', 'e1d3f7b584b8801db11e46776555b96207ff5dc296b7a173277eba822eca325e'],
].map(([stem, sha256]) => Object.freeze({ stem, sha256 })));

export const CLOSED_RECEIPTS = Object.freeze([
  { version: '20261008004304', name: '0041_lounge_admission' },
  { version: '20261008014327', name: '0042_lounge_scoped_grants' },
  { version: '20261008062348', name: '0063_lounge_identity_deletion_outbox' },
]);
export const BASELINE_VERSIONS = Object.freeze(Array.from({ length: 50 }, (_, i) => String(i + 1).padStart(4, '0'))
  .filter(version => !['0039', '0041', '0042', '0043', '0044'].includes(version)));

// Metadata/hashes only. No source bodies, user rows or credentials are returned.
const ledgerSelect = `select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,
    'statementsHash',md5(coalesce(array_to_json(statements)::text,'null')),
    'rollbackHash',md5(coalesce(array_to_json(rollback)::text,'null')),
    'createdByHash',md5(coalesce(created_by,'null')),
    'idempotencyHash',md5(coalesce(idempotency_key,'null'))) order by version),'[]'::jsonb)
  from supabase_migrations.schema_migrations`;
export const SNAPSHOT_EXPRESSION = `jsonb_build_object(
  'ledger',(${ledgerSelect}),
  'functions',(select coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
    'hash',md5(replace(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),chr(13),chr(10))),
    'aclHash',md5(coalesce(p.proacl::text,'null')),'configHash',md5(coalesce(p.proconfig::text,'null')),
    'ownerHash',md5(p.proowner::regrole::text)) order by p.oid::regprocedure::text),'[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','supabase_migrations') and p.prokind='f'),
  'schemaHash',(select md5(coalesce(string_agg(item,E'\\n' order by item),'')) from (
    select 'relation:'||c.relname||':'||c.relkind::text||':'||c.relrowsecurity||':'||c.relforcerowsecurity||':'||c.relowner::regrole::text||':'||coalesce(c.relacl::text,'') item
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','supabase_migrations')
    union all select 'constraint:'||c.conrelid::regclass||':'||c.conname||':'||pg_get_constraintdef(c.oid)
      from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in('public','supabase_migrations')
    union all select 'column:'||a.attrelid::regclass||':'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull||':'||coalesce(a.attacl::text,'')
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in('public','auth','supabase_migrations') and (n.nspname<>'auth' or c.relname in('users','sessions')) and a.attnum>0 and not a.attisdropped
    union all select 'default:'||d.adrelid::regclass||':'||d.adnum||':'||pg_get_expr(d.adbin,d.adrelid)
      from pg_attrdef d join pg_class c on c.oid=d.adrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','supabase_migrations')
    union all select 'policy:'||schemaname||':'||tablename||':'||policyname||':'||roles::text||':'||cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,'')
      from pg_policies where schemaname in('public','supabase_migrations')
    union all select 'trigger:'||t.tgrelid::regclass||':'||t.tgname||':'||t.tgenabled::text||':'||pg_get_triggerdef(t.oid)
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','supabase_migrations')
    union all select 'index:'||i.indexrelid::regclass||':'||pg_get_indexdef(i.indexrelid)
      from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','supabase_migrations')
  ) schema_items),
  'gates',jsonb_build_object(
    'loungeEnabled',(select enabled from public.lounge_admission_controls where singleton),
    'loungeLegalBound',(select privacy_policy_version is not null or terms_of_service_version is not null from public.lounge_admission_controls where singleton),
    'features',(select jsonb_object_agg(feature_key,enabled) from public.service_feature_controls)),
  'partial',jsonb_build_object('consents',to_regclass('public.account_storage_consents') is not null,
    'reviews',to_regclass('public.account_storage_operation_reviews') is not null,
    'erasure',to_regclass('public.account_storage_erasure_receipts') is not null,
    'epoch',exists(select 1 from pg_attribute where attrelid='public.external_provider_connections'::regclass and attname='connection_epoch' and not attisdropped),
    'authMarkers',exists(select 1 from pg_attribute where attrelid='public.lounge_session_grants'::regclass and attname in('requires_oauth','requires_passwordless') and not attisdropped))
)`;
export const INVENTORY_SQL = `select jsonb_build_object('projectRef',${literal(PROJECT_REF)},'snapshot',${SNAPSHOT_EXPRESSION}) as inventory;`;
// Metadata only; no table DATA (including gateway keys) is read to acquire locks.
export const TABLE_LOCK_CATALOG_EXPRESSION = `(select coalesce(jsonb_agg(jsonb_build_object(
  'oid',c.oid::text,'schema',n.nspname,'name',c.relname,'kind',c.relkind::text) order by c.oid),'[]'::jsonb)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p','f'))`;

const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const snapshotHash = snapshot => digest(JSON.stringify(canonical(snapshot)));

// Deliberately recognizes only the exact maintained outer wrappers. Never use
// global BEGIN/COMMIT replacement: function bodies have their own BEGIN blocks.
function containsTransactionControl(sql) {
  let statement = '', quote = null, dollarQuote = null, commentDepth = 0;
  const rejected = () => /^(begin|commit|rollback|abort|end|savepoint|release|start\s+transaction)\b/iu.test(statement.trim());
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i], next = sql[i + 1];
    if (commentDepth) {
      if (char === '/' && next === '*') { commentDepth++; i++; }
      else if (char === '*' && next === '/') { commentDepth--; i++; }
      continue;
    }
    if (dollarQuote) {
      if (sql.startsWith(dollarQuote, i)) { i += dollarQuote.length - 1; dollarQuote = null; }
      continue;
    }
    if (quote) {
      if (char === quote && next === quote) { i++; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '-' && next === '-') { const end = sql.indexOf('\n', i); i = end < 0 ? sql.length : end; statement += ' '; continue; }
    if (char === '/' && next === '*') { commentDepth = 1; i++; statement += ' '; continue; }
    if (char === "'" || char === '"') { quote = char; statement += ' literal '; continue; }
    if (char === '$') {
      const marker = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/u)?.[0];
      if (marker) { dollarQuote = marker; statement += ' body '; i += marker.length - 1; continue; }
    }
    if (char === ';') { if (rejected()) return true; statement = ''; }
    else statement += char;
  }
  if (quote || dollarQuote || commentDepth) fail('UNTERMINATED_SQL_LITERAL');
  return rejected();
}
export function stripOuterWrapper(text, version) {
  const sql = normalizeSql(text);
  const match = sql.match(/^((?:--[^\n]*\n|\s)*)begin;([\s\S]*)commit;\s*$/iu);
  if (version === '0039') {
    if (match || containsTransactionControl(sql)) fail('UNEXPECTED_UNWRAPPED_TRANSACTION');
    return sql;
  }
  if (!match || containsTransactionControl(match[2])) fail('UNSUPPORTED_TRANSACTION_WRAPPER');
  return `${match[1]}${match[2]}`;
}

export function loadClosureSources(directory = migrationRoot) {
  const names = readdirSync(directory);
  return SOURCE_PINS.map(pin => {
    const file = `${pin.stem}.sql`, version = pin.stem.slice(0, 4), name = pin.stem.slice(5);
    if (names.filter(candidate => candidate.startsWith(`${version}_`) && candidate.endsWith('.sql')).length !== 1) fail('SOURCE_VERSION_COLLISION');
    const path = new URL(file, directory);
    if (lstatSync(path).isSymbolicLink()) fail('SOURCE_LINK_REJECTED');
    const sql = normalizeSql(readFileSync(path, 'utf8'));
    if (digest(sql) !== pin.sha256) fail(`SOURCE_HASH_MISMATCH:${version}`);
    return { file, version, name, sql, body: stripOuterWrapper(sql, version), sha256: pin.sha256, sourceHash: digest(sql, 'md5') };
  });
}

export function expectedBaseline(directory = migrationRoot) {
  const files = readdirSync(directory);
  return [...BASELINE_VERSIONS.map(version => {
    const found = files.filter(file => file.startsWith(`${version}_`) && file.endsWith('.sql'));
    if (found.length !== 1) fail('BASELINE_SOURCE_INCOMPLETE');
    return { version, name: found[0].slice(5, -4) };
  }), ...CLOSED_RECEIPTS];
}

// Root must supply the fingerprint of independently reviewed metadata, not
// silently accept whatever a newly captured inventory happens to contain.
export function planClosure(inventory, reviewedSnapshotSha256, sources = loadClosureSources(), baseline = expectedBaseline()) {
  if (inventory?.projectRef !== PROJECT_REF) fail('PROJECT_MISMATCH');
  const snapshot = inventory.snapshot;
  if (!exactKeys(inventory, ['projectRef', 'snapshot']) || !exactKeys(snapshot, ['ledger', 'functions', 'schemaHash', 'gates', 'partial'])
    || !Array.isArray(snapshot.ledger) || snapshot.ledger.length !== 48 || !Array.isArray(snapshot.functions) || snapshot.functions.length === 0
    || !hash32(snapshot.schemaHash) || !exactKeys(snapshot.gates, ['loungeEnabled', 'loungeLegalBound', 'features'])
    || !exactKeys(snapshot.partial, ['consents', 'reviews', 'erasure', 'epoch', 'authMarkers'])
    || !snapshot.gates.features || Object.entries(snapshot.gates.features).some(([key, value]) => !/^[A-Z_0-9]{1,80}$/u.test(key) || typeof value !== 'boolean')) fail('INVALID_INVENTORY');
  if (sources.length !== 9 || sources.some((s, i) => s.file !== `${SOURCE_PINS[i].stem}.sql`
    || s.version !== SOURCE_PINS[i].stem.slice(0, 4) || s.name !== SOURCE_PINS[i].stem.slice(5)
    || s.sourceHash !== digest(s.sql, 'md5') || s.sha256 !== SOURCE_PINS[i].sha256
    || digest(s.sql) !== s.sha256 || s.body !== stripOuterWrapper(s.sql, s.version))) fail('INVALID_SOURCE_PLAN');
  const versions = new Set();
  for (const row of snapshot.ledger) {
    if (!exactKeys(row, ['version', 'name', 'statementsHash', 'rollbackHash', 'createdByHash', 'idempotencyHash'])
      || !/^\d{4,14}$/u.test(row.version ?? '') || versions.has(row.version)
      || !['statementsHash', 'rollbackHash', 'createdByHash', 'idempotencyHash'].every(key => hash32(row[key]))) fail('INVALID_LEDGER');
    versions.add(row.version);
  }
  if (baseline.length !== 48 || baseline.some(row => !snapshot.ledger.some(current => current.version === row.version && current.name === row.name))) fail('BASELINE_48_MISMATCH');
  const signatures = new Set();
  if (snapshot.functions.some(row => !exactKeys(row, ['signature', 'hash', 'aclHash', 'configHash', 'ownerHash'])
    || typeof row.signature !== 'string' || row.signature.length === 0 || row.signature.length > 2000 || row.signature.includes('\0')
    || signatures.has(row.signature) || !signatures.add(row.signature)
    || !['hash', 'aclHash', 'configHash', 'ownerHash'].every(key => hash32(row[key])))) fail('INVALID_FUNCTION_FINGERPRINT');
  if (JSON.stringify(snapshot).includes('$lounge_closure$')) fail('DOLLAR_QUOTE_COLLISION');
  if (Object.values(snapshot.partial).some(value => value !== false)) fail('PARTIAL_CLOSURE_STATE');
  if (snapshot.gates.loungeEnabled !== false || snapshot.gates.loungeLegalBound !== false
    || snapshot.gates.features?.DEVICE_INTEGRATION !== false || snapshot.gates.features?.SHARING !== false
    || own(snapshot.gates.features, 'AUTH_OAUTH') || own(snapshot.gates.features, 'AUTH_PASSWORDLESS')) fail('CLOSED_BASELINE_REQUIRED');
  if (sources.some(source => snapshot.ledger.some(row => row.version === source.version
    || row.name === source.name || row.name === source.file.slice(0, -4)))) fail('TARGET_RECEIPT_COLLISION');
  if (!hash64(reviewedSnapshotSha256) || reviewedSnapshotSha256 !== snapshotHash(snapshot)) fail('REVIEWED_BASELINE_REQUIRED');
  return { kind: 'TRAINORACLE_LOUNGE_CLOSURE_PLAN', version: 1, projectRef: PROJECT_REF,
    snapshot, snapshotSha256: snapshotHash(snapshot), reviewedSnapshotSha256, sources };
}

function assertEvidence(plan, evidence) {
  if (evidence?.projectRef !== PROJECT_REF || evidence.scope !== 'TRAINORACLE_ENCRYPTED_APP_RECORDS'
    || evidence.encrypted !== true || evidence.plaintextFiles !== false || evidence.privateRowsPrinted !== false
    || evidence.ciphertextIntegrityVerified !== true || evidence.isolatedAppRecordsRestoreVerified !== true
    || !hash64(evidence.ciphertextSha256) || evidence.metadataSnapshotSha256 !== plan.snapshotSha256
    || !((evidence.quiescenceMode === 'IN_TRANSACTION_TABLE_LOCKS' && evidence.operatorWritesQuiesced === false)
      || (evidence.quiescenceMode === 'EXTERNAL_DRAIN' && evidence.operatorWritesQuiesced === true))
    || evidence.publicActivationApproved !== false) fail('APP_RECORD_RECOVERY_EVIDENCE_REQUIRED');
  // Operator assertions are not self-proving: root must independently verify
  // the encrypted archive and actual isolated app-record restore receipt.
}

const dollar = (text, tag) => {
  const marker = `$${tag}$`;
  if (text.includes(marker) || text.includes('$lounge_closure$')) fail('DOLLAR_QUOTE_COLLISION');
  return `${marker}${text}${marker}`;
};

export function renderApplySql(plan, evidence) {
  if (plan.snapshotSha256 !== snapshotHash(plan.snapshot)) fail('PLAN_FINGERPRINT_CHANGED');
  planClosure({ projectRef: plan.projectRef, snapshot: plan.snapshot }, plan.reviewedSnapshotSha256, plan.sources);
  assertEvidence(plan, evidence);
  const chunks = plan.sources.map(source => {
    const emptyGuard = source.version === '0058' ? `
  if exists(select 1 from public.account_storage_consents)
    or exists(select 1 from public.account_storage_operation_reviews) then
    raise exception 'LOUNGE_CLOSURE_0057_NOT_EMPTY';
  end if;` : '';
    return `${emptyGuard}
  -- ${source.file}; normalized SHA256 ${source.sha256}
  execute ${dollar(source.body, `source_${source.version}`)};
  insert into supabase_migrations.schema_migrations(version,name,statements)
    values(${literal(source.version)},${literal(source.name)},array[${literal(source.sql)}]);`;
  }).join('\n');
  const targetVersions = plan.sources.map(source => literal(source.version)).join(',');
  const expectedTargets = plan.sources.map(({ version, name, sourceHash }) => ({ version, name, sourceHash }));
  return `-- Preparation is not permission to apply. Exact project ${PROJECT_REF}.
-- One DO owns all nine source bodies and nine receipts. The Management API
-- may add its separate bundle receipt; root must verify it after the call.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local idle_in_transaction_session_timeout='180s';
do $lounge_closure$
declare actual jsonb; original_ledger jsonb; target_receipts jsonb; lock_catalog jsonb; table_lock record;
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'LOUNGE_CLOSURE_READ_COMMITTED_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('trainoracle.lounge.closure',0));
  lock table supabase_migrations.schema_migrations in share row exclusive mode;
  select ${TABLE_LOCK_CATALOG_EXPRESSION} into lock_catalog;
  if jsonb_array_length(lock_catalog)=0 or exists(select 1 from jsonb_array_elements(lock_catalog) item where item->>'kind'='f')
    or exists(select 1 from pg_inherits i join pg_class child on child.oid=i.inhrelid
      join pg_namespace ns on ns.oid=child.relnamespace
      where i.inhparent in(select (item->>'oid')::oid from jsonb_array_elements(lock_catalog) item)
        and (ns.nspname<>'public' or child.relkind not in('r','p'))) then
    raise exception 'LOUNGE_CLOSURE_LOCK_SCOPE_UNSUPPORTED';
  end if;
  for table_lock in select item->>'schema' schema_name,item->>'name' table_name,item->>'oid' table_oid
    from jsonb_array_elements(lock_catalog) item order by (item->>'oid')::oid loop
    execute format('lock table only %I.%I in share row exclusive mode',table_lock.schema_name,table_lock.table_name);
  end loop;
  if lock_catalog is distinct from ${TABLE_LOCK_CATALOG_EXPRESSION} then
    raise exception 'LOUNGE_CLOSURE_LOCK_SCOPE_DRIFT';
  end if;
  if exists(select 1 from jsonb_array_elements(lock_catalog) item where not exists(
    select 1 from pg_locks l where l.locktype='relation' and l.database=(select oid from pg_database where datname=current_database())
      and l.relation=(item->>'oid')::oid and l.pid=pg_backend_pid() and l.granted
      and l.mode in('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock'))) then
    raise exception 'LOUNGE_CLOSURE_TABLE_LOCK_COVERAGE';
  end if;
  select ${SNAPSHOT_EXPRESSION} into actual;
  if actual is distinct from ${literal(JSON.stringify(plan.snapshot))}::jsonb then
    raise exception 'LOUNGE_CLOSURE_INVENTORY_DRIFT';
  end if;
${chunks}
  select ${SNAPSHOT_EXPRESSION} into actual;
  select coalesce(jsonb_agg(item order by item->>'version'),'[]'::jsonb) into original_ledger
    from jsonb_array_elements(actual->'ledger') item where item->>'version' not in(${targetVersions});
  if original_ledger is distinct from ${literal(JSON.stringify(plan.snapshot.ledger))}::jsonb
    or jsonb_array_length(actual->'ledger')<>57 then raise exception 'LOUNGE_CLOSURE_LEDGER_POSTCHECK'; end if;
  select jsonb_agg(jsonb_build_object('version',version,'name',name,
    'sourceHash',md5(btrim(replace(replace(statements[1],chr(13)||chr(10),chr(10)),chr(13),chr(10))))) order by version)
    into target_receipts from supabase_migrations.schema_migrations where version in(${targetVersions});
  if target_receipts is distinct from ${literal(JSON.stringify(expectedTargets))}::jsonb
    or exists(select 1 from supabase_migrations.schema_migrations
      where version in(${targetVersions}) and cardinality(statements) is distinct from 1) then
    raise exception 'LOUNGE_CLOSURE_SOURCE_RECEIPT_POSTCHECK';
  end if;
  if ((actual->'gates'->'features')-'AUTH_OAUTH'-'AUTH_PASSWORDLESS') is distinct from ${literal(JSON.stringify(plan.snapshot.gates.features))}::jsonb
    or actual->'gates'->'loungeLegalBound' is distinct from 'false'::jsonb then
    raise exception 'LOUNGE_CLOSURE_EXISTING_GATES_CHANGED';
  end if;
  if (select enabled from public.lounge_admission_controls where singleton) is distinct from false
    or public.service_feature_enabled('AUTH_OAUTH') is distinct from false
    or public.service_feature_enabled('AUTH_PASSWORDLESS') is distinct from false
    or public.account_storage_operations_ready() is distinct from false
    or exists(select 1 from public.account_storage_consents)
    or exists(select 1 from public.account_storage_operation_reviews)
    or exists(select 1 from public.account_storage_erasure_receipts)
    or exists(select 1 from public.account_storage_erasure_context) then
    raise exception 'LOUNGE_CLOSURE_CLOSED_POSTCHECK';
  end if;
  if to_regprocedure('public.claim_beta_seat(uuid,uuid,date,text,text)') is null
    or to_regprocedure('public.account_data_rights_identity(uuid,uuid)') is null
    or to_regprocedure('public.erase_withdrawn_account_storage(uuid,bigint)') is null
    or not exists(select 1 from pg_attribute where attrelid='public.external_provider_connections'::regclass and attname='connection_epoch' and not attisdropped)
    or (select count(*) from pg_attribute where attrelid='public.lounge_session_grants'::regclass and attname in('requires_oauth','requires_passwordless') and not attisdropped)<>2 then
    raise exception 'LOUNGE_CLOSURE_CAPABILITY_POSTCHECK';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in('lounge_admission_controls','lounge_session_grants','lounge_identity_deletion_outbox',
        'account_storage_operation_reviews','account_storage_consents','account_storage_consent_events',
        'account_storage_erasure_receipts','account_storage_erasure_context') and c.relrowsecurity)<>8
    or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values('anon'),('authenticated'),('service_role')) r(role)
      where n.nspname='public' and c.relname in('lounge_admission_controls','lounge_session_grants','lounge_identity_deletion_outbox',
        'account_storage_operation_reviews','account_storage_consents','account_storage_consent_events',
        'account_storage_erasure_receipts','account_storage_erasure_context')
        and (has_table_privilege(r.role,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') or has_any_column_privilege(r.role,c.oid,'SELECT,INSERT,UPDATE')))
    or has_function_privilege('authenticated','public.guardian_authority_allowed(uuid,text,date)','EXECUTE')
    or has_function_privilege('anon','public.issue_lounge_grant()','EXECUTE')
    or has_function_privilege('service_role','public.issue_lounge_grant()','EXECUTE')
    or not has_function_privilege('authenticated','public.issue_lounge_grant()','EXECUTE')
    or not has_function_privilege('anon','public.inspect_lounge_grant(text)','EXECUTE') then
    raise exception 'LOUNGE_CLOSURE_PRIVILEGE_POSTCHECK';
  end if;
end;
$lounge_closure$;
commit;
`;
}

export function createMcpRequest(plan, evidence) {
  return { project_id: PROJECT_REF, name: BUNDLE_NAME, query: renderApplySql(plan, evidence) };
}

export function summarizePlan(plan) {
  return { kind: plan.kind, projectRef: plan.projectRef, snapshotSha256: plan.snapshotSha256,
    baselineReceipts: plan.snapshot.ledger.length, targetReceipts: plan.sources.map(({ file, version, sha256 }) => ({ file, version, sha256 })),
    productionApplied: false, publicActivated: false, nativePasswordRequired: false,
    publicTableLockCoverageVerified: false };
}

// Read-only receipt/catalog checks after root's MCP apply. The provider may add
// one extra bundle ledger row. Never repair/delete that row to fake alignment.
export function verificationSql(sources = loadClosureSources()) {
  const expected = sources.map(({ version, name, sourceHash }) => `(${literal(version)},${literal(name)},${literal(sourceHash)})`).join(',');
  return `with expected(version,name,source_hash) as (values ${expected})
select jsonb_build_object(
  'targetReceipts',(select jsonb_agg(jsonb_build_object('version',e.version,'name',e.name,'present',m.version is not null,
    'sourceHashMatches',m.name=e.name and cardinality(m.statements)=1
      and md5(btrim(replace(replace(m.statements[1],chr(13)||chr(10),chr(10)),chr(13),chr(10))))=e.source_hash) order by e.version)
    from expected e left join supabase_migrations.schema_migrations m on m.version=e.version),
  'ledgerCount',(select count(*) from supabase_migrations.schema_migrations),
  'bundleReceipts',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name)),'[]'::jsonb)
    from supabase_migrations.schema_migrations where name=${literal(BUNDLE_NAME)}),
  'loungeEnabled',(select enabled from public.lounge_admission_controls where singleton),
  'authOauthEnabled',public.service_feature_enabled('AUTH_OAUTH'),
  'authPasswordlessEnabled',public.service_feature_enabled('AUTH_PASSWORDLESS'),
  'sensitiveStorageOperationsReady',public.account_storage_operations_ready()
) as verification;`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const option = name => process.argv.find(argument => argument.startsWith(`${name}=`))?.slice(name.length + 1);
    const inventoryPath = option('--inventory');
    if (!inventoryPath || !inventoryPath.endsWith('.json')) fail('INVENTORY_JSON_REQUIRED');
    const plan = planClosure(JSON.parse(readFileSync(inventoryPath, 'utf8')), option('--reviewed-snapshot-sha256'));
    const format = option('--format') ?? 'summary';
    if (format === 'summary') console.log(JSON.stringify(summarizePlan(plan)));
    else {
      const evidencePath = option('--evidence');
      if (!evidencePath || !evidencePath.endsWith('.json')) fail('EVIDENCE_JSON_REQUIRED');
      const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
      if (format === 'mcp') console.log(JSON.stringify(createMcpRequest(plan, evidence)));
      else if (format === 'sql') console.log(renderApplySql(plan, evidence));
      else fail('UNSUPPORTED_OUTPUT_FORMAT');
    }
  } catch (error) {
    // Never echo arbitrary input, SQL, file contents or wrapped provider errors.
    console.error(/^[A-Z0-9_:]+$/u.test(error.message) ? error.message : 'LOUNGE_CLOSURE_PREPARATION_FAILED');
    process.exitCode = 1;
  }
}
