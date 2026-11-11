# Kako radi aplikacija: Treniraj sa Akijem

Tehnički pregled za razvoj: kako su delovi povezani, gde je bezbednost i zašto su neke stvari urađene baš tako.
Pravila za pisanje koda su u `CLAUDE.md`, plan po fazama u `docs/PLAN.md`, a uputstvo za trenera u `docs/VODIC-ZA-TRENERA.md`.

> Ovaj dokument se ažurira posle svake nove funkcionalnosti (pravilo u `CLAUDE.md`).

---

## 1. Ukratko

PWA (web aplikacija koja se instalira na telefon) za trenera i njegove klijente: video treninzi, praćenje serija,
napredak sa fotografijama, ishrana sa nedeljnim planom i poruke uživo.

| Deo | Tehnologija |
|---|---|
| Ekrani | React 19 + Vite, sopstveni mali hash ruter (`#/...`) |
| Izgled | Organic dizajn sistem (`src/styles/organic.css`, samo CSS promenljive) |
| Podaci, prijava, fajlovi, uživo | Supabase: Postgres + RLS, Auth, Storage, Realtime |
| Hosting | Netlify (statički fajlovi iz `dist/`), deploy na svaki `git push` |
| Testovi | Playwright nad pravom bazom, samo `e2e-*` nalozi |

**Nema sopstvenog servera.** Telefon razgovara direktno sa Supabase-om. Zato je sva zaštita podataka u samoj bazi (RLS),
a ne u kodu aplikacije: kod u browseru svako može da pročita i izmeni.

```
 Telefon (PWA)                                    Supabase (EU, Irska)
 ┌──────────────────────┐   HTTPS (REST)      ┌───────────────────────────────┐
 │ React ekrani         │ ──────────────────▶ │ Auth: prijava, JWT token      │
 │   │                  │                     │ Postgres: tabele + RLS polise │
 │   ▼                  │   WebSocket         │ Realtime: nove poruke uživo   │
 │ src/data/api.js ─────┼──────────────────▶  │ Storage: privatne fotografije │
 │ (jedino mesto za     │                     └───────────────────────────────┘
 │  čitanje i pisanje)  │
 └──────────────────────┘
          ▲  HTML/JS/CSS (jednom, pa iz keša)
 ┌────────┴─────────┐
 │ Netlify          │
 └──────────────────┘
```

---

## 2. Bezbednost: gde je i kako radi

### 2.1 Javni ključ i RLS
`VITE_SUPABASE_ANON_KEY` je **javan** (ugrađen u aplikaciju). Sa njim svako može da pošalje upit bazi, ali svaki upit
nosi i token prijavljenog korisnika, a Postgres za svaki red proverava **polise (Row Level Security)**:

- klijent čita i menja samo **svoje** redove (`user_id = auth.uid()`),
- trener čita sve (`public.is_trainer()`), a menja samo sadržaj (programi, vežbe, namirnice) i ono što je izričito dozvoljeno
  (zaključavanje plana ishrane, gramaže),
- neprijavljen korisnik ne dobija ništa.

Zato `e2e/rls.spec.js` gađa API **direktno**, mimo aplikacije: proverava da nalog B ne može da pročita, upiše ili obriše
tuđe podatke čak ni kad zaobiđe ekran.

### 2.2 Zašto upiti uvek filtriraju po `user_id`
RLS treneru dozvoljava da čita sve. Kad bi `getWeights()` vratio "sve što smem da vidim", trener bi na svom ekranu Napredak
video težine svih klijenata. Zato svaka funkcija u `api.js` filtrira po `user_id` (bez parametra: prijavljeni korisnik;
trener prosleđuje id klijenta).

### 2.3 Ograničenja po kolonama
RLS bira **redove**, ne kolone. Gde treba ograničiti kolonu, koristi se `grant update (kolona)`:
kod poruka je dozvoljena izmena samo `read_at` (tekst i prilog poruke se ne menjaju).
Uloga u profilu se čuva drugačije: polisa `profil: izmena` traži da `role` ostane ista.

### 2.4 Pomoćne funkcije (`security definer`)
Neke polise moraju da pročitaju tabelu koju same štite (npr. "da li je plan ovog klijenta zaključan").
Takva provera bi pozvala samu sebe (beskonačna rekurzija), pa se radi kroz funkciju koja se izvršava bez RLS-a:
`is_trainer()`, `meal_plan_locked()`, `meal_plan_writable(id)`.
Pravilo: takva funkcija gleda **samo pozivaoca** (`auth.uid()`), ne prima tuđi id, i nije dostupna neprijavljenima.
Pregled svih funkcija i zašto je koja dostupna: `docs/supabase-hardening.sql`.

### 2.5 Fotografije (Storage)
Bucketi `progress-photos` i `message-photos` **nisu javni**. Putanja fajla počinje vlasnikom:
`{user_id}/{id}.jpg` (napredak) i `{client_id}/{id}.jpg` (poruke, folder = razgovor). Polise nad `storage.objects`
porede prvi deo putanje sa `auth.uid()`. Aplikacija sliku prikazuje preko **potpisanog linka koji važi sat vremena**
(`createSignedUrls`), pa ni podeljen link ne radi dugo.

Napomena: Supabase CDN onome ko je fajl već čitao može još kratko da vrati obrisan fajl iz keša (keš je po korisniku,
drugima se ne prikazuje). Zato testovi brisanje proveravaju listom fajlova, a ne čitanjem.

### 2.6 Privatnost i pristanak
Podaci o telu i zdravlju (težina, mere, fotografije) po ZZPL traže **izričit pristanak**. Redosled u `App.jsx`:
nema pristanka (ili je za stariju verziju politike) → ekran `PrivacyConsent` pre svega ostalog. Pristanak se čuva u
`profiles.privacy_accepted_at` i `privacy_version`. Kad se politika suštinski promeni, poveća se `PRIVACY_VERSION`
u `src/config.js` i svi korisnici ponovo daju pristanak, uz rečenicu `PRIVACY_CHANGES` o tome šta je novo.

---

## 3. Kako aplikacija bira ekran (`src/App.jsx`)

1. `#/privatnost` → politika privatnosti, **i bez prijave**.
2. Nije prijavljen → `Login`. (Link za novu lozinku iz mejla nosi token u `#`, pa ima prednost nad ruterom.)
3. Nema pristanka za trenutnu verziju politike → `PrivacyConsent`.
4. Nema profila (onboarding nije završen) → `Onboarding`.
5. Inače ekran po ruti. Trenerske rute (`#/klijenti`, `#/namirnice`…) klijentu prikazuju Početnu.

Ako učitavanje profila ne uspe (nema mreže), prikazuje se ekran **Nema veze** (`LoadError`) sa dugmetom za ponovni pokušaj,
a ne onboarding. Bez toga bi pad mreže izgledao kao "nemaš profil".

Supabase klijent sam ponavlja neuspešna čitanja (1 + 2 + 4 s), pa se greška vidi tek posle ~7 sekundi.

---

## 4. Konvencije u kodu

- **`src/data/api.js` je jedino mesto koje zove Supabase.** Ekrani dobijaju camelCase objekte, a baza ima snake_case kolone.
  Prevod je u api.js.
- Učitavanje: `const { data, error, reload } = useData(() => getNesto(id), [id])`. Bez indikatora učitavanja:
  ekran se pojavi kad stignu podaci.
- Kratke poruke: `toast('Sačuvano')`. Navigacija: `navigate('program', id)`, `back('fallback')`.
- **Pisanje "prvo novo, pa brisanje starog"** (treninzi, planovi ishrane): klijent nikad ne vidi prazno stanje.
- **Optimistički prikaz** gde je brzina važna (kvačica "pojeo sam"): prikaže se odmah, a ako upis ne uspe, vrati se
  na staro i pojavi se poruka. Dok upis traje, novi dodir na isti element se ignoriše (inače "upiši" i "obriši"
  mogu stići obrnutim redom).
- Čiste funkcije bez React-a i baze (`lib/nutrition.js`, `lib/mealPlan.js`) testiraju se bez browsera.

---

## 5. Funkcionalnosti

### 5.1 Prijava i lozinka
Email + lozinka (Supabase Auth, najmanje 8 znakova i u aplikaciji i na serveru). Nalog otvara trener (za sada ručno u
Supabase-u). Zaboravljena lozinka šalje link; link otvara ekran `NewPassword`. Supabase-ov ugrađeni servis za slanje mejlova ima
mali dnevni limit; pre pravih klijenata treba sopstveni domen i servis za mejlove (npr. Resend).
Pri registraciji trigger `handle_new_user` pravi prazan red u `profiles`; "nema profila" znači da je `goal` prazan.

### 5.2 Onboarding
Ime → cilj i mesto → nivo i učestalost → težina. Posle čuvanja aplikacija predloži program po **osobinama**, među
objavljenim programima (`lib/programs.js`, `pickSuggestedProgram`): mesto je važnije (kod kuće se teretana ne može
odraditi), pa nivo; program bez mesta ili za "Svi nivoi" odgovara svima; kod istog rezultata prvi po abecedi.
Bez objavljenih programa nema predloga. Predlog ne zavisi od fiksnih ID-jeva, pa radi sa bilo kojim programom trenera.
Isti ekran služi za izmenu ciljeva (`#/ciljevi`).

### 5.3 Treninzi
Program ima raspored treninga (`program_schedule`), trening ima vežbe (`workout_items`), vežba ima video: **Bunny Stream**
(`iframe.mediadelivery.net/embed/{biblioteka}/{video}`) ili YouTube (unlisted, prikaz preko `youtube-nocookie.com`).
`lib/video.js` prepoznaje oba linka i čuva ih u jednom obliku; Bunny plejer ne pušta i ne učitava video dok klijent ne pritisne
Play (štedi mobilni internet). Bunny biblioteka ima "Allowed Domains" (samo adresa aplikacije), što sprečava ugrađivanje na
drugim sajtovima, ali nije potpuna zaštita: potpisani linkovi samo za aktivnu članarinu su sledeći korak (traže serversku funkciju). Klijent je upisan u jedan aktivni program (`enrollments`).
Stavka treninga ima serije, ponavljanja (ili sekunde), opcioni **raspon** (`reps_max`, prikaz "4 serije × 10–12 ponavljanja"),
pauzu i **napomenu samo za taj trening** (`note`: "10 po nozi", "opcija 2: bench press", superset). Napomena je uz stavku, a ne
u savetu vežbe, jer je savet zajednički za sve programe. Ista vežba ne sme dvaput u istom treningu (sesija broji serije po vežbi),
pa za superset sa vežbom koja se ponavlja postoji posebna vežba (npr. "Pregib za biceps sa gumom").
Superset za sada nema poseban tok: vežbe idu jedna za drugom, a napomena objašnjava naizmenično izvođenje.
Pauza 0 (prva vežba superseta) znači da se ekran pauze ne otvara, a kartica "Sledeće" piše "Bez pauze".
Sesija treninga (`WorkoutSession.jsx`): vežba po vežba, cilj i napomena ispod naziva, upis ponavljanja i kilaže, pauza sa odbrojavanjem, rezime;
na kraju se čuva `sessions` + `session_sets`.
**Brisanje** (`DeleteControl`): vežba, trening i program se brišu samo kad se nigde ne koriste (vežba: nije u treningu i
niko je nije radio; trening: nije u programu i niko ga nije odradio; program: niko ga nije izabrao ni trenirao po njemu).
Ekran prvo prebroji upotrebu i prikaže razlog; baza i sama odbija brisanje upotrebljenog (strani ključevi bez kaskade, kod
23503), pa i trka završi jasnom porukom. Kaskadno se brišu samo stavke treninga i raspored programa.

### 5.4 Napredak
Težina (grafikon), mere (struk, kukovi, ruka), istorija treninga i **fotografije napretka** (`ProgressPhotos.jsx`):

1. Telefon smanji sliku pre slanja (`lib/image.js`: canvas, najviše 1600 px, JPEG ~0,8; poštuje EXIF rotaciju;
   na starijim browserima bez `createImageBitmap` slika se učitava preko `<img>`).
   Sa 4–8 MB na ~300 KB: štedi prostor (besplatno 1 GB) i mobilni internet.
2. Prvo se šalje fajl, pa red u `progress_photos`; ako red ne uspe, fajl se briše. Red ne sme da pokazuje na tuđ fajl
   (`check (path like user_id || '/%')`).
3. Prikaz preko potpisanih linkova; "Uporedi" stavlja dve fotografije jednu pored druge (starija levo).

Trener vidi isti ekran u profilu klijenta (`ClientDetail` → `Progress readOnly`), bez upisa i brisanja.

### 5.5 Poruke
Jedan razgovor po klijentu (`messages.client_id`). Nove poruke stižu preko **Realtime-a** (WebSocket), koji poštuje RLS:
drugi klijent ne dobija tuđe poruke ni preko WebSocket-a (ima test za to). Kao rezerva, razgovor se ponovo učitava
kad se aplikacija vrati u fokus ili se vrati mreža. "Pročitano" označava samo primalac; broj nepročitanih je na tabu.

**Fotografije u porukama:** dugme "Priloži fotografiju", slika se smanji kao kod napretka i ide sa tekstom iz polja kao
natpisom. Realtime šalje samo red iz baze, pa aplikacija pri prijemu pravi potpisani link. Zato poruka sa slikom stiže
malo kasnije od teksta poslatog posle nje; lista poruka se zato uvek drži po vremenu slanja. Ako pravljenje linkova ne uspe,
tekst se i dalje vidi, a umesto slike piše "Fotografija". Poslata fotografija se, kao i tekst, ne briše i ne menja.
Slika u balonu ima stalan oblik (4:5), da se razgovor ne pomera kad se učita; cela slika se vidi kad se otvori.

### 5.6 Ishrana
Četiri sloja, od najjednostavnijeg:

**a) Dnevni cilj (`lib/nutrition.js`)**
- Osnovni metabolizam po Mifflin-St Jeor formuli × faktor aktivnosti (1,2 do 1,9) = potrošnja.
- Cilj: mršavljenje −20 %, snaga +10 %, kondicija održavanje. Procenat umesto fiksnih ±500 kcal, jer je kod sitnije osobe
  −500 kcal preagresivno.
- Proteini: 2,0 / 1,8 / 1,6 g po kg. Iznad BMI 30 računa se za težinu koja odgovara BMI 25 (inače 120 kg → 240 g).
- Masti 25 % kalorija, ugljeni hidrati ostatak. Donja granica 1200 kcal (žene) / 1500 (muškarci); ispod 18 godina nema računa.
- Ekran prikazuje i red "Mršavljenje · 324 kcal manje od potrošnje (1.614)".
- Trener može ručno da postavi cilj (`nutrition_targets`); tada važi njegov.

**b) Namirnice i struktura obroka (trener)**
Namirnica ima vrednosti na 100 g u **sirovom/suvom** stanju, grupu (protein, mlečni, UH, mast, povrće, voće), obroke za koje
se nudi i najmanju/najveću porciju. Generator koristi **samo proverene i aktivne** namirnice (početnih 38 iz USDA baze stiže
neprovereno). Struktura obroka: pet obroka sa udelom kalorija (zbir 100 %) i grupama koje obrok sadrži.

**c) Izbor klijenta** (`food_preferences`): klijent čekira šta voli; za grupu bez izbora plan uzima trenerov predlog
(oznaka "predlog trenera").

**d) Generator plana (`lib/mealPlan.js`, čista funkcija)**
1. Svaki obrok dobija deo dnevnih kalorija. Proteini se dele samo na obroke koji imaju proteinsku grupu
   (inače bi deo proteina "nestao" u voćnoj užini).
2. Iz svake grupe obroka jedna namirnica; namirnice se smenjuju po danima, a ista se izbegava u dva obroka istog dana.
3. Gramaže po ulogama: povrće fiksno (150 g), protein pogađa proteine, mast masti, UH popunjava kalorije.
4. Dnevno balansiranje: ako granice porcija spreče pogodak, razlika ide na UH pa masti u drugim obrocima.
   **Protein se nikad ne smanjuje**, a povećava se samo kad drugo nema mesta (tada trener dobija upozorenje).
5. Zaokruživanje na 5 g. Upozorenja: preuske granice porcija, grupa bez proverene namirnice.

**Sačuvan plan (`meal_plans`, `meal_plan_items`)**
- Plan je nedeljni (dan u nedelji 0–6) i ponavlja se dok se ulazi ne promene.
- Uz plan se čuva **otisak ulaza** (`inputsKey`: cilj, struktura obroka, proverene namirnice, izbor). Pri otvaranju Ishrane,
  ako se otisak razlikuje i plan nije zaključan, generator pravi nov plan: prikaže se odmah, čuva se u pozadini.
- Zamena: prvo nov plan sa stavkama, pa brisanje **starijih** planova (ne "svih osim mog": dve istovremene zamene sa dva
  uređaja bi inače obrisale jedna drugu).
- **Zaključavanje:** trener menja grame u kartici "Plan ishrane" (profil klijenta); čuvanje prvo zaključa plan, pa menja
  grame (obrnutim redom bi klijent baš tada mogao da dobije nov plan). Zaključan plan generator ne dira, a klijent ne može
  da ga zameni ni obriše (RLS). Pri čitanju zaključan plan ima prednost nad novijim.
- **Kvačice "pojeo sam"** (`meal_checks`) čuvaju **snimak** kalorija i makroa obroka: ako se plan kasnije promeni,
  istorija ostaje tačna. Kvačica se ne može upisati za budući dan (po beogradskom vremenu).
- Ekran po dizajnu 05: dani u nedelji, krug "kcal preostalo", trake makroa, kvačica po obroku.

### 5.7 Trener
Uloga se postavlja ručno u bazi (`profiles.role = 'trainer'`). Trenerske stavke su u Profilu: Klijenti, Namirnice,
Struktura obroka, Uređivanje programa, Uređivanje treninga, Vežbe. Tab Poruke kod trenera je sanduče sa svim razgovorima.

### 5.8 Članarina (prvi korak: ručna evidencija + IPS QR)
- **Uplate** (`membership_payments`) evidentira trener u profilu klijenta; klijent ih samo čita (RLS), pa ne može sam sebi
  da produži članarinu. "Plaćeno do" je najkasniji `period_end`. Produženje (`extendPaidUntil` u `lib/membership.js`) se
  nastavlja na važeću članarinu, a posle isteka kreće od **dana uplate**, pa ni klijentovo ni trenerovo kašnjenje ne kraći mesec.
- **Stanja** (`membershipStatus`): bez uplata → bez ograničenja (postojeći nalozi); aktivna; ističe uskoro (5 dana pre);
  istekla, ali još 5 dana pristupa (`GRACE_DAYS`); zaključano. "Plaćeno do 10." = pristup zaključno sa 15., zaključava se 16.
- **Zaključavanje je u aplikaciji** (`App.jsx`): Treninzi i Ishrana pokazuju `MembershipLocked`; Početna, Poruke, Napredak i
  Profil rade. Baza ne zaključava sadržaj (programi i videi su i dalje čitljivi preko API-ja), što je poznato ograničenje.
  Uplate se čitaju ponovo pri svakoj promeni ekrana, pa se klijent otključa čim trener evidentira uplatu.
- **IPS QR** (`lib/ips.js`): sadržaj po NBS standardu (`K:PR|V:01|C:1|R:…|N:…|I:RSD…|SF:289|S:…`), broj računa proveren
  kontrolnim brojem (MOD 97). Ovakav QR (uplata na račun) ne traži ugovor sa bankom. Slika se pravi u browseru bibliotekom
  `qrcode`, koja se učitava tek na ekranu sa QR kodom. Podatke za uplatu (`billing_settings`, jedan red) unosi trener na
  ekranu Naplata; čitaju ih svi prijavljeni.
- "Uplata je poslata" šalje poruku treneru; članarina se produžava tek kad trener vidi novac i evidentira uplatu.
- Pravno: za stalnu naplatu treba registrovana delatnost (npr. paušalac) i provera obaveze fiskalnog računa kod knjigovođe.

### 5.9 Rad bez interneta
`public/sw.js` (samo u produkciji): network-first. Fajlovi aplikacije se čuvaju u kešu, pa se aplikacija otvara i bez mreže.
Zahtevi ka Supabase-u, Bunny-ju, YouTube-u i fontovima idu direktno (ne kešira ih). Kad podaci ne mogu da se učitaju, ekran "Nema veze".
Za brisanje starog keša na svim telefonima povećaj `VERSION` u `sw.js`.

---

## 6. Baza

SQL fajlovi u `docs/`, pokreću se ručno u Supabase SQL Editoru, **ovim redom**:
`supabase-schema.sql`, `-measurements`, `-messages`, `-nutrition-targets`, `-foods`, `-foods-seed`,
`-food-preferences`, `-meal-plans`, `-privacy`, `-progress-photos`, `-message-photos`, `-workout-item-details`,
`-memberships`, `-hardening` (poslednji). Sadržaj programa (vežbe, treninzi, program) dolazi posle šeme, npr.
`supabase-program-kucni-muskarci.sql`; ti fajlovi su bezbedni za ponovno pokretanje (`on conflict do nothing`).

Svaki fajl na vrhu ima komentar šta dodaje i zašto. Ako je fajl već pokrenut, a kasnije je ispravljen, ispravka za
postojeću bazu se daje posebno (glavni fajl ostaje ispravan za novu instalaciju).

| Tabela | Šta čuva | Ko čita / piše |
|---|---|---|
| `profiles` | ime, cilj, uloga, podaci za kalkulator, pristanak | svoj red; trener čita sve |
| `exercises`, `workouts`, `workout_items`, `programs`, `program_schedule` | sadržaj | svi čitaju (klijent samo objavljene programe), trener piše |
| `enrollments`, `sessions`, `session_sets`, `weights`, `measurements` | podaci klijenta | klijent svoje; trener čita |
| `messages` | poruke i prilozi | učesnici razgovora; izmena samo `read_at` |
| `nutrition_targets` | trenerov ručni cilj | klijent čita svoj; trener piše |
| `foods`, `meal_templates` | namirnice, struktura obroka | svi čitaju, trener piše |
| `food_preferences` | izbor klijenta | klijent svoje; trener čita |
| `meal_plans`, `meal_plan_items` | sačuvan plan | klijent dok nije zaključan; trener zaključava i menja grame |
| `meal_checks` | pojedeni obroci (snimak) | klijent svoje, ne za budućnost; trener čita |
| `progress_photos` | red za fotografiju napretka | klijent svoje; trener čita |
| `membership_payments` | uplate članarine | klijent čita svoje; trener piše |
| `billing_settings` | primalac, račun, cena (jedan red) | svi prijavljeni čitaju; trener menja |

---

## 7. Testovi

`npm run test:e2e` (Playwright, jedan po jedan, emulacija Pixel 7, sam pokreće `npm run dev`).

| Fajl | Šta proverava |
|---|---|
| `e2e/klijent.spec.js` | tokovi kroz pravi UI: prijava, onboarding, trening, napredak, fotografije, poruke uživo (dva browsera), ishrana, trener, privatnost, rad bez mreže |
| `e2e/rls.spec.js` | bezbednost baze direktno preko API-ja: tuđi podaci, uloge, Storage, Realtime |
| `e2e/nutrition.spec.js`, `e2e/mealplan.spec.js` | čiste funkcije: formula kalkulatora, generator plana (bez browsera) |

Pravila:
- Testovi rade nad **pravom bazom**, ali samo sa nalozima `e2e-a`, `e2e-b`, `e2e-trener` (lozinke u `.env.test.local`).
- **Testovi ne zavise od pravog sadržaja trenera.** Pre testova `e2e/global-setup.js` postavi zajednički sadržaj
  (`e2e/fixtures.js`: 13 vežbi, 6 treninga, 4 objavljena programa, nazivi "E2E …", fiksni ID-jevi e0…/b0…/c0…), a
  `e2e/global-teardown.js` ga posle obriše. Dok testovi traju, te programe vide i pravi klijenti. Čišćenja po "E2E*" u
  testovima preskaču taj sadržaj (`NOT_FIXTURE_…`). Pravi sadržaj (npr. `supabase-program-kucni-muskarci.sql`) koristi
  druge ID-jeve (e1…/b1…/c1…), pa se nikad ne poklapa sa testnim.
- `resetAccount()` (u `e2e/helpers.js`) pre testa vraća nalog na početno stanje: briše njegove redove i fajlove, a odbija
  svaki nalog koji ne počinje sa `e2e-`. Briše kroz RLS, pa ni greškom ne može da dira tuđe podatke.
- Test podaci imaju prefiks `E2E` i brišu se posle testa.
- Realtime posle mirovanja ponovo pokreće vezu sa bazom, pa prva poruka može da kasni; testovi uživo zato čekaju do 20 s,
  a poruke grešaka razlikuju "sporo" od "bezbednosni problem".
- Gde god se piše tekst koji se ponavlja ("Ručak" je i u "Doručak"), lokatori koriste `exact: true` ili ulogu elementa.

---

## 8. Deploy

GitHub repo je povezan sa Netlify-em: build `npm run build`, folder `dist`. Svaki `git push` na `main` objavljuje novu
verziju za minut-dva. **Ako izmena traži novu kolonu ili tabelu, SQL mora biti pokrenut pre push-a**, inače produkcija
traži nešto što ne postoji i korisnici dobijaju "Nema veze".

---

## 9. Kontrolna lista za novu funkcionalnost sa podacima

1. SQL fajl u `docs/` sa komentarom na vrhu; dodaj ga u redosled (ovde, u `CLAUDE.md` i komentar u `supabase-schema.sql`).
2. RLS uključen, polise za select/insert/update/delete posebno; razmisli da li treneru treba čitanje, pisanje ili ništa.
3. Ako polisa mora da čita sopstvenu tabelu: `security definer` funkcija koja gleda samo `auth.uid()`, bez pristupa za `anon`.
4. Funkcije u `api.js` (filter po `user_id`, opcioni parametar za trenera), nikad Supabase iz ekrana.
5. Test u `rls.spec.js` (drugi klijent, neprijavljen, trener) i tok u `klijent.spec.js`.
6. `resetAccount()` briše nove podatke e2e naloga.
7. Novi lični podaci → dopuni politiku privatnosti i razmisli o povećanju `PRIVACY_VERSION`.
8. `npm run build`, ceo paket testova, pa ažuriraj ovaj dokument.

---

## 10. Poznata ograničenja

- Članarina se zaključava samo u aplikaciji; tehnički potkovan klijent može da pročita sadržaj preko API-ja. Uplate se
  evidentiraju ručno (nema automatske naplate karticom).

- Supabase-ov ugrađeni servis za slanje mejlova ima mali limit (reset lozinke); treba domen + Resend.
- Izuzeci za testove (`e2e_clear_messages`, brisanje priloga) prepoznaju e2e nalog po mejlu `e2e-…`. Korisnik koji bi
  preko API-ja promenio svoj mejl u `e2e-…` mogao bi da obriše **sopstveni** razgovor i svoje priloge (tuđe ne).
  Rizik je mali; potpuno rešenje je poseban Supabase projekat za testove.
- Klijent može da otpremi fotografiju u svoj folder i bez poruke (najviše 2 MB po fajlu); kod veće grupe korisnika vredi
  dodati ograničenje broja fajlova.
- "Leaked password protection" je samo u Pro planu.
- Font naslova nema č i đ (iscrtavaju se rezervnim fontom).
- Brisanje naloga je na zahtev (trener/rukovalac, u roku od 30 dana); nema dugmeta "Obriši nalog".
- Plan ishrane je isti svake nedelje dok se ulazi ne promene.
- Za vreme testova (oko 5 minuta) proverene `E2E` namirnice vide i pravi klijenti; posle testa se plan sam popravi.
- Kartica plana kod trenera se ne osvežava sama; ako klijent u međuvremenu dobije nov plan, trener dobija poruku da osveži.
