-- Private, bilateral, version-bound comparison. No public-profile permission is reused.
-- No activation, key provisioning, plaintext profile copy or account-journal mutation.
begin;
create table public.oracle_profile_comparison_controls (
  singleton boolean primary key default true check (singleton), enabled boolean not null default false
);
insert into public.oracle_profile_comparison_controls values (true, false);
create table public.oracle_profile_comparison_keys (
  key_id text primary key check (length(key_id) between 1 and 80),
  secret bytea not null check (octet_length(secret) = 32), enabled boolean not null default true
);
create table public.oracle_profile_comparison_invitations (
  comparison_id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  owner_session_id uuid not null, recipient_id uuid references auth.users(id) on delete cascade,
  owner_auth_channels text[] not null,
  token_hash bytea not null unique check(octet_length(token_hash)=32),
  expires_at timestamptz not null check(isfinite(expires_at)), revoked_at timestamptz,
  check(recipient_id is null or recipient_id<>owner_id)
);

create function public.oracle_profile_comparison_fields_valid(fields text[])
returns boolean language sql immutable set search_path = pg_catalog as $$
  select fields is not null and cardinality(fields) between 1 and 24
    and cardinality(fields) = (select count(distinct f) from unnest(fields) f)
    and not exists (select 1 from unnest(fields) f where f is null or f !~ '^(CHALLENGE|INTENSITY|STRUCTURE|SOCIAL|EXPLORE|REFRESH|SU|WE)_[123]$');
$$;
create table public.oracle_profile_comparison_grants (
  comparison_id uuid not null, owner_id uuid not null references auth.users(id) on delete cascade,
  peer_id uuid not null references auth.users(id) on delete cascade, consent_session_id uuid not null,
  consent_auth_channels text[] not null,
  document_id uuid not null, document_revision bigint not null check(document_revision between 1 and 9007199254740990),
  profile_revision bigint not null check(profile_revision between 1 and 9007199254740990),
  question_version text not null check(question_version = 'ORACLE_QUESTIONS_V2_1'),
  score_version text not null check(score_version = 'SELF_RESPONSE_INDEX_V1'),
  fields text[] not null check(public.oracle_profile_comparison_fields_valid(fields)),
  expires_at timestamptz not null check(isfinite(expires_at)),
  created_at timestamptz not null default clock_timestamp(), revoked_at timestamptz,
  grant_revision bigint not null default 1,
  external_fields text[], external_expires_at timestamptz, external_revoked_at timestamptz,
  primary key(comparison_id, owner_id), check(owner_id <> peer_id),
  check((external_fields is null and external_expires_at is null) or
    (public.oracle_profile_comparison_fields_valid(external_fields) and external_fields <@ fields
      and external_expires_at is not null and isfinite(external_expires_at) and external_expires_at <= expires_at))
);
-- Also covers withdrawal that wins a race against the initial consent request.
create table public.oracle_profile_comparison_withdrawals (
  comparison_id uuid not null, owner_id uuid not null references auth.users(id) on delete cascade,
  comparison_revoked boolean not null default false, external_revoked boolean not null default true,
  primary key(comparison_id,owner_id)
);
alter table public.oracle_profile_comparison_controls enable row level security;
alter table public.oracle_profile_comparison_keys enable row level security;
alter table public.oracle_profile_comparison_grants enable row level security;
alter table public.oracle_profile_comparison_withdrawals enable row level security;
alter table public.oracle_profile_comparison_invitations enable row level security;
revoke all on public.oracle_profile_comparison_controls, public.oracle_profile_comparison_keys,
  public.oracle_profile_comparison_grants, public.oracle_profile_comparison_withdrawals,
  public.oracle_profile_comparison_invitations from public, anon, authenticated, service_role;

create function public.oracle_profile_comparison_channels_allowed(channels text[])
returns boolean language sql volatile security definer set search_path = pg_catalog as $$
  select channels is not null and cardinality(channels) between 1 and 2
    and array_position(channels,null) is null
    and channels <@ array['AUTH_OAUTH','AUTH_PASSWORDLESS']::text[]
    and not exists(select 1 from unnest(channels) channel
      where public.service_feature_enabled(channel) is distinct from true);
$$;

-- Internal helper: not a callable arbitrary-user eligibility oracle.
create function public.oracle_profile_comparison_subject_allowed(subject uuid, session_id uuid)
returns boolean language sql volatile security definer set search_path = pg_catalog as $$
  select public.account_storage_subject_allowed(subject) is true and exists (
    select 1 from auth.users u join auth.sessions s on s.user_id=u.id
    where u.id=subject and s.id=session_id
      and (s.not_after is null or s.not_after>clock_timestamp())
      and u.email_confirmed_at is not null and u.deleted_at is null and coalesce(u.is_anonymous,false)=false
      and nullif(u.encrypted_password,'') is null
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
  );
$$;

-- All requests are signed by the dedicated gateway AND executed with the caller JWT.
-- Ciphertexts are returned only to that gateway, never by a browser-facing action.
create function public.oracle_profile_comparison_attested(request_text text, signature text, key_id text)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  actor uuid := auth.uid(); claims jsonb := auth.jwt(); sid uuid; req jsonb; action text;
  signing_key bytea; cid uuid; peer uuid; doc uuid; lock_owner uuid; selected text[];
  current_doc public.account_journal_documents%rowtype;
  invitation public.oracle_profile_comparison_invitations%rowtype;
  a public.oracle_profile_comparison_grants%rowtype; b public.oracle_profile_comparison_grants%rowtype;
  own_doc public.account_journal_documents%rowtype; peer_doc public.account_journal_documents%rowtype;
  purpose text; manifest jsonb; until_at timestamptz; now_at timestamptz; expiry timestamptz;
  auth_channels text[];
begin
  if actor is null or claims->>'sub' is distinct from actor::text or claims->>'role' is distinct from 'authenticated'
    or coalesce(claims->>'session_id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    or coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$' then
    raise exception 'COMPARISON_DENIED' using errcode='42501';
  end if;
  sid := (claims->>'session_id')::uuid;
  if (claims->>'exp')::numeric <= extract(epoch from clock_timestamp()) or not exists(
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=sid and s.user_id=actor and (s.not_after is null or s.not_after>clock_timestamp())
      and u.deleted_at is null and coalesce(u.is_anonymous,false)=false
  ) then raise exception 'COMPARISON_DENIED' using errcode='42501'; end if;
  if request_text is null or octet_length(request_text)>16000 or signature is null or signature !~ '^[a-f0-9]{64}$' then
    raise exception 'COMPARISON_DENIED' using errcode='42501';
  end if;
  select k.secret into signing_key from public.oracle_profile_comparison_keys k where k.key_id=$3 and k.enabled;
  if signing_key is null or extensions.hmac(convert_to(request_text,'UTF8'),signing_key,'sha256') <> decode(signature,'hex') then
    raise exception 'COMPARISON_DENIED' using errcode='42501';
  end if;
  req := request_text::jsonb;
  if req->>'domain' is distinct from 'trainoracle.profile-comparison.gateway.v1'
    or req->>'ownerId' is distinct from actor::text or req->>'sessionId' is distinct from sid::text
    or coalesce(req->>'proofExpiresAt','') !~ '^[0-9]{1,12}$'
    or (req->>'proofExpiresAt')::numeric<=extract(epoch from clock_timestamp())
    or (req->>'proofExpiresAt')::numeric>extract(epoch from clock_timestamp())+120 then
    raise exception 'COMPARISON_DENIED' using errcode='42501';
  end if;
  cid := (req->>'comparisonId')::uuid; action := req->>'action';
  if action='acceptInvite' then
    select i.comparison_id into cid from public.oracle_profile_comparison_invitations i where i.token_hash=decode(req->>'tokenHash','hex');
  end if;
  if cid is null or action is null or action not in('createInvite','acceptInvite','invitationStatus','source','consent','status','compare','export','verify','allowExternal','revoke','revokeExternal') then
    raise exception 'INVALID_COMPARISON_REQUEST' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('oracle_profile_comparison:'||cid::text,0));
  select i.* into invitation from public.oracle_profile_comparison_invitations i where i.comparison_id=cid;
  select g.* into a from public.oracle_profile_comparison_grants g where g.comparison_id=cid and g.owner_id=actor;

  -- Withdrawal never depends on feature flags, profile existence, or the peer's consent.
  -- Revoked rows are terminal; deleting/recreating a consent cannot revive this ID.
  if action in('revoke','revokeExternal') then
    if invitation.comparison_id is not null and actor<>invitation.owner_id and actor is distinct from invitation.recipient_id then
      raise exception 'COMPARISON_DENIED' using errcode='42501';
    end if;
    if action='revoke' then
      update public.oracle_profile_comparison_invitations set revoked_at=coalesce(revoked_at,clock_timestamp()) where comparison_id=cid;
    end if;
    insert into public.oracle_profile_comparison_withdrawals(comparison_id,owner_id,comparison_revoked,external_revoked)
      values(cid,actor,action='revoke',true)
      on conflict(comparison_id,owner_id) do update set
        comparison_revoked=oracle_profile_comparison_withdrawals.comparison_revoked or excluded.comparison_revoked,
        external_revoked=true;
    if a.owner_id is not null then
      update public.oracle_profile_comparison_grants g set
        revoked_at=case when action='revoke' then coalesce(g.revoked_at,clock_timestamp()) else g.revoked_at end,
        external_revoked_at=coalesce(g.external_revoked_at,clock_timestamp()), grant_revision=g.grant_revision+1
        where g.comparison_id=cid and g.owner_id=actor;
    end if;
    return jsonb_build_object('kind',case when action='revoke' then 'revoked' else 'external-revoked' end,'comparisonId',cid);
  end if;
  if public.current_jwt_auth_method_allowed() is distinct from true
    or not exists(select 1 from public.oracle_profile_comparison_controls c where c.singleton and c.enabled)
    or public.service_feature_enabled('ACCOUNT') is distinct from true
    or public.service_feature_enabled('ACCOUNT_JOURNAL_V2') is distinct from true
    or public.service_feature_enabled('SHARING') is distinct from true
    or not public.oracle_profile_comparison_subject_allowed(actor,sid) then
    raise exception 'COMPARISON_DENIED' using errcode='42501';
  end if;
  -- Bind both parties to the channel that issued each capability, not the
  -- current reader's channel. Closing one provider class also closes its grants.
  select array_agg(distinct case method->>'method' when 'oauth' then 'AUTH_OAUTH' else 'AUTH_PASSWORDLESS' end)
    into auth_channels from jsonb_array_elements(claims->'amr') method
    where method->>'method' in('oauth','otp','magiclink','email/signup');
  if action='createInvite' then
    expiry := (req->>'expiresAt')::timestamptz;
    if expiry is null or not isfinite(expiry) or expiry<=clock_timestamp() or expiry>clock_timestamp()+interval '7 days'
      or coalesce(req->>'tokenHash','') !~ '^[a-f0-9]{64}$'
      or exists(select 1 from public.oracle_profile_comparison_withdrawals w where w.comparison_id=cid) then
      raise exception 'COMPARISON_DENIED' using errcode='42501';
    end if;
    insert into public.oracle_profile_comparison_invitations(comparison_id,owner_id,owner_session_id,owner_auth_channels,token_hash,expires_at)
      values(cid,actor,sid,auth_channels,decode(req->>'tokenHash','hex'),expiry);
    return jsonb_build_object('kind','invitation-created','comparisonId',cid,'expiresAt',expiry);
  end if;
  if invitation.comparison_id is null or invitation.revoked_at is not null or invitation.expires_at<=clock_timestamp()
    or not public.oracle_profile_comparison_channels_allowed(invitation.owner_auth_channels)
    or not public.oracle_profile_comparison_subject_allowed(invitation.owner_id,invitation.owner_session_id) then
    raise exception 'COMPARISON_DENIED' using errcode='42501';
  end if;
  if action='acceptInvite' then
    -- A creator may reopen their own link; this never binds them as recipient or grants consent.
    if actor<>invitation.owner_id then
      if invitation.recipient_id is not null and invitation.recipient_id<>actor then
        raise exception 'COMPARISON_DENIED' using errcode='42501';
      end if;
      update public.oracle_profile_comparison_invitations set recipient_id=actor where comparison_id=cid;
      invitation.recipient_id := actor;
    end if;
  end if;
  if actor<>invitation.owner_id and actor is distinct from invitation.recipient_id then
    raise exception 'COMPARISON_DENIED' using errcode='42501';
  end if;
  if action in('acceptInvite','invitationStatus') then
    return jsonb_build_object('kind','invitation','comparisonId',cid,'accepted',invitation.recipient_id is not null,
      'peerLabel',null,'expiresAt',invitation.expires_at);
  end if;
  if action='status' then
    return jsonb_build_object('kind','status','comparisonId',cid,'consented',a.owner_id is not null,
      'revoked',a.revoked_at is not null,'externalConsented',a.external_fields is not null and a.external_revoked_at is null,
      'fields',coalesce(to_jsonb(a.fields),'[]'::jsonb),'expiresAt',a.expires_at);
  end if;
  if action in('source','consent') then
    if invitation.recipient_id is null then raise exception 'COMPARISON_DENIED' using errcode='42501'; end if;
    if exists(select 1 from public.oracle_profile_comparison_withdrawals w where w.comparison_id=cid and w.owner_id=actor and w.comparison_revoked) then
      raise exception 'COMPARISON_DENIED' using errcode='42501';
    end if;
    doc := (req->>'documentId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:'||actor::text,0));
    if public.current_jwt_auth_method_allowed() is distinct from true
      or not public.oracle_profile_comparison_subject_allowed(actor,sid)
      or not public.oracle_profile_comparison_channels_allowed(invitation.owner_auth_channels)
      or not public.oracle_profile_comparison_subject_allowed(invitation.owner_id,invitation.owner_session_id)
      or not exists(select 1 from public.oracle_profile_comparison_controls c where c.singleton and c.enabled)
      or public.service_feature_enabled('ACCOUNT_JOURNAL_V2') is distinct from true
      or public.service_feature_enabled('SHARING') is distinct from true then
      raise exception 'COMPARISON_DENIED' using errcode='42501';
    end if;
    select d.* into current_doc from public.account_journal_documents d
      join public.account_journal_identity i on i.user_id=d.user_id and i.document_id=d.document_id
      where d.user_id=actor and d.document_id=doc and d.deleted_at is null and i.active and i.document_kind='RUNNING_PROFILE';
    if current_doc.document_id is null or current_doc.revision is distinct from (req->>'documentRevision')::bigint then
      raise exception 'COMPARISON_DENIED' using errcode='42501';
    end if;
    if action='source' then return jsonb_build_object('ownerId',actor,'documentId',doc,'documentRevision',current_doc.revision,'encryptedPayload',current_doc.encrypted_payload); end if;
    peer := case when actor=invitation.owner_id then invitation.recipient_id else invitation.owner_id end;
    expiry := (req->>'expiresAt')::timestamptz;
    select array_agg(value order by value) into selected from jsonb_array_elements_text(req->'fields');
    if peer is null or peer=actor or not exists(select 1 from auth.users u where u.id=peer)
      or req->>'questionVersion' is distinct from 'ORACLE_QUESTIONS_V2_1' or req->>'scoreVersion' is distinct from 'SELF_RESPONSE_INDEX_V1'
      or (req->>'profileRevision')::bigint is null or not public.oracle_profile_comparison_fields_valid(selected)
      or expiry is null or not isfinite(expiry) or expiry<=clock_timestamp() or expiry>invitation.expires_at then
      raise exception 'COMPARISON_DENIED' using errcode='42501';
    end if;
    -- One comparison ID binds exactly two participants. Reciprocal consent is independent.
    if exists(select 1 from public.oracle_profile_comparison_grants g where g.comparison_id=cid
      and not ((g.owner_id=actor and g.peer_id=peer) or (g.owner_id=peer and g.peer_id=actor))) then
      raise exception 'COMPARISON_DENIED' using errcode='42501';
    end if;
    if a.owner_id is not null then
      if a.revoked_at is not null or a.consent_session_id<>sid or a.consent_auth_channels<>auth_channels or a.peer_id<>peer or a.document_id<>doc
        or a.document_revision<>current_doc.revision or a.profile_revision<>(req->>'profileRevision')::bigint
        or a.fields<>selected or a.expires_at<>expiry then raise exception 'COMPARISON_DENIED' using errcode='42501'; end if;
    else
      insert into public.oracle_profile_comparison_grants(comparison_id,owner_id,peer_id,consent_session_id,consent_auth_channels,
        document_id,document_revision,profile_revision,question_version,score_version,fields,expires_at)
      values(cid,actor,peer,sid,auth_channels,doc,current_doc.revision,(req->>'profileRevision')::bigint,req->>'questionVersion',req->>'scoreVersion',selected,expiry);
    end if;
    return jsonb_build_object('kind','consented','comparisonId',cid);
  end if;

  select g.* into b from public.oracle_profile_comparison_grants g
    where g.comparison_id=cid and g.owner_id=a.peer_id and g.peer_id=actor;
  if a.owner_id is null or b.owner_id is null or a.revoked_at is not null or b.revoked_at is not null
    or invitation.recipient_id is null
    or a.peer_id is distinct from (case when actor=invitation.owner_id then invitation.recipient_id else invitation.owner_id end)
    or a.expires_at<=clock_timestamp() or b.expires_at<=clock_timestamp()
    or not public.oracle_profile_comparison_subject_allowed(a.owner_id,a.consent_session_id)
    or not public.oracle_profile_comparison_subject_allowed(b.owner_id,b.consent_session_id)
    or not public.oracle_profile_comparison_channels_allowed(a.consent_auth_channels)
    or not public.oracle_profile_comparison_channels_allowed(b.consent_auth_channels)
    or a.question_version<>b.question_version or a.score_version<>b.score_version then
    raise exception 'COMPARISON_DENIED' using errcode='42501';
  end if;
  -- Same owner locks as canonical writes, in deterministic order. No source triggers are needed.
  for lock_owner in select unnest(array[actor,a.peer_id]) order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:'||lock_owner::text,0));
  end loop;
  -- Storage withdrawal uses these same locks. Re-read consent after waiting,
  -- before any source can leave the database.
  if public.current_jwt_auth_method_allowed() is distinct from true
    or not public.oracle_profile_comparison_subject_allowed(a.owner_id,a.consent_session_id)
    or not public.oracle_profile_comparison_subject_allowed(b.owner_id,b.consent_session_id)
    or not public.oracle_profile_comparison_channels_allowed(invitation.owner_auth_channels)
    or not public.oracle_profile_comparison_channels_allowed(a.consent_auth_channels)
    or not public.oracle_profile_comparison_channels_allowed(b.consent_auth_channels)
    or not exists(select 1 from public.oracle_profile_comparison_controls c where c.singleton and c.enabled)
    or public.service_feature_enabled('ACCOUNT_JOURNAL_V2') is distinct from true
    or public.service_feature_enabled('SHARING') is distinct from true then
    raise exception 'COMPARISON_DENIED' using errcode='42501';
  end if;
  select d.* into own_doc from public.account_journal_documents d join public.account_journal_identity i
    on i.user_id=d.user_id and i.document_id=d.document_id
    where d.user_id=actor and d.document_id=a.document_id and d.revision=a.document_revision
      and d.deleted_at is null and i.active and i.document_kind='RUNNING_PROFILE';
  select d.* into peer_doc from public.account_journal_documents d join public.account_journal_identity i
    on i.user_id=d.user_id and i.document_id=d.document_id
    where d.user_id=a.peer_id and d.document_id=b.document_id and d.revision=b.document_revision
      and d.deleted_at is null and i.active and i.document_kind='RUNNING_PROFILE';
  if own_doc.document_id is null or peer_doc.document_id is null then raise exception 'COMPARISON_DENIED' using errcode='42501'; end if;
  if action='allowExternal' then
    if exists(select 1 from public.oracle_profile_comparison_withdrawals w where w.comparison_id=cid and w.owner_id=actor and w.external_revoked) then
      raise exception 'COMPARISON_DENIED' using errcode='42501';
    end if;
    select array_agg(value order by value) into selected from jsonb_array_elements_text(req->'fields');
    expiry := (req->>'expiresAt')::timestamptz;
    if not public.oracle_profile_comparison_fields_valid(selected) or not selected<@a.fields
      or expiry is null or not isfinite(expiry) or expiry<=clock_timestamp() or expiry>least(a.expires_at,b.expires_at)
      or a.external_revoked_at is not null then raise exception 'COMPARISON_DENIED' using errcode='42501'; end if;
    if a.external_fields is not null then
      if a.external_fields<>selected or a.external_expires_at<>expiry then raise exception 'COMPARISON_DENIED' using errcode='42501'; end if;
    else
      update public.oracle_profile_comparison_grants g set external_fields=selected,external_expires_at=expiry,grant_revision=g.grant_revision+1
        where g.comparison_id=cid and g.owner_id=actor;
    end if;
    return jsonb_build_object('kind','external-consented','comparisonId',cid);
  end if;
  purpose := case when action='verify' then req->>'purpose' else action end;
  if purpose is null or purpose not in('compare','export') then raise exception 'COMPARISON_DENIED' using errcode='42501'; end if;
  if purpose='export' and (a.external_fields is null or b.external_fields is null or a.external_revoked_at is not null
    or b.external_revoked_at is not null or a.external_expires_at<=clock_timestamp() or b.external_expires_at<=clock_timestamp()) then
    raise exception 'COMPARISON_DENIED' using errcode='42501';
  end if;
  now_at := clock_timestamp();
  until_at := least(invitation.expires_at,a.expires_at,b.expires_at,to_timestamp((claims->>'exp')::double precision),
    (select s.not_after from auth.sessions s where s.id=a.consent_session_id),
    (select s.not_after from auth.sessions s where s.id=b.consent_session_id),
    case when purpose='export' then least(a.external_expires_at,b.external_expires_at) else null end);
  if until_at<=now_at then raise exception 'COMPARISON_DENIED' using errcode='42501'; end if;
  manifest := jsonb_build_object('selfGrantRevision',a.grant_revision,'peerGrantRevision',b.grant_revision,
    'selfDocumentRevision',own_doc.revision,'peerDocumentRevision',peer_doc.revision,'purpose',purpose);
  if action='verify' then
    if req->'expectedManifest' is distinct from manifest then raise exception 'COMPARISON_DENIED' using errcode='42501'; end if;
    return jsonb_build_object('kind','verified','checkedAt',now_at,'validUntil',until_at);
  end if;
  return jsonb_build_object('kind','sources','comparisonId',cid,'manifest',manifest,'checkedAt',now_at,'validUntil',until_at,
    'self',jsonb_build_object('ownerId',actor,'documentId',a.document_id,'documentRevision',a.document_revision,
      'profileRevision',a.profile_revision,'questionVersion',a.question_version,'scoreVersion',a.score_version,
      'fields',case when purpose='export' then a.external_fields else a.fields end,'encryptedPayload',own_doc.encrypted_payload),
    'peer',jsonb_build_object('ownerId',a.peer_id,'documentId',b.document_id,'documentRevision',b.document_revision,
      'profileRevision',b.profile_revision,'questionVersion',b.question_version,'scoreVersion',b.score_version,
      'fields',case when purpose='export' then b.external_fields else b.fields end,'encryptedPayload',peer_doc.encrypted_payload));
end;
$$;
revoke all on function public.oracle_profile_comparison_fields_valid(text[]),
  public.oracle_profile_comparison_channels_allowed(text[]),
  public.oracle_profile_comparison_subject_allowed(uuid,uuid),public.oracle_profile_comparison_attested(text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.oracle_profile_comparison_attested(text,text,text) to authenticated;
commit;
