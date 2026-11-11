// Bezbednost baze: nalog B direktno gađa API, mimo filtera iz aplikacije.
// Ekran ovo ne može da proveri, jer api.js sam filtrira po user_id.

import { test, expect } from '@playwright/test';
import { ACCOUNT_A, ACCOUNT_B, ACCOUNT_TRAINER, LAGANO, GORNJI, SKLEKOVI, apiLogin, rest, resetAccount, subscribeToMessages, storage, listPhotos } from './helpers.js';

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

test.describe('poruke', () => {
  let clientMessageId;
  let trainerMessageId;

  test.beforeAll(async () => {
    await rest('rpc/e2e_clear_messages', { token: a.token, method: 'POST', body: {} });
    clientMessageId = (await rest('messages', { token: a.token, method: 'POST', body: { client_id: a.id, body: 'Poruka vlasnika' } })).rows[0].id;
    trainerMessageId = (await rest('messages', { token: trainer.token, method: 'POST', body: { client_id: a.id, body: 'Od trenera' } })).rows[0].id;
  });

  test('vlasnik i trener vide razgovor, drugi klijent ne', async () => {
    expect((await rest(`messages?client_id=eq.${a.id}`, { token: a.token })).rows).toHaveLength(2);
    expect((await rest(`messages?client_id=eq.${a.id}`, { token: trainer.token })).rows).toHaveLength(2);
    expect((await rest(`messages?client_id=eq.${a.id}`, { token: b.token })).rows).toEqual([]);
  });

  test('niko ne piše u tuđi razgovor ni u tuđe ime', async () => {
    const intoOther = await rest('messages', { token: b.token, method: 'POST', body: { client_id: a.id, body: 'hak' } });
    expect(intoOther.status).toBe(DENIED);
    const asOther = await rest('messages', { token: b.token, method: 'POST', body: { client_id: b.id, sender_id: a.id, body: 'hak' } });
    expect(asOther.status).toBe(DENIED);
  });

  test('tekst poruke se ne menja, a pročitano označava samo primalac', async () => {
    const edited = await rest(`messages?id=eq.${trainerMessageId}`, { token: a.token, method: 'PATCH', body: { body: 'izmenjeno' } });
    expect(edited.status).toBeGreaterThanOrEqual(400);

    const ownRead = await rest(`messages?id=eq.${clientMessageId}`, { token: a.token, method: 'PATCH', body: { read_at: new Date().toISOString() } });
    expect(ownRead.rows).toEqual([]);
    const otherRead = await rest(`messages?id=eq.${trainerMessageId}`, { token: b.token, method: 'PATCH', body: { read_at: new Date().toISOString() } });
    expect(otherRead.rows).toEqual([]);
    const read = await rest(`messages?id=eq.${trainerMessageId}`, { token: a.token, method: 'PATCH', body: { read_at: new Date().toISOString() } });
    expect(read.rows).toHaveLength(1);

    const texts = await rest(`messages?client_id=eq.${a.id}&select=body&order=created_at`, { token: a.token });
    expect(texts.rows).toEqual([{ body: 'Poruka vlasnika' }, { body: 'Od trenera' }]);
  });

  test('poruke se ne brišu', async () => {
    const removed = await rest(`messages?client_id=eq.${a.id}`, { token: a.token, method: 'DELETE' });
    expect(removed.status >= 400 || removed.rows.length === 0).toBe(true);
    expect((await rest(`messages?client_id=eq.${a.id}`, { token: a.token })).rows).toHaveLength(2);
  });

  // Da funkcija ne radi ništa za ne-e2e naloge, vidi se u SQL-u; test nalogom to ne može da se proveri.
  test('čišćenje za testove briše samo poruke pozivaoca', async () => {
    const cleared = await rest('rpc/e2e_clear_messages', { token: b.token, method: 'POST', body: {} });
    expect(cleared.status).toBeLessThan(400);
    expect((await rest(`messages?client_id=eq.${a.id}`, { token: a.token })).rows).toHaveLength(2);
  });

  test('Realtime ne šalje tuđe poruke drugom klijentu', async () => {
    const spy = await subscribeToMessages(b);
    const control = await subscribeToMessages(trainer); // kontrola: trener mora da dobije poruku, inače test ništa ne dokazuje
    try {
      await rest('messages', { token: a.token, method: 'POST', body: { client_id: a.id, body: 'Tajna poruka' } });
      // Realtime posle mirovanja ponovo pokreće vezu sa bazom, pa prva poruka može da kasni: zato 20 s.
      await expect.poll(() => control.received.length, {
        timeout: 20_000, message: 'Kontrola: trener nije dobio poruku preko Realtime-a (spora veza, ne bezbednosni problem)',
      }).toBe(1);
      await new Promise((r) => setTimeout(r, 1500));
      expect(spy.received, 'BEZBEDNOST: drugi klijent je dobio tuđu poruku preko Realtime-a').toEqual([]);
    } finally {
      await spy.close();
      await control.close();
    }
  });
});

test.describe('dnevni cilj ishrane', () => {
  test.beforeAll(async () => {
    await rest(`nutrition_targets?client_id=eq.${a.id}`, { token: trainer.token, method: 'DELETE' });
    await rest('nutrition_targets', { token: trainer.token, method: 'POST', body: { client_id: a.id, kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 } });
  });
  test.afterAll(() => rest(`nutrition_targets?client_id=eq.${a.id}`, { token: trainer.token, method: 'DELETE' }));

  test('klijent i trener vide cilj, drugi klijent ne', async () => {
    expect((await rest(`nutrition_targets?client_id=eq.${a.id}`, { token: a.token })).rows).toHaveLength(1);
    expect((await rest(`nutrition_targets?client_id=eq.${a.id}`, { token: trainer.token })).rows).toHaveLength(1);
    expect((await rest(`nutrition_targets?client_id=eq.${a.id}`, { token: b.token })).rows).toEqual([]);
  });

  test('klijent ne može sam da menja ni postavi cilj', async () => {
    const changed = await rest(`nutrition_targets?client_id=eq.${a.id}`, { token: a.token, method: 'PATCH', body: { kcal: 5000 } });
    expect(changed.rows).toEqual([]);
    const removed = await rest(`nutrition_targets?client_id=eq.${a.id}`, { token: a.token, method: 'DELETE' });
    expect(removed.rows).toEqual([]);
    const created = await rest('nutrition_targets', { token: b.token, method: 'POST', body: { client_id: b.id, kcal: 5000, protein_g: 1, carbs_g: 1, fat_g: 1 } });
    expect(created.status).toBe(DENIED);
    expect((await rest(`nutrition_targets?client_id=eq.${a.id}&select=kcal`, { token: a.token })).rows).toEqual([{ kcal: 2000 }]);
  });

  test('podatke o telu klijent menja samo sebi', async () => {
    const own = await rest(`profiles?id=eq.${b.id}`, { token: b.token, method: 'PATCH', body: { height_cm: 180 } });
    expect(own.rows).toHaveLength(1);
    const other = await rest(`profiles?id=eq.${a.id}`, { token: b.token, method: 'PATCH', body: { height_cm: 100 } });
    expect(other.rows).toEqual([]);
    await rest(`profiles?id=eq.${b.id}`, { token: b.token, method: 'PATCH', body: { height_cm: null } });
  });
});

test('namirnice i strukturu obroka klijent čita, ali ne menja', async () => {
  const foods = await rest('foods?select=id&limit=1', { token: b.token });
  expect(foods.status).toBe(200);
  const templates = await rest('meal_templates?select=meal_type', { token: b.token });
  expect(templates.rows.length).toBeGreaterThan(0);

  const created = await rest('foods', { token: b.token, method: 'POST', body: { name: 'E2E hak', food_group: 'protein', kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0 } });
  expect(created.status).toBe(DENIED);
  const changed = await rest('meal_templates?meal_type=eq.rucak', { token: b.token, method: 'PATCH', body: { share_pct: 99 } });
  expect(changed.rows).toEqual([]);
});

test('izbor namirnica: svako svoj, trener čita', async () => {
  const anyFood = (await rest('foods?select=id&limit=1', { token: trainer.token })).rows[0];
  test.skip(!anyFood, 'Nema nijedne namirnice u bazi');
  await rest(`food_preferences?client_id=eq.${a.id}`, { token: a.token, method: 'DELETE' });
  const own = await rest('food_preferences', { token: a.token, method: 'POST', body: { client_id: a.id, food_id: anyFood.id } });
  expect(own.status).toBe(201);

  expect((await rest(`food_preferences?client_id=eq.${a.id}`, { token: trainer.token })).rows).toHaveLength(1);
  expect((await rest(`food_preferences?client_id=eq.${a.id}`, { token: b.token })).rows).toEqual([]);
  const intoOther = await rest('food_preferences', { token: b.token, method: 'POST', body: { client_id: a.id, food_id: anyFood.id } });
  expect(intoOther.status).toBe(DENIED);
  const removeOther = await rest(`food_preferences?client_id=eq.${a.id}`, { token: b.token, method: 'DELETE' });
  expect(removeOther.rows).toEqual([]);
  await rest(`food_preferences?client_id=eq.${a.id}`, { token: a.token, method: 'DELETE' });
});

test.describe('plan ishrane', () => {
  let food;
  let planId;
  const newPlan = (account, extra = {}) => rest('meal_plans', { token: account.token, method: 'POST', body: {
    client_id: a.id, target: { kcal: 2000, protein: 150, carbs: 200, fat: 60 }, inputs_key: 'e2e', ...extra,
  } });
  const item = (plan) => ({ plan_id: plan, weekday: 0, meal_type: 'rucak', food_id: food.id, grams: 100 });

  test.beforeAll(async () => {
    food = (await rest('foods?select=id&limit=1', { token: trainer.token })).rows[0];
    await rest(`meal_plans?client_id=eq.${a.id}`, { token: a.token, method: 'DELETE' });
    if (!food) return;
    planId = (await newPlan(a)).rows[0].id;
    await rest('meal_plan_items', { token: a.token, method: 'POST', body: item(planId) });
  });
  // Ako test padne dok je plan zaključan, resetAccount u afterAll ovog fajla ga otključa i obriše.

  test('vlasnik i trener vide plan, drugi klijent ne', async () => {
    test.skip(!food, 'Nema nijedne namirnice u bazi');
    expect((await rest(`meal_plans?id=eq.${planId}&select=id,meal_plan_items(grams)`, { token: a.token })).rows[0].meal_plan_items).toHaveLength(1);
    expect((await rest(`meal_plan_items?plan_id=eq.${planId}`, { token: trainer.token })).rows).toHaveLength(1);
    expect((await rest(`meal_plans?client_id=eq.${a.id}`, { token: b.token })).rows).toEqual([]);
    expect((await rest(`meal_plan_items?plan_id=eq.${planId}`, { token: b.token })).rows).toEqual([]);
  });

  test('niko ne piše u tuđi plan, a klijent ne može sam da zaključa', async () => {
    test.skip(!food, 'Nema nijedne namirnice u bazi');
    expect((await newPlan(b)).status).toBe(DENIED);
    expect((await rest('meal_plan_items', { token: b.token, method: 'POST', body: item(planId) })).status).toBe(DENIED);
    expect((await newPlan(a, { locked: true })).status).toBe(DENIED);
    expect((await rest(`meal_plans?id=eq.${planId}`, { token: a.token, method: 'PATCH', body: { locked: true } })).rows).toEqual([]);
    expect((await rest(`meal_plan_items?plan_id=eq.${planId}`, { token: a.token, method: 'PATCH', body: { grams: 999 } })).rows).toEqual([]);
    expect((await rest(`meal_plans?id=eq.${planId}`, { token: b.token, method: 'DELETE' })).rows).toEqual([]);
  });

  test('zaključan plan klijent ne može da zameni ni obriše, a trener menja grame', async () => {
    test.skip(!food, 'Nema nijedne namirnice u bazi');
    expect((await rest(`meal_plans?id=eq.${planId}`, { token: trainer.token, method: 'PATCH', body: { locked: true } })).rows).toHaveLength(1);
    expect((await newPlan(a)).status).toBe(DENIED);
    expect((await rest('meal_plan_items', { token: a.token, method: 'POST', body: item(planId) })).status).toBe(DENIED);
    expect((await rest(`meal_plans?id=eq.${planId}`, { token: a.token, method: 'DELETE' })).rows).toEqual([]);
    const edited = await rest(`meal_plan_items?plan_id=eq.${planId}`, { token: trainer.token, method: 'PATCH', body: { grams: 150 } });
    expect(edited.rows.map((r) => r.grams)).toEqual([150]);
    await rest(`meal_plans?id=eq.${planId}`, { token: trainer.token, method: 'PATCH', body: { locked: false } });
  });

  test('pomoćne funkcije ne odaju tuđe planove', async () => {
    // Neprijavljen ne može da ih pozove, a verzija koja prima tuđi id ne postoji.
    expect((await rest('rpc/meal_plan_locked', { method: 'POST', body: {} })).status).toBeGreaterThanOrEqual(400);
    expect((await rest('rpc/meal_plan_locked', { token: b.token, method: 'POST', body: { uid: a.id } })).status).toBe(404);
    expect((await rest('rpc/meal_plan_locked', { token: b.token, method: 'POST', body: {} })).rows).toBe(false);
  });

  test('kvačice: svako svoje, ne za budućnost, trener čita', async () => {
    const check = (account, date) => rest('meal_checks', { token: account.token, method: 'POST', body: {
      client_id: a.id, date, meal_type: 'rucak', kcal: 500, protein_g: 40, carbs_g: 50, fat_g: 15,
    } });
    expect((await check(a, '2000-01-03')).status).toBe(201);
    expect((await check(a, '2999-01-01')).status).toBe(DENIED);
    expect((await check(b, '2000-01-04')).status).toBe(DENIED);
    expect((await rest(`meal_checks?client_id=eq.${a.id}`, { token: trainer.token })).rows).toHaveLength(1);
    expect((await rest(`meal_checks?client_id=eq.${a.id}`, { token: b.token })).rows).toEqual([]);
    expect((await rest(`meal_checks?client_id=eq.${a.id}`, { token: b.token, method: 'DELETE' })).rows).toEqual([]);
    expect((await rest(`meal_checks?client_id=eq.${a.id}`, { token: trainer.token, method: 'DELETE' })).rows).toEqual([]);
  });
});

test('fotografije napretka: fajl i red vidi samo vlasnik i trener, menja samo vlasnik', async () => {
  const path = `${a.id}/e2e-rls.jpg`;
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); // najkraći JPEG okvir; Storage proverava tip iz zaglavlja
  expect((await storage(`object/progress-photos/${path}`, { token: a.token, method: 'POST', body: bytes })).status).toBe(200);
  expect((await rest('progress_photos', { token: a.token, method: 'POST', body: { user_id: a.id, path } })).status).toBe(201);
  const read = (token) => storage(`object/authenticated/progress-photos/${path}`, { token });

  expect((await read(a.token)).status).toBe(200);
  expect((await read(trainer.token)).status).toBe(200);
  expect((await read(b.token)).status).not.toBe(200);
  expect((await read(undefined)).status).not.toBe(200);
  expect(await listPhotos(b.token, a.id)).toEqual([]);
  expect((await rest(`progress_photos?user_id=eq.${a.id}`, { token: b.token })).rows).toEqual([]);
  expect((await rest(`progress_photos?user_id=eq.${a.id}`, { token: trainer.token })).rows).toHaveLength(1);

  // Upis u tuđ folder, red koji pokazuje na tuđ fajl i brisanje tuđeg: ne prolaze.
  expect((await storage(`object/progress-photos/${a.id}/e2e-hak.jpg`, { token: b.token, method: 'POST', body: bytes })).status).not.toBe(200);
  expect((await rest('progress_photos', { token: b.token, method: 'POST', body: { user_id: b.id, path } })).status).toBeGreaterThanOrEqual(400);
  for (const token of [b.token, trainer.token]) {
    await storage('object/progress-photos', { token, method: 'DELETE', body: { prefixes: [path] } });
    expect((await rest(`progress_photos?user_id=eq.${a.id}`, { token, method: 'DELETE' })).rows).toEqual([]);
  }
  expect((await read(a.token)).status).toBe(200);
  expect(await listPhotos(a.token, a.id)).toEqual([path]);
  await resetAccount(ACCOUNT_A); // briše i fajl i red
  expect(await listPhotos(a.token, a.id)).toEqual([]);
});

test('fotografije u porukama: samo učesnici razgovora, prilog samo iz tog razgovora', async () => {
  const path = `${a.id}/e2e-poruka.jpg`;
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const upload = (token, p) => storage(`object/message-photos/${p}`, { token, method: 'POST', body: bytes });
  const read = (token) => storage(`object/authenticated/message-photos/${path}`, { token });
  const send = (account, body) => rest('messages', { token: account.token, method: 'POST', body: { client_id: a.id, ...body } });

  expect((await upload(a.token, path)).status).toBe(200);
  expect((await send(a, { body: '', attachment_path: path })).status).toBe(201); // sa fotografijom tekst nije obavezan
  expect((await read(a.token)).status).toBe(200);
  expect((await read(trainer.token)).status).toBe(200);
  expect((await read(b.token)).status).not.toBe(200);
  expect((await read(undefined)).status).not.toBe(200);

  expect((await upload(b.token, `${a.id}/e2e-hak.jpg`)).status).not.toBe(200);
  expect((await send(a, { body: '' })).status).toBeGreaterThanOrEqual(400); // ni teksta ni fotografije
  expect((await send(a, { body: 'tuđ prilog', attachment_path: `${b.id}/x.jpg` })).status).toBeGreaterThanOrEqual(400);
  // Prilog se ne menja naknadno (izmena je dozvoljena samo za read_at).
  const changed = await rest(`messages?client_id=eq.${a.id}`, { token: a.token, method: 'PATCH', body: { attachment_path: `${a.id}/drugi.jpg` } });
  expect(changed.status).toBeGreaterThanOrEqual(400);
  await storage('object/message-photos', { token: b.token, method: 'DELETE', body: { prefixes: [path] } });
  expect((await read(a.token)).status).toBe(200);

  await resetAccount(ACCOUNT_A); // e2e nalog briše svoje fajlove i poruke
  // Proverava se lista, ne čitanje: Supabase CDN još kratko vraća obrisan fajl iz keša onome ko ga je već čitao.
  const left = await storage('object/list/message-photos', { token: trainer.token, method: 'POST', body: { prefix: a.id } });
  expect(left.json).toEqual([]);
});

test('članarina: klijent samo čita svoje uplate, drugi ih ne vidi, trener evidentira', async () => {
  const payment = { client_id: a.id, paid_on: '2000-01-01', amount_rsd: 100, months: 1, period_end: '2000-01-31' };
  expect((await rest('membership_payments', { token: a.token, method: 'POST', body: payment })).status).toBe(DENIED); // sam sebi
  expect((await rest('membership_payments', { token: b.token, method: 'POST', body: payment })).status).toBe(DENIED);
  const created = await rest('membership_payments', { token: trainer.token, method: 'POST', body: payment });
  expect(created.status).toBe(201);
  const id = created.rows[0].id;
  try {
    expect((await rest(`membership_payments?client_id=eq.${a.id}`, { token: a.token })).rows).toHaveLength(1);
    expect((await rest(`membership_payments?client_id=eq.${a.id}`, { token: b.token })).rows).toEqual([]);
    expect((await rest(`membership_payments?client_id=eq.${a.id}`)).rows).toEqual([]); // neprijavljen
    // Klijent ne može da produži ni obriše svoju uplatu.
    expect((await rest(`membership_payments?id=eq.${id}`, { token: a.token, method: 'PATCH', body: { period_end: '2999-01-01' } })).rows).toEqual([]);
    expect((await rest(`membership_payments?id=eq.${id}`, { token: a.token, method: 'DELETE' })).rows).toEqual([]);
  } finally {
    await rest(`membership_payments?id=eq.${id}`, { token: trainer.token, method: 'DELETE' });
  }
});

test('podatke za uplatu čitaju prijavljeni, a menja samo trener', async () => {
  expect((await rest('billing_settings?select=id', { token: a.token })).rows).toHaveLength(1);
  expect((await rest('billing_settings?select=id')).rows).toEqual([]); // neprijavljen ne vidi račun
  expect((await rest('billing_settings?id=eq.1', { token: a.token, method: 'PATCH', body: { price_rsd: 1 } })).rows).toEqual([]);
  expect((await rest('billing_settings', { token: a.token, method: 'POST', body: { id: 2 } })).status).toBeGreaterThanOrEqual(400);
  // Trener sme da menja; menja se samo vreme izmene, da test ne dira prave podatke za uplatu.
  const touched = await rest('billing_settings?id=eq.1', { token: trainer.token, method: 'PATCH', body: { updated_at: new Date().toISOString() } });
  expect(touched.rows).toHaveLength(1);
});

test('pristanak na privatnost menja samo vlasnik', async () => {
  const changed = await rest(`profiles?id=eq.${a.id}`, { token: b.token, method: 'PATCH', body: { privacy_accepted_at: null } });
  expect(changed.rows).toEqual([]);
  const trainerChanged = await rest(`profiles?id=eq.${a.id}`, { token: trainer.token, method: 'PATCH', body: { privacy_accepted_at: null } });
  expect(trainerChanged.rows).toEqual([]);
});

test('klijent ne može da menja raspored programa', async () => {
  const added = await rest('program_schedule', { token: b.token, method: 'POST', body: { program_id: LAGANO, position: 99, workout_id: GORNJI } });
  expect(added.status).toBe(DENIED);
  const removed = await rest(`program_schedule?program_id=eq.${LAGANO}`, { token: b.token, method: 'DELETE' });
  expect(removed.rows).toEqual([]);
});

test('klijent ne može da menja sadržaj trenera', async () => {
  const created = await rest('programs', { token: b.token, method: 'POST', body: { title: 'hak', weeks: 1, per_week: 1 } });
  expect(created.status).toBe(DENIED);
  const changed = await rest(`programs?id=eq.${LAGANO}`, { token: b.token, method: 'PATCH', body: { published: true } });
  expect(changed.rows).toEqual([]);
});
