create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (
    event_name in (
      'landing_view',
      'signup_started',
      'signup_completed',
      'onboarding_completed',
      'first_log',
      'coach_message_sent',
      'paywall_viewed',
      'checkout_started',
      'trial_started',
      'subscription_active'
    )
  ),
  user_id uuid references public.profiles(id) on delete set null,
  anon_id text,
  locale text not null check (locale in ('es', 'en')),
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_actor_check check (
    user_id is not null or nullif(trim(anon_id), '') is not null
  ),
  constraint analytics_events_props_object_check check (
    jsonb_typeof(props) = 'object'
  )
);

alter table public.analytics_events enable row level security;

revoke all on public.analytics_events from anon, authenticated;

create index analytics_events_event_created_idx
  on public.analytics_events (event_name, created_at desc);

create index analytics_events_user_created_idx
  on public.analytics_events (user_id, created_at desc)
  where user_id is not null;

create index analytics_events_anon_created_idx
  on public.analytics_events (anon_id, created_at desc)
  where anon_id is not null;

create index analytics_events_utm_source_idx
  on public.analytics_events ((props->>'utm_source'))
  where props ? 'utm_source';

comment on table public.analytics_events is
  'Privacy-first product funnel events. Metadata only: no health values, no food content, no coach message text, no PII.';
