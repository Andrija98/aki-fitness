# Treniraj sa Akijem — PWA za trenera i klijente

Aplikacija trenera (Aki) za klijente: video programi, praćenje treninga, ishrana, napredak sa fotografijama i poruke.
Plan po fazama: `docs/PLAN.md`. Kako aplikacija radi: `docs/KAKO-RADI.md`. Uputstvo za trenera: `docs/VODIC-ZA-TRENERA.md`. Trenutno: **faza 3 u toku** (trener i komunikacija; sledeće po planu je članarina).

Odgovaraj na srpskom (latinica). Ja sam QA automation inženjer (Java, Selenium, JUnit, Python),
radio sam i React/Node/PostgreSQL. Želim da RAZUMEM kod, ne samo da ga dobijem:
- Pre veće izmene ukratko objasni plan i koje fajlove menjaš, pa sačekaj moje "ok".
- Posle izmene objasni šta si uradio i zašto.
- Ako je moja ideja loša ili prekomplikovana, reci direktno.

## Komande
- `npm install`: prvi put
- `npm run dev`: razvojni server sa hot reload-om (`--host`, pa radi i sa telefona u istoj mreži)
- `npm run build`: produkcijski build u `dist/` (to ide na Netlify)
- `npm run preview`: lokalno pokreni build
- `npm run test:e2e`: Playwright testovi nad pravom bazom, samo nalozima `e2e-*` (lozinke u `.env.test.local`)

## Struktura
```
src/
  main.jsx            ulaz: render + registracija service workera (samo u produkciji)
  App.jsx             bira ekran: nije prijavljen → Login, nema pristanka → PrivacyConsent, nema profila → Onboarding, inače po ruti (#/...)
  config.js           ime trenera i aplikacije
  data/api.js         JEDINO mesto za čitanje/pisanje podataka (async funkcije)
  lib/supabase.js     Supabase klijent (koristi ga samo api.js)
  lib/useAuth.js      hook za sesiju: undefined = proverava, null = odjavljen
  lib/router.js       mali hash router: useRoute(), navigate('program', id), href(), back()
  lib/useData.js      hook za async učitavanje: const { data, reload } = useData(() => api(), [deps])
  lib/format.js       datumi, brojevi, nedelja, streak, YouTube ID
  lib/nutrition.js    kalkulator dnevnog cilja, grupe namirnica, obroci (čiste funkcije, testovi u e2e/nutrition.spec.js)
  lib/mealPlan.js     generator plana ishrane i otisak ulaza (čista funkcija, testovi u e2e/mealplan.spec.js)
  lib/image.js        smanjivanje fotografije pre slanja (canvas, JPEG)
  lib/toast.js        toast('Poruka') sa bilo kog mesta
  components/         TabBar, Icon (Lucide), Media (Striped placeholder, VideoPlayer), DayPicker (dani u nedelji), PhotoViewer (slika preko celog ekrana)
  screens/            jedan fajl po ekranu
  styles/organic.css  dizajn sistem (NE MENJATI ručno, to su tokeni iz Claude Design-a)
  styles/app.css      stilovi aplikacije, samo preko tokena
design/               originalni dizajn iz Claude Design-a (referenca za nove ekrane)
docs/                 PLAN.md, SQL: supabase-schema.sql, -seed, -measurements, -messages, -nutrition-targets, -foods, -foods-seed, -food-preferences, -meal-plans, -privacy, -progress-photos, -message-photos, -hardening (tim redom)
public/               manifest, sw.js, ikonice
e2e/                  Playwright: klijent.spec.js (tokovi kroz UI), rls.spec.js (bezbednost baze)
```

## Rute
`#/pocetna`, `#/treninzi`, `#/program/:id`, `#/trening/:programId/:workoutId`, `#/profil`, `#/lozinka`, `#/vezbe`, `#/klijenti`, `#/klijent/:id`, `#/trener-treninzi`, `#/trener-trening/:id|novi`, `#/trener-programi`, `#/trener-program/:id|novi`, `#/namirnice`, `#/namirnica/:id|nova`, `#/obroci` (poslednjih deset samo trener), `#/ciljevi`,
`#/napredak`, `#/poruke` (trener: sanduče, `#/poruke/:klijentId` razgovor), `#/ishrana` (cilj, nedeljni plan i kvačice), `#/ishrana/namirnice` (izbor namirnica), `#/privatnost` (politika, i bez prijave).

## Pravila
- **Podaci samo kroz `src/data/api.js`.** Ekrani nikad ne zovu Supabase direktno. Sve funkcije su async.
- Upiti za klijentove podatke uvek filtriraju po `user_id`, jer RLS treneru dozvoljava da čita sve.
- **Dizajn:** Organic sistem. Boje, fontovi, radijusi isključivo preko CSS promenljivih
  (`var(--color-accent)`, `var(--font-heading)`…), nikad hex u komponentama. Pravila: `design/organic-design-system.md`.
  Novi ekran: prvo pogledaj `design/fitness-app-design.html` (ekrani 05 Ishrana, 06 Napredak, 07 Poruke već postoje u dizajnu).
- Ikonice: Lucide, `stroke-width 2.75`, dodaju se u `components/Icon.jsx`.
- Mobilno prvo: input font ≥16px (iOS zoom), dodirne površine ≥44px, `env(safe-area-inset-*)`.
- Pristupačnost: pravi `<button>`/`<a>`, `aria-label` na dugmićima samo sa ikonicom.
- Bez novih biblioteka bez mog pitanja. Male, fokusirane izmene; ne refaktoriši ono što nisam tražio.
- Tekst u aplikaciji je na srpskom (latinica).

## Provera pre commita
`npm run build` mora da prođe. Posle nove funkcionalnosti ažuriraj `docs/KAKO-RADI.md` (i `docs/VODIC-ZA-TRENERA.md` ako se tiče trenera). Ručno: onboarding → Početna → današnji trening → završi par serija
(pauza se pojavljuje) → rezime → Početna pokazuje kvačicu za danas. Konzola bez grešaka.

## Deploy
GitHub repo povezan sa Netlify-em: build command `npm run build`, publish directory `dist`.
Svaki `git push` na `main` automatski deploy-uje.
