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

test.describe('trener: klijent bez mreže', () => {
  test.afterAll(() => resetAccount(ACCOUNT_TRAINER));

  test('pad mreže ne izgleda kao "Klijent nije pronađen"', async ({ page }) => {
    const client = await resetAccount(ACCOUNT_A);
    await resetAccount(ACCOUNT_TRAINER);
    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);

    await page.route('**/rest/v1/**', (route) => route.abort());
    await page.goto(`/#/klijent/${client.id}`);
    await expect(page.getByRole('heading', { name: 'Nema veze' })).toBeVisible({ timeout: 15_000 }); // posle Supabase ponavljanja
    await expect(page.getByText('Klijent nije pronađen.')).toHaveCount(0);

    await page.unroute('**/rest/v1/**');
    await page.getByRole('button', { name: 'Pokušaj ponovo' }).click();
    await expect(page.getByText('Cilj nije izabran')).toBeVisible();
  });
});

test.describe('poruke', () => {
  test.afterAll(async () => {
    await resetAccount(ACCOUNT_A);
    await resetAccount(ACCOUNT_TRAINER);
  });

  test('klijent i trener se dopisuju uživo, sa nepročitanim na tabu', async ({ page, browser }) => {
    const client = await resetAccount(ACCOUNT_A);
    const trainerSession = await resetAccount(ACCOUNT_TRAINER);
    await rest(`profiles?id=eq.${client.id}`, { token: client.token, method: 'PATCH', body: { name: 'E2E Klijent', goal: 'snaga', location: 'kuca', level: 'pocetnik', per_week: 3 } });

    // Klijent u jednom prozoru
    await loginUi(page, ACCOUNT_A);
    await expect(page.getByRole('heading', { name: 'Zdravo, E2E Klijent' })).toBeVisible();
    await page.getByRole('link', { name: 'Aki', exact: true }).click();
    await expect(page.getByText('Pitaj Akija bilo šta')).toBeVisible();
    await page.getByLabel('Poruka').fill('Zdravo treneru');
    await page.getByRole('button', { name: 'Pošalji' }).click();
    await expect(page.locator('.bubble--out')).toContainText('Zdravo treneru');

    // Trener u drugom prozoru, istovremeno
    const trainerContext = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: { width: 412, height: 839 } });
    const trainer = await trainerContext.newPage();
    await loginUi(trainer, ACCOUNT_TRAINER);
    await finishOnboarding(trainer);
    await expect(trainer.getByRole('link', { name: 'Poruke, nepročitanih: 1' })).toBeVisible();
    await trainer.getByRole('link', { name: /^Poruke/ }).click();
    await trainer.getByRole('button', { name: /E2E Klijent/ }).click();
    await expect(trainer.locator('.bubble--in')).toContainText('Zdravo treneru');
    await expect(trainer.getByRole('link', { name: 'Poruke', exact: true })).toBeVisible();

    // Odgovor stiže klijentu bez osvežavanja
    await trainer.getByLabel('Poruka').fill('Bravo za trening!');
    await trainer.getByRole('button', { name: 'Pošalji' }).click();
    await expect(page.locator('.bubble--in')).toContainText('Bravo za trening!');

    // Klijent nije na razgovoru: nova poruka se vidi kao nepročitana na tabu
    await page.getByRole('link', { name: 'Početna' }).click();
    await trainer.getByLabel('Poruka').fill('Još jedna');
    await trainer.getByRole('button', { name: 'Pošalji' }).click();
    await expect(page.getByRole('link', { name: 'Aki, nepročitanih: 1' })).toBeVisible();
    await page.getByRole('link', { name: /^Aki/ }).click();
    await expect(page.locator('.bubble--in').last()).toContainText('Još jedna');
    await expect(page.getByRole('link', { name: 'Aki', exact: true })).toBeVisible();

    const saved = await rest(`messages?client_id=eq.${client.id}&select=body,read_at,sender_id&order=created_at`, { token: trainerSession.token });
    expect(saved.rows.map((m) => [m.body, m.sender_id === client.id, m.read_at !== null])).toEqual([
      ['Zdravo treneru', true, true],
      ['Bravo za trening!', false, true],
      ['Još jedna', false, true],
    ]);
    await trainerContext.close();
  });
});

test.describe('ishrana: kalkulator', () => {
  let trainer;
  const removeOverride = (clientId) => rest(`nutrition_targets?client_id=eq.${clientId}`, { token: trainer.token, method: 'DELETE' });
  const born = (age) => String(new Date().getFullYear() - age);

  test.beforeAll(async () => { trainer = await resetAccount(ACCOUNT_TRAINER); });
  test.afterAll(async () => {
    const client = await resetAccount(ACCOUNT_A);
    await removeOverride(client.id);
    await resetAccount(ACCOUNT_TRAINER);
  });

  test('klijent unosi podatke i dobija preporuku; ispod 18 nema računa', async ({ page }) => {
    const client = await resetAccount(ACCOUNT_A);
    await removeOverride(client.id);
    await loginUi(page, ACCOUNT_A);
    await finishOnboarding(page); // cilj: mršavljenje

    await page.getByRole('link', { name: 'Ishrana' }).click();
    await expect(page.getByRole('heading', { name: 'Izračunaj dnevni cilj' })).toBeVisible();
    const calculate = page.getByRole('button', { name: 'Izračunaj' });
    await calculate.click();
    await expect(page.getByRole('alert')).toHaveText('Izaberi pol.');

    await page.getByRole('radiogroup', { name: 'Pol' }).getByRole('radio', { name: 'Ženski' }).click();
    await page.getByLabel('Godina rođenja').fill(born(16));
    await page.getByLabel('Visina (cm)').fill('165');
    await page.getByLabel('Težina (kg)').fill('60');
    await page.getByRole('radiogroup', { name: 'Aktivnost' }).getByRole('radio', { name: /Sedeći/ }).click();
    await calculate.click();
    await expect(page.getByText('Za mlađe od 18 godina ne računamo cilj po formuli.', { exact: false })).toBeVisible();

    // Žena, 25 god, 165 cm, 60 kg, sedeći, mršavljenje: 1345,25 × 1,2 × 0,8 = 1291 → 1290 kcal, P 120, M 35, UH 125
    await page.getByRole('button', { name: 'Izmeni podatke' }).click();
    await page.getByLabel('Godina rođenja').fill(born(25));
    await calculate.click();
    await expect(page.locator('.target-kcal')).toContainText('1.290');
    await expect(page.locator('.stat-grid')).toContainText('120 g');
    await expect(page.locator('.stat-grid')).toContainText('125 g');
    await expect(page.locator('.stat-grid')).toContainText('35 g');
    await expect(page.getByText('Preporuka po formuli.', { exact: false })).toBeVisible();
    // potrošnja 1345,25 × 1,2 = 1614 kcal, cilj 1290 → 324 manje
    await expect(page.getByText('Mršavljenje · 324 kcal manje od potrošnje (1.614)')).toBeVisible();
    await expect(page.getByText('Proteini su računati za', { exact: false })).toHaveCount(0);

    const weights = await rest(`weights?user_id=eq.${client.id}&select=kg`, { token: client.token });
    expect(weights.rows).toEqual([{ kg: 60 }]);
  });

  test('trener vidi preporuku, postavlja svoj cilj i vraća na preporuku', async ({ page, browser }) => {
    const client = await resetAccount(ACCOUNT_A);
    await removeOverride(client.id);
    await rest(`profiles?id=eq.${client.id}`, { token: client.token, method: 'PATCH', body: {
      name: 'E2E Klijent', goal: 'mrsavljenje', location: 'kuca', level: 'pocetnik', per_week: 3,
      sex: 'z', birth_year: Number(born(25)), height_cm: 165, activity: 'sedeci',
    } });
    await rest('weights', { token: client.token, method: 'POST', body: { user_id: client.id, date: '2000-01-01', kg: 60 } });

    await resetAccount(ACCOUNT_TRAINER);
    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);
    await page.goto(`/#/klijent/${client.id}`);
    const card = page.getByRole('form', { name: 'Dnevni cilj ishrane' });
    await expect(card).toContainText('Preporuka po formuli: 1.290 kcal');
    await expect(card).toContainText('Mršavljenje · 324 kcal manje od potrošnje (1.614)');
    await expect(page.getByLabel('Kalorije')).toHaveValue('1290');

    await page.getByLabel('Kalorije').fill('1500');
    await page.getByLabel('Proteini (g)').fill('130');
    await page.getByLabel('Ugljeni hidrati (g)').fill('150');
    await page.getByLabel('Masti (g)').fill('40');
    await page.getByRole('button', { name: 'Sačuvaj cilj' }).click();
    await expect(page.getByRole('button', { name: 'Vrati na preporuku' })).toBeVisible();
    const saved = await rest(`nutrition_targets?client_id=eq.${client.id}&select=kcal,protein_g,carbs_g,fat_g`, { token: trainer.token });
    expect(saved.rows).toEqual([{ kcal: 1500, protein_g: 130, carbs_g: 150, fat_g: 40 }]);

    // Klijent u drugom prozoru vidi trenerov cilj.
    const clientContext = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: { width: 412, height: 839 } });
    const clientPage = await clientContext.newPage();
    await loginUi(clientPage, ACCOUNT_A);
    await clientPage.getByRole('link', { name: 'Ishrana' }).click();
    await expect(clientPage.locator('.target-kcal')).toContainText('1.500');
    await expect(clientPage.getByText('Cilj postavio Aki.')).toBeVisible();
    await clientContext.close();

    await page.getByRole('button', { name: 'Vrati na preporuku' }).click();
    await expect(page.getByRole('button', { name: 'Vrati na preporuku' })).toHaveCount(0);
    expect((await rest(`nutrition_targets?client_id=eq.${client.id}`, { token: trainer.token })).rows).toEqual([]);
  });
});

test.describe('trener: namirnice i struktura obroka', () => {
  let trainer;
  // Test namirnice nose prefiks E2E i brišu se; u planove još ne ulaze.
  const removeTestFoods = () => rest('foods?name=like.E2E*', { token: trainer.token, method: 'DELETE' });

  test.beforeAll(async () => {
    trainer = await resetAccount(ACCOUNT_TRAINER);
    await removeTestFoods();
  });
  test.afterAll(async () => {
    await removeTestFoods();
    await resetAccount(ACCOUNT_TRAINER);
  });

  test('nova namirnica: provere, upozorenje za makroe, dupli naziv i označavanje provere', async ({ page }) => {
    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);
    await page.getByRole('link', { name: 'Profil' }).click();
    await page.getByRole('button', { name: 'Namirnice' }).click();
    await page.getByRole('button', { name: 'Nova namirnica' }).click();

    const save = page.getByRole('button', { name: 'Sačuvaj namirnicu' });
    const alert = page.getByRole('alert');
    await page.getByLabel('Naziv').fill('E2E Piletina');
    await page.getByLabel('Kalorije (kcal)').fill('110');
    await page.getByLabel('Proteini (g)').fill('230'); // greška u kucanju
    await page.getByLabel('Ugljeni hidrati (g)').fill('0');
    await page.getByLabel('Masti (g)').fill('1,2');
    await expect(page.getByRole('note')).toContainText('Kalorije se ne slažu sa makroima');
    await save.click();
    await expect(alert).toHaveText('Proteini na 100 g moraju biti od 0 do 100.');

    await page.getByLabel('Proteini (g)').fill('23');
    await expect(page.getByRole('note')).toHaveCount(0);
    await save.click();
    await expect(alert).toHaveText('Izaberi bar jedan obrok u kom se nudi.');

    // exact: inače "Ručak" pogađa i "Doručak"
    await page.getByRole('group', { name: 'Obroci' }).getByRole('button', { name: 'Ručak', exact: true }).click();
    await page.getByRole('group', { name: 'Obroci' }).getByRole('button', { name: 'Večera', exact: true }).click();
    await page.getByLabel('Najmanja porcija (g)').fill('100');
    await page.getByLabel('Najveća porcija (g)').fill('250');
    await page.getByRole('checkbox', { name: /Proverena/ }).uncheck();
    await save.click();

    const row = page.getByRole('button', { name: /E2E Piletina/ });
    await expect(row).toContainText('Neproverena');
    await expect(row).toContainText('110 kcal · P 23 · UH 0 · M 1,2');
    const saved = await rest('foods?name=eq.E2E%20Piletina&select=food_group,kcal,protein_g,fat_g,meal_types,min_g,max_g,verified', { token: trainer.token });
    expect(saved.rows).toEqual([{ food_group: 'protein', kcal: 110, protein_g: 23, fat_g: 1.2, meal_types: ['rucak', 'vecera'], min_g: 100, max_g: 250, verified: false }]);

    // Dupli naziv
    await page.getByRole('button', { name: 'Nova namirnica' }).click();
    await page.getByLabel('Naziv').fill('E2E Piletina');
    for (const [label, value] of [['Kalorije (kcal)', '100'], ['Proteini (g)', '20'], ['Ugljeni hidrati (g)', '0'], ['Masti (g)', '2']]) await page.getByLabel(label).fill(value);
    await page.getByRole('group', { name: 'Obroci' }).getByRole('button', { name: 'Ručak', exact: true }).click();
    await save.click();
    await expect(alert).toHaveText('Namirnica sa tim nazivom već postoji.');
    await page.getByRole('button', { name: 'Nazad' }).click();

    // Označavanje kao proverene
    await page.getByRole('button', { name: /E2E Piletina/ }).click();
    await page.getByRole('checkbox', { name: /Proverena/ }).check();
    await save.click();
    await expect(page.getByRole('button', { name: /E2E Piletina/ })).not.toContainText('Neproverena');
  });

  test('struktura obroka: zbir mora biti 100 %, čuvanje bez izmene', async ({ page }) => {
    await resetAccount(ACCOUNT_TRAINER); // prvi test je već prošao onboarding ovim nalogom
    const before = (await rest('meal_templates?select=meal_type,share_pct&order=position', { token: trainer.token })).rows;
    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);
    await page.goto('/#/obroci');

    const breakfast = page.getByLabel('Udeo, Doručak');
    const original = await breakfast.inputValue();
    await breakfast.fill(String(Number(original) - 5));
    await page.getByRole('button', { name: 'Sačuvaj strukturu' }).click();
    await expect(page.getByRole('alert')).toContainText('Zbir udela mora biti 100 %');

    // Vraćamo istu vrednost i čuvamo: test ne menja Akijevu pravu strukturu.
    await breakfast.fill(original);
    await page.getByRole('button', { name: 'Sačuvaj strukturu' }).click();
    await expect(page.getByText('Struktura obroka sačuvana')).toBeVisible();
    const after = (await rest('meal_templates?select=meal_type,share_pct&order=position', { token: trainer.token })).rows;
    expect(after).toEqual(before);
  });
});

test.describe('ishrana: izbor namirnica, plan i kvačice', () => {
  let trainer;
  // Proverene E2E namirnice za sve grupe i obroke, da plan ne zavisi od toga šta je Aki već proverio.
  // Dok test traje, prave korisnike mogu da ih vide na listi; brišu se odmah posle.
  const TEST_FOODS = [
    ['E2E Piletina', 'protein', 120, 22.5, 0, 2.6, 100, 250],
    ['E2E Jogurt', 'mlecni', 59, 10.2, 3.6, 0.4, 100, 300],
    ['E2E Pirinač', 'uh', 365, 7.1, 80, 0.7, 40, 150],
    ['E2E Ulje', 'mast', 884, 0, 0, 100, 5, 20],
    ['E2E Brokoli', 'povrce', 34, 2.8, 6.6, 0.4, 100, 300],
    ['E2E Banana', 'voce', 89, 1.1, 22.8, 0.3, 80, 200],
  ];
  const removeTestFoods = () => rest('foods?name=like.E2E*', { token: trainer.token, method: 'DELETE' });

  test.beforeAll(async () => {
    trainer = await resetAccount(ACCOUNT_TRAINER);
    await removeTestFoods();
    await rest('foods', { token: trainer.token, method: 'POST', body: TEST_FOODS.map(([name, food_group, kcal, protein_g, carbs_g, fat_g, min_g, max_g]) => ({
      name, food_group, kcal, protein_g, carbs_g, fat_g, min_g, max_g, verified: true,
      meal_types: ['dorucak', 'uzina1', 'rucak', 'uzina2', 'vecera'],
    })) });
  });
  test.afterAll(async () => {
    await resetAccount(ACCOUNT_A);
    await removeTestFoods();
    await resetAccount(ACCOUNT_TRAINER);
  });

  // Klijent sa podacima za 1.290 kcal (mršavljenje) koji voli sve E2E namirnice, bez plana.
  async function prepareClient() {
    const client = await resetAccount(ACCOUNT_A);
    await rest(`profiles?id=eq.${client.id}`, { token: client.token, method: 'PATCH', body: {
      name: 'E2E Klijent', goal: 'mrsavljenje', location: 'kuca', level: 'pocetnik', per_week: 3,
      sex: 'z', birth_year: new Date().getFullYear() - 25, height_cm: 165, activity: 'sedeci',
    } });
    await rest('weights', { token: client.token, method: 'POST', body: { user_id: client.id, date: '2000-01-01', kg: 60 } });
    const foods = (await rest('foods?name=like.E2E*&select=id,name', { token: client.token })).rows;
    await rest('food_preferences', { token: client.token, method: 'POST', body: foods.map((f) => ({ client_id: client.id, food_id: f.id })) });
    const plans = async () => (await rest(`meal_plans?client_id=eq.${client.id}&select=id,locked,meal_plan_items(id)`, { token: client.token })).rows;
    return { client, foods, plans };
  }

  test('klijent bira namirnice i dobija plan za danas sa gramažama', async ({ page }) => {
    const client = await resetAccount(ACCOUNT_A);
    await rest(`profiles?id=eq.${client.id}`, { token: client.token, method: 'PATCH', body: {
      name: 'E2E Klijent', goal: 'mrsavljenje', location: 'kuca', level: 'pocetnik', per_week: 3,
      sex: 'z', birth_year: new Date().getFullYear() - 25, height_cm: 165, activity: 'sedeci',
    } });
    await rest('weights', { token: client.token, method: 'POST', body: { user_id: client.id, date: '2000-01-01', kg: 60 } });

    await loginUi(page, ACCOUNT_A);
    await page.getByRole('link', { name: 'Ishrana' }).click();
    await expect(page.locator('.target-kcal')).toContainText('1.290');
    await page.getByRole('button', { name: 'Izaberi namirnice koje voliš' }).click();

    for (const [name] of TEST_FOODS.filter(([, group]) => group !== 'voce')) await page.getByRole('checkbox', { name: new RegExp(name) }).check();
    await expect(page.getByRole('note')).toContainText('Nisi izabrao ništa iz: voće');
    await page.getByRole('checkbox', { name: /E2E Banana/ }).check();
    await expect(page.getByRole('note')).toHaveCount(0);
    await page.getByRole('button', { name: /Sačuvaj izbor/ }).click();

    const plan = page.getByRole('region', { name: 'Plan ishrane' });
    await expect(plan).toBeVisible();
    await expect(plan).toContainText('RUČAK');
    await expect(plan).toContainText(/E2E Piletina\d* *\d+ g/);
    await expect(plan).not.toContainText('predlog trenera');

    const saved = await rest(`food_preferences?client_id=eq.${client.id}&select=food_id`, { token: client.token });
    expect(saved.rows).toHaveLength(TEST_FOODS.length);

    // Odčekiravanje briše samo tu namirnicu.
    await page.getByRole('button', { name: 'Promeni namirnice' }).click();
    await page.getByRole('checkbox', { name: /E2E Banana/ }).uncheck();
    await page.getByRole('button', { name: /Sačuvaj izbor/ }).click();
    await expect(plan).toBeVisible();
    expect((await rest(`food_preferences?client_id=eq.${client.id}&select=food_id`, { token: client.token })).rows).toHaveLength(TEST_FOODS.length - 1);
  });

  test('plan se čuva, kvačica smanjuje preostale kalorije, a promena izbora pravi nov plan', async ({ page }) => {
    const { client, foods, plans } = await prepareClient();
    const checks = async () => (await rest(`meal_checks?client_id=eq.${client.id}&select=date,meal_type,kcal`, { token: client.token })).rows;
    const today = new Date().toLocaleDateString('sv-SE');

    await loginUi(page, ACCOUNT_A);
    await page.getByRole('link', { name: 'Ishrana' }).click();
    const plan = page.getByRole('region', { name: 'Plan ishrane' });
    await expect(plan).toContainText('Plan za danas');
    await expect.poll(async () => (await plans()).length, { timeout: 15000 }).toBe(1);
    const [first] = await plans();
    expect(first.locked).toBe(false);
    expect(first.meal_plan_items.length).toBeGreaterThan(20); // 7 dana × 5 obroka × 2–4 namirnice

    const ring = page.locator('.kcal-ring');
    await expect(ring).toContainText('1.290');
    await expect(ring).toContainText('kcal preostalo');

    // Dupli klik: drugi dodir se ignoriše dok prvi upis traje, pa ekran i baza ostaju usklađeni.
    const breakfast = page.getByRole('button', { name: 'Pojeo sam: Doručak' });
    await breakfast.dblclick();
    await expect(breakfast).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await checks()).length, { timeout: 15000 }).toBe(1);
    const [check] = await checks();
    expect(check).toMatchObject({ date: today, meal_type: 'dorucak' });
    await expect(ring).toContainText((1290 - check.kcal).toLocaleString('sr-RS'));

    // Kvačica ostaje posle ponovnog učitavanja, a plan se ne pravi ponovo dok se ulazi ne promene.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Pojeo sam: Doručak' })).toHaveAttribute('aria-pressed', 'true');
    expect((await plans()).map((p) => p.id)).toEqual([first.id]);

    // Budući dani se vide, ali bez kvačica.
    const todayIndex = (new Date().getDay() + 6) % 7;
    if (todayIndex < 6) {
      await page.getByRole('group', { name: 'Dan u nedelji' }).getByRole('button', { name: /^Nedelja/ }).click();
      await expect(plan).toContainText('Plan: nedelja');
      await expect(plan).toContainText('RUČAK');
      await expect(page.getByRole('button', { name: /^Pojeo sam/ })).toHaveCount(0);
    }

    // Promena izbora (bez banane) → nov plan, stari obrisan.
    const banana = foods.find((f) => f.name === 'E2E Banana');
    await rest(`food_preferences?client_id=eq.${client.id}&food_id=eq.${banana.id}`, { token: client.token, method: 'DELETE' });
    await page.reload();
    await expect(plan).toBeVisible();
    await expect.poll(async () => (await plans()).map((p) => p.id), { timeout: 15000 }).not.toEqual([first.id]);
    expect(await plans()).toHaveLength(1);

    // Skidanje kvačice briše red.
    await page.getByRole('button', { name: 'Pojeo sam: Doručak' }).click();
    await expect(page.getByRole('button', { name: 'Pojeo sam: Doručak' })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await checks()).length, { timeout: 15000 }).toBe(0);
    await expect(ring).toContainText('1.290');
  });

  test('trener menja grame i zaključava plan, a posle otključavanja plan se opet pravi sam', async ({ page, browser }) => {
    const { client, foods, plans } = await prepareClient();
    const chicken = foods.find((f) => f.name === 'E2E Piletina');
    const banana = foods.find((f) => f.name === 'E2E Banana');
    const todayIndex = (new Date().getDay() + 6) % 7;

    // Klijent otvori Ishranu i dobije plan.
    const clientContext = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: { width: 412, height: 839 } });
    const clientPage = await clientContext.newPage();
    await loginUi(clientPage, ACCOUNT_A);
    await clientPage.getByRole('link', { name: 'Ishrana' }).click();
    await expect.poll(async () => (await plans()).length, { timeout: 15000 }).toBe(1);
    const [first] = await plans();

    await resetAccount(ACCOUNT_TRAINER);
    await loginUi(page, ACCOUNT_TRAINER);
    await finishOnboarding(page);
    await page.goto(`/#/klijent/${client.id}`);
    const card = page.getByRole('region', { name: 'Plan ishrane klijenta' });
    await expect(card).toContainText('Otključan');
    await expect(card).toContainText('Ove nedelje pojedeno 0 od');
    await expect(card).toContainText(' / 1.290 kcal');

    const chickenAtLunch = card.getByLabel('E2E Piletina, Ručak (g)');
    await chickenAtLunch.fill('0');
    await card.getByRole('button', { name: 'Sačuvaj i zaključaj' }).click();
    await expect(card.getByRole('alert')).toHaveText('Gramaža mora biti ceo broj od 1 do 2000.');
    await chickenAtLunch.fill('200');
    await card.getByRole('button', { name: 'Sačuvaj i zaključaj' }).click();
    await expect(page.getByText('Plan sačuvan i zaključan')).toBeVisible();
    await expect(card).toContainText('Zaključan');

    const lunchItem = async () => (await rest(
      `meal_plan_items?plan_id=eq.${first.id}&weekday=eq.${todayIndex}&meal_type=eq.rucak&food_id=eq.${chicken.id}&select=grams`,
      { token: client.token },
    )).rows;
    expect(await lunchItem()).toEqual([{ grams: 200 }]);
    expect((await plans())[0]).toMatchObject({ id: first.id, locked: true });

    // Klijent vidi Akijeve grame; promena izbora više ne pravi nov plan.
    await rest(`food_preferences?client_id=eq.${client.id}&food_id=eq.${banana.id}`, { token: client.token, method: 'DELETE' });
    await clientPage.reload();
    const lunchCard = clientPage.locator('.meal-card').filter({ has: clientPage.getByRole('button', { name: 'Pojeo sam: Ručak', exact: true }) });
    await expect(lunchCard).toContainText(/E2E Piletina\s*200 g/);
    await expect(clientPage.getByText('Plan je pripremio', { exact: false })).toBeVisible();
    await expect(clientPage.getByRole('button', { name: 'Promeni namirnice' })).toHaveCount(0);
    expect((await plans()).map((p) => p.id)).toEqual([first.id]);

    // Otključavanje: klijentov plan se pri sledećem otvaranju pravi ponovo (izbor se u međuvremenu promenio).
    await card.getByRole('button', { name: 'Otključaj plan' }).click();
    await expect(page.getByText('Plan otključan')).toBeVisible();
    await expect(card).toContainText('Otključan');
    await clientPage.reload();
    await expect(clientPage.getByRole('button', { name: 'Promeni namirnice' })).toBeVisible();
    await expect.poll(async () => (await plans()).map((p) => p.id), { timeout: 15000 }).not.toEqual([first.id]);
    await clientContext.close();
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

  // Odbijamo samo zahteve ka bazi; setOffline bi isključio i dev server.
  // Supabase sam ponavlja neuspela čitanja 3 puta (1 + 2 + 4 s), pa greška stiže tek posle ~7 s.
  const DATA = '**/rest/v1/**';
  const AFTER_RETRIES = { timeout: 15_000 };
  const cutNetwork = (page) => page.route(DATA, (route) => route.abort());
  const noConnection = (page) => page.getByRole('heading', { name: 'Nema veze' });

  test('bez mreže: ekran kaže Nema veze i oporavlja se dugmetom i sam od sebe', async ({ page }) => {
    await finishOnboarding(page);

    await cutNetwork(page);
    await page.getByRole('link', { name: 'Napredak' }).click();
    await expect(noConnection(page)).toBeVisible(AFTER_RETRIES);
    await page.unroute(DATA);
    await page.getByRole('button', { name: 'Pokušaj ponovo' }).click();
    await expect(page.getByRole('heading', { name: 'Napredak' })).toBeVisible();

    await cutNetwork(page);
    await page.getByRole('link', { name: 'Početna' }).click();
    await expect(noConnection(page)).toBeVisible(AFTER_RETRIES);
    await page.unroute(DATA);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.getByRole('heading', { name: 'Zdravo, Tester' })).toBeVisible();
  });

  test('bez mreže: upisi daju poruku, a posle uspevaju', async ({ page }) => {
    // Kraj onboardinga
    await page.getByLabel('Ime').fill('Tester');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Nastavi' }).click();
    await cutNetwork(page);
    await page.getByRole('button', { name: 'Kreni sa treningom' }).click();
    // Kraj onboardinga prvo čita profil, pa i ovde čekamo ponavljanja.
    await expect(page.getByRole('alert')).toHaveText('Nije sačuvano. Proveri internet i pokušaj ponovo.', AFTER_RETRIES);
    await page.unroute(DATA);
    await page.getByRole('button', { name: 'Kreni sa treningom' }).click();
    await expect(page.getByRole('heading', { name: 'Zdravo, Tester' })).toBeVisible();

    // Težina u Profilu
    await page.getByRole('link', { name: 'Profil' }).click();
    await page.getByLabel('Težina danas u kilogramima').fill('80');
    await cutNetwork(page);
    await page.getByRole('button', { name: 'Upiši težinu' }).click();
    await expect(page.getByText('Težina nije upisana. Proveri internet.')).toBeVisible();
    await page.unroute(DATA);
    await page.getByRole('button', { name: 'Upiši težinu' }).click();
    await expect(page.getByText(/poslednje: 80/)).toBeVisible();

    // Aktiviranje programa
    await page.getByRole('link', { name: 'Treninzi' }).click();
    await page.getByRole('button', { name: /Snaga bez teretane/ }).click();
    await expect(page.getByRole('button', { name: 'Izaberi ovaj program' })).toBeVisible();
    await cutNetwork(page);
    await page.getByRole('button', { name: 'Izaberi ovaj program' }).click();
    await expect(page.getByText('Program nije aktiviran. Proveri internet.')).toBeVisible();
    await page.unroute(DATA);
    await page.getByRole('button', { name: 'Izaberi ovaj program' }).click();
    await expect(page.getByRole('button', { name: /Počni sledeći trening/ })).toBeVisible();
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
