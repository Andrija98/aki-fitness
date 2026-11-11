-- Program "Kućni trening muškarci": 3 treninga nedeljno, 12 nedelja (kardio raste po mesecima).
-- Pokreće se POSLE docs/supabase-workout-item-details.sql (koristi kolone reps_max i note).
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run.
-- Bezbedno je pokrenuti ponovo: postojeći redovi sa istim ID-jem se preskaču (on conflict do nothing).
-- Program je NACRT (published = false): klijenti ga ne vide dok ga trener ne objavi u aplikaciji.
-- Vežbe nemaju video; trener dodaje Bunny ili YouTube link u Profil → Vežbe.
-- Sve vežbe pravi ovaj fajl (ne zavisi od drugog sadržaja); ID-jevi e1… ne smeju da se poklope sa test sadržajem (e0…).

-- ============ Nove vežbe ============
insert into public.exercises (id, name) values
  ('e1000000-0000-4000-8000-000000000001', 'Sklek sa nogama na povišenju'),
  ('e1000000-0000-4000-8000-000000000002', 'Dijamant sklek'),
  ('e1000000-0000-4000-8000-000000000003', 'Propadanja na razboju'),
  ('e1000000-0000-4000-8000-000000000004', 'Ekstenzija za triceps sa gumom iza glave'),
  ('e1000000-0000-4000-8000-000000000005', 'Legionari'),
  ('e1000000-0000-4000-8000-000000000006', 'Bugarski čučanj za kvadriceps'),
  ('e1000000-0000-4000-8000-000000000007', 'Iskorak napred'),
  ('e1000000-0000-4000-8000-000000000008', 'Izdržaj u čučnju'),
  ('e1000000-0000-4000-8000-000000000009', 'Hollow body izdržaj'),
  ('e1000000-0000-4000-8000-000000000010', 'Veslanje u pretklonu'),
  ('e1000000-0000-4000-8000-000000000011', 'Jednoručno veslanje'),
  ('e1000000-0000-4000-8000-000000000012', 'Face pull sa gumom'),
  ('e1000000-0000-4000-8000-000000000013', 'Pregib za biceps sa gumom'),
  ('e1000000-0000-4000-8000-000000000014', 'Leđnjaci'),
  ('e1000000-0000-4000-8000-000000000015', 'Trbušnjaci sa podignutim nogama'),
  ('e1000000-0000-4000-8000-000000000016', 'Jumping jacks'),
  ('e1000000-0000-4000-8000-000000000017', 'Sklek'),
  ('e1000000-0000-4000-8000-000000000018', 'Čučanj'),
  ('e1000000-0000-4000-8000-000000000019', 'Rumunsko mrtvo dizanje'),
  ('e1000000-0000-4000-8000-000000000020', 'Pregib za biceps')
on conflict (id) do nothing;

-- ============ Treninzi ============
insert into public.workouts (id, title, minutes, equipment) values
  ('b1000000-0000-4000-8000-000000000001', 'Grudi i triceps', 45, 'Klupa ili stolica, guma'),
  ('b1000000-0000-4000-8000-000000000002', 'Noge', 45, 'Bučica ili girja (po želji)'),
  ('b1000000-0000-4000-8000-000000000003', 'Leđa, ramena i biceps', 45, 'Guma, bučica ili šipka')
on conflict (id) do nothing;

-- Stavke se upisuju samo ako trening još nema stavki (ponovno pokretanje ne pravi duplikate).
-- Odmor: 180 s za glavne (teške) vežbe, 120–90 s za ostale; u supersetu 0 s posle prve vežbe para.
insert into public.workout_items (workout_id, exercise_id, position, sets, reps, reps_max, seconds, rest_sec, note)
select v.workout_id::uuid, v.exercise_id::uuid, v.position, v.sets, v.reps, v.reps_max, v.seconds, v.rest_sec, v.note
from (values
  -- Trening 1: grudi i triceps
  ('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000017', 1, 4, 10, 12, null, 180,
   'Običan sklek, ili sa opterećenjem na leđima ako možeš; ako je pretežak, sa kolena. Opcija 2, ako imaš klupu i šipku: bench press. Radiš jednu varijantu.'),
  ('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 2, 3, 10, 12, null, 90, null),
  ('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 3, 3, 10, 12, null, 90,
   'Ako ne možeš ovu varijantu, radi je sa kolena.'),
  ('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', 4, 3, 8, 12, null, 90,
   'Opcija 2, ako nemaš razboj: propadanja za triceps na klupi. Radiš jednu varijantu.'),
  ('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000004', 5, 3, 10, 12, null, 90, null),
  ('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000005', 6, 3, null, null, 30, 30,
   'Finisher za celo telo: 30 sekundi legionara, pa 30 sekundi odmora. Ukupno 3 kruga.'),
  -- Trening 2: noge
  ('b1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000018', 1, 4, 10, 12, null, 180,
   'Običan čučanj ili čučanj sa opterećenjem, prema opremi koju imaš. Bez opterećenja uradi koliko god možeš ponavljanja, do otkaza.'),
  ('b1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000006', 2, 3, 10, 12, null, 120,
   'Na snimku je sa bučicom; ako si početnik, radi bez nje.'),
  ('b1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000019', 3, 4, 12, null, null, 180,
   'Sa girjom ili sa bučicom, prema opremi koju imaš. Radiš jednu varijantu.'),
  ('b1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000007', 4, 3, 10, null, null, 90,
   '10 ponavljanja po nozi. Bez opterećenja ili sa tegom/bučicom.'),
  ('b1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000008', 5, 3, null, null, 30, 0,
   'Superset sa sledećom vežbom: izdržaj u čučnju, odmah zatim hollow body, pa tek onda odmor. Ukupno 3 puta.'),
  ('b1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000009', 6, 3, null, null, 30, 90,
   'Superset sa izdržajem u čučnju. 20–30 sekundi; ako ne možeš 30, kreni od 20.'),
  -- Trening 3: leđa, ramena i biceps
  ('b1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000010', 1, 4, 10, 12, null, 180,
   'Sa gumom ili sa šipkom, prema opremi koju imaš. Radiš jednu varijantu.'),
  ('b1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000011', 2, 3, 10, null, null, 90,
   '10 ponavljanja po ruci. Sa bučicom, tegom ili gumom.'),
  ('b1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000012', 3, 3, 12, 15, null, 0,
   'Superset sa sledećom vežbom: face pull, odmah zatim pregib za biceps, pa tek onda odmor. Ukupno 3 puta.'),
  ('b1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000013', 4, 3, 12, 15, null, 90,
   'Superset sa face pull-om. Može i sa bučicama.'),
  ('b1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000014', 5, 3, 10, 15, null, 0,
   'Superset sa sledećom vežbom: leđnjaci, odmah zatim trbušnjaci, pa tek onda odmor. Ukupno 3 puta.'),
  ('b1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000015', 6, 3, 10, 15, null, 90,
   'Superset sa leđnjacima. Ruke iza leđa.'),
  ('b1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000020', 7, 4, 10, 12, null, 90,
   'Sa gumom, šipkom ili bučicom. Posebna vežba, radi se pored pregiba iz superseta.'),
  ('b1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000016', 8, 3, null, null, 30, 30,
   'Finisher za celo telo: 30 sekundi jumping jacks, pa 30 sekundi odmora. Ukupno 3 kruga.')
) as v(workout_id, exercise_id, position, sets, reps, reps_max, seconds, rest_sec, note)
where not exists (select 1 from public.workout_items wi where wi.workout_id = v.workout_id::uuid);

-- ============ Program (nacrt) ============
insert into public.programs (id, title, description, weeks, per_week, location, level, tone, published) values
  ('c1000000-0000-4000-8000-000000000001', 'Kućni trening muškarci',
   'Muški program kućnih treninga: tri treninga nedeljno, za grudi i triceps, za noge, i za leđa, ramena i biceps. Dane biraš sam; važno je da tokom nedelje odradiš sva tri i da ne treniraš mišić koji je još upaljen.

Zagrevanje: pre svake vežbe uradi 1–2 lakše serije. One se ne računaju u zadate serije.
Opterećenje: poslednja ponavljanja u zadatom rasponu treba da budu veoma teška, blizu otkaza, ali uz ispravnu formu.
Odmor: 3–4 minuta između serija teških vežbi, 1,5–2 minuta kod lakših. Između vežbi odmaraj koliko ti treba.
Tempo: spuštanje oko 2 sekunde, podizanje oko 1 sekunde, uz snažnu kontrakciju mišića koji radi.
Varijante: kod nekih vežbi biraš jednu varijantu prema opremi koju imaš (piše uz vežbu). Ne radiš obe.
Superset: dve vežbe radiš zajedno: seriju prve, odmah seriju druge, pa tek onda odmor.
Ako je trening pretežak, smanji broj serija ili ponavljanja i postepeno ih povećavaj. Ako postane lak, dodaj ponavljanja ili težinu, ili radi sporije.

Kardio: brzo hodanje, napolju ili na traci, po 40 minuta. Prvi mesec 3 puta nedeljno, drugi mesec 4 puta, treći mesec 5 puta. I danima bez treninga ostani aktivan i skupljaj korake.',
   12, 3, 'kuca', 'Svi nivoi', 'accent', false)
on conflict (id) do nothing;

insert into public.program_schedule (program_id, position, workout_id) values
  ('c1000000-0000-4000-8000-000000000001', 1, 'b1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000001', 2, 'b1000000-0000-4000-8000-000000000002'),
  ('c1000000-0000-4000-8000-000000000001', 3, 'b1000000-0000-4000-8000-000000000003')
on conflict (program_id, position) do nothing;
