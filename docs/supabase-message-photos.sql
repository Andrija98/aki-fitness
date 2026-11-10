-- Fotografije u porukama: privatan bucket message-photos + kolona attachment_path u messages.
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run (samo jednom).
--
-- Putanja fajla je {client_id}/{id}.jpg: folder je razgovor, pa fajl vide i šalju samo taj klijent i trener.
-- Kao i tekst, poslata fotografija se ne briše (izuzetak: e2e nalozi, da testovi ne ostavljaju fajlove).

alter table public.messages add column attachment_path text;

-- Tekst je opcion kad poruka ima fotografiju; prilog mora biti iz foldera tog razgovora.
alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_check
  check (char_length(body) <= 2000 and (char_length(body) >= 1 or attachment_path is not null));
alter table public.messages add constraint messages_attachment_in_conversation
  check (attachment_path is null or attachment_path like client_id::text || '/%');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-photos', 'message-photos', false, 2097152, array['image/jpeg']); -- najviše 2 MB, samo JPEG

create policy "prilozi: čitanje" on storage.objects for select to authenticated
  using (bucket_id = 'message-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_trainer()));
create policy "prilozi: slanje" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_trainer()));
-- Samo za automatske testove: e2e nalog briše fajlove koje je sam poslao.
create policy "prilozi: brisanje (e2e)" on storage.objects for delete to authenticated
  using (bucket_id = 'message-photos' and owner_id = auth.uid()::text and (auth.jwt() ->> 'email') like 'e2e-%');
