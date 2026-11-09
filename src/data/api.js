// DATA SLOJ: jedino mesto gde aplikacija čita i piše podatke.
// Baza ima snake_case kolone, a ekrani dobijaju camelCase objekte; prevod je ovde.
// Upiti za klijentove podatke uvek filtriraju po user_id: RLS treneru dozvoljava da čita sve,
// pa bez filtera trener na svom telefonu ne bi video samo svoje.

import { supabase } from '../lib/supabase.js';

// Programi iz docs/supabase-seed.sql koji se predlažu posle onboardinga.
const SUGGESTED_PROGRAMS = {
  snagaKuca: 'c0000000-0000-4000-8000-000000000002',
  masa: 'c0000000-0000-4000-8000-000000000003',
  pauza: 'c0000000-0000-4000-8000-000000000004',
};

// Supabase ne baca grešku nego je vraća u rezultatu; ovde je pretvaramo u exception.
function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

async function currentUserId() {
  const session = await getAuthSession();
  if (!session) throw new Error('Korisnik nije prijavljen.');
  return session.user.id;
}

const byPosition = (a, b) => a.position - b.position;

function toProgram(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    weeks: row.weeks,
    perWeek: row.per_week,
    location: row.location,
    level: row.level,
    tone: row.tone,
    schedule: [...row.program_schedule].sort(byPosition).map((s) => s.workout_id),
  };
}

function toSet(row) {
  return { exerciseId: row.exercise_id, setNo: row.set_no, reps: row.reps, seconds: row.seconds, kg: row.kg };
}

// ---------- Prijava ----------

export async function getAuthSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

// scope 'local': odjavljuje samo ovaj uređaj, ne i klijentov telefon ako je prijavljen na više mesta.
export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

// callback(session, event) se zove pri svakoj promeni; vraća funkciju za odjavu slušaoca.
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event));
  return () => data.subscription.unsubscribe();
}

// Greške "nalog ne postoji" i "adresa nije dozvoljena" namerno ćutimo,
// da niko preko ove forme ne može da proverava čiji mejl ima nalog.
export async function requestPasswordReset(email) {
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error && (!error.status || error.status === 429 || error.status >= 500)) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// ---------- Sadržaj (trener) ----------

const PROGRAM_FIELDS = '*, program_schedule(position, workout_id)';

export async function getPrograms() {
  const rows = unwrap(await supabase.from('programs').select(PROGRAM_FIELDS).order('id'));
  return rows.map(toProgram);
}

export async function getProgram(id) {
  const result = await supabase.from('programs').select(PROGRAM_FIELDS).eq('id', id).maybeSingle();
  if (result.error?.code === '22P02') return null; // adresa sa ID-jem koji nije UUID
  const row = unwrap(result);
  return row ? toProgram(row) : null;
}

// Vraća trening sa "razmotanim" vežbama (ime, video, savet), spreman za prikaz.
export async function getWorkout(id) {
  const result = await supabase
    .from('workouts')
    .select('id, title, minutes, equipment, workout_items(position, exercise_id, sets, reps, seconds, kg, rest_sec, exercises(name, video_url, cue))')
    .eq('id', id)
    .maybeSingle();
  if (result.error?.code === '22P02') return null;
  const row = unwrap(result);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    minutes: row.minutes,
    equipment: row.equipment,
    items: [...row.workout_items].sort(byPosition).map((it) => ({
      exerciseId: it.exercise_id,
      sets: it.sets,
      reps: it.reps,
      seconds: it.seconds,
      kg: it.kg,
      rest: it.rest_sec,
      name: it.exercises.name,
      videoUrl: it.exercises.video_url ?? '',
      cue: it.exercises.cue,
    })),
  };
}

// ---------- Korisnik ----------

// Trigger pravi prazan red pri otvaranju naloga, pa je "nema profila" = onboarding nije završen (goal je prazan).
export async function getProfile() {
  const userId = await currentUserId();
  const row = unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
  if (!row?.goal) return null;
  const latest = unwrap(await supabase.from('weights').select('kg').eq('user_id', userId).order('date', { ascending: false }).limit(1));
  return {
    name: row.name,
    goal: row.goal,
    location: row.location,
    level: row.level,
    perWeek: row.per_week,
    weightKg: latest[0]?.kg ?? null,
    createdAt: row.created_at,
  };
}

export async function saveProfile(profile) {
  const userId = await currentUserId();
  const before = await getProfile();
  unwrap(await supabase.from('profiles').update({
    name: profile.name,
    goal: profile.goal,
    location: profile.location,
    level: profile.level,
    per_week: profile.perWeek,
  }).eq('id', userId));
  if (profile.weightKg && profile.weightKg !== before?.weightKg) await addWeight(profile.weightKg);
  if (!(await getActiveProgramId())) {
    const suggested = await suggestProgram(profile);
    if (suggested) await setActiveProgram(suggested.id);
  }
  return getProfile();
}

// Prvi predlog programa na osnovu onboardinga.
async function suggestProgram(profile) {
  const programs = await getPrograms();
  let id = null;
  if (profile.location === 'teretana' && profile.level !== 'pocetnik') id = SUGGESTED_PROGRAMS.masa;
  else if (profile.goal === 'kondicija') id = SUGGESTED_PROGRAMS.pauza;
  else if (profile.goal === 'snaga') id = SUGGESTED_PROGRAMS.snagaKuca;
  return programs.find((p) => p.id === id) ?? programs[0];
}

export async function getActiveProgramId() {
  const userId = await currentUserId();
  const rows = unwrap(await supabase.from('enrollments').select('program_id')
    .eq('user_id', userId).eq('active', true).order('started_at', { ascending: false }).limit(1));
  return rows[0]?.program_id ?? null;
}

export async function setActiveProgram(programId) {
  const userId = await currentUserId();
  unwrap(await supabase.from('enrollments').upsert({ user_id: userId, program_id: programId, active: true }));
  unwrap(await supabase.from('enrollments').update({ active: false }).eq('user_id', userId).neq('program_id', programId));
}

// ---------- Odrađeni treninzi ----------

// session = { programId, workoutId, durationSec, sets: [{ exerciseId, setNo, reps, kg, seconds }] }
// Trening i serije su dva upisa; ako serije ne prođu, brišemo trening da ponovni pokušaj ne napravi duplikat.
export async function saveSession(session) {
  const row = unwrap(await supabase.from('sessions').insert({
    program_id: session.programId,
    workout_id: session.workoutId,
    duration_sec: session.durationSec,
  }).select().single());

  const { error } = await supabase.from('session_sets').insert(session.sets.map((s) => ({
    session_id: row.id,
    exercise_id: s.exerciseId,
    set_no: s.setNo,
    reps: s.reps ?? null,
    seconds: s.seconds ?? null,
    kg: s.kg ?? null,
  })));
  if (error) {
    await supabase.from('sessions').delete().eq('id', row.id);
    throw error;
  }
  return { id: row.id, date: row.date, ...session };
}

export async function getSessions() {
  const userId = await currentUserId();
  const rows = unwrap(await supabase.from('sessions')
    .select('id, program_id, workout_id, date, duration_sec, session_sets(exercise_id, set_no, reps, seconds, kg)')
    .eq('user_id', userId)
    .order('date'));
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    programId: r.program_id,
    workoutId: r.workout_id,
    durationSec: r.duration_sec,
    sets: r.session_sets.map(toSet),
  }));
}

// Poslednji put kad je vežba rađena: za predlog kilaže.
export async function getLastSets(exerciseId) {
  const userId = await currentUserId();
  const rows = unwrap(await supabase.from('sessions')
    .select('date, session_sets!inner(exercise_id, set_no, reps, seconds, kg)')
    .eq('user_id', userId)
    .eq('session_sets.exercise_id', exerciseId)
    .order('date', { ascending: false })
    .limit(1));
  if (!rows.length) return [];
  return rows[0].session_sets.map(toSet).sort((a, b) => a.setNo - b.setNo);
}

// Napredak kroz program: koliko je treninga odrađeno i koji je sledeći.
export async function getProgramProgress(programId) {
  const program = await getProgram(programId);
  if (!program) return null;
  const userId = await currentUserId();
  const { count, error } = await supabase.from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('program_id', programId);
  if (error) throw error;
  const done = count ?? 0;
  const total = program.weeks * program.perWeek;
  const nextWorkoutId = program.schedule[done % program.schedule.length];
  return {
    program,
    done,
    total,
    percent: Math.min(100, Math.round((done / total) * 100)),
    week: Math.min(program.weeks, Math.floor(done / program.perWeek) + 1),
    nextWorkoutId,
  };
}

// ---------- Težina ----------

export async function getWeights() {
  const userId = await currentUserId();
  return unwrap(await supabase.from('weights').select('date, kg').eq('user_id', userId).order('date'));
}

export async function addWeight(kg) {
  const userId = await currentUserId();
  unwrap(await supabase.from('weights').upsert({ user_id: userId, date: today(), kg }));
}

// ---------- Ostalo ----------

function today() {
  return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD po lokalnom vremenu
}
