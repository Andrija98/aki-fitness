-- Pristanak na politiku privatnosti (obrada podataka o zdravlju traži izričit pristanak).
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run (samo jednom).
-- Kolonu menja sam korisnik kroz postojeću polisu "profil: izmena" (svako samo svoj red).

alter table public.profiles add column privacy_accepted_at timestamptz; -- null = još nije prihvatio
