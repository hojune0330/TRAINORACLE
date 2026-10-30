-- Candidate only. Not a migration or deployment receipt. Apply to a disposable
-- rehearsal DB first, then create the project migration through the Supabase CLI.
-- Requires existing account storage migrations through 0065 and pgcrypto.
begin;

create table public.self_hosted_coaching_controls (
  singleton boolean primary key default true check(singleton),
  approved boolean not null default false,
  evidence_reference text not null,
  reviewed_at timestamptz not null default clock_timestamp()
);
create table public.self_hosted_coaching_keys (
  key_id text primary key,
  secret bytea not null check(octet_length(secret)=32),
  enabled boolean not null default false,
  scope text not null default 'RUNTIME' check(scope in ('RUNTIME','INTAKE'))
);
create table public.self_hosted_coaching_provider_grants (
  grant_id text primary key,
  grant_document jsonb not null check(jsonb_typeof(grant_document)='object'),
  revision bigint not null default 1 check(revision > 0)
);
-- This is a trusted intake registry, NOT a copy of client lineage. It is written
-- only after existing ingestion/review has verified source, confirmation,
-- duplicate/conflict exclusion and exact canonical document revision.
create table public.self_hosted_coaching_sources (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null,
  document_revision bigint not null check(document_revision>0),
  record_date date not null,
  lineage jsonb not null check(jsonb_typeof(lineage)='object'),
  confirmed boolean not null default false,
  analysis_eligible boolean not null default false,
  evidence_reference text,
  reviewed_at timestamptz,
  primary key(user_id, document_id)
);
create table public.self_hosted_coaching_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check(revision between 1 and 9007199254740990),
  active boolean not null default false,
  purpose_version text not null,
  document_ids uuid[] not null,
  source_manifest text,
  decided_at timestamptz not null default clock_timestamp()
);
alter table public.self_hosted_coaching_controls enable row level security;
alter table public.self_hosted_coaching_keys enable row level security;
alter table public.self_hosted_coaching_provider_grants enable row level security;
alter table public.self_hosted_coaching_sources enable row level security;
alter table public.self_hosted_coaching_consents enable row level security;
revoke all on public.self_hosted_coaching_controls, public.self_hosted_coaching_keys,
  public.self_hosted_coaching_provider_grants, public.self_hosted_coaching_sources,
  public.self_hosted_coaching_consents from public, anon, authenticated, service_role;

-- A browser cannot call this with its JWT alone: a separate company-gateway HMAC
-- binds the exact user/session/action. No service-role token is used by the gateway.
create function public.self_hosted_coaching_attested(request_text text, signature text, key_id text)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
  actor uuid := auth.uid(); claims jsonb := auth.jwt(); sid uuid; req jsonb; action text;
  signing_key bytea; selected uuid[]; current_consent public.self_hosted_coaching_consents%rowtype;
  consent_json jsonb; rows_json jsonb; grants_json jsonb; manifest text; ready boolean;
  expected_revision bigint; key_scope text; source_row public.account_journal_documents%rowtype;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if actor is null or claims->>'sub' is distinct from actor::text or claims->>'role' is distinct from 'authenticated'
    or coalesce(claims->>'session_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    or coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$' then
    raise exception 'COACHING_DENIED' using errcode='42501';
  end if;
  sid := (claims->>'session_id')::uuid;
  if (claims->>'exp')::numeric <= extract(epoch from clock_timestamp()) or not exists (
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=sid and s.user_id=actor and (s.not_after is null or s.not_after>clock_timestamp())
      and u.deleted_at is null and coalesce(u.is_anonymous,false)=false
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
  ) then raise exception 'COACHING_DENIED' using errcode='42501'; end if;
  if request_text is null or octet_length(request_text)>16000 or signature is null or signature !~ '^[a-f0-9]{64}$' then
    raise exception 'COACHING_DENIED' using errcode='42501';
  end if;
  select k.secret,k.scope into signing_key,key_scope from public.self_hosted_coaching_keys k where k.key_id=$3 and k.enabled;
  if signing_key is null or extensions.hmac(convert_to(request_text,'UTF8'),signing_key,'sha256') <> decode(signature,'hex') then
    raise exception 'COACHING_DENIED' using errcode='42501';
  end if;
  req := request_text::jsonb; action := req->>'action';
  if req->>'domain' is distinct from 'trainoracle.self-hosted-coaching.v1'
    or req->>'ownerId' is distinct from actor::text or req->>'sessionId' is distinct from sid::text
    or coalesce(req->>'proofExpiresAt','') !~ '^[0-9]{1,12}$'
    or (req->>'proofExpiresAt')::numeric<=extract(epoch from clock_timestamp())
    or (req->>'proofExpiresAt')::numeric>extract(epoch from clock_timestamp())+90
    or action is null or action not in ('status','bundle','consent','withdraw','verify','intakeSource','registerSource')
    or (action in ('intakeSource','registerSource') and key_scope<>'INTAKE')
    or (action not in ('intakeSource','registerSource') and key_scope<>'RUNTIME') then
    raise exception 'COACHING_DENIED' using errcode='42501';
  end if;
  -- Serialize consent changes, including first consent (where no row exists yet).
  perform pg_advisory_xact_lock(hashtextextended('self-hosted-coaching:'||actor::text,0));
  select * into current_consent from public.self_hosted_coaching_consents c where c.user_id=actor for update;
  consent_json := jsonb_build_object('revision',coalesce(current_consent.revision,0),
    'active',coalesce(current_consent.active,false),'purposeVersion',coalesce(current_consent.purpose_version,'2026-10-30'),
    'documentIds',coalesce(to_jsonb(current_consent.document_ids),'[]'::jsonb));
  -- Source review uses a separate, owner-operated key. Runtime gateway keys and
  -- browser requests cannot register or upgrade source claims.
  if action in ('intakeSource','registerSource') then
    if public.account_network_access_allowed(actor) is distinct from true
      or public.service_feature_enabled('ACCOUNT_JOURNAL_V2') is distinct from true
      or coalesce(req->>'documentId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      or coalesce(req->>'revision','') !~ '^[1-9][0-9]{0,15}$' then raise exception 'COACHING_DENIED' using errcode='42501'; end if;
    select * into source_row from public.account_journal_documents d
      where d.user_id=actor and d.document_id=(req->>'documentId')::uuid and d.deleted_at is null for share;
    if not found or source_row.revision<>(req->>'revision')::bigint then return jsonb_build_object('error','SOURCE_CHANGED'); end if;
    if action='intakeSource' then return jsonb_build_object('documentId',source_row.document_id,
      'revision',source_row.revision,'encryptedPayload',source_row.encrypted_payload,'deletedAt',null); end if;
    if jsonb_typeof(req->'lineage') is distinct from 'object' or req->>'confirmed' is distinct from 'true'
      or req->>'analysisEligible' is distinct from 'true' or coalesce(req->>'evidenceReference','') !~ '^[A-Za-z0-9._:/-]{12,200}$'
      or (req->>'reviewedAt')::timestamptz>clock_timestamp() or req->>'reviewedAt' is null
      or coalesce(req->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'COACHING_DENIED' using errcode='42501';
    end if;
    insert into public.self_hosted_coaching_sources(user_id,document_id,document_revision,record_date,lineage,confirmed,analysis_eligible,evidence_reference,reviewed_at)
      values(actor,source_row.document_id,source_row.revision,(req->>'date')::date,req->'lineage',true,true,req->>'evidenceReference',(req->>'reviewedAt')::timestamptz)
      on conflict(user_id,document_id) do update set document_revision=excluded.document_revision,record_date=excluded.record_date,
        lineage=excluded.lineage,confirmed=true,analysis_eligible=true,evidence_reference=excluded.evidence_reference,reviewed_at=excluded.reviewed_at;
    return jsonb_build_object('registered',true,'revision',source_row.revision);
  end if;
  -- Withdrawal stays available when account storage, operations or AI are stopped.
  if action='withdraw' then
    if coalesce(req->>'expectedConsentRevision','') !~ '^[0-9]{1,16}$' then
      return jsonb_build_object('error','CONSENT_CHANGED');
    end if;
    expected_revision := (req->>'expectedConsentRevision')::bigint;
    if expected_revision<>coalesce(current_consent.revision,0) or expected_revision>=9007199254740990 then
      return jsonb_build_object('error','CONSENT_CHANGED');
    end if;
    insert into public.self_hosted_coaching_consents(user_id,revision,active,purpose_version,document_ids)
      values(actor,expected_revision+1,false,'2026-10-30','{}')
      on conflict(user_id) do update set revision=excluded.revision,active=false,document_ids='{}',source_manifest=null,decided_at=clock_timestamp();
    return jsonb_build_object('consent',jsonb_build_object('revision',expected_revision+1,'active',false,'purposeVersion','2026-10-30'));
  end if;
  ready := exists(select 1 from public.self_hosted_coaching_controls c where c.singleton and c.approved and c.reviewed_at<=clock_timestamp())
    and public.account_network_access_allowed(actor) is true
    and public.service_feature_enabled('ACCOUNT_JOURNAL_V2') is true;
  if not ready then
    return jsonb_build_object('operationsReady',false,'consent',consent_json,'rows','[]'::jsonb,'grants','[]'::jsonb);
  end if;
  if action<>'status' then
    if jsonb_typeof(req->'documentIds') is distinct from 'array' or jsonb_array_length(req->'documentIds') not between 1 and 20 then
      raise exception 'COACHING_DENIED' using errcode='42501';
    end if;
    select array_agg(value::uuid order by value) into selected from jsonb_array_elements_text(req->'documentIds');
    if cardinality(selected)<>(select count(distinct item) from unnest(selected) item) then
      raise exception 'COACHING_DENIED' using errcode='42501';
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('documentId',r.document_id,'revision',r.revision,
    'encryptedPayload',r.encrypted_payload,'deletedAt',r.deleted_at,'date',s.record_date,
    'lineage',s.lineage,'confirmed',s.confirmed,'analysisEligible',s.analysis_eligible) order by r.document_id),'[]'::jsonb)
    into rows_json from (
      select d.* from public.account_journal_documents d
      join public.self_hosted_coaching_sources src on src.user_id=d.user_id and src.document_id=d.document_id and src.document_revision=d.revision
      where d.user_id=actor and d.deleted_at is null and (selected is null or d.document_id=any(selected))
      order by src.record_date desc,d.document_id limit 20
    ) r join public.self_hosted_coaching_sources s on s.user_id=r.user_id and s.document_id=r.document_id;
  if selected is not null and jsonb_array_length(rows_json)<>cardinality(selected) then return jsonb_build_object('error','SOURCE_CHANGED'); end if;
  select coalesce(jsonb_agg(g.grant_document order by g.grant_id),'[]'::jsonb) into grants_json
    from public.self_hosted_coaching_provider_grants g
    where g.grant_document->>'active'='true'
      and (g.grant_document->>'validFrom')::timestamptz<=clock_timestamp()
      and (g.grant_document->>'validUntil')::timestamptz>clock_timestamp();
  manifest := encode(extensions.digest(convert_to(jsonb_build_object('rows',rows_json,'grants',grants_json)::text,'UTF8'),'sha256'),'hex');
  if action in ('consent','verify') and req->>'expectedManifest' is distinct from manifest then return jsonb_build_object('error','SOURCE_CHANGED'); end if;
  if action='consent' then
    if req->>'purposeVersion' is distinct from '2026-10-30' or coalesce(req->>'expectedConsentRevision','') !~ '^[0-9]{1,16}$' then
      return jsonb_build_object('error','CONSENT_CHANGED');
    end if;
    expected_revision := (req->>'expectedConsentRevision')::bigint;
    if expected_revision<>coalesce(current_consent.revision,0) or expected_revision>=9007199254740990 then return jsonb_build_object('error','CONSENT_CHANGED'); end if;
    insert into public.self_hosted_coaching_consents(user_id,revision,active,purpose_version,document_ids,source_manifest)
      values(actor,expected_revision+1,true,'2026-10-30',selected,manifest)
      on conflict(user_id) do update set revision=excluded.revision,active=true,purpose_version=excluded.purpose_version,
        document_ids=excluded.document_ids,source_manifest=excluded.source_manifest,decided_at=clock_timestamp();
    return jsonb_build_object('consent',jsonb_build_object('revision',expected_revision+1,'active',true,'purposeVersion','2026-10-30'));
  end if;
  if action='verify' or (action='bundle' and req ? 'consentRevision') then
    if current_consent.active is distinct from true or current_consent.purpose_version is distinct from '2026-10-30'
      or coalesce(req->>'consentRevision','')<>current_consent.revision::text or not selected<@current_consent.document_ids then
      return jsonb_build_object('error','CONSENT_CHANGED');
    end if;
    if current_consent.source_manifest is distinct from manifest then return jsonb_build_object('error','SOURCE_CHANGED'); end if;
  end if;
  if action='verify' then return jsonb_build_object('verified',true); end if;
  return jsonb_build_object('operationsReady',true,'consent',consent_json,'rows',rows_json,'grants',grants_json,'manifest',manifest);
end;
$$;
revoke all on function public.self_hosted_coaching_attested(text,text,text) from public,anon,service_role;
grant execute on function public.self_hosted_coaching_attested(text,text,text) to authenticated;
commit;
