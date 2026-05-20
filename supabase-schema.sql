create table if not exists public.creator_app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_creator_app_state_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_creator_app_state_updated_at on public.creator_app_state;

create trigger set_creator_app_state_updated_at
before update on public.creator_app_state
for each row
execute function public.set_creator_app_state_updated_at();

