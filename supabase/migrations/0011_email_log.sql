-- 0011_email_log.sql
-- Idempotency log for transactional emails sent by the system.
--
-- The send-reminders cron checks this table before sending to avoid
-- double-sending the same reminder on a given calendar day. RLS is
-- locked down to the service role; user-facing code never reads this
-- table.

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null,
  sent_at timestamptz not null default now()
);

create index email_log_user_type_sent_at_idx
  on public.email_log(user_id, email_type, sent_at desc);

alter table public.email_log enable row level security;

-- No policies for anon / authenticated → all reads/writes from the
-- service role only. Service role bypasses RLS by design.
