// DATA SLOJ: jedino mesto gde aplikacija čita i piše podatke.
// Baza ima snake_case kolone, a ekrani dobijaju camelCase objekte; prevod je ovde.
// Upiti za klijentove podatke uvek filtriraju po user_id: RLS treneru dozvoljava da čita sve,
// pa bez filtera trener na svom telefonu ne bi video samo svoje.

import { supabase } from '../lib/supabase.js';

// Programi iz docs/supabase-seed.sql koji se predlažu posle onboardinga.
const SUGGESTED_PROGRAMS = {
  lagano: 'c0000000-0000-4000-8000-000000000001',
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
    published: row.published,
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

// Samo objavljeni, abecedno. RLS klijentu ionako krije nacrte, a filter čuva i trenera od nacrta u njegovoj listi.
export async function getPrograms() {
  const rows = unwrap(await supabase.from('programs').select(PROGRAM_FIELDS).eq('published', true).order('title'));
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
    .select('id, title, minutes, equipment, workout_items(position, exercise_id, sets, reps, reps_max, seconds, kg, rest_sec, note, exercises(name, video_url, cue))')
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
      repsMax: it.reps_max,
      seconds: it.seconds,
      kg: it.kg,
      rest: it.rest_sec,
      note: it.note,
      name: it.exercises.name,
      videoUrl: it.exercises.video_url ?? '',
      cue: it.exercises.cue,
    })),
  };
}

export async function getExercises() {
  const rows = unwrap(await supabase.from('exercises').select('id, name, cue, video_url').order('name'));
  return rows.map((r) => ({ id: r.id, name: r.name, cue: r.cue, videoUrl: r.video_url }));
}

export async function createExercise({ name, cue }) {
  unwrap(await supabase.from('exercises').insert({ name, cue }).select('id').single());
}

export async function updateExercise(id, { name, cue }) {
  const rows = unwrap(await supabase.from('exercises').update({ name, cue }).eq('id', id).select('id'));
  if (!rows.length) throw new Error('Vežba nije izmenjena.');
}

// url = null uklanja video. RLS odbijen UPDATE ne vraća grešku nego 0 redova, pa to proveravamo ručno.
export async function setExerciseVideo(id, url) {
  const rows = unwrap(await supabase.from('exercises').update({ video_url: url }).eq('id', id).select('id'));
  if (!rows.length) throw new Error('Video nije sačuvan.');
}

// ---------- Trener: treninzi ----------

export async function getWorkoutsOverview() {
  const rows = unwrap(await supabase.from('workouts').select('id, title, minutes, equipment, workout_items(id), program_schedule(program_id)').order('title'));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    minutes: r.minutes,
    itemCount: r.workout_items.length,
    programCount: new Set(r.program_schedule.map((s) => s.program_id)).size,
  }));
}

// U koliko programa je trening: izmene tada odmah vide klijenti tih programa.
// ---------- Brisanje sadržaja (trener) ----------
// Briše se samo ono što se nigde ne koristi. Baza i sama odbija brisanje upotrebljenog (strani ključ, kod 23503):
// tada funkcija baca grešku sa inUse = true, pa ekran može da prikaže razlog umesto opšte greške.

async function countRows(query) {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
const HEAD = { count: 'exact', head: true };

async function deleteById(table, id) {
  const result = await supabase.from(table).delete().eq('id', id).select('id');
  if (result.error?.code === '23503') throw Object.assign(new Error('Koristi se.'), { inUse: true });
  if (!unwrap(result).length) throw new Error('Nije obrisano.');
}

// Vežba: u koliko treninga je i koliko serija su klijenti odradili.
export async function getExerciseUsage(id) {
  const [workouts, sets] = await Promise.all([
    countRows(supabase.from('workout_items').select('id', HEAD).eq('exercise_id', id)),
    countRows(supabase.from('session_sets').select('id', HEAD).eq('exercise_id', id)),
  ]);
  return { workouts, sets };
}

// Trening: u koliko programa je i koliko puta je odrađen.
export async function getWorkoutDeleteUsage(id) {
  const [programs, sessions] = await Promise.all([
    getWorkoutUsage(id),
    countRows(supabase.from('sessions').select('id', HEAD).eq('workout_id', id)),
  ]);
  return { programs, sessions };
}

// Program: koliko klijenata ga je ikad izabralo (i neaktivni upisi blokiraju brisanje) i koliko treninga je po njemu odrađeno.
export async function getProgramDeleteUsage(id) {
  const [enrollments, sessions] = await Promise.all([
    countRows(supabase.from('enrollments').select('user_id', HEAD).eq('program_id', id)),
    countRows(supabase.from('sessions').select('id', HEAD).eq('program_id', id)),
  ]);
  return { enrollments, sessions };
}

export const deleteExercise = (id) => deleteById('exercises', id);
export const deleteWorkout = (id) => deleteById('workouts', id);   // stavke treninga idu kaskadno
export const deleteProgram = (id) => deleteById('programs', id);   // raspored programa ide kaskadno; treninzi ostaju

export async function getWorkoutUsage(id) {
  const rows = unwrap(await supabase.from('program_schedule').select('program_id').eq('workout_id', id));
  return new Set(rows.map((r) => r.program_id)).size;
}

// workout = { id?, title, minutes, equipment, items: [{ exerciseId, sets, reps, repsMax, seconds, kg, rest, note }] }
// Prvo upisujemo nove stavke, pa brišemo stare: klijent nikad ne vidi prazan trening.
// Stare stavke čitamo tik pre upisa, pa ponovno čuvanje posle prekida samo ispravi višak.
export async function saveWorkout(workout) {
  const fields = { title: workout.title, minutes: workout.minutes, equipment: workout.equipment };
  const isNew = !workout.id;
  let workoutId = workout.id;
  if (isNew) {
    workoutId = unwrap(await supabase.from('workouts').insert(fields).select('id').single()).id;
  } else {
    const rows = unwrap(await supabase.from('workouts').update(fields).eq('id', workoutId).select('id'));
    if (!rows.length) throw new Error('Trening nije sačuvan.');
  }

  const old = unwrap(await supabase.from('workout_items').select('id').eq('workout_id', workoutId));
  const { error } = await supabase.from('workout_items').insert(workout.items.map((it, i) => ({
    workout_id: workoutId,
    exercise_id: it.exerciseId,
    position: i + 1,
    sets: it.sets,
    reps: it.reps,
    reps_max: it.repsMax ?? null,
    seconds: it.seconds,
    kg: it.kg,
    rest_sec: it.rest,
    note: it.note ?? null,
  })));
  if (error) {
    if (isNew) await supabase.from('workouts').delete().eq('id', workoutId); // da ponovni pokušaj ne napravi duplikat
    throw error;
  }
  if (old.length) unwrap(await supabase.from('workout_items').delete().in('id', old.map((r) => r.id)));
  return workoutId;
}

// ---------- Trener: programi ----------

export async function getProgramsAdmin() {
  const rows = unwrap(await supabase.from('programs').select(PROGRAM_FIELDS).order('title'));
  return rows.map(toProgram);
}

// Koliko klijenata trenutno radi program: njih pogađaju izmene rasporeda i skidanje objave.
export async function getProgramClientCount(programId) {
  const { count, error } = await supabase.from('enrollments')
    .select('user_id', { count: 'exact', head: true })
    .eq('program_id', programId)
    .eq('active', true);
  if (error) throw error;
  return count ?? 0;
}

// program = { id?, title, description, weeks, perWeek, location, level, tone, published, schedule: [workoutId] }
// Raspored se prepisuje na licu mesta (upsert po poziciji), pa se brišu pozicije koje su višak.
export async function saveProgram(program) {
  const fields = {
    title: program.title,
    description: program.description,
    weeks: program.weeks,
    per_week: program.perWeek,
    location: program.location,
    level: program.level,
    tone: program.tone,
    published: program.published,
  };
  const isNew = !program.id;
  let programId = program.id;
  if (isNew) {
    programId = unwrap(await supabase.from('programs').insert(fields).select('id').single()).id;
  } else {
    const rows = unwrap(await supabase.from('programs').update(fields).eq('id', programId).select('id'));
    if (!rows.length) throw new Error('Program nije sačuvan.');
  }

  const { error } = await supabase.from('program_schedule').upsert(
    program.schedule.map((workoutId, i) => ({ program_id: programId, position: i + 1, workout_id: workoutId })),
    { onConflict: 'program_id,position' },
  );
  if (error) {
    if (isNew) await supabase.from('programs').delete().eq('id', programId); // da ponovni pokušaj ne napravi duplikat
    throw error;
  }
  unwrap(await supabase.from('program_schedule').delete().eq('program_id', programId).gt('position', program.schedule.length));
  return programId;
}

// ---------- Korisnik ----------

// Trigger pravi prazan red pri otvaranju naloga, pa je "nema profila" = onboarding nije završen (goal je prazan).
export async function getProfile() {
  const userId = await currentUserId();
  const row = unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
  if (!row?.goal) return null;
  const latest = unwrap(await supabase.from('weights').select('kg').eq('user_id', userId).order('date', { ascending: false }).limit(1));
  return {
    role: row.role,
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

// Pristanak na politiku privatnosti: { acceptedAt, version } ili null ako ga nikad nije dao.
export async function getPrivacyConsent() {
  const userId = await currentUserId();
  const row = unwrap(await supabase.from('profiles').select('privacy_accepted_at, privacy_version').eq('id', userId).maybeSingle());
  if (!row?.privacy_accepted_at) return null;
  return { acceptedAt: row.privacy_accepted_at, version: row.privacy_version ?? 1 };
}

export async function acceptPrivacy(version) {
  const userId = await currentUserId();
  const rows = unwrap(await supabase.from('profiles')
    .update({ privacy_accepted_at: new Date().toISOString(), privacy_version: version }).eq('id', userId).select('id'));
  if (!rows.length) throw new Error('Pristanak nije sačuvan.');
}

// Prvi predlog programa na osnovu onboardinga.
async function suggestProgram(profile) {
  const programs = await getPrograms();
  let id = SUGGESTED_PROGRAMS.lagano; // eksplicitno, jer je lista abecedna
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

// Bez parametra: podaci prijavljenog korisnika. Trener prosleđuje ID klijenta.
export async function getSessions(forUserId) {
  const userId = forUserId ?? await currentUserId();
  const rows = unwrap(await supabase.from('sessions')
    .select('id, program_id, workout_id, date, duration_sec, workouts(title), session_sets(exercise_id, set_no, reps, seconds, kg)')
    .eq('user_id', userId)
    .order('date'));
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    programId: r.program_id,
    workoutId: r.workout_id,
    workoutTitle: r.workouts?.title ?? 'Trening',
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

export async function getWeights(forUserId) {
  const userId = forUserId ?? await currentUserId();
  return unwrap(await supabase.from('weights').select('date, kg').eq('user_id', userId).order('date'));
}

export async function addWeight(kg) {
  const userId = await currentUserId();
  unwrap(await supabase.from('weights').upsert({ user_id: userId, date: today(), kg }));
}

// ---------- Mere ----------

export async function getMeasurements(forUserId) {
  const userId = forUserId ?? await currentUserId();
  const rows = unwrap(await supabase.from('measurements').select('date, waist_cm, hips_cm, arm_cm').eq('user_id', userId).order('date'));
  return rows.map((r) => ({ date: r.date, waist: r.waist_cm, hips: r.hips_cm, arm: r.arm_cm }));
}

// values = { waist?, hips?, arm? }. Šaljemo samo unete mere: drugi upis istog dana ne briše one koje nisu unete.
export async function saveMeasurements(values) {
  const userId = await currentUserId();
  const row = { user_id: userId, date: today() };
  if (values.waist != null) row.waist_cm = values.waist;
  if (values.hips != null) row.hips_cm = values.hips;
  if (values.arm != null) row.arm_cm = values.arm;
  unwrap(await supabase.from('measurements').upsert(row));
}

// ---------- Fotografije napretka (privatan Storage bucket) ----------

const PHOTO_BUCKET = 'progress-photos';
const SIGNED_URL_SECONDS = 60 * 60; // link za prikaz važi sat vremena

// Najnovije prvo. Svaka fotografija dobija privremeni potpisani link (bucket nije javan).
export async function getProgressPhotos(forUserId) {
  const userId = forUserId ?? await currentUserId();
  const rows = unwrap(await supabase.from('progress_photos').select('id, date, path')
    .eq('user_id', userId).order('date', { ascending: false }).order('created_at', { ascending: false }));
  if (!rows.length) return [];
  const signed = unwrap(await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(rows.map((r) => r.path), SIGNED_URL_SECONDS));
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ id: r.id, date: r.date, path: r.path, url: urlFor.get(r.path) ?? null }));
}

// blob: već smanjen JPEG (lib/image.js). Prvo fajl, pa red; ako red ne uspe, fajl se briše.
export async function addProgressPhoto(blob) {
  const userId = await currentUserId();
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  unwrap(await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' }));
  const inserted = await supabase.from('progress_photos').insert({ user_id: userId, date: today(), path });
  if (inserted.error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw inserted.error;
  }
}

// Prvo red (fotografija odmah nestaje iz aplikacije), pa fajl.
export async function deleteProgressPhoto(photo) {
  const userId = await currentUserId();
  const rows = unwrap(await supabase.from('progress_photos').delete().eq('id', photo.id).eq('user_id', userId).select('id'));
  if (!rows.length) throw new Error('Fotografija nije obrisana.');
  unwrap(await supabase.storage.from(PHOTO_BUCKET).remove([photo.path]));
}

// ---------- Članarina ----------
// Uplate evidentira trener; klijent ih samo čita. "Plaćeno do" = najkasniji period_end (lib/membership.js).

function toPayment(r) {
  return { id: r.id, paidOn: r.paid_on, amountRsd: r.amount_rsd, months: r.months, periodEnd: r.period_end, note: r.note };
}

// Najnovije prvo. Bez parametra: prijavljeni korisnik; trener prosleđuje id klijenta.
export async function getMembershipPayments(forUserId) {
  const userId = forUserId ?? await currentUserId();
  const rows = unwrap(await supabase.from('membership_payments').select('id, paid_on, amount_rsd, months, period_end, note')
    .eq('client_id', userId).order('period_end', { ascending: false }).order('created_at', { ascending: false }));
  return rows.map(toPayment);
}

// payment = { paidOn, amountRsd, months, periodEnd, note } (periodEnd računa ekran preko extendPaidUntil)
export async function addMembershipPayment(clientId, payment) {
  unwrap(await supabase.from('membership_payments').insert({
    client_id: clientId, paid_on: payment.paidOn, amount_rsd: payment.amountRsd, months: payment.months,
    period_end: payment.periodEnd, note: payment.note || null,
  }));
}

export async function deleteMembershipPayment(id) {
  const rows = unwrap(await supabase.from('membership_payments').delete().eq('id', id).select('id'));
  if (!rows.length) throw new Error('Uplata nije obrisana.');
}

// Podaci za uplatu (jedan red). Prazna polja dok ih trener ne unese.
export async function getBillingSettings() {
  const row = unwrap(await supabase.from('billing_settings').select('payee_name, account, price_rsd').eq('id', 1).maybeSingle());
  return { payeeName: row?.payee_name ?? '', account: row?.account ?? '', priceRsd: row?.price_rsd ?? null };
}

export async function saveBillingSettings({ payeeName, account, priceRsd }) {
  const rows = unwrap(await supabase.from('billing_settings')
    .update({ payee_name: payeeName || null, account: account || null, price_rsd: priceRsd, updated_at: new Date().toISOString() })
    .eq('id', 1).select('id'));
  if (!rows.length) throw new Error('Podaci za uplatu nisu sačuvani.');
}

// ---------- Trener: klijenti ----------

// Samo klijenti koji su završili onboarding. Prvi su oni koji najduže nisu trenirali.
export async function getClients() {
  const rows = unwrap(await supabase.from('profiles')
    .select('id, name, goal, sessions(date), membership_payments!membership_payments_client_id_fkey(period_end)')
    .eq('role', 'client').not('goal', 'is', null));
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      goal: r.goal,
      sessionCount: r.sessions.length,
      lastSessionAt: r.sessions.map((s) => s.date).sort().at(-1) ?? null,
      paidUntil: r.membership_payments.map((p) => p.period_end).sort().at(-1) ?? null,
    }))
    .sort((a, b) => (a.lastSessionAt ?? '').localeCompare(b.lastSessionAt ?? ''));
}

export async function getClient(id) {
  const result = await supabase.from('profiles').select('id, name, goal').eq('id', id).eq('role', 'client').maybeSingle();
  if (result.error?.code === '22P02') return null; // adresa sa ID-jem koji nije UUID
  return unwrap(result);
}

// ---------- Poruke ----------
// Jedan razgovor po klijentu (client_id). Klijent ne prosleđuje clientId: to je njegov razgovor.

// Fotografije u porukama: privatan bucket, folder = razgovor ({client_id}/...). Link za prikaz važi sat vremena.
const MESSAGE_PHOTO_BUCKET = 'message-photos';

function toMessage(row, me, photoUrl = null) {
  return {
    id: row.id, clientId: row.client_id, body: row.body, createdAt: row.created_at, readAt: row.read_at, mine: row.sender_id === me,
    photoPath: row.attachment_path ?? null, photoUrl,
  };
}

async function signMessagePhotos(paths) {
  if (!paths.length) return new Map();
  const signed = unwrap(await supabase.storage.from(MESSAGE_PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS));
  return new Map(signed.map((s) => [s.path, s.signedUrl]));
}

export async function getMessages(clientId) {
  const me = await currentUserId();
  const rows = unwrap(await supabase.from('messages').select('*').eq('client_id', clientId ?? me).order('created_at'));
  // Ako linkovi ne uspeju, tekst se i dalje prikazuje, a umesto slike piše "Fotografija".
  const urls = await signMessagePhotos(rows.map((r) => r.attachment_path).filter(Boolean)).catch(() => new Map());
  return rows.map((r) => toMessage(r, me, urls.get(r.attachment_path) ?? null));
}

// photo: već smanjen JPEG (lib/image.js) ili ništa. Sa fotografijom tekst može biti prazan.
// Ako upis poruke ne uspe, fajl ostaje u bucketu (korisnici ne brišu priloge), ali se nigde ne prikazuje.
export async function sendMessage(body, clientId, photo) {
  const me = await currentUserId();
  const conversation = clientId ?? me;
  let path = null;
  if (photo) {
    path = `${conversation}/${crypto.randomUUID()}.jpg`;
    unwrap(await supabase.storage.from(MESSAGE_PHOTO_BUCKET).upload(path, photo, { contentType: 'image/jpeg' }));
  }
  const row = unwrap(await supabase.from('messages').insert({ client_id: conversation, body, attachment_path: path }).select().single());
  // Poruka je već poslata: neuspeh linka ne sme da izgleda kao neuspeh slanja.
  const urls = await signMessagePhotos(path ? [path] : []).catch(() => new Map());
  return toMessage(row, me, urls.get(path) ?? null);
}

// Primalac označava pročitano. RLS sam preskače poruke koje ovaj korisnik ne sme da označi.
export async function markMessagesRead(clientId) {
  const me = await currentUserId();
  unwrap(await supabase.from('messages').update({ read_at: new Date().toISOString() })
    .eq('client_id', clientId ?? me).is('read_at', null).neq('sender_id', me));
}

// Nepročitane za klijenta: poruke trenera. Za trenera: poruke klijenata (pošiljalac je sam klijent).
export async function getUnreadCount(isTrainer) {
  const me = await currentUserId();
  let query = supabase.from('messages').select('client_id, sender_id').is('read_at', null).neq('sender_id', me);
  if (!isTrainer) query = query.eq('client_id', me);
  const rows = unwrap(await query);
  return rows.filter((r) => !isTrainer || r.sender_id === r.client_id).length;
}

// Trener: klijenti sa poslednjom porukom i brojem nepročitanih. Prvo oni sa nepročitanim, pa po poslednjoj poruci.
export async function getInbox() {
  const [clients, rows] = await Promise.all([
    getClients(),
    supabase.from('messages').select('client_id, sender_id, body, attachment_path, created_at, read_at').order('created_at', { ascending: false }).limit(500).then(unwrap),
  ]);
  return clients
    .map((c) => {
      const own = rows.filter((r) => r.client_id === c.id);
      return {
        id: c.id,
        name: c.name,
        lastBody: own[0] ? (own[0].body || (own[0].attachment_path ? 'Fotografija' : '')) : null,
        lastAt: own[0]?.created_at ?? null,
        unread: own.filter((r) => !r.read_at && r.sender_id === c.id).length,
      };
    })
    .sort((a, b) => (b.unread > 0) - (a.unread > 0) || (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
}

let channelCounter = 0;

// callback(message) za svaku novu poruku koju korisnik sme da vidi (Realtime poštuje RLS).
// clientId ograničava na jedan razgovor; bez njega stižu sve dozvoljene. Vraća funkciju za odjavu.
export function onNewMessage(clientId, callback) {
  let me = null;
  getAuthSession().then((s) => { me = s?.user.id ?? null; });
  const channel = supabase
    .channel(`messages-${channelCounter++}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      ...(clientId ? { filter: `client_id=eq.${clientId}` } : {}),
    }, async (payload) => {
      // Realtime šalje samo red; link za fotografiju se pravi ovde. Ako ne uspe, poruka stiže bez slike
      // (pojaviće se pri sledećem učitavanju razgovora).
      const path = payload.new.attachment_path;
      const urls = path ? await signMessagePhotos([path]).catch(() => new Map()) : new Map();
      callback(toMessage(payload.new, me, urls.get(path) ?? null));
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ---------- Ishrana: kalkulator ----------

// Ulazi za kalkulator i trenerova izmena cilja (ili null). Bez parametra: prijavljeni korisnik.
export async function getNutrition(forUserId) {
  const userId = forUserId ?? await currentUserId();
  const [row, latest, override] = await Promise.all([
    supabase.from('profiles').select('goal, sex, birth_year, height_cm, activity').eq('id', userId).maybeSingle().then(unwrap),
    supabase.from('weights').select('kg').eq('user_id', userId).order('date', { ascending: false }).limit(1).then(unwrap),
    supabase.from('nutrition_targets').select('kcal, protein_g, carbs_g, fat_g').eq('client_id', userId).maybeSingle().then(unwrap),
  ]);
  return {
    goal: row?.goal ?? null,
    sex: row?.sex ?? null,
    birthYear: row?.birth_year ?? null,
    heightCm: row?.height_cm ?? null,
    activity: row?.activity ?? null,
    weightKg: latest[0]?.kg ?? null,
    override: override ? { kcal: override.kcal, protein: override.protein_g, carbs: override.carbs_g, fat: override.fat_g } : null,
  };
}

// Klijent unosi podatke o telu; nova težina ide u istoriju težine kao i iz Profila.
export async function saveBodyData({ sex, birthYear, heightCm, activity, weightKg }) {
  const userId = await currentUserId();
  const rows = unwrap(await supabase.from('profiles')
    .update({ sex, birth_year: birthYear, height_cm: heightCm, activity }).eq('id', userId).select('id'));
  if (!rows.length) throw new Error('Podaci nisu sačuvani.');
  const latest = unwrap(await supabase.from('weights').select('kg').eq('user_id', userId).order('date', { ascending: false }).limit(1));
  if (weightKg && weightKg !== latest[0]?.kg) await addWeight(weightKg);
}

export async function setNutritionTarget(clientId, { kcal, protein, carbs, fat }) {
  const rows = unwrap(await supabase.from('nutrition_targets').upsert({
    client_id: clientId, kcal, protein_g: protein, carbs_g: carbs, fat_g: fat, updated_at: new Date().toISOString(),
  }).select('client_id'));
  if (!rows.length) throw new Error('Cilj nije sačuvan.');
}

export async function clearNutritionTarget(clientId) {
  unwrap(await supabase.from('nutrition_targets').delete().eq('client_id', clientId));
}

// ---------- Ishrana: namirnice i struktura obroka (trener) ----------

function toFood(r) {
  return {
    id: r.id, name: r.name, group: r.food_group, kcal: r.kcal, protein: r.protein_g, carbs: r.carbs_g, fat: r.fat_g,
    mealTypes: r.meal_types, minG: r.min_g, maxG: r.max_g, verified: r.verified, active: r.active, source: r.source,
  };
}

export async function getFoods() {
  return unwrap(await supabase.from('foods').select('*').order('name')).map(toFood);
}

export async function getFood(id) {
  const result = await supabase.from('foods').select('*').eq('id', id).maybeSingle();
  if (result.error?.code === '22P02') return null;
  const row = unwrap(result);
  return row ? toFood(row) : null;
}

// Greška sa code '23505' znači da namirnica sa tim nazivom već postoji (naziv je jedinstven).
export async function saveFood(food) {
  const fields = {
    name: food.name, food_group: food.group, kcal: food.kcal, protein_g: food.protein, carbs_g: food.carbs, fat_g: food.fat,
    meal_types: food.mealTypes, min_g: food.minG, max_g: food.maxG, verified: food.verified, active: food.active,
  };
  if (!food.id) return unwrap(await supabase.from('foods').insert(fields).select('id').single()).id;
  const rows = unwrap(await supabase.from('foods').update(fields).eq('id', food.id).select('id'));
  if (!rows.length) throw new Error('Namirnica nije sačuvana.');
  return food.id;
}

export async function getMealTemplates() {
  const rows = unwrap(await supabase.from('meal_templates').select('*').order('position'));
  return rows.map((r) => ({ mealType: r.meal_type, label: r.label, sharePct: r.share_pct, timeHint: r.time_hint, groups: r.food_groups }));
}

export async function saveMealTemplates(templates) {
  const rows = unwrap(await supabase.from('meal_templates').upsert(templates.map((t, i) => ({
    meal_type: t.mealType, label: t.label, position: i + 1, share_pct: t.sharePct, time_hint: t.timeHint, food_groups: t.groups,
  }))).select('meal_type'));
  if (rows.length !== templates.length) throw new Error('Struktura obroka nije sačuvana.');
}

// ---------- Ishrana: namirnice koje klijent voli ----------

export async function getFoodPreferences(forUserId) {
  const userId = forUserId ?? await currentUserId();
  return unwrap(await supabase.from('food_preferences').select('food_id').eq('client_id', userId)).map((r) => r.food_id);
}

// Upisuje samo razliku: nove dodaje, odčekirane briše.
export async function saveFoodPreferences(foodIds) {
  const userId = await currentUserId();
  const current = new Set(await getFoodPreferences());
  const wanted = new Set(foodIds);
  const toAdd = [...wanted].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !wanted.has(id));
  if (toAdd.length) unwrap(await supabase.from('food_preferences').insert(toAdd.map((food_id) => ({ client_id: userId, food_id }))));
  if (toRemove.length) unwrap(await supabase.from('food_preferences').delete().eq('client_id', userId).in('food_id', toRemove));
}

// ---------- Ishrana: sačuvan plan i kvačice ----------

// Važeći plan je najnoviji (posle zamene stari se briše, ali za kratko mogu da postoje oba).
// Zaključan ima prednost: ako trener zaključa stari baš dok klijent pravi nov, važi trenerov
// (klijent ga ne može obrisati, a novi plan bez trenerovih izmena ostaje skriven dok trener ne otključa).
// Bez parametra: prijavljeni korisnik; trener prosleđuje id klijenta.
export async function getMealPlan(forUserId) {
  const userId = forUserId ?? await currentUserId();
  const rows = unwrap(await supabase.from('meal_plans')
    .select('id, locked, target, inputs_key, meal_plan_items(id, weekday, meal_type, food_id, grams, suggested, position)')
    .eq('client_id', userId).order('locked', { ascending: false }).order('created_at', { ascending: false }).limit(1));
  const p = rows[0];
  if (!p) return null;
  return {
    id: p.id,
    locked: p.locked,
    target: p.target,
    inputsKey: p.inputs_key,
    items: p.meal_plan_items.map((i) => ({
      id: i.id, weekday: i.weekday, mealType: i.meal_type, foodId: i.food_id, grams: i.grams, suggested: i.suggested, position: i.position,
    })),
  };
}

// Prvo nov plan sa stavkama, pa brisanje starih: klijent nikad ne vidi prazan plan.
// Brišu se samo STARIJI planovi: dve istovremene zamene (npr. telefon i računar) inače obrišu jedna drugu.
// Ako je plan zaključan, RLS odbija upis i funkcija baca grešku.
export async function replaceMealPlan({ target, inputsKey, items }) {
  if (!items.length) throw new Error('Plan je prazan.');
  const userId = await currentUserId();
  const plan = unwrap(await supabase.from('meal_plans')
    .insert({ client_id: userId, target, inputs_key: inputsKey }).select('id, created_at').single());
  const inserted = await supabase.from('meal_plan_items').insert(items.map((i) => ({
    plan_id: plan.id, weekday: i.weekday, meal_type: i.mealType, food_id: i.foodId, grams: i.grams, suggested: i.suggested, position: i.position,
  })));
  if (inserted.error) {
    await supabase.from('meal_plans').delete().eq('id', plan.id);
    throw inserted.error;
  }
  unwrap(await supabase.from('meal_plans').delete().eq('client_id', userId).lt('created_at', plan.created_at));
  return plan.id;
}

// Trener: zaključava plan (klijentov generator ga više ne dira) i menja grame. Prvo zaključavanje,
// da klijent u međuvremenu ne zameni plan; ako ga je već zamenio, plana sa tim id-jem nema i stiže greška.
// changes: [{ id, grams }] samo izmenjene stavke.
export async function saveMealPlanGrams(planId, changes) {
  await setMealPlanLocked(planId, true);
  const results = await Promise.all(changes.map(({ id, grams }) =>
    supabase.from('meal_plan_items').update({ grams }).eq('id', id).eq('plan_id', planId).select('id')));
  if (results.some((r) => r.error || !r.data.length)) throw new Error('Gramaže nisu sačuvane.');
}

export async function setMealPlanLocked(planId, locked) {
  const rows = unwrap(await supabase.from('meal_plans').update({ locked }).eq('id', planId).select('id'));
  if (!rows.length) throw new Error('Plan nije pronađen.');
}

// Kvačice u rasponu datuma (YYYY-MM-DD), uključujući oba kraja.
export async function getMealChecks(from, to, forUserId) {
  const userId = forUserId ?? await currentUserId();
  const rows = unwrap(await supabase.from('meal_checks').select('date, meal_type, kcal, protein_g, carbs_g, fat_g')
    .eq('client_id', userId).gte('date', from).lte('date', to));
  return rows.map((r) => ({ date: r.date, mealType: r.meal_type, kcal: r.kcal, protein: r.protein_g, carbs: r.carbs_g, fat: r.fat_g }));
}

// totals = { kcal, protein, carbs, fat } obroka (snimak), ili null da se kvačica skine.
export async function setMealCheck(date, mealType, totals) {
  const userId = await currentUserId();
  if (!totals) {
    unwrap(await supabase.from('meal_checks').delete().eq('client_id', userId).eq('date', date).eq('meal_type', mealType));
    return;
  }
  const result = await supabase.from('meal_checks').insert({
    client_id: userId, date, meal_type: mealType,
    kcal: Math.round(totals.kcal), protein_g: Math.round(totals.protein), carbs_g: Math.round(totals.carbs), fat_g: Math.round(totals.fat),
  });
  if (result.error?.code === '23505') return; // već štiklirano (dupli dodir)
  unwrap(result);
}

// ---------- Ostalo ----------

function today() {
  return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD po lokalnom vremenu
}
