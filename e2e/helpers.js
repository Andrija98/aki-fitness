// Zajedničko za testove: pozivi ka Supabase-u, čišćenje e2e naloga i česti koraci kroz UI.

import { expect } from '@playwright/test';

export const ACCOUNT_A = { email: 'e2e-a@aki.test', passwordVar: 'E2E_A_PASSWORD' };
export const ACCOUNT_B = { email: 'e2e-b@aki.test', passwordVar: 'E2E_B_PASSWORD' };
export const ACCOUNT_TRAINER = { email: 'e2e-trener@aki.test', passwordVar: 'E2E_TRAINER_PASSWORD' };

// ID-jevi iz docs/supabase-seed.sql
export const LAGANO = 'c0000000-0000-4000-8000-000000000001';
export const SNAGA_KUCA = 'c0000000-0000-4000-8000-000000000002';
export const GORNJI = 'b0000000-0000-4000-8000-000000000001';
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

// Vraća nalog na stanje pre onboardinga. Radi kroz RLS, pa može da dira samo svoje redove.
export async function resetAccount(account) {
  if (!account.email.startsWith('e2e-')) throw new Error('Čišćenje je dozvoljeno samo za e2e naloge.');
  const { token, id } = await apiLogin(account);
  const writes = [
    rest(`sessions?user_id=eq.${id}`, { token, method: 'DELETE' }), // session_sets idu kaskadno
    rest(`weights?user_id=eq.${id}`, { token, method: 'DELETE' }),
    rest(`enrollments?user_id=eq.${id}`, { token, method: 'DELETE' }),
    rest(`profiles?id=eq.${id}`, {
      token,
      method: 'PATCH',
      body: { name: '', goal: null, location: null, level: null, per_week: null },
    }),
  ];
  for (const result of await Promise.all(writes)) {
    if (result.status >= 400) throw new Error(`Čišćenje nije uspelo: ${JSON.stringify(result)}`);
  }
  return { token, id };
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
