-- Ishrana, korak 3: namirnice koje klijent voli. Generator plana bira samo iz njih (uz trenerov predlog kad grupa fali).
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run (samo jednom).

create table public.food_preferences (
  client_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  food_id   uuid not null references public.foods (id) on delete cascade,
  primary key (client_id, food_id)
);

alter table public.food_preferences enable row level security;

create policy "izbor: čitanje" on public.food_preferences for select to authenticated
  using (client_id = auth.uid() or public.is_trainer());
create policy "izbor: dodavanje" on public.food_preferences for insert to authenticated
  with check (client_id = auth.uid());
create policy "izbor: brisanje" on public.food_preferences for delete to authenticated
  using (client_id = auth.uid());
