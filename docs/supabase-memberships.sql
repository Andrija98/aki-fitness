-- Članarina, prvi korak: trener ručno evidentira uplate, klijent plaća preko IPS QR koda (uplata na račun).
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run (samo jednom).
--
-- "Plaćeno do" je najkasniji period_end među uplatama klijenta. Klijent bez ijedne uplate nema ograničenja
-- (postojeći nalozi), a posle isteka ima još 5 dana pristupa (računa aplikacija, src/lib/membership.js).

create table public.membership_payments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles (id) on delete cascade,
  paid_on     date not null default current_date,
  amount_rsd  integer not null check (amount_rsd between 0 and 1000000),
  months      smallint not null check (months between 1 and 24),
  period_end  date not null,                      -- plaćeno zaključno sa ovim danom
  note        text check (char_length(note) <= 200),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index membership_payments_client on public.membership_payments (client_id, period_end desc);

alter table public.membership_payments enable row level security;

-- Klijent samo čita svoje uplate (ne može sam sebi da produži članarinu); trener radi sve.
create policy "uplate: čitanje" on public.membership_payments for select to authenticated
  using (client_id = auth.uid() or public.is_trainer());
create policy "uplate: trener dodaje" on public.membership_payments for insert to authenticated
  with check (public.is_trainer());
create policy "uplate: trener menja" on public.membership_payments for update to authenticated
  using (public.is_trainer()) with check (public.is_trainer());
create policy "uplate: trener briše" on public.membership_payments for delete to authenticated
  using (public.is_trainer());

-- Podaci za uplatu: jedan red. Svi prijavljeni čitaju (klijentu trebaju za QR), menja samo trener.
create table public.billing_settings (
  id          smallint primary key default 1 check (id = 1),
  payee_name  text check (char_length(payee_name) <= 70),
  account     text check (account ~ '^[0-9]{18}$'), -- 18 cifara, bez crtica (aplikacija proverava i kontrolni broj)
  price_rsd   integer check (price_rsd between 0 and 1000000),
  updated_at  timestamptz not null default now()
);
insert into public.billing_settings (id) values (1) on conflict (id) do nothing;

alter table public.billing_settings enable row level security;

create policy "naplata: čitanje" on public.billing_settings for select to authenticated using (true);
create policy "naplata: trener menja" on public.billing_settings for update to authenticated
  using (public.is_trainer()) with check (public.is_trainer());
