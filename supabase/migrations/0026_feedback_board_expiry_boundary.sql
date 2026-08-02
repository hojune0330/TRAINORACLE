create or replace function public.list_my_feedback_threads(client_token_input text)
returns jsonb
language plpgsql
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
  where thread.client_token_hash = token_hash
    and thread.expires_at > clock_timestamp();

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
      and thread.expires_at > clock_timestamp()
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
  if not exists (
    select 1 from public.feedback_threads thread
    where thread.id = thread_id_input
      and thread.expires_at > clock_timestamp()
  ) then
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
