import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../migrations/', import.meta.url);
const digest = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex');
const normalize = value => value.replace(/\r\n?/g, '\n').trim();
const fail = code => { throw new Error(code); };
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
export const SECRET_NAME = 'TRAINORACLE_PROFILE_COMPARISON_ATTESTATION_JSON';
export const AUTH_MIGRATIONS = [
  '0051_current_account_admission', '0052_coros_ingestion_account_gate',
  '0053_supported_auth_method_gate', '0054_public_profile_admission_policies',
  '0055_session_bound_account_admission', '0056_remaining_auth_surface_gates',
];

// No source definitions, user rows, ciphertext, credentials, or secret bytes leave this query.
export const SNAPSHOT_SQL = `select jsonb_build_object(
  'ledger', (select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,
    'sourceHash',case when cardinality(statements)=1 then md5(btrim(replace(replace(statements[1],E'\\r\\n',E'\\n'),E'\\r',E'\\n'))) end) order by version),'[]'::jsonb)
    from supabase_migrations.schema_migrations),
  'functions', (select coalesce(jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,
    'hash',md5(pg_get_functiondef(p.oid)), 'acl',p.proacl::text) order by p.oid::regprocedure::text),'[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
  'schemaHash', (select md5(coalesce(string_agg(item,E'\\n' order by item),'')) from (
    select 'relation:'||c.relname||':'||c.relrowsecurity||':'||c.relforcerowsecurity||':'||coalesce(c.relacl::text,'') item
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    union all select 'constraint:'||c.conrelid::regclass||':'||c.conname||':'||pg_get_constraintdef(c.oid)
      from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'
    union all select 'column:'||a.attrelid::regclass||':'||a.attname||':'||a.atttypid||':'||a.attnotnull||':'||coalesce(a.attacl::text,'')
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and a.attnum>0 and not a.attisdropped
    union all select 'policy:'||schemaname||':'||tablename||':'||policyname||':'||roles::text||':'||cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,'')
      from pg_policies where schemaname='public'
  ) schema_items),
  'capabilities', jsonb_build_array(
    coalesce((select position('runningProfileSupport' in prosrc)>0 from pg_proc where oid=to_regprocedure('public.mutate_account_journal_attested(text,text,text)')),false),
    coalesce((select position('oracleV2Support' in prosrc)>0 from pg_proc where oid=to_regprocedure('public.mutate_account_journal_attested(text,text,text)')),false),
    coalesce((select position('oracleV2RestartSupport' in prosrc)>0 from pg_proc where oid=to_regprocedure('public.mutate_account_journal_attested(text,text,text)')),false),
    to_regprocedure('public.oracle_profile_comparison_attested(text,text,text)') is not null),
  'comparisonTables', (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname in('oracle_profile_comparison_controls','oracle_profile_comparison_keys',
      'oracle_profile_comparison_invitations','oracle_profile_comparison_grants','oracle_profile_comparison_withdrawals'))
) as snapshot`;

export function loadMigrations(directory = root) {
  return readdirSync(directory).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort().map(file => {
    const sql = normalize(readFileSync(new URL(file, directory), 'utf8'));
    return { file, version: file.slice(0,4), name: file.slice(5,-4), sql, hash: digest(sql), sourceHash: digest(sql,'md5') };
  });
}

export function planRelease(inventory, projectRef, migrations = loadMigrations()) {
  if (!/^[a-z]{20}$/.test(projectRef) || inventory.projectRef !== projectRef) fail('PROJECT_MISMATCH');
  const snapshot = inventory.snapshot;
  if (!snapshot || !Array.isArray(snapshot.ledger) || !Array.isArray(snapshot.functions)
    || !/^[a-f0-9]{32}$/.test(snapshot.schemaHash) || snapshot.capabilities?.length !== 4) fail('INVALID_INVENTORY');
  const seen = new Set();
  for (const row of snapshot.ledger) {
    if (!/^\d{4,14}$/.test(row.version) || typeof row.name !== 'string' || seen.has(row.version)) fail('INVALID_LEDGER');
    seen.add(row.version);
  }
  const baseline = migrations.filter(m => m.version <= '0050');
  if (baseline.length !== 50) fail('LOCAL_BASELINE_INCOMPLETE');
  for (const m of baseline) {
    if (!snapshot.ledger.some(r => r.version === m.version && r.name === m.name)) fail('REMOTE_BASELINE_MISMATCH');
  }
  for (const identity of AUTH_MIGRATIONS) {
    if (!snapshot.ledger.some(r=>r.version===identity.slice(0,4) && r.name===identity.slice(5))) fail('AUTH_MIGRATIONS_REQUIRED');
  }
  const oracle = migrations.filter(m => m.version >= '0057' && m.version <= '0060');
  if (oracle.length !== 4) fail('ORACLE_SOURCE_INCOMPLETE');
  let missing = false;
  const pending = [];
  for (const [index,m] of oracle.entries()) {
    const rows = snapshot.ledger.filter(r => r.name === m.name);
    if (rows.length > 1) fail('DUPLICATE_ORACLE_LEDGER');
    if (rows.length && rows[0].sourceHash !== m.sourceHash) fail('APPLIED_SOURCE_UNPROVEN');
    if (rows.length && rows[0].version !== m.version) fail('ORACLE_VERSION_MISMATCH');
    if (snapshot.ledger.some(r=>r.version===m.version && r.name!==m.name)) fail('MIGRATION_VERSION_COLLISION');
    const applied = rows.length === 1;
    if (snapshot.capabilities[index] !== applied) fail('LEDGER_CAPABILITY_MISMATCH');
    if (applied && missing) fail('NON_PREFIX_ORACLE_HISTORY');
    if (!applied) { missing = true; pending.push(m); }
  }
  if (snapshot.comparisonTables !== (snapshot.capabilities[3] ? 5 : 0)) fail('PARTIAL_COMPARISON_SCHEMA');
  const migrationsToApply = pending.map(m => ({...m, targetVersion:m.version}));
  return { version:1, projectRef, snapshot, migrations:migrationsToApply };
}

function migrationBody(sql) {
  // Only remove the known outer transaction. All procedural dollar-quoted SQL stays byte-for-byte intact.
  const match = sql.match(/^(?:--[^\n]*\n|\s)*begin;([\s\S]*)commit;\s*$/i);
  if (!match || /^(?:begin|commit|rollback);\s*$/im.test(match[1])) fail('UNSUPPORTED_TRANSACTION_WRAPPER');
  return match[1];
}

export function renderApplySql(plan) {
  const expected = literal(JSON.stringify(plan.snapshot));
  const bodies = plan.migrations.map(m => `${migrationBody(m.sql)}\ninsert into supabase_migrations.schema_migrations(version,name,statements)
values(${literal(m.targetVersion)},${literal(m.name)},array[${literal(m.sql)}]);`).join('\n');
  return `-- Target project: ${plan.projectRef}. Review target connection separately; no keys in this file.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
select pg_advisory_xact_lock(hashtextextended('trainoracle.oracle-v2.release',0));
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $release_guard$
declare actual jsonb;
begin
  ${SNAPSHOT_SQL.replace(' as snapshot',' into actual')};
  if actual is distinct from ${expected}::jsonb then raise exception 'ORACLE_RELEASE_INVENTORY_DRIFT'; end if;
end;
$release_guard$;
${bodies}
do $postcheck$
declare actual jsonb;
begin
  ${SNAPSHOT_SQL.replace(' as snapshot',' into actual')};
  if actual->'capabilities' <> '[true,true,true,true]'::jsonb or actual->>'comparisonTables' <> '5'
    then raise exception 'ORACLE_RELEASE_POSTCHECK_FAILED'; end if;
end;
$postcheck$;
commit;
`;
}

export const VERIFY_SQL = `begin read only;
set local search_path=pg_catalog;
${SNAPSHOT_SQL};
select singleton,enabled from public.oracle_profile_comparison_controls;
select key_id,enabled,octet_length(secret)=32 as valid_length from public.oracle_profile_comparison_keys order by key_id;
select feature_key,enabled from public.service_feature_controls
 where feature_key in('ACCOUNT','ACCOUNT_JOURNAL_V2','SHARING','AUTH_OAUTH','AUTH_PASSWORDLESS') order by feature_key;
select c.relname,c.relrowsecurity,
 not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
 and not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
 and not has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') as private
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname like 'oracle_profile_comparison_%' and c.relkind='r';
select p.oid::regprocedure as function,p.prosecdef,p.proconfig,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'oracle_profile_comparison_%';
rollback;
`;

export const ROLLBACK_SQL = `-- Non-destructive stop only. Keep the current V2 reader, withdrawal endpoint, and all keys.
begin;
set local lock_timeout='10s';
update public.oracle_profile_comparison_controls set enabled=false where singleton=true;
select singleton,enabled from public.oracle_profile_comparison_controls;
commit;
`;

export function stageRelease(plan, output) {
  // A fresh directory prevents mixing candidates or accidentally replacing a previous receipt.
  mkdirSync(output, {recursive:false});
  const applySql=renderApplySql(plan);
  for (const [name,contents] of Object.entries({
    'manifest.json':JSON.stringify({...plan, applyHash:digest(applySql), migrations:plan.migrations.map(({sql,...m})=>m)},null,2)+'\n',
    'apply.sql':applySql, 'verify.sql':VERIFY_SQL, 'stop-comparison.sql':ROLLBACK_SQL,
  })) writeFileSync(resolve(output,name),contents,{flag:'wx'});
}

export async function provisionComparisonKey(client, config, token, keyId, request = fetch) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(keyId)) fail('INVALID_KEY_ID');
  if (!token || typeof token !== 'string') fail('MANAGEMENT_TOKEN_REQUIRED');
  const endpoint = `https://api.supabase.com/v1/projects/${config.projectRef}/secrets`;
  const headers = {authorization:`Bearer ${token}`, 'content-type':'application/json'};
  const response = await request(endpoint,{headers,redirect:'error',signal:AbortSignal.timeout(30000)});
  if (!response.ok) fail('EDGE_SECRET_METADATA_UNAVAILABLE');
  const secretMetadata = await response.json();
  if (!Array.isArray(secretMetadata) || secretMetadata.some(s=>s.name===SECRET_NAME)) fail('EXISTING_EDGE_SECRET_PRESERVED');
  const bytes = randomBytes(32);
  let registered = false;
  try {
    await client.query('begin');
    await client.query('set local log_parameter_max_length_on_error=0');
    await client.query("select pg_advisory_xact_lock(hashtextextended('trainoracle.oracle-v2.release',0))");
    const state = await client.query('select enabled from public.oracle_profile_comparison_controls where singleton=true for update');
    if (state.rows.length!==1 || state.rows[0].enabled!==false) fail('COMPARISON_MUST_BE_OFF');
    const existing = await client.query('select key_id from public.oracle_profile_comparison_keys where key_id=$1',[keyId]);
    if (existing.rows.length) fail('EXISTING_DB_KEY_PRESERVED');
    await client.query('insert into public.oracle_profile_comparison_keys(key_id,secret,enabled) values($1,$2,true)',[keyId,bytes]);
    await client.query('commit');
    registered = true;
    // The two services cannot commit atomically. Keep the inserted key on an unknown HTTP outcome;
    // deleting it could strand an installed Edge secret and break withdrawals.
    const published = await request(endpoint,{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(30000),
      body:JSON.stringify([{name:SECRET_NAME,value:JSON.stringify({keyId,key:bytes.toString('base64')})}])});
    if (!published.ok) fail('EDGE_PUBLICATION_FAILED');
    return {projectRef:config.projectRef,keyId,dbRegistered:true,edgeAccepted:true,comparisonEnabled:false,authenticatedSmoke:'REQUIRED'};
  } catch {
    if (!registered) await client.query('rollback').catch(()=>{});
    fail(registered ? 'DB_KEY_RETAINED_EDGE_OUTCOME_REQUIRES_OPERATOR_RECONCILIATION' : 'KEY_REGISTRATION_REFUSED');
  } finally { bytes.fill(0); }
}

async function inputSecrets() {
  if (process.stdin.isTTY) fail('PRIVATE_STDIN_REQUIRED');
  let data='';
  for await (const chunk of process.stdin) { data+=chunk; if(data.length>16384) fail('INPUT_TOO_LARGE'); }
  const input=JSON.parse(data);
  if(typeof input.password!=='string' || !input.password) fail('DATABASE_PASSWORD_REQUIRED');
  return input;
}

function readConfig(path, expectedProject) {
  const c=JSON.parse(readFileSync(path,'utf8'));
  if (!/^[a-z]{20}$/.test(expectedProject) || c.projectRef!==expectedProject
    || typeof c.host!=='string' || !/^[a-z0-9.-]+\.supabase\.(com|co)$/.test(c.host)
    || ![5432,6543].includes(c.port) || c.database!=='postgres'
    || ![`postgres.${expectedProject}`,'postgres'].includes(c.user)
    || (c.user==='postgres' && c.host!==`db.${expectedProject}.supabase.co`)
    || typeof c.pgModule!=='string' || typeof c.caFile!=='string'
    || Object.keys(c).some(k=>!['projectRef','host','port','user','database','pgModule','caFile'].includes(k))) fail('INVALID_PUBLIC_CONFIG');
  return c;
}

async function main() {
  const [action,...args]=process.argv.slice(2);
  if(action==='stage' && args.length===3) {
    const [inventory,projectRef,output]=args;
    const plan=planRelease(JSON.parse(readFileSync(inventory,'utf8')),projectRef);
    stageRelease(plan,output);
    console.log(JSON.stringify({staged:plan.migrations.map(m=>({source:m.file,version:m.targetVersion})),output}));
    return;
  }
  if (!['inventory','apply','verify','provision-key'].includes(action) || args.length!==(['inventory','verify'].includes(action)?3:4)) fail('INVALID_COMMAND_ARGUMENTS');
  const [configPath,projectRef,destination,confirmation]=args;
  if(action==='provision-key' && confirmation!=='CONFIRM_FIRST_PROVISION') fail('EXPLICIT_KEY_CONFIRMATION_REQUIRED');
  if(action==='apply' && confirmation!=='CONFIRM_SQL_APPLY') fail('EXPLICIT_SQL_CONFIRMATION_REQUIRED');
  const config=readConfig(configPath,projectRef);
  let applySql;
  if(action==='apply') {
    const manifest=JSON.parse(readFileSync(resolve(destination,'manifest.json'),'utf8'));
    applySql=readFileSync(resolve(destination,'apply.sql'),'utf8');
    const expected=planRelease({projectRef,snapshot:manifest.snapshot},projectRef);
    if(manifest.projectRef!==projectRef || digest(applySql)!==manifest.applyHash || renderApplySql(expected)!==applySql) fail('STAGED_CANDIDATE_CHANGED');
  }
  const secrets=await inputSecrets();
  const {Client}=createRequire(import.meta.url)(resolve(config.pgModule));
  const client=new Client({host:config.host,port:config.port,user:config.user,database:config.database,password:secrets.password,
    ssl:{ca:readFileSync(config.caFile,'utf8'),rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:120000,
    application_name:'trainoracle-oracle-v2-release',options:'-c log_parameter_max_length_on_error=0'});
  try {
    await client.connect();
    if(action==='inventory') {
      await client.query('begin read only');
      await client.query('set local search_path=pg_catalog');
      const {snapshot}=(await client.query(SNAPSHOT_SQL)).rows[0];
      await client.query('rollback');
      writeFileSync(destination,JSON.stringify({projectRef,snapshot},null,2)+'\n',{flag:'wx'});
      console.log(JSON.stringify({projectRef,inventory:destination,readOnly:true}));
    } else if(action==='apply') {
      await client.query(applySql);
      console.log(JSON.stringify({projectRef,applied:true,postDeploymentVerification:'REQUIRED'}));
    } else if(action==='verify') {
      const results=await client.query(VERIFY_SQL);
      writeFileSync(destination,JSON.stringify({projectRef,results:results.filter(r=>r.rows?.length).map(r=>r.rows)},null,2)+'\n',{flag:'wx'});
      console.log(JSON.stringify({projectRef,verification:destination,readOnly:true}));
    } else console.log(JSON.stringify(await provisionComparisonKey(client,config,secrets.managementToken,destination)));
  } finally { secrets.password=''; secrets.managementToken=''; await client.end(); }
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{
    // Driver/HTTP errors may contain connection details or parameters. Never log them.
    console.error(/^[A-Z][A-Z0-9_: |]+$/.test(error.message)?error.message:'ORACLE_RELEASE_FAILED_REVIEW_NON_SECRET_STATE');
    process.exitCode=1;
  });
}
