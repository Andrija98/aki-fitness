-- Ishrana, korak 4: sačuvan nedeljni plan, zaključavanje (trener) i kvačice "pojeo sam".
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run (samo jednom).
--
-- Zamena plana: klijent upiše NOV plan sa stavkama, pa obriše stari (stavke idu kaskadno).
-- Važeći plan je najnoviji po created_at, pa klijent nikad ne vidi prazan plan.

create table public.meal_plans (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  locked      boolean not null default false, -- zaključava samo trener; tada se plan ne pravi ponovo
  target      jsonb not null,                 -- { kcal, protein, carbs, fat } za koje je plan napravljen
  inputs_key  text not null                   -- otisak ulaza (cilj, izbor, struktura obroka): kad se promeni, plan se pravi ponovo
);
create index meal_plans_client on public.meal_plans (client_id, created_at desc);

create table public.meal_plan_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.meal_plans (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6), -- 0 = ponedeljak
  meal_type   text not null check (meal_type in ('dorucak', 'uzina1', 'rucak', 'uzina2', 'vecera')),
  food_id     uuid not null references public.foods (id) on delete cascade,
  grams       smallint not null check (grams between 1 and 2000),
  suggested   boolean not null default false, -- trenerov predlog, klijent ovu namirnicu nije izabrao
  position    smallint not null default 0
);
create index meal_plan_items_plan on public.meal_plan_items (plan_id);

create table public.meal_checks (
  client_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date        date not null,
  meal_type   text not null check (meal_type in ('dorucak', 'uzina1', 'rucak', 'uzina2', 'vecera')),
  -- snimak obroka u trenutku štikliranja: ako se plan kasnije promeni, istorija ostaje tačna
  kcal        smallint not null check (kcal between 0 and 5000),
  protein_g   smallint not null check (protein_g between 0 and 500),
  carbs_g     smallint not null check (carbs_g between 0 and 1000),
  fat_g       smallint not null check (fat_g between 0 and 500),
  primary key (client_id, date, meal_type)
);

-- Pomoćne funkcije: security definer čita meal_plans bez RLS-a, pa polisa ne poziva samu sebe (rekurzija).
-- Obe gledaju samo planove pozivaoca (auth.uid()), da preko /rpc niko ne može da pita za tuđ nalog.
create function public.meal_plan_locked() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.meal_plans where client_id = auth.uid() and locked) $$;

create function public.meal_plan_writable(pid uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.meal_plans where id = pid and client_id = auth.uid() and not locked) $$;

-- Postgres podrazumevano daje EXECUTE svima (public), pa i neprijavljenima (anon).
revoke execute on function public.meal_plan_locked(), public.meal_plan_writable(uuid) from public, anon;
grant execute on function public.meal_plan_locked(), public.meal_plan_writable(uuid) to authenticated;

alter table public.meal_plans      enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.meal_checks     enable row level security;

-- Plan: klijent čita svoje, pravi nov i briše stari samo dok nije zaključan. Zaključava samo trener.
create policy "plan: čitanje" on public.meal_plans for select to authenticated
  using (client_id = auth.uid() or public.is_trainer());
create policy "plan: novi" on public.meal_plans for insert to authenticated
  with check (client_id = auth.uid() and not locked and not public.meal_plan_locked());
create policy "plan: brisanje" on public.meal_plans for delete to authenticated
  using (client_id = auth.uid() and not locked);
create policy "plan: trener menja" on public.meal_plans for update to authenticated
  using (public.is_trainer()) with check (public.is_trainer());

-- Stavke: klijent upisuje samo u svoj otključan plan; trener menja grame.
create policy "stavke: čitanje" on public.meal_plan_items for select to authenticated
  using (exists (select 1 from public.meal_plans p where p.id = plan_id and (p.client_id = auth.uid() or public.is_trainer())));
create policy "stavke: dodavanje" on public.meal_plan_items for insert to authenticated
  with check (public.meal_plan_writable(plan_id));
create policy "stavke: trener menja" on public.meal_plan_items for update to authenticated
  using (public.is_trainer()) with check (public.is_trainer());

-- Kvačice: svako svoje, ne za buduće dane (po beogradskom vremenu); trener čita.
create policy "kvačice: čitanje" on public.meal_checks for select to authenticated
  using (client_id = auth.uid() or public.is_trainer());
create policy "kvačice: dodavanje" on public.meal_checks for insert to authenticated
  with check (client_id = auth.uid() and date <= (now() at time zone 'Europe/Belgrade')::date);
create policy "kvačice: brisanje" on public.meal_checks for delete to authenticated
  using (client_id = auth.uid());
