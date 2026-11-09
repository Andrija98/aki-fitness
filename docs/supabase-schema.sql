-- Supabase šema za fazu 2 (trener + klijenti).
-- Kako se koristi: Supabase projekat → SQL Editor → nalepi ceo fajl → Run.
--
-- Uloge: svaki korisnik ima red u "profiles". role = 'client' (podrazumevano) ili 'trainer'.
-- Trenera postaviš ručno jednom:  update profiles set role = 'trainer' where id = '<tvoj user id>';
--
-- Bezbednost (RLS): klijent vidi i menja samo SVOJE podatke; sadržaj (programi, vežbe) čitaju svi
-- prijavljeni, a menja ga samo trener; trener vidi podatke svih klijenata.

-- ============ Profili ============
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'client' check (role in ('client', 'trainer')),
  name        text not null default '',
  goal        text check (goal in ('mrsavljenje', 'snaga', 'kondicija')),
  location    text check (location in ('kuca', 'teretana', 'oba')),
  level       text check (level in ('pocetnik', 'srednji', 'napredni')),
  per_week    smallint check (per_week between 1 and 7),
  created_at  timestamptz not null default now()
);

-- Automatski napravi profil kad se korisnik registruje.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pomoćna funkcija za RLS: da li je trenutni korisnik trener?
create function public.is_trainer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'trainer');
$$;

-- ============ Sadržaj (pravi ga trener) ============
create table public.exercises (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  video_url  text,
  cue        text
);

create table public.workouts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  minutes    smallint,
  equipment  text
);

create table public.workout_items (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id),
  position     smallint not null,
  sets         smallint not null default 3,
  reps         smallint,           -- ili reps ili seconds
  seconds      smallint,
  kg           numeric(5, 1),      -- predlog trenera
  rest_sec     smallint not null default 60
);

create table public.programs (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  weeks        smallint not null,
  per_week     smallint not null,
  location     text check (location in ('kuca', 'teretana')),
  level        text,
  tone         text default 'accent',
  cover_url    text,
  published    boolean not null default false
);

create table public.program_schedule (
  program_id  uuid not null references public.programs (id) on delete cascade,
  position    smallint not null,
  workout_id  uuid not null references public.workouts (id),
  primary key (program_id, position)
);

-- ============ Podaci klijenta ============
create table public.enrollments (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  program_id  uuid not null references public.programs (id),
  active      boolean not null default true,
  started_at  timestamptz not null default now(),
  primary key (user_id, program_id)
);

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  program_id    uuid references public.programs (id),
  workout_id    uuid references public.workouts (id),
  date          timestamptz not null default now(),
  duration_sec  integer
);

create table public.session_sets (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id),
  set_no       smallint not null,
  reps         smallint,
  seconds      smallint,
  kg           numeric(5, 1)
);

create table public.weights (
  user_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date     date not null default current_date,
  kg       numeric(5, 1) not null,
  primary key (user_id, date)
);

create table public.measurements (
  user_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date      date not null default current_date,
  waist_cm  numeric(5, 1) check (waist_cm between 20 and 300),
  hips_cm   numeric(5, 1) check (hips_cm between 20 and 300),
  arm_cm    numeric(5, 1) check (arm_cm between 10 and 150),
  primary key (user_id, date)
);

create index on public.sessions (user_id, date desc);
create index on public.session_sets (session_id);

-- ============ RLS ============
alter table public.profiles         enable row level security;
alter table public.exercises        enable row level security;
alter table public.workouts         enable row level security;
alter table public.workout_items    enable row level security;
alter table public.programs         enable row level security;
alter table public.program_schedule enable row level security;
alter table public.enrollments      enable row level security;
alter table public.sessions         enable row level security;
alter table public.session_sets     enable row level security;
alter table public.weights          enable row level security;
alter table public.measurements     enable row level security;

-- Profili: svoj profil čitaš i menjaš (ali ne i ulogu), trener čita sve.
create policy "profil: čitanje" on public.profiles for select using (id = auth.uid() or public.is_trainer());
create policy "profil: izmena" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- Sadržaj: svi prijavljeni čitaju (klijent samo objavljene programe), samo trener menja.
create policy "vežbe: čitanje"   on public.exercises        for select to authenticated using (true);
create policy "treninzi: čitanje" on public.workouts        for select to authenticated using (true);
create policy "stavke: čitanje"  on public.workout_items    for select to authenticated using (true);
create policy "raspored: čitanje" on public.program_schedule for select to authenticated using (true);
create policy "programi: čitanje" on public.programs        for select to authenticated using (published or public.is_trainer());

create policy "vežbe: trener"    on public.exercises        for all using (public.is_trainer()) with check (public.is_trainer());
create policy "treninzi: trener" on public.workouts         for all using (public.is_trainer()) with check (public.is_trainer());
create policy "stavke: trener"   on public.workout_items    for all using (public.is_trainer()) with check (public.is_trainer());
create policy "raspored: trener" on public.program_schedule for all using (public.is_trainer()) with check (public.is_trainer());
create policy "programi: trener" on public.programs         for all using (public.is_trainer()) with check (public.is_trainer());

-- Podaci klijenta: svoje redove radiš sve, trener samo čita.
create policy "upis: svoje"  on public.enrollments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "upis: trener" on public.enrollments for select using (public.is_trainer());

create policy "treninzi klijenta: svoje"  on public.sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "treninzi klijenta: trener" on public.sessions for select using (public.is_trainer());

create policy "serije: svoje" on public.session_sets for all
  using (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "serije: trener" on public.session_sets for select using (public.is_trainer());

create policy "težina: svoje"  on public.weights for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "težina: trener" on public.weights for select using (public.is_trainer());

-- Poruke: tabela, pravila, Realtime i funkcija za testove su u docs/supabase-messages.sql (pokreni posle ovog fajla).
-- Kalkulator kalorija (kolone u profiles, tabela nutrition_targets): docs/supabase-nutrition-targets.sql.

create policy "mere: svoje"  on public.measurements for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "mere: trener" on public.measurements for select using (public.is_trainer());
