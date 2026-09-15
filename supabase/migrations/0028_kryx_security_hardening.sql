-- Kryx-only security hardening applied to production on 2026-09-15.
-- Does not touch public/Meamus application objects.

revoke all on function agentstack.enforce_agent_quota() from public, anon, authenticated;
revoke all on function agentstack.ensure_profile(uuid, text) from public, anon, authenticated;
revoke all on function agentstack.handle_new_user() from public, anon, authenticated;
revoke all on function agentstack.pause_agents_on_lapse() from public, anon, authenticated;
revoke all on function agentstack.pause_agents_on_trial_end() from public, anon, authenticated;
revoke all on function agentstack.promote_playbook(integer) from public, anon, authenticated;
revoke all on function agentstack.record_learning(uuid, text, text, text, numeric) from public, anon, authenticated;
revoke all on function agentstack.spend_credits(uuid, uuid, text, text, integer) from public, anon, authenticated;

grant execute on function agentstack.ensure_profile(uuid, text) to service_role;
grant execute on function agentstack.promote_playbook(integer) to service_role;
grant execute on function agentstack.record_learning(uuid, text, text, text, numeric) to service_role;
grant execute on function agentstack.spend_credits(uuid, uuid, text, text, integer) to service_role;
grant execute on function agentstack.add_credits(uuid, integer, integer, text) to service_role;

alter function agentstack.touch_updated_at() set search_path = agentstack, pg_temp;
alter function agentstack.is_entitled(agentstack.profiles) set search_path = agentstack, pg_temp;

revoke all on agentstack.agent_secrets from anon, authenticated;
revoke all on agentstack.webhook_events from anon, authenticated;
grant all on agentstack.agent_secrets to service_role;
grant all on agentstack.webhook_events to service_role;

notify pgrst, 'reload schema';
