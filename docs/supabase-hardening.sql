-- Bezbednost funkcija (Supabase savetnik, lintovi 0028/0029). Pokreće se POSLEDNJI, posle svih ostalih SQL fajlova.
-- Kako se koristi: Supabase → SQL Editor → New query → nalepi ceo fajl → Run (može i više puta).
--
-- Trigger funkcije ne treba da budu dostupne preko /rest/v1/rpc. Postgres proverava EXECUTE samo kad se
-- trigger PRAVI, ne kad se okida, pa registracija (handle_new_user) i dalje pravi profil.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- rls_auto_enable pravi Supabase (opcija "automatski uključi RLS"), pa je nema u svakom projektu.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- Svesno ostaju dostupne (savetnik će ih i dalje prijavljivati):
--   is_trainer()          odgovara samo "da li sam JA trener", ne odaje ništa o drugima; poziva je
--                         i polisa koja važi za neprijavljene, pa bi im oduzimanje dalo grešku umesto 0 redova
--   e2e_clear_messages()  koriste je testovi; sama proverava da je pozivalac e2e-* nalog
--   meal_plan_locked(), meal_plan_writable(uuid)  samo za prijavljene, gledaju samo planove pozivaoca
