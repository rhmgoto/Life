-- MyLog cloud schema
-- Supabase Dashboard > SQL Editor でこのファイル全体を1回実行してください。

create table if not exists public.logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date date not null,
  time time not null,
  title text not null default '',
  body text not null,
  type text not null check (type in ('PT', 'BT', 'PM', 'BM')),
  tags text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

-- 既存プロジェクトを新しい見出し・種類へ安全に移行する。
alter table public.logs add column if not exists title text not null default '';
alter table public.logs drop constraint if exists logs_type_check;
update public.logs set type = case type when 'P' then 'PT' when 'B' then 'BT' else type end
where type in ('P', 'B');
alter table public.logs add constraint logs_type_check check (type in ('PT', 'BT', 'PM', 'BM'));

create table if not exists public.events (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date date not null,
  start_time time not null,
  end_time time,
  title text not null,
  memo text,
  source text not null default 'local' check (source in ('local', 'google')),
  external_id text,
  calendar_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

create index if not exists logs_user_date_idx on public.logs (user_id, date, time);
create index if not exists events_user_date_idx on public.events (user_id, date, start_time);

alter table public.logs enable row level security;
alter table public.events enable row level security;

revoke all on table public.logs from anon;
revoke all on table public.events from anon;
grant select, insert, update, delete on table public.logs to authenticated;
grant select, insert, update, delete on table public.events to authenticated;

drop policy if exists "Users manage own logs" on public.logs;
create policy "Users manage own logs" on public.logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own events" on public.events;
create policy "Users manage own events" on public.events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
