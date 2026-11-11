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

## ✅ Faza 2 — Nalozi i baza (Supabase, gotovo)
Cilj: klijent se prijavi, podaci su na serveru, trener vidi ko trenira.
1. Napraviti Supabase projekat, pokrenuti `docs/supabase-schema.sql`
2. `npm install @supabase/supabase-js`, ključevi u `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
3. Login ekran (email magic link ili email + lozinka)
4. Prebaciti demo sadržaj u bazu (`docs/supabase-seed.sql`)
5. Prepisati funkcije u `src/data/api.js` na Supabase pozive
6. Ekran **Napredak**: grafikon težine, mere, istorija treninga
7. Trenerov pravi sadržaj: video za svaku vežbu, Bunny Stream (preporuka) ili YouTube (unlisted)

## Faza 3 — Trener i komunikacija (u toku)
1. ✅ **Trener panel**: lista klijenata i njihov napredak, vežbe sa videom, treninzi i programi
2. **Poruke** sa trenerom (Supabase Realtime): ✅ tekstualne poruke; prilozi (fotografije) sledeći
3. ✅ **Ishrana**: kalkulator dnevnog cilja, baza namirnica i struktura obroka (trener), klijent bira namirnice,
   generator nedeljnog plana sa gramažama, kvačice "pojeo sam" (dizajn 05), trener menja grame i zaključava plan
4. Fotografije napretka (Supabase Storage, privatni bucket), sa pre/posle poređenjem

## Faza 4 — Članarina (u toku)
- ✅ Korak 1: trener ručno evidentira uplate, klijent plaća preko IPS QR koda (uplata na račun, bez ugovora sa bankom),
  5 dana pristupa posle isteka, pa zaključavanje treninga i ishrane u aplikaciji.
- Korak 2 (kad bude dovoljno klijenata): kartična naplata sa automatskim mesečnim plaćanjem (AllSecure ili Monri,
  ugovor sa bankom), zaključavanje i u bazi.
- Pre naplate pravim klijentima: registrovana delatnost (npr. paušalac) i provera fiskalnog računa kod knjigovođe.
- Video samo za aktivnu članarinu: potpisani Bunny linkovi preko Supabase Edge Function (ključ ne sme u aplikaciju).
- Pravna strana: ✅ politika privatnosti i pristanak (nacrt, pre pravih klijenata da pogleda pravnik); uslovi korišćenja, fiskalizacija.
- Pre pravih klijenata: sopstveni domen i slanje mejlova (Resend) za reset lozinke.

## Testiranje (paralelno sa fazama)
- ✅ Playwright E2E nad pravom bazom (samo `e2e-*` nalozi): tokovi kroz UI, RLS bezbednost, čiste funkcije (kalkulator, generator plana)

## Kasnije, možda (da se ne zaboravi)
- Push notifikacije: podsetnik za trening, nova poruka. Traži serversku funkciju (Supabase Edge Function) i VAPID ključeve;
  na iPhone-u radi samo kad je aplikacija instalirana na početni ekran (iOS 16.4+).
- Font naslova nema č i đ (iscrtavaju se rezervnim fontom); rešava se u dizajn sistemu.
- Automatsko brisanje naloga (dugme "Obriši nalog"); do tada brisanje na zahtev, u roku od 30 dana.
- Performanse baze kad bude više korisnika (Supabase savetnik): indeksi na stranim ključevima i `(select auth.uid())`
  u polisama umesto `auth.uid()`; sada je razlika neprimetna.
