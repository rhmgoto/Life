-- MyLogの同期を、サーバー時刻・版番号・論理削除・変更履歴に対応させます。
-- Supabase Dashboard > SQL Editor で、このファイル全体を1回実行してください。

alter table public.logs
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.logs add column if not exists revision bigint not null default 1;
alter table public.logs add column if not exists deleted_at timestamptz;

create table if not exists public.log_history (
  history_id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_id text not null,
  revision bigint not null,
  date date not null,
  time time not null,
  title text not null default '',
  body text not null,
  type text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  operation text not null check (operation in ('update', 'delete')),
  archived_at timestamptz not null default now()
);

create index if not exists log_history_user_log_idx
  on public.log_history (user_id, log_id, archived_at desc);

alter table public.log_history enable row level security;
revoke all on table public.log_history from anon;
revoke all on table public.log_history from authenticated;
grant select on table public.log_history to authenticated;

drop policy if exists "Users read own log history" on public.log_history;
create policy "Users read own log history" on public.log_history
  for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.mylog_set_log_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.revision := 1;
    new.deleted_at := null;
    return new;
  end if;

  insert into public.log_history (
    user_id, log_id, revision, date, time, title, body, type, tags,
    created_at, updated_at, deleted_at, operation
  ) values (
    old.user_id, old.id, old.revision, old.date, old.time, old.title, old.body, old.type, old.tags,
    old.created_at, old.updated_at, old.deleted_at,
    case when old.deleted_at is null and new.deleted_at is not null then 'delete' else 'update' end
  );

  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.revision := old.revision + 1;
  if old.deleted_at is null and new.deleted_at is not null then
    new.deleted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists mylog_log_metadata_trigger on public.logs;
create trigger mylog_log_metadata_trigger
before insert or update on public.logs
for each row execute function public.mylog_set_log_metadata();

create or replace function public.mylog_archive_deleted_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.log_history (
    user_id, log_id, revision, date, time, title, body, type, tags,
    created_at, updated_at, deleted_at, operation
  ) values (
    old.user_id, old.id, old.revision, old.date, old.time, old.title, old.body, old.type, old.tags,
    old.created_at, old.updated_at, old.deleted_at, 'delete'
  );
  return old;
end;
$$;

drop trigger if exists mylog_hard_delete_history_trigger on public.logs;
create trigger mylog_hard_delete_history_trigger
before delete on public.logs
for each row execute function public.mylog_archive_deleted_log();
