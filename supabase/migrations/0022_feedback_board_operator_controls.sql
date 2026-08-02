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
  if not exists (select 1 from public.feedback_threads where id = thread_id_input) then
    raise exception 'feedback thread not found' using errcode = 'P0002';
  end if;

  insert into public.feedback_comments (thread_id, author_kind, client_comment_id, body)
  values (thread_id_input, 'OPERATOR', operator_comment_id_input, trim(body_input))
  on conflict (thread_id, client_comment_id) do nothing
  returning id, created_at into comment_id, accepted_at;

  if comment_id is null then
    select comment.id, comment.created_at into comment_id, accepted_at
    from public.feedback_comments comment
    where comment.thread_id = thread_id_input
      and comment.client_comment_id = operator_comment_id_input;
  end if;

  update public.feedback_threads
  set status = case when resolve_input then 'RESOLVED' else 'ANSWERED' end,
      last_activity_at = greatest(last_activity_at, accepted_at)
  where id = thread_id_input;

  return jsonb_build_object('id', comment_id, 'acceptedAt', accepted_at);
end;
$$;

create or replace function public.delete_feedback_thread_for_operations(thread_id_input uuid)
returns boolean
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
  delete from public.feedback_threads where id = thread_id_input;
  get diagnostics removed = row_count;
  return removed = 1;
end;
$$;

revoke all on function public.reply_to_feedback_thread(uuid, uuid, text, boolean) from public;
revoke all on function public.reply_to_feedback_thread(uuid, uuid, text, boolean) from anon;
revoke all on function public.reply_to_feedback_thread(uuid, uuid, text, boolean) from authenticated;
revoke all on function public.reply_to_feedback_thread(uuid, uuid, text, boolean) from service_role;
grant execute on function public.reply_to_feedback_thread(uuid, uuid, text, boolean) to service_role;

revoke all on function public.delete_feedback_thread_for_operations(uuid) from public;
revoke all on function public.delete_feedback_thread_for_operations(uuid) from anon;
revoke all on function public.delete_feedback_thread_for_operations(uuid) from authenticated;
revoke all on function public.delete_feedback_thread_for_operations(uuid) from service_role;
grant execute on function public.delete_feedback_thread_for_operations(uuid) to service_role;
