-- 0010_calendar_todos.sql
-- Personal planner surface: calendar events + todo list.
--
-- calendar_events: user-scheduled items on a specific calendar day.
-- Optional event_time when the user cares about time-of-day. Optional
-- related_medication_id for "next Wegovy injection" style entries — set
-- null when the user deletes the medication (on delete set null), so
-- the calendar event survives.
--
-- todos: lightweight checklist. due_date optional. priority is an int
-- 1..3 (1=high, 2=medium, 3=low) so we can sort cheaply without an
-- enum migration later.
--
-- RLS: same pattern as doses/weight_entries — users see/modify only
-- their own rows.

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  event_date date not null,
  event_time time,
  event_type text not null default 'note'
    check (event_type in ('injection', 'appointment', 'reminder', 'note')),
  related_medication_id uuid references public.medications(id) on delete set null,
  locale text check (locale in ('es', 'en')),
  created_at timestamptz not null default now()
);

create index calendar_events_user_event_date_idx
  on public.calendar_events(user_id, event_date);

alter table public.calendar_events enable row level security;
create policy "calendar_events_own" on public.calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  due_date date,
  priority int not null default 2 check (priority between 1 and 3),
  created_at timestamptz not null default now()
);

create index todos_user_completed_due_date_idx
  on public.todos(user_id, completed, due_date);

alter table public.todos enable row level security;
create policy "todos_own" on public.todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
