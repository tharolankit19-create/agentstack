-- Device queue durability: queued work can survive an offline/sleeping device.
-- The signed execution envelope itself is short-lived; the durable DB job is not.
alter table agentstack.device_tasks
  alter column expires_at set default (now() + interval '24 hours');
