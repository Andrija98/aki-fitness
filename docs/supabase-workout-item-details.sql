-- Stavka treninga: raspon ponavljanja ("10–12") i napomena samo za taj trening
-- (npr. "10 po nozi", "opcija 2: bench press", "superset sa sledećom vežbom").
-- Savet vežbe (exercises.cue) je zajednički za sve programe, pa ovakve napomene idu uz stavku.
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run (samo jednom).
-- Pravila pristupa se ne menjaju: stavke piše samo trener (polisa "stavke: trener").

alter table public.workout_items
  add column reps_max smallint check (reps_max is null or (reps is not null and reps_max > reps)),
  add column note text check (char_length(note) <= 300);
