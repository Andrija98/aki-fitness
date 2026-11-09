-- Mere klijenta (struk, kukovi, ruka). Dodaje samo novu tabelu, postojeće podatke ne dira.
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run.

create table public.measurements (
  user_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date      date not null default current_date,
  waist_cm  numeric(5, 1) check (waist_cm between 20 and 300),
  hips_cm   numeric(5, 1) check (hips_cm between 20 and 300),
  arm_cm    numeric(5, 1) check (arm_cm between 10 and 150),
  primary key (user_id, date)
);

alter table public.measurements enable row level security;

create policy "mere: svoje" on public.measurements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "mere: trener" on public.measurements for select
  using (public.is_trainer());
