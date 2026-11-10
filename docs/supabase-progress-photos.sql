-- Fotografije napretka: privatan Storage bucket + tabela, i verzija pristanka na politiku privatnosti.
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run (samo jednom).
--
-- Fajl je u bucketu na putanji {user_id}/{id}.jpg; prvi deo putanje određuje vlasnika (polise ispod).
-- Bucket NIJE javan: slika se prikazuje samo preko privremenog potpisanog linka (createSignedUrls).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 2097152, array['image/jpeg']); -- najviše 2 MB, samo JPEG

create policy "fotografije: čitanje" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_trainer()));
create policy "fotografije: dodavanje" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotografije: brisanje" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create table public.progress_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date        date not null default current_date,
  path        text not null unique,
  created_at  timestamptz not null default now(),
  check (path like user_id::text || '/%') -- red ne sme da pokazuje na tuđ fajl
);
create index progress_photos_user on public.progress_photos (user_id, date desc);

alter table public.progress_photos enable row level security;
create policy "fotografije: čitanje reda" on public.progress_photos for select to authenticated
  using (user_id = auth.uid() or public.is_trainer());
create policy "fotografije: novi red" on public.progress_photos for insert to authenticated
  with check (user_id = auth.uid());
create policy "fotografije: brisanje reda" on public.progress_photos for delete to authenticated
  using (user_id = auth.uid());

-- Verzija politike koju je korisnik prihvatio. Kad se politika promeni (PRIVACY_VERSION u src/config.js),
-- aplikacija ponovo traži pristanak. Postojeći pristanci su verzija 1 (pre fotografija).
alter table public.profiles add column privacy_version smallint;
update public.profiles set privacy_version = 1 where privacy_accepted_at is not null;
