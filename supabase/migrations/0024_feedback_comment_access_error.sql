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
  if not exists (
    select 1 from public.feedback_threads thread
    where thread.id = thread_id_input
      and thread.client_token_hash = token_hash
      and thread.status <> 'RESOLVED'
  ) then
    raise exception 'feedback thread unavailable' using errcode = '42501';
  end if;
  if (select count(*) from public.feedback_comments where thread_id = thread_id_input) >= 50 then
    raise exception 'feedback comment limit reached' using errcode = '54000';
  end if;

  insert into public.feedback_comments (thread_id, author_kind, client_comment_id, body)
  values (thread_id_input, 'USER', client_comment_id_input, trim(body_input))
  on conflict on constraint feedback_comments_thread_id_client_comment_id_key do nothing
  returning id, created_at into created_comment_id, accepted_at;

  if created_comment_id is null then
    select comment.id, comment.created_at into created_comment_id, accepted_at
    from public.feedback_comments comment
    where comment.thread_id = thread_id_input
      and comment.client_comment_id = client_comment_id_input;
  end if;

  update public.feedback_threads
  set last_activity_at = greatest(last_activity_at, accepted_at)
  where id = thread_id_input;
  return jsonb_build_object('id', created_comment_id, 'acceptedAt', accepted_at);
end;
$$;
