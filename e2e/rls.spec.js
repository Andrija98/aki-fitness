// Bezbednost baze: nalog B direktno gađa API, mimo filtera iz aplikacije.
// Ekran ovo ne može da proveri, jer api.js sam filtrira po user_id.

import { test, expect } from '@playwright/test';
import { ACCOUNT_A, ACCOUNT_B, ACCOUNT_TRAINER, LAGANO, GORNJI, SKLEKOVI, apiLogin, rest, resetAccount } from './helpers.js';

const DENIED = 403;
let a;
let b;
let trainer;
let sessionId;

test.beforeAll(async () => {
  a = await resetAccount(ACCOUNT_A);
  b = await apiLogin(ACCOUNT_B);
  trainer = await apiLogin(ACCOUNT_TRAINER);

  await rest(`profiles?id=eq.${a.id}`, { token: a.token, method: 'PATCH', body: { name: 'Vlasnik' } });
  await rest('weights', { token: a.token, method: 'POST', body: { user_id: a.id, date: '2000-01-02', kg: 70 } });
  const session = await rest('sessions', { token: a.token, method: 'POST', body: { program_id: LAGANO, workout_id: GORNJI, duration_sec: 60 } });
  sessionId = session.rows[0].id;
  await rest('session_sets', { token: a.token, method: 'POST', body: { session_id: sessionId, exercise_id: SKLEKOVI, set_no: 1, reps: 10 } });
  await rest('enrollments', { token: a.token, method: 'POST', body: { user_id: a.id, program_id: LAGANO } });
  await rest('measurements', { token: a.token, method: 'POST', body: { user_id: a.id, date: '2000-01-02', waist_cm: 80 } });
});

test.afterAll(() => resetAccount(ACCOUNT_A));

// Vlasnik mora da vidi podatke; inače bi "0 redova" kod napadača bilo lažno zeleno.
test('kontrola: vlasnik vidi svoje podatke', async () => {
  for (const path of [`profiles?id=eq.${a.id}`, `sessions?user_id=eq.${a.id}`, `session_sets?session_id=eq.${sessionId}`, `weights?user_id=eq.${a.id}`, `enrollments?user_id=eq.${a.id}`, `measurements?user_id=eq.${a.id}`]) {
    const result = await rest(path, { token: a.token });
    expect(result.rows, path).toHaveLength(1);
  }
});

test('drugi klijent ne može da čita tuđe podatke', async () => {
  for (const path of [`profiles?id=eq.${a.id}`, `sessions?user_id=eq.${a.id}`, `session_sets?session_id=eq.${sessionId}`, `weights?user_id=eq.${a.id}`, `enrollments?user_id=eq.${a.id}`, `measurements?user_id=eq.${a.id}`]) {
    const result = await rest(path, { token: b.token });
    expect(result.status, path).toBe(200);
    expect(result.rows, path).toEqual([]);
  }
});

test('drugi klijent bez filtera vidi samo svoj profil', async () => {
  const result = await rest('profiles?select=id', { token: b.token });
  expect(result.rows).toEqual([{ id: b.id }]);
});

test('neprijavljen korisnik ne dobija nijedan red', async () => {
  for (const table of ['profiles', 'sessions', 'session_sets', 'weights', 'enrollments', 'measurements', 'programs', 'exercises']) {
    const result = await rest(`${table}?select=*`);
    if (result.status === 200) expect(result.rows, table).toEqual([]);
    else expect(result.status, table).toBeGreaterThanOrEqual(400);
  }
});

test('drugi klijent ne može da upiše podatke u tuđe ime', async () => {
  const weight = await rest('weights', { token: b.token, method: 'POST', body: { user_id: a.id, date: '2000-01-01', kg: 99 } });
  expect(weight.status).toBe(DENIED);
  const session = await rest('sessions', { token: b.token, method: 'POST', body: { user_id: a.id, duration_sec: 1 } });
  expect(session.status).toBe(DENIED);
  const set = await rest('session_sets', { token: b.token, method: 'POST', body: { session_id: sessionId, exercise_id: SKLEKOVI, set_no: 2, reps: 1 } });
  expect(set.status).toBe(DENIED);
  const enrollment = await rest('enrollments', { token: b.token, method: 'POST', body: { user_id: a.id, program_id: LAGANO } });
  expect(enrollment.status).toBe(DENIED);
  const measurement = await rest('measurements', { token: b.token, method: 'POST', body: { user_id: a.id, date: '2000-01-01', waist_cm: 99 } });
  expect(measurement.status).toBe(DENIED);
});

test('niko osim vlasnika ne može da menja ni briše mere', async () => {
  for (const token of [b.token, trainer.token]) {
    const changed = await rest(`measurements?user_id=eq.${a.id}`, { token, method: 'PATCH', body: { waist_cm: 99 } });
    expect(changed.rows).toEqual([]);
    const removed = await rest(`measurements?user_id=eq.${a.id}`, { token, method: 'DELETE' });
    expect(removed.rows).toEqual([]);
  }
  const own = await rest(`measurements?user_id=eq.${a.id}&select=waist_cm`, { token: a.token });
  expect(own.rows).toEqual([{ waist_cm: 80 }]);
});

test('drugi klijent ne može da menja ni briše tuđe redove', async () => {
  const profile = await rest(`profiles?id=eq.${a.id}`, { token: b.token, method: 'PATCH', body: { name: 'hak' } });
  expect(profile.rows).toEqual([]);
  const removed = await rest(`sessions?id=eq.${sessionId}`, { token: b.token, method: 'DELETE' });
  expect(removed.rows).toEqual([]);

  const own = await rest(`profiles?id=eq.${a.id}&select=name`, { token: a.token });
  expect(own.rows).toEqual([{ name: 'Vlasnik' }]);
  const stillThere = await rest(`sessions?id=eq.${sessionId}&select=id`, { token: a.token });
  expect(stillThere.rows).toHaveLength(1);
});

test('klijent ne može sam sebi da da ulogu trenera', async () => {
  const result = await rest(`profiles?id=eq.${b.id}`, { token: b.token, method: 'PATCH', body: { role: 'trainer' } });
  expect(result.status).toBe(DENIED);
  const role = await rest(`profiles?id=eq.${b.id}&select=role`, { token: b.token });
  expect(role.rows).toEqual([{ role: 'client' }]);
});

test('trener čita podatke klijenta', async () => {
  for (const path of [`profiles?id=eq.${a.id}`, `sessions?user_id=eq.${a.id}`, `session_sets?session_id=eq.${sessionId}`, `weights?user_id=eq.${a.id}`, `enrollments?user_id=eq.${a.id}`, `measurements?user_id=eq.${a.id}`]) {
    const result = await rest(path, { token: trainer.token });
    expect(result.rows, path).toHaveLength(1);
  }
});

test('trener ne može da upisuje u ime klijenta', async () => {
  const weight = await rest('weights', { token: trainer.token, method: 'POST', body: { user_id: a.id, date: '2000-01-01', kg: 99 } });
  expect(weight.status).toBe(DENIED);
  const session = await rest('sessions', { token: trainer.token, method: 'POST', body: { user_id: a.id, duration_sec: 1 } });
  expect(session.status).toBe(DENIED);
  const set = await rest('session_sets', { token: trainer.token, method: 'POST', body: { session_id: sessionId, exercise_id: SKLEKOVI, set_no: 2, reps: 1 } });
  expect(set.status).toBe(DENIED);
  const measurement = await rest('measurements', { token: trainer.token, method: 'POST', body: { user_id: a.id, date: '2000-01-01', waist_cm: 99 } });
  expect(measurement.status).toBe(DENIED);
});

test('trener ne može da menja ni briše podatke klijenta', async () => {
  const profile = await rest(`profiles?id=eq.${a.id}`, { token: trainer.token, method: 'PATCH', body: { name: 'hak' } });
  expect(profile.rows).toEqual([]);
  const session = await rest(`sessions?id=eq.${sessionId}`, { token: trainer.token, method: 'DELETE' });
  expect(session.rows).toEqual([]);
  const weight = await rest(`weights?user_id=eq.${a.id}`, { token: trainer.token, method: 'DELETE' });
  expect(weight.rows).toEqual([]);

  const own = await rest(`profiles?id=eq.${a.id}&select=name`, { token: a.token });
  expect(own.rows).toEqual([{ name: 'Vlasnik' }]);
  const stillThere = await rest(`sessions?id=eq.${sessionId}&select=id`, { token: a.token });
  expect(stillThere.rows).toHaveLength(1);
});

test('trener može da menja sadržaj', async () => {
  const changed = await rest(`programs?id=eq.${LAGANO}`, { token: trainer.token, method: 'PATCH', body: { published: true } });
  expect(changed.status).toBe(200);
  expect(changed.rows).toHaveLength(1);
});

test('klijent ne može da doda novu vežbu', async () => {
  const created = await rest('exercises', { token: b.token, method: 'POST', body: { name: 'E2E hak' } });
  expect(created.status).toBe(DENIED);
});

test('klijent ne može da doda trening ni da menja vežbe u treningu', async () => {
  const workout = await rest('workouts', { token: b.token, method: 'POST', body: { title: 'E2E hak' } });
  expect(workout.status).toBe(DENIED);
  const item = await rest('workout_items', { token: b.token, method: 'POST', body: { workout_id: GORNJI, exercise_id: SKLEKOVI, position: 99, sets: 1, reps: 1 } });
  expect(item.status).toBe(DENIED);
  const removed = await rest(`workout_items?workout_id=eq.${GORNJI}`, { token: b.token, method: 'DELETE' });
  expect(removed.rows).toEqual([]);
});

test('video vežbe može da menja samo trener', async () => {
  const before = await rest(`exercises?id=eq.${SKLEKOVI}&select=video_url`, { token: b.token });
  expect(before.rows).toHaveLength(1);
  const current = before.rows[0].video_url;

  const byClient = await rest(`exercises?id=eq.${SKLEKOVI}`, { token: b.token, method: 'PATCH', body: { video_url: 'https://youtu.be/hakhakhak00' } });
  expect(byClient.rows).toEqual([]);

  // Trener upisuje istu vrednost koju je pročitao, da test ne menja pravi sadržaj.
  const byTrainer = await rest(`exercises?id=eq.${SKLEKOVI}`, { token: trainer.token, method: 'PATCH', body: { video_url: current } });
  expect(byTrainer.rows).toHaveLength(1);

  const after = await rest(`exercises?id=eq.${SKLEKOVI}&select=video_url`, { token: b.token });
  expect(after.rows).toEqual([{ video_url: current }]);
});

test('klijent ne može da menja sadržaj trenera', async () => {
  const created = await rest('programs', { token: b.token, method: 'POST', body: { title: 'hak', weeks: 1, per_week: 1 } });
  expect(created.status).toBe(DENIED);
  const changed = await rest(`programs?id=eq.${LAGANO}`, { token: b.token, method: 'PATCH', body: { published: true } });
  expect(changed.rows).toEqual([]);
});
