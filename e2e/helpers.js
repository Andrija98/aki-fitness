// Zajedničko za testove: pozivi ka Supabase-u, čišćenje e2e naloga i česti koraci kroz UI.

import { expect } from '@playwright/test';
import { PRIVACY_VERSION } from '../src/config.js';

export const ACCOUNT_A = { email: 'e2e-a@aki.test', passwordVar: 'E2E_A_PASSWORD' };
export const ACCOUNT_B = { email: 'e2e-b@aki.test', passwordVar: 'E2E_B_PASSWORD' };
export const ACCOUNT_TRAINER = { email: 'e2e-trener@aki.test', passwordVar: 'E2E_TRAINER_PASSWORD' };

// ID-jevi iz docs/supabase-seed.sql
export const LAGANO = 'c0000000-0000-4000-8000-000000000001';
export const SNAGA_KUCA = 'c0000000-0000-4000-8000-000000000002';
export const GORNJI = 'b0000000-0000-4000-8000-000000000001';
export const KARDIO = 'b0000000-0000-4000-8000-000000000003';
export const SKLEKOVI = 'e0000000-0000-4000-8000-000000000004';

const baseUrl = () => process.env.VITE_SUPABASE_URL;
const anonKey = () => process.env.VITE_SUPABASE_ANON_KEY;

export function passwordOf(account) {
  const password = process.env[account.passwordVar];
  if (!password) throw new Error(`Nedostaje ${account.passwordVar} u .env.test.local`);
  return password;
}

// Prijava preko API-ja, bez browsera. Vraća { token, id }.
export async function apiLogin(account) {
  const res = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: passwordOf(account) }),
  });
  if (!res.ok) throw new Error(`Prijava ${account.email} nije uspela: ${res.status}`);
  const body = await res.json();
  return { token: body.access_token, refreshToken: body.refresh_token, id: body.user.id };
}

// Poziv ka bazi. Bez tokena ide kao neprijavljen korisnik.
export async function rest(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: anonKey(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, rows: text ? JSON.parse(text) : null };
}

// Poziv ka Supabase Storage-u (fotografije). body: Buffer za upload ili objekat za JSON.
export async function storage(path, { token, method = 'GET', body, contentType } = {}) {
  const isFile = body instanceof Uint8Array;
  const res = await fetch(`${baseUrl()}/storage/v1/${path}`, {
    method,
    headers: {
      apikey: anonKey(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': isFile ? (contentType ?? 'image/jpeg') : 'application/json' } : {}),
    },
    body: body ? (isFile ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: res.status, json };
}

// Imena fajlova u folderu korisnika u bucketu fotografija.
export async function listPhotos(token, userId) {
  const { json } = await storage('object/list/progress-photos', { token, method: 'POST', body: { prefix: userId, limit: 1000 } });
  return (json ?? []).map((o) => `${userId}/${o.name}`);
}

// Fotografije iz poruka koje je ovaj e2e nalog poslao, u svim razgovorima koje vidi (klijent: svoj, trener: sve).
// Polisa dozvoljava brisanje samo e2e nalozima i samo sopstvenih fajlova, pa tuđi fajlovi ostaju netaknuti.
export async function clearMessagePhotos(token) {
  const list = async (prefix) => (await storage('object/list/message-photos', { token, method: 'POST', body: { prefix, limit: 1000 } })).json ?? [];
  const folders = (await list('')).filter((o) => o.id === null).map((o) => o.name);
  for (const folder of folders) {
    const files = (await list(folder)).map((o) => `${folder}/${o.name}`);
    if (files.length) await storage('object/message-photos', { token, method: 'DELETE', body: { prefixes: files } });
  }
}

// Vraća nalog na stanje pre onboardinga. Radi kroz RLS, pa može da dira samo svoje redove.
export async function resetAccount(account) {
  if (!account.email.startsWith('e2e-')) throw new Error('Čišćenje je dozvoljeno samo za e2e naloge.');
  const { token, id } = await apiLogin(account);
  const writes = [
    rest(`sessions?user_id=eq.${id}`, { token, method: 'DELETE' }), // session_sets idu kaskadno
    rest(`weights?user_id=eq.${id}`, { token, method: 'DELETE' }),
    rest(`enrollments?user_id=eq.${id}`, { token, method: 'DELETE' }),
    rest(`measurements?user_id=eq.${id}`, { token, method: 'DELETE' }),
    rest(`food_preferences?client_id=eq.${id}`, { token, method: 'DELETE' }),
    rest(`meal_checks?client_id=eq.${id}`, { token, method: 'DELETE' }),
    rest(`progress_photos?user_id=eq.${id}`, { token, method: 'DELETE' }),
    rest(`meal_plans?client_id=eq.${id}`, { token, method: 'DELETE' }), // stavke idu kaskadno; zaključan plan ostaje (vidi ispod)
    rest('rpc/e2e_clear_messages', { token, method: 'POST', body: {} }), // radi samo za e2e naloge (docs/supabase-messages.sql)
    rest(`profiles?id=eq.${id}`, {
      token,
      method: 'PATCH',
      // Pristanak ostaje upisan, da svaki test ne prolazi kroz taj ekran (testovi pristanka ga brišu sami).
      body: {
        name: '', goal: null, location: null, level: null, per_week: null, sex: null, birth_year: null, height_cm: null, activity: null,
        privacy_accepted_at: new Date().toISOString(), privacy_version: PRIVACY_VERSION,
      },
    }),
  ];
  // Fajlovi fotografija nisu u bazi, pa se brišu posebno (redovi idu u writes ispod).
  const files = await listPhotos(token, id);
  if (files.length) {
    const removed = await storage('object/progress-photos', { token, method: 'DELETE', body: { prefixes: files } });
    if (removed.status >= 400) throw new Error(`Čišćenje fotografija nije uspelo: ${JSON.stringify(removed)}`);
  }
  await clearMessagePhotos(token);
  for (const result of await Promise.all(writes)) {
    if (result.status >= 400) throw new Error(`Čišćenje nije uspelo: ${JSON.stringify(result)}`);
  }
  // Zaključan plan klijent ne sme da obriše: trener ga otključa, pa ga klijent obriše.
  const left = await rest(`meal_plans?client_id=eq.${id}&select=id`, { token });
  if (left.rows?.length) {
    const trainer = await apiLogin(ACCOUNT_TRAINER);
    await rest(`meal_plans?client_id=eq.${id}`, { token: trainer.token, method: 'PATCH', body: { locked: false } });
    const removed = await rest(`meal_plans?client_id=eq.${id}`, { token, method: 'DELETE' });
    if (removed.status >= 400 || removed.rows.length !== left.rows.length) throw new Error('Čišćenje plana ishrane nije uspelo.');
  }
  return { token, id };
}

// Realtime pretplata na nove poruke iz Node-a, kao određeni korisnik. Vraća { received, close }.
export async function subscribeToMessages(session) {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(baseUrl(), anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  await client.auth.setSession({ access_token: session.token, refresh_token: session.refreshToken });
  client.realtime.setAuth(session.token);
  const received = [];
  await new Promise((resolve, reject) => {
    client.channel(`e2e-${Math.random()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => received.push(p.new))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`Realtime: ${status}`));
      });
  });
  return { received, close: () => client.removeAllChannels() };
}

// Presreće promenu lozinke, da test ne promeni pravu lozinku naloga. Vraća objekat u koji upisuje šta je poslato.
export async function mockPasswordUpdate(page, account) {
  const captured = {};
  await page.route('**/auth/v1/user*', (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    captured.password = route.request().postDataJSON().password;
    return route.fulfill({
      status: 200,
      json: { id: account.id, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    });
  });
  return captured;
}

// ---------- Koraci kroz UI ----------

export async function loginUi(page, account, password = passwordOf(account)) {
  await page.goto('/');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Lozinka').fill(password);
  await page.getByRole('button', { name: 'Prijavi se' }).click();
}

export async function finishOnboarding(page, { weight } = {}) {
  await page.getByLabel('Ime').fill('Tester');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Nastavi' }).click();
  if (weight) await page.getByLabel('Težina (kg)').fill(weight);
  await page.getByRole('button', { name: 'Kreni sa treningom' }).click();
  await expect(page.getByRole('heading', { name: 'Zdravo, Tester' })).toBeVisible();
}

export async function expectExercise(page, number, total = 5) {
  await expect(page.getByText(`Vežba ${number} od ${total}`)).toBeVisible();
}

export async function skipExercise(page, nextNumber) {
  await page.getByRole('button', { name: 'Preskoči vežbu' }).click();
  await expectExercise(page, nextNumber);
}

// Završi seriju koja nije poslednja, pa preskoči pauzu koja se tada pojavi.
export async function completeSetAndSkipRest(page) {
  await page.getByRole('button', { name: 'Završi seriju' }).click();
  await page.getByRole('dialog', { name: 'Pauza' }).getByRole('button', { name: 'Preskoči' }).click();
}
