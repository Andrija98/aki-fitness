// DATA SLOJ: jedino mesto gde aplikacija čita i piše podatke.
//
// Sada: sadržaj (programi, treninzi) dolazi iz mockData.js, a korisnikovi podaci
// (profil, odrađeni treninzi, težina) iz localStorage-a na telefonu.
// Faza 2: zamenimo telo ovih funkcija Supabase pozivima. Ekrani se NE menjaju,
// zato su sve funkcije async (vraćaju Promise) već sada.

import { programs, workouts, exercises } from './mockData.js';
import { supabase } from '../lib/supabase.js';

const KEY = 'aki-fitness-v1';

function emptyState() {
  return { profile: null, activeProgramId: null, sessions: [], weights: [] };
}

function read() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s ? { ...emptyState(), ...s } : emptyState();
  } catch {
    return emptyState();
  }
}

function write(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

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

// callback(session) se zove pri svakoj promeni; vraća funkciju za odjavu slušaoca.
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

// ---------- Sadržaj (trener) ----------

export async function getPrograms() {
  return programs;
}

export async function getProgram(id) {
  return programs.find((p) => p.id === id) ?? null;
}

// Vraća trening sa "razmotanim" vežbama (ime, video, savet), spreman za prikaz.
export async function getWorkout(id) {
  const w = workouts[id];
  if (!w) return null;
  return {
    id,
    ...w,
    items: w.items.map((it) => ({ ...it, ...exercises[it.ex], exerciseId: it.ex })),
  };
}

// ---------- Korisnik ----------

export async function getProfile() {
  return read().profile;
}

export async function saveProfile(profile) {
  const s = read();
  const isNew = !s.profile;
  s.profile = { ...s.profile, ...profile, createdAt: s.profile?.createdAt ?? new Date().toISOString() };
  if (isNew && profile.weightKg) s.weights.push({ date: today(), kg: profile.weightKg });
  if (!s.activeProgramId) s.activeProgramId = suggestProgram(s.profile).id;
  write(s);
  return s.profile;
}

// Prvi predlog programa na osnovu onboardinga.
function suggestProgram(profile) {
  if (profile.location === 'teretana' && profile.level !== 'pocetnik') return programs.find((p) => p.id === 'masa');
  if (profile.goal === 'kondicija') return programs.find((p) => p.id === 'pauza');
  if (profile.goal === 'snaga') return programs.find((p) => p.id === 'snaga-kuca');
  return programs[0];
}

export async function getActiveProgramId() {
  return read().activeProgramId;
}

export async function setActiveProgram(programId) {
  const s = read();
  s.activeProgramId = programId;
  write(s);
}

// ---------- Odrađeni treninzi ----------

// session = { programId, workoutId, durationSec, sets: [{ exerciseId, setNo, reps, kg, seconds }] }
export async function saveSession(session) {
  const s = read();
  const saved = { id: uid(), date: new Date().toISOString(), ...session };
  s.sessions.push(saved);
  write(s);
  return saved;
}

export async function getSessions() {
  return read().sessions;
}

// Poslednji put kad je vežba rađena: za predlog kilaže.
export async function getLastSets(exerciseId) {
  const sessions = read().sessions;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const sets = sessions[i].sets.filter((x) => x.exerciseId === exerciseId);
    if (sets.length) return sets;
  }
  return [];
}

// Napredak kroz program: koliko je treninga odrađeno i koji je sledeći.
export async function getProgramProgress(programId) {
  const program = await getProgram(programId);
  if (!program) return null;
  const done = read().sessions.filter((x) => x.programId === programId).length;
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
  return read().weights;
}

export async function addWeight(kg) {
  const s = read();
  const d = today();
  s.weights = s.weights.filter((w) => w.date !== d);
  s.weights.push({ date: d, kg });
  s.weights.sort((a, b) => a.date.localeCompare(b.date));
  write(s);
}

// ---------- Ostalo ----------

export async function resetAll() {
  localStorage.removeItem(KEY);
}

function today() {
  return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD po lokalnom vremenu
}
