// Zajednički sadržaj za testove: vežbe, treninzi i programi sa fiksnim ID-jevima i nazivima "E2E …".
// Pravi sadržaj pravi trener sam, pa testovi ne smeju da zavise od njega. Ovaj sadržaj postavlja
// e2e/global-setup.js pre testova, a briše e2e/global-teardown.js posle njih.
//
// Programi su objavljeni (klijent u testu mora da ih vidi), pa ih dok testovi traju (~6 min) vide i pravi klijenti.

import { ACCOUNT_A, ACCOUNT_B, ACCOUNT_TRAINER, apiLogin, resetAccount } from './helpers.js';

const ex = (n) => `e0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const wo = (n) => `b0000000-0000-4000-8000-00000000000${n}`;
const pr = (n) => `c0000000-0000-4000-8000-00000000000${n}`;

export const FIXTURE_EXERCISES = [
  [ex(1), 'E2E Čučanj', 'Stopala u širini ramena, kolena prate prste.'],
  [ex(2), 'E2E Iskorak sa bučicama', 'Zadnje koleno skoro do poda, trup uspravan.'],
  [ex(3), 'E2E Rameni potisak', 'Ne izvijaj leđa, laktovi blago ispred.'],
  [ex(4), 'E2E Sklekovi', 'Telo u jednoj liniji, grudi do poda.'],
  [ex(5), 'E2E Veslanje bučicom', 'Lakat vuci ka kuku, leđa ravna.'],
  [ex(6), 'E2E Biceps pregib', 'Laktovi uz telo, kontrolisano spuštanje.'],
  [ex(7), 'E2E Plank', 'Stomak i guza stegnuti, ne propadaj u kukovima.'],
  [ex(8), 'E2E Gluteus most', 'Pritisni pete, zadrži gore 1 sekundu.'],
  [ex(9), 'E2E Rumunsko mrtvo dizanje', 'Kukovi nazad, šipka blizu nogu.'],
  [ex(10), 'E2E Bench press', 'Lopatice skupljene, šipka do donjeg dela grudi.'],
  [ex(11), 'E2E Lat pulldown', 'Vuci ka gornjem delu grudi, ne ljuljaj se.'],
  [ex(12), 'E2E Jumping jacks', 'Ujednačen ritam, meko doskakanje.'],
  [ex(13), 'E2E Mountain climbers', 'Kukovi nisko, brza kolena ka grudima.'],
].map(([id, name, cue]) => ({ id, name, cue }));

export const FIXTURE_WORKOUTS = [
  [wo(1), 'E2E Gornji deo tela', 35, 'bučice'],
  [wo(2), 'E2E Donji deo tela', 30, 'bučice'],
  [wo(3), 'E2E Kardio krug', 20, 'bez opreme'],
  [wo(4), 'E2E Noge — teretana', 50, 'šipka, mašine'],
  [wo(5), 'E2E Grudi i ramena', 50, 'šipka, bučice'],
  [wo(6), 'E2E Leđa i ruke', 45, 'mašine, bučice'],
].map(([id, title, minutes, equipment]) => ({ id, title, minutes, equipment }));

// [trening, vežba, pozicija, serije, ponavljanja, sekunde, kg, pauza]
const ITEMS = [
  [1, 4, 1, 3, 10, null, null, 45], [1, 5, 2, 3, 12, null, 8, 45], [1, 3, 3, 3, 12, null, 6, 45], [1, 6, 4, 3, 12, null, 6, 30], [1, 7, 5, 3, null, 30, null, 30],
  [2, 1, 1, 3, 15, null, null, 45], [2, 2, 2, 4, 12, null, 6, 45], [2, 8, 3, 3, 15, null, null, 30], [2, 7, 4, 2, null, 40, null, 30],
  [3, 12, 1, 3, null, 40, null, 20], [3, 13, 2, 3, null, 30, null, 20], [3, 1, 3, 3, 20, null, null, 20], [3, 4, 4, 3, 8, null, null, 20],
  [4, 1, 1, 4, 8, null, 60, 120], [4, 9, 2, 4, 10, null, 50, 90], [4, 2, 3, 3, 10, null, 14, 60],
  [5, 10, 1, 4, 8, null, 50, 120], [5, 3, 2, 3, 10, null, 14, 90], [5, 4, 3, 2, 15, null, null, 60],
  [6, 11, 1, 4, 10, null, 45, 90], [6, 5, 2, 3, 10, null, 20, 90], [6, 6, 3, 3, 12, null, 10, 60],
];
export const FIXTURE_ITEMS = ITEMS.map(([w, e, position, sets, reps, seconds, kg, rest]) => ({
  workout_id: wo(w), exercise_id: ex(e), position, sets, reps, reps_max: null, seconds, kg, rest_sec: rest, note: null,
}));

export const FIXTURE_PROGRAMS = [
  [pr(1), 'E2E Lagano do forme', 'Četiri nedelje da vratiš ritam: kratki treninzi celog tela, kod kuće, sa bučicama.', 4, 3, 'kuca', 'Početnik', 'sage'],
  [pr(2), 'E2E Snaga bez teretane', 'Jače telo samo sa bučicama i sopstvenom težinom.', 6, 4, 'kuca', 'Početnik', 'accent'],
  [pr(3), 'E2E Masa i snaga', 'Klasičan push / pull / legs program za mišićnu masu.', 8, 3, 'teretana', 'Srednji', 'sage'],
  [pr(4), 'E2E 20 minuta u pauzi', 'Brzi treninzi kad nemaš vremena. Bez opreme.', 4, 5, 'kuca', 'Svi nivoi', 'neutral'],
].map(([id, title, description, weeks, per_week, location, level, tone]) => ({ id, title, description, weeks, per_week, location, level, tone, published: true }));

export const FIXTURE_SCHEDULE = [
  [1, 1, 1], [1, 2, 2], [1, 3, 3],
  [2, 1, 1], [2, 2, 2], [2, 3, 1], [2, 4, 3],
  [3, 1, 5], [3, 2, 6], [3, 3, 4],
  [4, 1, 3],
].map(([p, position, w]) => ({ program_id: pr(p), position, workout_id: wo(w) }));

// Za filtere: "sve E2E osim zajedničkog sadržaja" (npr. čišćenje sopstvenih test vežbi).
const list = (rows) => `(${rows.map((r) => r.id).join(',')})`;
export const NOT_FIXTURE_EXERCISE = `id=not.in.${list(FIXTURE_EXERCISES)}`;
export const NOT_FIXTURE_WORKOUT = `id=not.in.${list(FIXTURE_WORKOUTS)}`;
export const NOT_FIXTURE_PROGRAM = `id=not.in.${list(FIXTURE_PROGRAMS)}`;

// ---------- Postavljanje i brisanje (kao trener, kroz RLS) ----------

async function call(path, token, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: process.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]}: ${res.status} ${await res.text()}`);
}
const UPSERT = 'resolution=merge-duplicates,return=minimal';
const ids = (rows) => rows.map((r) => r.id).join(',');

// Idempotentno: ako je prethodno pokretanje prekinuto, sadržaj se samo osveži.
export async function installFixtures() {
  const { token } = await apiLogin(ACCOUNT_TRAINER);
  await call('exercises', token, { method: 'POST', body: FIXTURE_EXERCISES.map((e) => ({ ...e, video_url: null })), prefer: UPSERT });
  await call('workouts', token, { method: 'POST', body: FIXTURE_WORKOUTS, prefer: UPSERT });
  await call(`workout_items?workout_id=in.(${ids(FIXTURE_WORKOUTS)})`, token, { method: 'DELETE' });
  await call('workout_items', token, { method: 'POST', body: FIXTURE_ITEMS, prefer: 'return=minimal' });
  await call('programs', token, { method: 'POST', body: FIXTURE_PROGRAMS, prefer: UPSERT });
  await call(`program_schedule?program_id=in.(${ids(FIXTURE_PROGRAMS)})`, token, { method: 'DELETE' });
  await call('program_schedule', token, { method: 'POST', body: FIXTURE_SCHEDULE, prefer: 'return=minimal' });
}

// Prvo e2e nalozi (njihovi treninzi i izbori programa pokazuju na ovaj sadržaj), pa programi, treninzi i vežbe.
// Ako je neki pravi klijent baš tada izabrao E2E program, brisanje ne prolazi: tada se programi samo sakriju.
export async function removeFixtures() {
  for (const account of [ACCOUNT_A, ACCOUNT_B, ACCOUNT_TRAINER]) await resetAccount(account);
  const { token } = await apiLogin(ACCOUNT_TRAINER);
  try {
    await call(`programs?id=in.(${ids(FIXTURE_PROGRAMS)})`, token, { method: 'DELETE' });
    await call(`workouts?id=in.(${ids(FIXTURE_WORKOUTS)})`, token, { method: 'DELETE' });
    await call(`exercises?id=in.(${ids(FIXTURE_EXERCISES)})`, token, { method: 'DELETE' });
  } catch (e) {
    await call(`programs?id=in.(${ids(FIXTURE_PROGRAMS)})`, token, { method: 'PATCH', body: { published: false } });
    console.warn(`E2E sadržaj nije obrisan do kraja (koristi ga neko van testova), programi su sakriveni: ${e.message}`);
  }
}
