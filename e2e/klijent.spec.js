// Glavni tokovi klijenta kroz pravi UI i pravu bazu, nalogom e2e-a.

import { test, expect } from '@playwright/test';
import {
  ACCOUNT_A, LAGANO, SNAGA_KUCA, GORNJI, rest, resetAccount, loginUi, finishOnboarding,
  expectExercise, skipExercise, completeSetAndSkipRest,
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
