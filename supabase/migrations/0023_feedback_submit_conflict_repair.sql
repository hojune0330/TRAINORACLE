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

  perform pg_advisory_xact_lock(hashtext(token_hash));
  select thread.id, thread.created_at into created_thread_id, accepted_at
  from public.feedback_threads thread
  where thread.client_token_hash = token_hash
    and thread.client_request_id = client_request_id_input;

  if created_thread_id is not null then
    return jsonb_build_object('id', created_thread_id, 'acceptedAt', accepted_at);
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
  on conflict on constraint feedback_threads_client_token_hash_client_request_id_key do nothing
  returning id, created_at into created_thread_id, accepted_at;

  insert into public.feedback_comments (thread_id, author_kind, client_comment_id, body)
  values (created_thread_id, 'USER', client_request_id_input, trim(body_input))
  on conflict on constraint feedback_comments_thread_id_client_comment_id_key do nothing;

  return jsonb_build_object('id', created_thread_id, 'acceptedAt', accepted_at);
end;
$$;
