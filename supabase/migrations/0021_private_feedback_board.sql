alter table public.service_feature_controls
  drop constraint if exists service_feature_controls_feature_key_check;
alter table public.service_feature_controls
  add constraint service_feature_controls_feature_key_check
  check (feature_key in ('ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS', 'FEEDBACK_BOARD'));

alter table public.service_feature_control_events
  drop constraint if exists service_feature_control_events_feature_key_check;
alter table public.service_feature_control_events
  add constraint service_feature_control_events_feature_key_check
  check (feature_key in ('ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS', 'FEEDBACK_BOARD'));

insert into public.service_feature_controls (feature_key, enabled, change_reason)
values ('FEEDBACK_BOARD', false, 'INITIAL_SAFE_DEFAULT')
on conflict (feature_key) do nothing;

create table public.feedback_threads (
  id uuid primary key default gen_random_uuid(),
  client_token_hash text not null check (length(client_token_hash) = 64),
  client_request_id uuid not null,
  category text not null check (category in ('BUG', 'IDEA', 'QUESTION')),
  subject text not null check (char_length(trim(subject)) between 4 and 120),
  status text not null default 'OPEN' check (status in ('OPEN', 'ANSWERED', 'RESOLVED')),
  created_at timestamptz not null default clock_timestamp(),
  last_activity_at timestamptz not null default clock_timestamp(),
  unique (client_token_hash, client_request_id)
);

create table public.feedback_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.feedback_threads(id) on delete cascade,
  author_kind text not null check (author_kind in ('USER', 'OPERATOR')),
  client_comment_id uuid not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp(),
  unique (thread_id, client_comment_id)
);

create index feedback_threads_token_activity_idx
  on public.feedback_threads (client_token_hash, last_activity_at desc);
create index feedback_comments_thread_created_idx
  on public.feedback_comments (thread_id, created_at);

alter table public.feedback_threads enable row level security;
alter table public.feedback_comments enable row level security;

revoke all on table public.feedback_threads from public;
revoke all on table public.feedback_threads from anon;
revoke all on table public.feedback_threads from authenticated;
revoke all on table public.feedback_threads from service_role;
revoke all on table public.feedback_comments from public;
revoke all on table public.feedback_comments from anon;
revoke all on table public.feedback_comments from authenticated;
revoke all on table public.feedback_comments from service_role;

create or replace function public.feedback_token_digest(client_token_input text)
returns text
language plpgsql
immutable
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if client_token_input !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid feedback receipt' using errcode = '22023';
  end if;
  return encode(extensions.digest(client_token_input, 'sha256'), 'hex');
end;
$$;

create or replace function public.submit_feedback_thread(
  client_token_input text,
  client_request_id_input uuid,
  category_input text,
  subject_input text,
  body_input text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  token_hash text := public.feedback_token_digest(client_token_input);
  thread_id uuid;
  accepted_at timestamptz;
begin
  if not public.service_feature_enabled('FEEDBACK_BOARD') then
    raise exception 'SERVER_FEATURE_DISABLED_FEEDBACK_BOARD' using errcode = '42501';
  end if;
  if category_input not in ('BUG', 'IDEA', 'QUESTION')
    or char_length(trim(coalesce(subject_input, ''))) not between 4 and 120
    or char_length(trim(coalesce(body_input, ''))) not between 1 and 2000 then
    raise exception 'invalid feedback content' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(token_hash));
  select thread.id, thread.created_at into thread_id, accepted_at
  from public.feedback_threads thread
  where thread.client_token_hash = token_hash
    and thread.client_request_id = client_request_id_input;

  if thread_id is not null then
    return jsonb_build_object('id', thread_id, 'acceptedAt', accepted_at);
  end if;

  if (select count(*) from public.feedback_threads
      where client_token_hash = token_hash and created_at > clock_timestamp() - interval '24 hours') >= 10 then
    raise exception 'feedback rate limit reached' using errcode = '54000';
  end if;

  insert into public.feedback_threads (
    client_token_hash, client_request_id, category, subject
  ) values (
    token_hash, client_request_id_input, category_input, trim(subject_input)
  )
  on conflict (client_token_hash, client_request_id) do nothing
  returning id, created_at into thread_id, accepted_at;

  insert into public.feedback_comments (thread_id, author_kind, client_comment_id, body)
  values (thread_id, 'USER', client_request_id_input, trim(body_input))
  on conflict (thread_id, client_comment_id) do nothing;

  return jsonb_build_object('id', thread_id, 'acceptedAt', accepted_at);
end;
$$;

create or replace function public.list_my_feedback_threads(client_token_input text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  token_hash text := public.feedback_token_digest(client_token_input);
  result jsonb;
begin
  if not public.service_feature_enabled('FEEDBACK_BOARD') then
    raise exception 'SERVER_FEATURE_DISABLED_FEEDBACK_BOARD' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', thread.id,
    'category', thread.category,
    'subject', thread.subject,
    'status', thread.status,
    'createdAt', thread.created_at,
    'lastActivityAt', thread.last_activity_at,
    'comments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', comment.id,
        'author', comment.author_kind,
        'body', comment.body,
        'createdAt', comment.created_at
      ) order by comment.created_at), '[]'::jsonb)
      from public.feedback_comments comment
      where comment.thread_id = thread.id
    )
  ) order by thread.last_activity_at desc), '[]'::jsonb)
  into result
  from public.feedback_threads thread
  where thread.client_token_hash = token_hash;

  return result;
end;
$$;

create or replace function public.append_feedback_comment(
  client_token_input text,
  thread_id_input uuid,
  client_comment_id_input uuid,
  body_input text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  token_hash text := public.feedback_token_digest(client_token_input);
  comment_id uuid;
  accepted_at timestamptz;
begin
  if not public.service_feature_enabled('FEEDBACK_BOARD') then
    raise exception 'SERVER_FEATURE_DISABLED_FEEDBACK_BOARD' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(body_input, ''))) not between 1 and 2000 then
    raise exception 'invalid feedback comment' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.feedback_threads thread
    where thread.id = thread_id_input
      and thread.client_token_hash = token_hash
      and thread.status <> 'RESOLVED'
  ) then
    raise exception 'feedback thread not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.feedback_comments where thread_id = thread_id_input) >= 50 then
    raise exception 'feedback comment limit reached' using errcode = '54000';
  end if;

  insert into public.feedback_comments (thread_id, author_kind, client_comment_id, body)
  values (thread_id_input, 'USER', client_comment_id_input, trim(body_input))
  on conflict (thread_id, client_comment_id) do nothing
  returning id, created_at into comment_id, accepted_at;

  if comment_id is null then
    select comment.id, comment.created_at into comment_id, accepted_at
    from public.feedback_comments comment
    where comment.thread_id = thread_id_input
      and comment.client_comment_id = client_comment_id_input;
  end if;

  update public.feedback_threads
  set last_activity_at = greatest(last_activity_at, accepted_at)
  where id = thread_id_input;
  return jsonb_build_object('id', comment_id, 'acceptedAt', accepted_at);
end;
$$;

revoke all on function public.feedback_token_digest(text) from public;
revoke all on function public.feedback_token_digest(text) from anon;
revoke all on function public.feedback_token_digest(text) from authenticated;
revoke all on function public.submit_feedback_thread(text, uuid, text, text, text) from public;
revoke all on function public.list_my_feedback_threads(text) from public;
revoke all on function public.append_feedback_comment(text, uuid, uuid, text) from public;
grant execute on function public.submit_feedback_thread(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.list_my_feedback_threads(text) to anon, authenticated;
grant execute on function public.append_feedback_comment(text, uuid, uuid, text) to anon, authenticated;
