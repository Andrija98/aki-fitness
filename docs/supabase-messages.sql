-- Poruke klijent ↔ trener. Dodaje novu tabelu, Realtime i funkciju za čišćenje testova.
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run (samo jednom).

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles (id) on delete cascade, -- čiji je razgovor
  sender_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index messages_client_created on public.messages (client_id, created_at);

alter table public.messages enable row level security;

-- Klijent čita svoj razgovor, trener sve razgovore.
create policy "poruke: čitanje" on public.messages for select to authenticated
  using (client_id = auth.uid() or public.is_trainer());

-- Pošiljalac je uvek prijavljeni korisnik: nema pisanja u tuđe ime ni u tuđi razgovor.
create policy "poruke: slanje" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and (client_id = auth.uid() or public.is_trainer()));

-- "Pročitano" označava samo primalac: klijent poruke trenera, trener poruke klijenta.
create policy "poruke: pročitano" on public.messages for update to authenticated
  using ((client_id = auth.uid() and sender_id <> auth.uid()) or (public.is_trainer() and sender_id = client_id))
  with check ((client_id = auth.uid() and sender_id <> auth.uid()) or (public.is_trainer() and sender_id = client_id));

-- RLS ne može da ograniči kolone, pa dozvola za izmenu postoji samo za read_at (tekst poruke se ne menja).
revoke update on public.messages from anon, authenticated;
grant update (read_at) on public.messages to authenticated;

-- Nove poruke stižu u aplikaciju odmah (Realtime poštuje RLS).
alter publication supabase_realtime add table public.messages;

-- Samo za automatske testove: briše poruke pozivaoca, ali SAMO ako je to nalog sa mejlom e2e-...
-- Za sve ostale naloge ne radi ništa.
create function public.e2e_clear_messages() returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select email from auth.users where id = auth.uid()) like 'e2e-%' then
    delete from public.messages where client_id = auth.uid() or sender_id = auth.uid();
  end if;
end $$;

revoke execute on function public.e2e_clear_messages() from public, anon;
grant execute on function public.e2e_clear_messages() to authenticated;
