# Plan razvoja — Treniraj sa Akijem

Aplikacija trenera za njegove klijente: video programi, praćenje treninga, ishrana, napredak i poruke.
Gradimo u fazama. Svaka faza je upotrebljiva sama za sebe.

## ✅ Faza 1 — Frontend (gotovo)
- Vite + React, Organic dizajn sistem, PWA (instalacija na telefon)
- Onboarding (ime, cilj, mesto, nivo, učestalost, težina)
- Početna: današnji trening, nedelja, napredak programa, težina
- Treninzi: pretraga, filteri, aktivni program, detalj programa sa rasporedom
- Video trening: vežba po vežba, unos ponavljanja i kilaže, pauza sa odbrojavanjem, rezime
- Profil: statistike, upis težine, izmena ciljeva
- Podaci: lokalno na telefonu (`src/data/api.js` + localStorage), sadržaj iz `src/data/mockData.js`

## Faza 2 — Nalozi i baza (Supabase)
Cilj: klijent se prijavi, podaci su na serveru, trener vidi ko trenira.
1. Napraviti Supabase projekat, pokrenuti `docs/supabase-schema.sql`
2. `npm install @supabase/supabase-js`, ključevi u `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
3. Login ekran (email magic link ili email + lozinka)
4. Prepisati funkcije u `src/data/api.js` na Supabase pozive (ekrani se ne menjaju)
5. Prebaciti sadržaj iz `mockData.js` u bazu (seed skripta)
6. Ekran **Napredak**: grafikon težine, mere, istorija treninga
7. Trenerov pravi sadržaj: YouTube (unlisted) linkovi za svaku vežbu

## Faza 3 — Trener i komunikacija
1. **Trener panel** (posebna ruta ili posebna mala web app): lista klijenata, njihovi treninzi, dodavanje programa i vežbi
2. **Poruke** sa trenerom (Supabase Realtime)
3. **Ishrana**: plan obroka po danu, kalorije i makroi, PDF plan
4. Fotografije napretka (Supabase Storage, privatni bucket)
5. Push notifikacije (podsetnik za trening)

## Faza 4 — Članarina
- Plaćanje članarine. Za Srbiju proveriti opcije (npr. kartično plaćanje preko domaće banke ili servisa
  koji podržava RSD), pa zaključavanje premium sadržaja prema statusu u bazi.
- Pravna strana: uslovi korišćenja, politika privatnosti (zdravstveni podaci!), fiskalizacija.

## Testiranje (paralelno sa fazama)
- Playwright E2E za glavni tok: onboarding → trening → serije → rezime
- Testovi za `api.js` (Vitest) kad pređemo na Supabase
