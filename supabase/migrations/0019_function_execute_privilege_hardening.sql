revoke all on function public.accept_guardian_invitation(text) from public;
revoke all on function public.accept_guardian_invitation(text) from anon;
grant execute on function public.accept_guardian_invitation(text) to authenticated;
grant execute on function public.accept_guardian_invitation(text) to service_role;

revoke all on function public.accept_support_invitation(text) from public;
revoke all on function public.accept_support_invitation(text) from anon;
grant execute on function public.accept_support_invitation(text) to authenticated;
grant execute on function public.accept_support_invitation(text) to service_role;

revoke all on function public.account_network_access_allowed(uuid) from public;
revoke all on function public.account_network_access_allowed(uuid) from anon;
grant execute on function public.account_network_access_allowed(uuid) to authenticated;
grant execute on function public.account_network_access_allowed(uuid) to service_role;

revoke all on function public.activate_plan_proposal(uuid) from public;
revoke all on function public.activate_plan_proposal(uuid) from anon;
grant execute on function public.activate_plan_proposal(uuid) to authenticated;
grant execute on function public.activate_plan_proposal(uuid) to service_role;

revoke all on function public.first_link_guardian_requirement_met(uuid, uuid, date) from public;
revoke all on function public.first_link_guardian_requirement_met(uuid, uuid, date) from anon;
grant execute on function public.first_link_guardian_requirement_met(uuid, uuid, date) to authenticated;
grant execute on function public.first_link_guardian_requirement_met(uuid, uuid, date) to service_role;

revoke all on function public.record_plan_proposal_warning_review(uuid, text) from public;
revoke all on function public.record_plan_proposal_warning_review(uuid, text) from anon;
grant execute on function public.record_plan_proposal_warning_review(uuid, text) to authenticated;
grant execute on function public.record_plan_proposal_warning_review(uuid, text) to service_role;

revoke all on function public.request_account_deletion() from public;
revoke all on function public.request_account_deletion() from anon;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.request_account_deletion() to service_role;

revoke all on function public.block_account_after_deletion_request() from public;
revoke all on function public.block_account_after_deletion_request() from anon;
revoke all on function public.block_account_after_deletion_request() from authenticated;
revoke all on function public.block_account_after_deletion_request() from service_role;

revoke all on function public.enforce_guardian_connection_authority() from public;
revoke all on function public.enforce_guardian_connection_authority() from anon;
revoke all on function public.enforce_guardian_connection_authority() from authenticated;
revoke all on function public.enforce_guardian_connection_authority() from service_role;

revoke all on function public.first_link_guardian_requirement_met(uuid, uuid) from public;
revoke all on function public.first_link_guardian_requirement_met(uuid, uuid) from anon;
revoke all on function public.first_link_guardian_requirement_met(uuid, uuid) from authenticated;
revoke all on function public.first_link_guardian_requirement_met(uuid, uuid) from service_role;
