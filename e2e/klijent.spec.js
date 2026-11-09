// Glavni tokovi klijenta kroz pravi UI i pravu bazu, nalogom e2e-a.

import { test, expect } from '@playwright/test';
import {
  ACCOUNT_A, ACCOUNT_TRAINER, LAGANO, SNAGA_KUCA, GORNJI, KARDIO, SKLEKOVI, rest, resetAccount, loginUi, finishOnboarding,
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

test.describe('trener: klijenti', () => {
  test.afterAll(async () => {
    await resetAccount(ACCOUNT_A);
    await resetAccount(ACCOUNT_TRAINER);
  });

  test('vidi klijenta sa aktivnošću i njegov napredak, samo za čitanje', async ({ page }) => {
    const client = await resetAccount(ACCOUNT_A);
    await resetAccount(ACCOUNT_TRAINER);
    const asClient = { token: client.token, method: 'POST' };

    await rest(`profiles?id=eq.${client.id}`, { token: client.token, method: 'PATCH', body: { name: 'E2E Klijent', goal: 'snaga', location: 'kuca', level: 'pocetnik', per_week: 3 } });
    await rest('weights', { ...asClient, body: { user_id: client.id, date: '2000-01-02', kg: 75 } });
    await rest('weights', { ...asClient, body: { user_id: client.id, date: '2000-02-01', kg: 72 } });
    await rest('measurements', { ...asClient, body: { user_id: client.id, date: '2000-01-02', waist_cm: 84 } });
    await rest('measurements', { ...asClient, body: { user_id: client.id, date: '2000-02-01', waist_cm: 80 } });
    const session = await rest('sessions', { ...asClient, body: { program_id: LAGANO, workout_id: GORNJI, duration_sec: 600 } });
    await rest('session_sets', { ...asClient, body: { session_id: session.rows[0].id, exercise_id: SKLEKOVI, set_no: 1, reps: 10 } });

    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);
    await page.getByRole('link', { name: 'Profil' }).click();
    await page.getByRole('button', { name: 'Klijenti' }).click();
    await expect(page.getByRole('heading', { name: 'Klijenti' })).toBeVisible();

    const row = page.getByRole('button', { name: /E2E Klijent/ });
    await expect(row).toContainText('Snaga i mišići · 1 trening');
    await expect(row).toContainText('danas');
    await expect(page.getByRole('button', { name: /^Tester/ })).toHaveCount(0);

    await row.click();
    await expect(page.getByRole('heading', { name: 'E2E Klijent' })).toBeVisible();
    await expect(page.getByRole('img', { name: /Grafikon težine: od 75 kg .* do 72 kg/ })).toBeVisible();
    await expect(page.locator('.measures')).toContainText('−4 cm');
    await expect(page.getByText('Gornji deo tela')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upiši težinu' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upiši mere' })).toHaveCount(0);
  });
});

test.describe('trener: vežbe', () => {
  let trainer;
  // Prava baza je zajednička: test vežbe nose prefiks E2E, nisu ni u jednom treningu i brišu se.
  const removeTestExercises = () => rest('exercises?name=like.E2E*', { token: trainer.token, method: 'DELETE' });

  test.beforeAll(async () => {
    trainer = await resetAccount(ACCOUNT_TRAINER);
    await removeTestExercises();
  });

  test.afterAll(async () => {
    await removeTestExercises();
    await resetAccount(ACCOUNT_TRAINER);
  });

  test('dodavanje i izmena vežbe, uz odbijanje praznog i dupliranog naziva', async ({ page }) => {
    await resetAccount(ACCOUNT_TRAINER);

    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);
    await page.goto('/#/vezbe');
    await page.getByRole('button', { name: 'Nova vežba' }).click();

    const add = page.getByRole('button', { name: 'Dodaj vežbu' });
    await add.click();
    await expect(page.getByRole('alert')).toHaveText('Unesi naziv vežbe.');
    await page.getByLabel('Naziv vežbe').fill('bench PRESS');
    await add.click();
    await expect(page.getByRole('alert')).toHaveText('Vežba sa tim nazivom već postoji.');

    await page.getByLabel('Naziv vežbe').fill('E2E Vežba');
    await page.getByLabel('Savet za izvođenje').fill('Prvi savet');
    await add.click();
    await expect(page.getByRole('button', { name: 'Izmeni vežbu E2E Vežba' })).toBeVisible();
    await expect(page.getByText('Prvi savet')).toBeVisible();

    await page.getByRole('button', { name: 'Izmeni vežbu E2E Vežba' }).click();
    await page.getByLabel('Naziv vežbe').fill('E2E Izmenjena');
    await page.getByLabel('Savet za izvođenje').fill('Drugi savet');
    await page.getByRole('button', { name: 'Sačuvaj izmene' }).click();
    await expect(page.getByRole('button', { name: 'Izmeni vežbu E2E Izmenjena' })).toBeVisible();

    await page.reload();
    await expect(page.getByText('Drugi savet')).toBeVisible();
    const saved = await rest('exercises?name=like.E2E*&select=name,cue', { token: trainer.token });
    expect(saved.rows).toEqual([{ name: 'E2E Izmenjena', cue: 'Drugi savet' }]);
  });
});

test.describe('trener: treninzi', () => {
  let trainer;
  // Test treninzi nose prefiks E2E, nisu ni u jednom programu (klijenti ih ne vide) i brišu se zajedno sa stavkama.
  const removeTestWorkouts = () => rest('workouts?title=like.E2E*', { token: trainer.token, method: 'DELETE' });
  const savedItems = async (title) => {
    const result = await rest(`workouts?title=eq.${encodeURIComponent(title)}&select=workout_items(position,reps,seconds,kg,rest_sec,exercises(name))`, { token: trainer.token });
    expect(result.rows).toHaveLength(1);
    return result.rows[0].workout_items.sort((x, y) => x.position - y.position)
      .map((it) => ({ position: it.position, name: it.exercises.name, reps: it.reps, seconds: it.seconds, kg: it.kg, rest: it.rest_sec }));
  };

  // beforeAll, a ne u testu: posle neuspelog testa Playwright pokreće nov proces i promenljive kreću od nule.
  test.beforeAll(async () => {
    trainer = await resetAccount(ACCOUNT_TRAINER);
    await removeTestWorkouts();
  });

  test.afterAll(async () => {
    await removeTestWorkouts();
    await resetAccount(ACCOUNT_TRAINER);
  });

  test('novi trening: provere, redosled, sekunde, pa izmena bez duplih stavki', async ({ page }) => {
    await resetAccount(ACCOUNT_TRAINER);
    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);

    await page.goto('/#/trener-treninzi');
    await page.getByRole('button', { name: 'Novi trening' }).click();
    const save = page.getByRole('button', { name: 'Sačuvaj trening' });
    const alert = page.getByRole('alert');

    await save.click();
    await expect(alert).toHaveText('Unesi naziv treninga.');
    await page.getByLabel('Naziv treninga').fill('E2E Trening');
    await save.click();
    await expect(alert).toHaveText('Dodaj bar jednu vežbu.');

    await page.getByRole('button', { name: 'Dodaj vežbu' }).click();
    await page.getByRole('button', { name: 'Dodaj vežbu' }).click();
    await expect(page.getByLabel('Vežba 1', { exact: true })).toHaveValue(/.+/);
    await page.getByLabel('Vežba 1', { exact: true }).selectOption({ label: 'Bench press' });
    await page.getByLabel('Vežba 2', { exact: true }).selectOption({ label: 'Bench press' });
    await save.click();
    await expect(alert).toHaveText('Ista vežba je dvaput u treningu.');

    await page.getByLabel('Vežba 2', { exact: true }).selectOption({ label: 'Plank' });
    await page.getByRole('radiogroup', { name: 'Mera za vežbu 2' }).getByRole('radio', { name: 'Sekunde' }).click();
    await page.getByLabel('Sekundi, vežba 2').fill('45');
    await page.getByLabel('Kilaža (kg), vežba 1').fill('42,5');
    await page.getByLabel('Serije, vežba 1').fill('0');
    await save.click();
    await expect(alert).toHaveText('Vežba 1: serije moraju biti od 1 do 20.');
    await page.getByLabel('Serije, vežba 1').fill('4');

    await page.getByRole('button', { name: 'Pomeri gore: Plank' }).click();
    await save.click();
    await expect(page.getByText('Trening sačuvan')).toBeVisible();
    await expect(page.getByRole('button', { name: /E2E Trening/ })).toContainText('2 vežbe');

    expect(await savedItems('E2E Trening')).toEqual([
      { position: 1, name: 'Plank', reps: null, seconds: 45, kg: null, rest: 60 },
      { position: 2, name: 'Bench press', reps: 10, seconds: null, kg: 42.5, rest: 60 },
    ]);

    // Izmena: uklanjamo vežbu i menjamo naziv. Stare stavke moraju da nestanu.
    await page.getByRole('button', { name: /E2E Trening/ }).click();
    await expect(page.getByLabel('Sekundi, vežba 1')).toHaveValue('45');
    await page.getByRole('button', { name: 'Ukloni: Plank' }).click();
    await page.getByLabel('Naziv treninga').fill('E2E Izmenjen');
    await save.click();
    // Ne čekamo poruku "Trening sačuvan": ona može da ostane od prethodnog čuvanja. Lista se prikaže tek kad je sve upisano.
    await expect(page.getByRole('button', { name: /E2E Izmenjen/ })).toContainText('1 vežba');
    expect(await savedItems('E2E Izmenjen')).toEqual([
      { position: 1, name: 'Bench press', reps: 10, seconds: null, kg: 42.5, rest: 60 },
    ]);
  });

  test('trening iz programa prikazuje upozorenje', async ({ page }) => {
    await resetAccount(ACCOUNT_TRAINER);
    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);
    await page.goto(`/#/trener-trening/${GORNJI}`);
    await expect(page.getByRole('heading', { name: 'Izmena treninga' })).toBeVisible();
    await expect(page.getByRole('note')).toContainText('Ovaj trening koristi programa: 2.');
    await expect(page.getByLabel('Naziv treninga')).toHaveValue('Gornji deo tela');
  });
});

test.describe('trener: programi', () => {
  let trainer;
  let draftId;
  // Test programi nose prefiks E2E i nikad nisu stvarno objavljeni. Upise klijenta brišemo pre programa (strani ključ).
  const removeTestPrograms = () => rest('programs?title=like.E2E*', { token: trainer.token, method: 'DELETE' });
  const savedProgram = async (title) => {
    const result = await rest(`programs?title=eq.${encodeURIComponent(title)}&select=published,weeks,program_schedule(position,workouts(title))`, { token: trainer.token });
    expect(result.rows).toHaveLength(1);
    const p = result.rows[0];
    return { published: p.published, weeks: p.weeks, schedule: p.program_schedule.sort((x, y) => x.position - y.position).map((s) => s.workouts.title) };
  };

  test.beforeAll(async () => {
    await resetAccount(ACCOUNT_A);
    trainer = await resetAccount(ACCOUNT_TRAINER);
    await removeTestPrograms();
    const draft = await rest('programs', { token: trainer.token, method: 'POST', body: { title: 'E2E Nacrt', weeks: 2, per_week: 2, location: 'kuca', level: 'Početnik', published: false } });
    draftId = draft.rows[0].id;
    await rest('program_schedule', { token: trainer.token, method: 'POST', body: { program_id: draftId, position: 1, workout_id: KARDIO } });
  });

  test.afterAll(async () => {
    await resetAccount(ACCOUNT_A);
    await removeTestPrograms();
    await resetAccount(ACCOUNT_TRAINER);
  });

  test('novi program: provere, raspored sa ponovljenim treningom, pa izmena bez viška pozicija', async ({ page }) => {
    await resetAccount(ACCOUNT_TRAINER);
    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);
    await page.goto('/#/trener-programi');
    await page.getByRole('button', { name: 'Novi program' }).click();
    const save = page.getByRole('button', { name: 'Sačuvaj program' });
    const alert = page.getByRole('alert');

    await save.click();
    await expect(alert).toHaveText('Unesi naziv programa.');
    await page.getByLabel('Naziv programa').fill('E2E Program');
    await page.getByLabel('Broj nedelja').fill('0');
    await save.click();
    await expect(alert).toHaveText('Broj nedelja mora biti od 1 do 52.');
    await page.getByLabel('Broj nedelja').fill('6');
    await save.click();
    await expect(alert).toHaveText('Dodaj bar jedan trening u raspored.');

    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Dodaj trening' }).click();
    await page.getByLabel('Trening 1 u rasporedu').selectOption({ label: 'Gornji deo tela' });
    await page.getByLabel('Trening 2 u rasporedu').selectOption({ label: 'Kardio krug' });
    await page.getByLabel('Trening 3 u rasporedu').selectOption({ label: 'Gornji deo tela' });
    await page.getByRole('button', { name: 'Pomeri gore trening 2' }).click();
    await expect(page.getByRole('checkbox', { name: /Objavljen/ })).not.toBeChecked();
    await save.click();

    await expect(page.getByRole('button', { name: /E2E Program/ })).toContainText('Nacrt');
    expect(await savedProgram('E2E Program')).toEqual({ published: false, weeks: 6, schedule: ['Kardio krug', 'Gornji deo tela', 'Gornji deo tela'] });

    await page.getByRole('button', { name: /E2E Program/ }).click();
    await page.getByRole('button', { name: 'Ukloni trening 1' }).click();
    await save.click();
    await expect(page.getByRole('button', { name: /E2E Program/ })).toContainText('2 u rasporedu');
    expect(await savedProgram('E2E Program')).toEqual({ published: false, weeks: 6, schedule: ['Gornji deo tela', 'Gornji deo tela'] });
  });

  test('objavljivanje šalje published, a upozorenje broji klijente programa', async ({ page }) => {
    // Klijent počinje nacrt preko API-ja, da upozorenje ima koga da broji.
    const client = await resetAccount(ACCOUNT_A);
    await rest('enrollments', { token: client.token, method: 'POST', body: { user_id: client.id, program_id: draftId } });

    // Pravo objavljivanje bi na trenutak pokazalo test program pravim korisnicima, pa ga presrećemo.
    let sent = null;
    await page.route('**/rest/v1/programs*', (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      sent = route.request().postDataJSON();
      return route.fulfill({ status: 200, json: [{ id: draftId }] });
    });

    await resetAccount(ACCOUNT_TRAINER);
    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);
    await page.goto(`/#/trener-program/${draftId}`);
    await expect(page.getByRole('note')).toContainText('Ovaj program trenutno radi klijenata: 1.');
    await page.getByRole('checkbox', { name: /Objavljen/ }).check();
    await page.getByRole('button', { name: 'Sačuvaj program' }).click();
    await expect(page.getByRole('heading', { name: 'Uređivanje programa' })).toBeVisible();
    expect(sent).toMatchObject({ title: 'E2E Nacrt', published: true });
  });

  test('klijent ne vidi nacrt ni u aplikaciji ni preko API-ja', async ({ page }) => {
    const client = await resetAccount(ACCOUNT_A);
    const viaApi = await rest('programs?title=like.E2E*&select=id', { token: client.token });
    expect(viaApi.rows).toEqual([]);

    await loginUi(page, ACCOUNT_A);
    await finishOnboarding(page);
    await page.getByRole('link', { name: 'Treninzi' }).click();
    await expect(page.getByRole('button', { name: /^Lagano do forme/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /E2E/ })).toHaveCount(0);
  });
});

test.describe('trener: video snimci', () => {
  test.afterAll(() => resetAccount(ACCOUNT_TRAINER));

  test('neispravan link se odbija, a ispravan čuva u jednom obliku', async ({ page }) => {
    await resetAccount(ACCOUNT_TRAINER);

    // Čuvanje je presretnuto: test ne sme da upiše lažan video u sadržaj koji vide klijenti.
    let saved = null;
    await page.route('**/rest/v1/exercises*', (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      saved = route.request().postDataJSON();
      return route.fulfill({ status: 200, json: [{ id: 'presretnuto' }] });
    });

    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);
    await page.getByRole('link', { name: 'Profil' }).click();
    await page.getByRole('button', { name: 'Vežbe' }).click();
    await expect(page.getByRole('heading', { name: 'Vežbe' })).toBeVisible();
    await expect(page.getByText(/od \d+ vežbi ima video/)).toBeVisible();

    await page.getByLabel('YouTube link za Bench press').fill('nije link');
    await page.getByRole('button', { name: 'Sačuvaj video za Bench press' }).click();
    await expect(page.getByRole('alert')).toHaveText('To nije ispravan YouTube link.');
    expect(saved).toBeNull();

    await page.getByLabel('YouTube link za Bench press').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s');
    await page.getByRole('button', { name: 'Sačuvaj video za Bench press' }).click();
    await expect(page.getByText('Video sačuvan')).toBeVisible();
    expect(saved).toEqual({ video_url: 'https://youtu.be/dQw4w9WgXcQ' });
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

  test('klijent ne vidi unos videa i ne može na tu adresu', async ({ page }) => {
    await finishOnboarding(page);
    await page.getByRole('link', { name: 'Profil' }).click();
    await expect(page.getByRole('button', { name: 'Promeni lozinku' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vežbe' })).toHaveCount(0);

    await page.goto('/#/vezbe');
    await expect(page.getByRole('heading', { name: 'Zdravo, Tester' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vežbe' })).toHaveCount(0);

    await page.goto('/#/klijenti');
    await expect(page.getByRole('heading', { name: 'Zdravo, Tester' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Klijenti' })).toHaveCount(0);
  });

  test('Napredak: od praznog stanja do grafikona i razlike u težini', async ({ page }) => {
    await finishOnboarding(page);
    await page.getByRole('link', { name: 'Napredak' }).click();
    await expect(page.getByText('Upiši prvu težinu dugmetom +.')).toBeVisible();
    await expect(page.getByText('Još nema odrađenih treninga.')).toBeVisible();

    await page.getByRole('button', { name: 'Upiši težinu' }).click();
    await page.getByLabel('Težina danas u kilogramima').fill('72');
    await page.getByRole('button', { name: 'Sačuvaj težinu' }).click();
    await expect(page.getByText('Upiši još jednom da vidiš grafikon.')).toBeVisible();
    await expect(page.getByRole('img', { name: /Grafikon težine/ })).toHaveCount(0);

    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    await rest('weights', { token: account.token, method: 'POST', body: { user_id: account.id, date: monthAgo, kg: 75 } });
    await page.reload();

    await expect(page.getByRole('img', { name: /Grafikon težine: od 75 kg .* do 72 kg/ })).toBeVisible();
    await expect(page.getByText('−3 kg')).toBeVisible();

    const chart = page.locator('.weight-chart');
    const box = await chart.boundingBox();
    await chart.click({ position: { x: 5, y: box.height / 2 } });
    await expect(page.locator('.chart-tip')).toContainText('75 kg');
  });

  test('Napredak: mere se upisuju, dopunjuju i pokazuju razliku', async ({ page }) => {
    await finishOnboarding(page);
    await page.getByRole('link', { name: 'Napredak' }).click();

    await page.getByRole('button', { name: 'Upiši mere' }).click();
    await page.getByRole('button', { name: 'Sačuvaj mere' }).click();
    await expect(page.getByText('Unesi bar jednu meru')).toBeVisible();

    await page.getByLabel('Struk (cm)').fill('80');
    await page.getByRole('button', { name: 'Sačuvaj mere' }).click();
    await expect(page.locator('.measures')).toContainText('80 cm');

    // Drugi upis istog dana, samo kukovi: struk ne sme da nestane.
    await page.getByRole('button', { name: 'Upiši mere' }).click();
    await page.getByLabel('Kukovi (cm)').fill('98,5');
    await page.getByRole('button', { name: 'Sačuvaj mere' }).click();
    await expect(page.locator('.measures')).toContainText('98,5 cm');
    const saved = await rest(`measurements?user_id=eq.${account.id}&select=waist_cm,hips_cm,arm_cm`, { token: account.token });
    expect(saved.rows).toEqual([{ waist_cm: 80, hips_cm: 98.5, arm_cm: null }]);

    await rest('measurements', { token: account.token, method: 'POST', body: { user_id: account.id, date: '2000-01-01', waist_cm: 84 } });
    await page.reload();
    await expect(page.locator('.measures')).toContainText('−4 cm');
  });

  test('Napredak: odrađen trening se vidi u istoriji', async ({ page }) => {
    await finishOnboarding(page);
    const session = await rest('sessions', { token: account.token, method: 'POST', body: { program_id: LAGANO, workout_id: GORNJI, duration_sec: 600 } });
    for (const setNo of [1, 2]) {
      await rest('session_sets', { token: account.token, method: 'POST', body: { session_id: session.rows[0].id, exercise_id: SKLEKOVI, set_no: setNo, reps: 10 } });
    }

    await page.getByRole('link', { name: 'Napredak' }).click();
    await expect(page.getByText('Gornji deo tela')).toBeVisible();
    await expect(page.getByText('10 min · 2 serije')).toBeVisible();
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
