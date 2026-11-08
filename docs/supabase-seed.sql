-- Demo sadržaj: 13 vežbi, 6 treninga, 4 programa.
-- Kako se koristi: Supabase → SQL Editor → nalepi ceo fajl → Run. Može da se pokrene više puta.
-- Fiksni ID-jevi: e… vežbe, b… treninzi, c… programi. api.js koristi ID-jeve programa za predlog posle onboardinga.

begin;

insert into public.exercises (id, name, video_url, cue) values
  ('e0000000-0000-4000-8000-000000000001', 'Čučanj', null, 'Stopala u širini ramena, kolena prate prste.'),
  ('e0000000-0000-4000-8000-000000000002', 'Iskorak sa bučicama', null, 'Zadnje koleno skoro do poda, trup uspravan.'),
  ('e0000000-0000-4000-8000-000000000003', 'Rameni potisak', null, 'Ne izvijaj leđa, laktovi blago ispred.'),
  ('e0000000-0000-4000-8000-000000000004', 'Sklekovi', null, 'Telo u jednoj liniji, grudi do poda.'),
  ('e0000000-0000-4000-8000-000000000005', 'Veslanje bučicom', null, 'Lakat vuci ka kuku, leđa ravna.'),
  ('e0000000-0000-4000-8000-000000000006', 'Biceps pregib', null, 'Laktovi uz telo, kontrolisano spuštanje.'),
  ('e0000000-0000-4000-8000-000000000007', 'Plank', null, 'Stomak i guza stegnuti, ne propadaj u kukovima.'),
  ('e0000000-0000-4000-8000-000000000008', 'Gluteus most', null, 'Pritisni pete, zadrži gore 1 sekundu.'),
  ('e0000000-0000-4000-8000-000000000009', 'Rumunsko mrtvo dizanje', null, 'Kukovi nazad, šipka blizu nogu.'),
  ('e0000000-0000-4000-8000-000000000010', 'Bench press', null, 'Lopatice skupljene, šipka do donjeg dela grudi.'),
  ('e0000000-0000-4000-8000-000000000011', 'Lat pulldown', null, 'Vuci ka gornjem delu grudi, ne ljuljaj se.'),
  ('e0000000-0000-4000-8000-000000000012', 'Jumping jacks', null, 'Ujednačen ritam, meko doskakanje.'),
  ('e0000000-0000-4000-8000-000000000013', 'Mountain climbers', null, 'Kukovi nisko, brza kolena ka grudima.')
on conflict (id) do update set name = excluded.name, cue = excluded.cue;

insert into public.workouts (id, title, minutes, equipment) values
  ('b0000000-0000-4000-8000-000000000001', 'Gornji deo tela', 35, 'bučice'),
  ('b0000000-0000-4000-8000-000000000002', 'Donji deo tela', 30, 'bučice'),
  ('b0000000-0000-4000-8000-000000000003', 'Kardio krug', 20, 'bez opreme'),
  ('b0000000-0000-4000-8000-000000000004', 'Noge — teretana', 50, 'šipka, mašine'),
  ('b0000000-0000-4000-8000-000000000005', 'Grudi i ramena', 50, 'šipka, bučice'),
  ('b0000000-0000-4000-8000-000000000006', 'Leđa i ruke', 45, 'mašine, bučice')
on conflict (id) do update set title = excluded.title, minutes = excluded.minutes, equipment = excluded.equipment;

-- Stavke nemaju prirodan ključ, pa ih za ove treninge pišemo iznova.
delete from public.workout_items where workout_id in (
  'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004',
  'b0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000006'
);

insert into public.workout_items (workout_id, exercise_id, position, sets, reps, seconds, kg, rest_sec) values
  -- Gornji deo tela
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 1, 3, 10, null, null, 45),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005', 2, 3, 12, null, 8, 45),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 3, 3, 12, null, 6, 45),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006', 4, 3, 12, null, 6, 30),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000007', 5, 3, null, 30, null, 30),
  -- Donji deo tela
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 1, 3, 15, null, null, 45),
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 2, 4, 12, null, 6, 45),
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000008', 3, 3, 15, null, null, 30),
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000007', 4, 2, null, 40, null, 30),
  -- Kardio krug
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000012', 1, 3, null, 40, null, 20),
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000013', 2, 3, null, 30, null, 20),
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 3, 3, 20, null, null, 20),
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000004', 4, 3, 8, null, null, 20),
  -- Noge — teretana
  ('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 1, 4, 8, null, 60, 120),
  ('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000009', 2, 4, 10, null, 50, 90),
  ('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000002', 3, 3, 10, null, 14, 60),
  -- Grudi i ramena
  ('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000010', 1, 4, 8, null, 50, 120),
  ('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000003', 2, 3, 10, null, 14, 90),
  ('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000004', 3, 2, 15, null, null, 60),
  -- Leđa i ruke
  ('b0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000011', 1, 4, 10, null, 45, 90),
  ('b0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000005', 2, 3, 10, null, 20, 90),
  ('b0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000006', 3, 3, 12, null, 10, 60);

insert into public.programs (id, title, description, weeks, per_week, location, level, tone, published) values
  ('c0000000-0000-4000-8000-000000000001', 'Lagano do forme', 'Četiri nedelje da vratiš ritam: kratki treninzi celog tela, kod kuće, sa bučicama.', 4, 3, 'kuca', 'Početnik', 'sage', true),
  ('c0000000-0000-4000-8000-000000000002', 'Snaga bez teretane', 'Jače telo samo sa bučicama i sopstvenom težinom.', 6, 4, 'kuca', 'Početnik', 'accent', true),
  ('c0000000-0000-4000-8000-000000000003', 'Masa i snaga', 'Klasičan push / pull / legs program za mišićnu masu.', 8, 3, 'teretana', 'Srednji', 'sage', true),
  ('c0000000-0000-4000-8000-000000000004', '20 minuta u pauzi', 'Brzi treninzi kad nemaš vremena. Bez opreme.', 4, 5, 'kuca', 'Svi nivoi', 'neutral', true)
on conflict (id) do update set
  title = excluded.title, description = excluded.description, weeks = excluded.weeks, per_week = excluded.per_week,
  location = excluded.location, level = excluded.level, tone = excluded.tone, published = excluded.published;

insert into public.program_schedule (program_id, position, workout_id) values
  ('c0000000-0000-4000-8000-000000000001', 1, 'b0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000001', 2, 'b0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000001', 3, 'b0000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000002', 1, 'b0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 2, 'b0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000002', 3, 'b0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 4, 'b0000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000003', 1, 'b0000000-0000-4000-8000-000000000005'),
  ('c0000000-0000-4000-8000-000000000003', 2, 'b0000000-0000-4000-8000-000000000006'),
  ('c0000000-0000-4000-8000-000000000003', 3, 'b0000000-0000-4000-8000-000000000004'),
  ('c0000000-0000-4000-8000-000000000004', 1, 'b0000000-0000-4000-8000-000000000003')
on conflict (program_id, position) do update set workout_id = excluded.workout_id;

commit;
