-- MyLog reliable sync migration
-- Supabase Dashboard > SQL Editor でこのファイル全体を1回実行してください。

alter table public.logs add column if not exists title text not null default '';
alter table public.logs add column if not exists revision bigint not null default 1;
alter table public.logs add column if not exists deleted_at timestamptz;
alter table public.logs alter column created_at set default now();
alter table public.logs alter column updated_at set default now();

alter table public.logs drop constraint if exists logs_type_check;

update public.logs
set type = case type
  when 'P' then 'PT'
  when 'B' then 'BT'
  else type
end
where type in ('P', 'B');

alter table public.logs
  add constraint logs_type_check
  check (type in ('PT', 'BT', 'PM', 'BM'));

create table if not exists public.log_history (
  history_id bigint generated always as identity primary key,
  user_id uuid not null,
  log_id text not null,
  changed_at timestamptz not null default now(),
  previous_title text,
  previous_body text,
  previous_type text,
  previous_tags text[],
  previous_updated_at timestamptz,
  previous_deleted_at timestamptz
);

alter table public.log_history enable row level security;
revoke all on table public.log_history from anon;
grant select, insert on table public.log_history to authenticated;

drop policy if exists "Users read own log history" on public.log_history;
create policy "Users read own log history" on public.log_history
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users write own log history" on public.log_history;
create policy "Users write own log history" on public.log_history
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.mylog_track_log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    insert into public.log_history (
      user_id, log_id, previous_title, previous_body, previous_type,
      previous_tags, previous_updated_at, previous_deleted_at
    )
    values (
      old.user_id, old.id, old.title, old.body, old.type,
      old.tags, old.updated_at, old.deleted_at
    );
    new.revision = coalesce(old.revision, 0) + 1;
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists mylog_track_log_change on public.logs;
create trigger mylog_track_log_change
  before update on public.logs
  for each row
  execute function public.mylog_track_log_change();
