alter table public.feedback_threads
  add column expires_at timestamptz not null
  default (clock_timestamp() + interval '180 days');

create index feedback_threads_expiry_idx
  on public.feedback_threads (expires_at);

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
  created_thread_id uuid;
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

  perform pg_advisory_xact_lock(hashtext('TRAINORACLE_FEEDBACK_GLOBAL'));
  perform pg_advisory_xact_lock(hashtext(token_hash));
  select thread.id, thread.created_at into created_thread_id, accepted_at
  from public.feedback_threads thread
  where thread.client_token_hash = token_hash
    and thread.client_request_id = client_request_id_input;

  if created_thread_id is not null then
    return jsonb_build_object('id', created_thread_id, 'acceptedAt', accepted_at);
  end if;

  if (select count(*) from public.feedback_threads
      where created_at > clock_timestamp() - interval '1 hour') >= 60
    or (select count(*) from public.feedback_threads
      where created_at > clock_timestamp() - interval '24 hours') >= 300 then
    raise exception 'feedback board capacity reached' using errcode = '54000';
  end if;
  if (select count(*) from public.feedback_threads
      where client_token_hash = token_hash
        and created_at > clock_timestamp() - interval '24 hours') >= 10 then
    raise exception 'feedback rate limit reached' using errcode = '54000';
  end if;

  insert into public.feedback_threads (
    client_token_hash, client_request_id, category, subject
  ) values (
    token_hash, client_request_id_input, category_input, trim(subject_input)
  )
  returning id, created_at into created_thread_id, accepted_at;

  insert into public.feedback_comments (thread_id, author_kind, client_comment_id, body)
  values (created_thread_id, 'USER', client_request_id_input, trim(body_input));

  return jsonb_build_object('id', created_thread_id, 'acceptedAt', accepted_at);
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
  created_comment_id uuid;
  accepted_at timestamptz;
begin
  if not public.service_feature_enabled('FEEDBACK_BOARD') then
    raise exception 'SERVER_FEATURE_DISABLED_FEEDBACK_BOARD' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(body_input, ''))) not between 1 and 2000 then
    raise exception 'invalid feedback comment' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('FEEDBACK_COMMENT_THREAD'),
    hashtext(thread_id_input::text)
  );
  if not exists (
    select 1 from public.feedback_threads thread
    where thread.id = thread_id_input
      and thread.client_token_hash = token_hash
      and thread.status <> 'RESOLVED'
  ) then
    raise exception 'feedback thread unavailable' using errcode = '42501';
  end if;

  select comment.id, comment.created_at into created_comment_id, accepted_at
  from public.feedback_comments comment
  where comment.thread_id = thread_id_input
    and comment.client_comment_id = client_comment_id_input;
  if created_comment_id is not null then
    return jsonb_build_object('id', created_comment_id, 'acceptedAt', accepted_at);
  end if;

  if (select count(*) from public.feedback_comments where thread_id = thread_id_input) >= 50 then
    raise exception 'feedback comment limit reached' using errcode = '54000';
  end if;

  insert into public.feedback_comments (thread_id, author_kind, client_comment_id, body)
  values (thread_id_input, 'USER', client_comment_id_input, trim(body_input))
  returning id, created_at into created_comment_id, accepted_at;

  update public.feedback_threads
  set last_activity_at = accepted_at,
      expires_at = accepted_at + interval '180 days'
  where id = thread_id_input;
  return jsonb_build_object('id', created_comment_id, 'acceptedAt', accepted_at);
end;
$$;

create or replace function public.list_feedback_threads_for_operator(limit_input integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if limit_input not between 1 and 100 then
    raise exception 'invalid feedback list limit' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', listed.id,
        'category', listed.category,
        'subject', listed.subject,
        'status', listed.status,
        'createdAt', listed.created_at,
        'lastActivityAt', listed.last_activity_at,
        'expiresAt', listed.expires_at,
        'comments', listed.comments
      ) order by listed.last_activity_at desc
    ),
    '[]'::jsonb
  ) into result
  from (
    select
      thread.id,
      thread.category,
      thread.subject,
      thread.status,
      thread.created_at,
      thread.last_activity_at,
      thread.expires_at,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', comment.id,
            'author', comment.author_kind,
            'body', comment.body,
            'createdAt', comment.created_at
          ) order by comment.created_at asc
        )
        from public.feedback_comments comment
        where comment.thread_id = thread.id
      ), '[]'::jsonb) as comments
    from public.feedback_threads thread
    where thread.expires_at > clock_timestamp()
    order by thread.last_activity_at desc
    limit limit_input
  ) listed;

  return result;
end;
$$;

create or replace function public.reply_to_feedback_thread(
  thread_id_input uuid,
  operator_comment_id_input uuid,
  body_input text,
  resolve_input boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  comment_id uuid;
  accepted_at timestamptz;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(body_input, ''))) not between 1 and 2000 then
    raise exception 'invalid feedback reply' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('FEEDBACK_COMMENT_THREAD'),
    hashtext(thread_id_input::text)
  );
  if not exists (select 1 from public.feedback_threads where id = thread_id_input) then
    raise exception 'feedback thread not found' using errcode = 'P0002';
  end if;

  select comment.id, comment.created_at into comment_id, accepted_at
  from public.feedback_comments comment
  where comment.thread_id = thread_id_input
    and comment.client_comment_id = operator_comment_id_input;
  if comment_id is not null then
    return jsonb_build_object('id', comment_id, 'acceptedAt', accepted_at);
  end if;

  if (select count(*) from public.feedback_comments where thread_id = thread_id_input) >= 50 then
    raise exception 'feedback comment limit reached' using errcode = '54000';
  end if;

  insert into public.feedback_comments (thread_id, author_kind, client_comment_id, body)
  values (thread_id_input, 'OPERATOR', operator_comment_id_input, trim(body_input))
  returning id, created_at into comment_id, accepted_at;

  update public.feedback_threads
  set status = case when resolve_input then 'RESOLVED' else 'ANSWERED' end,
      last_activity_at = accepted_at,
      expires_at = accepted_at + interval '180 days'
  where id = thread_id_input;

  return jsonb_build_object('id', comment_id, 'acceptedAt', accepted_at);
end;
$$;

create or replace function public.delete_my_feedback_thread(
  client_token_input text,
  thread_id_input uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  token_hash text := public.feedback_token_digest(client_token_input);
  removed integer;
begin
  delete from public.feedback_threads thread
  where thread.id = thread_id_input
    and thread.client_token_hash = token_hash;
  get diagnostics removed = row_count;
  return removed = 1;
end;
$$;

create or replace function public.purge_expired_feedback_threads()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  removed integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  delete from public.feedback_threads where expires_at <= clock_timestamp();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.delete_my_feedback_thread(text, uuid) from public;
revoke all on function public.delete_my_feedback_thread(text, uuid) from anon;
revoke all on function public.delete_my_feedback_thread(text, uuid) from authenticated;
grant execute on function public.delete_my_feedback_thread(text, uuid) to anon, authenticated;

revoke all on function public.list_feedback_threads_for_operator(integer) from public;
revoke all on function public.list_feedback_threads_for_operator(integer) from anon;
revoke all on function public.list_feedback_threads_for_operator(integer) from authenticated;
revoke all on function public.list_feedback_threads_for_operator(integer) from service_role;
grant execute on function public.list_feedback_threads_for_operator(integer) to service_role;

revoke all on function public.reply_to_feedback_thread(uuid, uuid, text, boolean) from public;
revoke all on function public.reply_to_feedback_thread(uuid, uuid, text, boolean) from anon;
revoke all on function public.reply_to_feedback_thread(uuid, uuid, text, boolean) from authenticated;
revoke all on function public.reply_to_feedback_thread(uuid, uuid, text, boolean) from service_role;
grant execute on function public.reply_to_feedback_thread(uuid, uuid, text, boolean) to service_role;

revoke all on function public.purge_expired_feedback_threads() from public;
revoke all on function public.purge_expired_feedback_threads() from anon;
revoke all on function public.purge_expired_feedback_threads() from authenticated;
revoke all on function public.purge_expired_feedback_threads() from service_role;
grant execute on function public.purge_expired_feedback_threads() to service_role;
