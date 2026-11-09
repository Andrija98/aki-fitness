// Glavni tokovi klijenta kroz pravi UI i pravu bazu, nalogom e2e-a.

import { test, expect } from '@playwright/test';
import {
  ACCOUNT_A, ACCOUNT_TRAINER, LAGANO, SNAGA_KUCA, GORNJI, rest, resetAccount, loginUi, finishOnboarding,
  expectExercise, skipExercise, completeSetAndSkipRest, mockPasswordUpdate,
} from './helpers.js';

const loginHeading = (page) => page.getByRole('heading', { name: 'Prijavi se' });

test.describe('bez naloga', () => {
  test('neprijavljen korisnik vidi samo login, i na direktnoj adresi', async ({ page }) => {
    await page.goto('/#/profil');
    await expect(loginHeading(page)).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });

  test('pogrešna lozinka daje poruku i ostaje na loginu', async ({ page }) => {
    await loginUi(page, ACCOUNT_A, 'namerno-pogresna-lozinka');
    await expect(page.getByRole('alert')).toHaveText('Pogrešan email ili lozinka.');
    await expect(loginHeading(page)).toBeVisible();
  });
});

test.describe('zaboravljena lozinka', () => {
  const SENT = 'Ako nalog postoji, poslali smo link na taj email.';

  // Svi zahtevi su presretnuti: testovi ne šalju prave mejlove i ne troše limit.
  async function requestLink(page, response) {
    let requested = null;
    await page.route('**/auth/v1/recover*', (route) => {
      requested = route.request().postDataJSON();
      return route.fulfill(response);
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Zaboravljena lozinka?' }).click();
    await page.getByLabel('Email').fill(ACCOUNT_A.email);
    await page.getByRole('button', { name: 'Pošalji link' }).click();
    return () => requested;
  }

  test('postojeći nalog dobija potvrdu', async ({ page }) => {
    const requested = await requestLink(page, { status: 200, json: {} });
    await expect(page.getByRole('status')).toHaveText(SENT);
    expect(requested().email).toBe(ACCOUNT_A.email);
  });

  test('nedozvoljena adresa dobija istu poruku, bez otkrivanja naloga', async ({ page }) => {
    await requestLink(page, { status: 400, json: { code: 400, error_code: 'email_address_not_authorized', msg: 'Email address not authorized' } });
    await expect(page.getByRole('status')).toHaveText(SENT);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('previše zahteva daje poruku o čekanju', async ({ page }) => {
    await requestLink(page, { status: 429, json: { code: 429, error_code: 'over_email_send_rate_limit', msg: 'rate limit' } });
    await expect(page.getByRole('alert')).toHaveText('Previše pokušaja. Sačekaj malo pa probaj ponovo.');
  });

  test('istekao link vraća na login sa porukom', async ({ page }) => {
    await page.goto('/#error=access_denied&error_code=otp_expired&error_description=expired');
    await expect(loginHeading(page)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText('Link je istekao ili je već iskorišćen. Zatraži novi.');
  });

  test('link iz mejla traži novu lozinku pre ulaska u aplikaciju', async ({ page }) => {
    const account = await resetAccount(ACCOUNT_A);
    const captured = await mockPasswordUpdate(page, account);

    // Isti oblik adrese koji Supabase šalje iz mejla, sa pravim tokenima.
    await page.goto(`/#access_token=${account.token}&refresh_token=${account.refreshToken}&expires_in=3600&token_type=bearer&type=recovery`);
    await expect(page.getByRole('heading', { name: 'Nova lozinka' })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);

    await page.getByLabel('Nova lozinka').fill('nova-lozinka-123');
    await page.getByLabel('Ponovi lozinku').fill('nova-lozinka-123');
    await page.getByRole('button', { name: 'Sačuvaj lozinku' }).click();

    await expect(page.getByLabel('Ime')).toBeVisible();
    expect(captured.password).toBe('nova-lozinka-123');
  });
});

test.describe('trener', () => {
  test.afterAll(async () => {
    await resetAccount(ACCOUNT_A);
    await resetAccount(ACCOUNT_TRAINER);
  });

  test('u aplikaciji vidi svoje podatke, ne treninge klijenata', async ({ page }) => {
    const client = await resetAccount(ACCOUNT_A);
    const trainer = await resetAccount(ACCOUNT_TRAINER);
    await rest('sessions', { token: client.token, method: 'POST', body: { program_id: LAGANO, workout_id: GORNJI, duration_sec: 60 } });

    // Kontrola: trener može da pročita taj trening, pa ga od kvačice štiti samo filter u api.js.
    const visible = await rest(`sessions?user_id=eq.${client.id}&select=id`, { token: trainer.token });
    expect(visible.rows).toHaveLength(1);

    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);
    await expect(page.locator('.week .dot.done')).toHaveCount(0);
  });
});

test.describe('prijavljen klijent', () => {
  let account;

  test.beforeEach(async ({ page }) => {
    account = await resetAccount(ACCOUNT_A);
    await loginUi(page, ACCOUNT_A);
  });

  test.afterAll(() => resetAccount(ACCOUNT_A));

  const sessions = () => rest(`sessions?user_id=eq.${account.id}&select=*,session_sets(*)`, { token: account.token });

  test('onboarding → trening → rezime → kvačica, podaci ostaju posle osvežavanja', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(e.message));

    await finishOnboarding(page, { weight: '72,5' });
    await page.getByRole('button', { name: /Današnji trening/ }).click();

    // Veslanje je druga vežba: upisujemo kilažu koju test posle očekuje kao predlog.
    await expectExercise(page, 1);
    await skipExercise(page, 2);
    await page.getByLabel('Teg u kilogramima').fill('11');
    await completeSetAndSkipRest(page);
    await skipExercise(page, 3);
    await skipExercise(page, 4);
    await skipExercise(page, 5);
    await page.getByRole('button', { name: 'Završi trening' }).click();

    await expect(page.getByRole('heading', { name: 'Bravo!' })).toBeVisible();
    await page.getByRole('button', { name: 'Na početnu' }).click();
    await expect(page.locator('.week .dot.done')).toHaveCount(1);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Zdravo, Tester' })).toBeVisible();
    await expect(page.locator('.week .dot.done')).toHaveCount(1);

    const saved = (await sessions()).rows;
    expect(saved).toHaveLength(1);
    expect(saved[0].session_sets).toHaveLength(1);
    expect(saved[0].session_sets[0].kg).toBe(11);

    const weights = await rest(`weights?user_id=eq.${account.id}&select=kg`, { token: account.token });
    expect(weights.rows).toEqual([{ kg: 72.5 }]);

    // Predlog kilaže dolazi iz prošlog treninga.
    await page.goto(`/#/trening/${LAGANO}/${GORNJI}`);
    await expectExercise(page, 1);
    await skipExercise(page, 2);
    await expect(page.getByLabel('Teg u kilogramima')).toHaveValue('11');

    expect(consoleErrors).toEqual([]);
  });

  test('upis težine, promena programa i odjava', async ({ page }) => {
    await finishOnboarding(page);

    await page.getByRole('link', { name: 'Profil' }).click();
    await page.getByLabel('Težina danas u kilogramima').fill('80');
    await page.getByRole('button', { name: 'Upiši težinu' }).click();
    await expect(page.getByText(/poslednje: 80/)).toBeVisible();

    await page.getByRole('link', { name: 'Treninzi' }).click();
    await page.getByRole('button', { name: /Snaga bez teretane/ }).click();
    await page.getByRole('button', { name: 'Izaberi ovaj program' }).click();
    await expect(page.getByRole('button', { name: /Počni sledeći trening/ })).toBeVisible();

    const active = await rest(`enrollments?user_id=eq.${account.id}&active=is.true&select=program_id`, { token: account.token });
    expect(active.rows).toEqual([{ program_id: SNAGA_KUCA }]);

    await page.goto('/#/profil');
    await page.getByRole('button', { name: 'Odjavi se' }).click();
    await expect(loginHeading(page)).toBeVisible();
    await page.reload();
    await expect(loginHeading(page)).toBeVisible();
  });

  test('promena lozinke iz Profila proverava unos i čuva lozinku', async ({ page }) => {
    const captured = await mockPasswordUpdate(page, account);
    await finishOnboarding(page);
    await page.getByRole('link', { name: 'Profil' }).click();
    await page.getByRole('button', { name: 'Promeni lozinku' }).click();

    const save = page.getByRole('button', { name: 'Sačuvaj lozinku' });
    await page.getByLabel('Nova lozinka').fill('kratka');
    await page.getByLabel('Ponovi lozinku').fill('kratka');
    await save.click();
    await expect(page.getByRole('alert')).toHaveText('Lozinka mora da ima najmanje 8 znakova.');

    await page.getByLabel('Nova lozinka').fill('nova-lozinka-123');
    await page.getByLabel('Ponovi lozinku').fill('druga-lozinka-123');
    await save.click();
    await expect(page.getByRole('alert')).toHaveText('Lozinke se ne poklapaju.');
    expect(captured.password).toBeUndefined();

    await page.getByLabel('Ponovi lozinku').fill('nova-lozinka-123');
    await save.click();
    await expect(page.getByText('Lozinka promenjena')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Promeni lozinku' })).toBeVisible();
    expect(captured.password).toBe('nova-lozinka-123');
  });

  test('bez interneta: trening se ne gubi i ponovni pokušaj ne pravi duplikat', async ({ page, context }) => {
    await finishOnboarding(page);
    await page.goto(`/#/trening/${LAGANO}/${GORNJI}`);
    await expectExercise(page, 1);
    await completeSetAndSkipRest(page);
    await skipExercise(page, 2);
    await skipExercise(page, 3);
    await skipExercise(page, 4);
    await skipExercise(page, 5);

    await context.setOffline(true);
    await page.getByRole('button', { name: 'Završi trening' }).click();
    await expect(page.getByRole('heading', { name: 'Trening nije sačuvan' })).toBeVisible();
    expect((await sessions()).rows).toHaveLength(0);

    await context.setOffline(false);
    await page.getByRole('button', { name: 'Pokušaj ponovo' }).click();
    await expect(page.getByRole('heading', { name: 'Bravo!' })).toBeVisible();

    const saved = (await sessions()).rows;
    expect(saved).toHaveLength(1);
    expect(saved[0].session_sets).toHaveLength(1);
  });
});
