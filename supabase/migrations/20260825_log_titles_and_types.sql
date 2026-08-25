-- 既存のMyLogデータを、任意見出しと4種類へ移行します。
-- Supabase Dashboard > SQL Editor でこのファイル全体を実行してください。

alter table public.logs add column if not exists title text not null default '';

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
