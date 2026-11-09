-- Kalkulator kalorija: podaci o telu u profilu i Akijeve izmene dnevnog cilja.
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run (samo jednom).

-- Klijent ih unosi sam, kroz postojeće pravilo "profil: izmena" (svoj red, bez promene uloge).
alter table public.profiles
  add column sex        text     check (sex in ('m', 'z')),
  add column birth_year smallint check (birth_year between 1900 and 2100),
  add column height_cm  smallint check (height_cm between 100 and 250),
  add column activity   text     check (activity in ('sedeci', 'lako', 'umereno', 'aktivno', 'veoma'));

-- Preporuka se računa u aplikaciji iz profila i težine. Ovde stoji samo ono što je trener ručno postavio.
create table public.nutrition_targets (
  client_id  uuid primary key references public.profiles (id) on delete cascade,
  kcal       smallint not null check (kcal between 800 and 6000),
  protein_g  smallint not null check (protein_g between 0 and 500),
  carbs_g    smallint not null check (carbs_g between 0 and 1000),
  fat_g      smallint not null check (fat_g between 0 and 400),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_targets enable row level security;

-- Klijent čita svoj cilj; piše samo trener (klijent ne može da pregazi Akijevu odluku).
create policy "cilj: čitanje" on public.nutrition_targets for select to authenticated
  using (client_id = auth.uid() or public.is_trainer());
create policy "cilj: trener" on public.nutrition_targets for all to authenticated
  using (public.is_trainer()) with check (public.is_trainer());
