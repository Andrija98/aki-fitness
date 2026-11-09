-- Ishrana, korak 2: namirnice i struktura obroka. Piše samo trener; čitaju svi prijavljeni (klijent bira namirnice u koraku 3).
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run (samo jednom).
-- Vrednosti su na 100 g namirnice u SIROVOM / SUVOM stanju (pirinač suv, meso sirovo).

create table public.foods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  food_group  text not null check (food_group in ('protein', 'uh', 'mast', 'povrce', 'voce', 'mlecni')),
  kcal        numeric(6, 1) not null check (kcal between 0 and 900),
  protein_g   numeric(5, 1) not null check (protein_g between 0 and 100),
  carbs_g     numeric(5, 1) not null check (carbs_g between 0 and 100),
  fat_g       numeric(5, 1) not null check (fat_g between 0 and 100),
  meal_types  text[] not null default '{}'
              check (meal_types <@ array['dorucak', 'uzina1', 'rucak', 'uzina2', 'vecera']),
  min_g       smallint not null default 10 check (min_g between 1 and 1000),
  max_g       smallint not null default 300 check (max_g between 1 and 2000),
  verified    boolean not null default false, -- generator plana koristi samo namirnice koje je trener proverio
  active      boolean not null default true,  -- umesto brisanja (planovi klijenata će se pozivati na namirnice)
  source      text,                            -- npr. "USDA FDC 171477"
  check (max_g >= min_g)
);

create table public.meal_templates (
  meal_type   text primary key check (meal_type in ('dorucak', 'uzina1', 'rucak', 'uzina2', 'vecera')),
  label       text not null,
  position    smallint not null,
  share_pct   smallint not null check (share_pct between 0 and 100),
  time_hint   text,
  food_groups text[] not null default '{}'
              check (food_groups <@ array['protein', 'uh', 'mast', 'povrce', 'voce', 'mlecni'])
);

alter table public.foods          enable row level security;
alter table public.meal_templates enable row level security;

create policy "namirnice: čitanje" on public.foods          for select to authenticated using (true);
create policy "namirnice: trener"  on public.foods          for all    to authenticated using (public.is_trainer()) with check (public.is_trainer());
create policy "obroci: čitanje"    on public.meal_templates for select to authenticated using (true);
create policy "obroci: trener"     on public.meal_templates for all    to authenticated using (public.is_trainer()) with check (public.is_trainer());

-- Podrazumevana struktura: zbir udela je 100 %. Trener je menja u aplikaciji.
insert into public.meal_templates (meal_type, label, position, share_pct, time_hint, food_groups) values
  ('dorucak', 'Doručak',     1, 25, '08:00', array['protein', 'uh', 'mast']),
  ('uzina1',  'Prva užina',  2, 10, '10:30', array['mlecni', 'voce']),
  ('rucak',   'Ručak',       3, 30, '13:30', array['protein', 'uh', 'povrce', 'mast']),
  ('uzina2',  'Druga užina', 4, 10, '17:00', array['voce', 'mast']),
  ('vecera',  'Večera',      5, 25, '20:00', array['protein', 'povrce', 'mast']);
