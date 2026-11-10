// Politika privatnosti. Otvara se i bez prijave (#/privatnost), sa Login ekrana, iz pristanka i iz Profila.
// Nacrt po Zakonu o zaštiti podataka o ličnosti (ZZPL); pre pravih klijenata neka ga pogleda pravnik.

import { back } from '../lib/router.js';
import { APP_NAME, PRIVACY_CONTROLLER, PRIVACY_EMAIL, PRIVACY_UPDATED, TRAINER_NAME } from '../config.js';
import Icon from '../components/Icon.jsx';

function Section({ title, children }) {
  return (
    <section className="col" style={{ gap: 8 }}>
      <h2 className="heading" style={{ margin: 0, fontSize: 20 }}>{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <main className="screen screen--no-tabbar policy">
      <div className="row between">
        <button className="round-btn" onClick={() => back('pocetna')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>
      <div className="col" style={{ gap: 6 }}>
        <h1 className="screen-title">Politika privatnosti</h1>
        <span className="small muted">{APP_NAME} · poslednja izmena: {PRIVACY_UPDATED}</span>
      </div>

      <Section title="Ko brine o tvojim podacima">
        <p>Rukovalac podacima je <strong>{PRIVACY_CONTROLLER}</strong>. Za sva pitanja o privatnosti piši na{' '}
          <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> ili treneru u porukama u aplikaciji.</p>
      </Section>

      <Section title="Koje podatke čuvamo">
        <ul>
          <li><strong>Nalog:</strong> email i lozinka (lozinka se čuva samo kao šifrovani otisak, niko je ne može pročitati).</li>
          <li><strong>Profil:</strong> ime, cilj, gde i koliko često treniraš, nivo.</li>
          <li><strong>Podaci o telu i zdravlju:</strong> pol, godina rođenja, visina, težina, telesne mere i koliko si aktivan.</li>
          <li><strong>Treninzi:</strong> koje treninge si odradio, serije, ponavljanja i trajanje.</li>
          <li><strong>Ishrana:</strong> dnevni cilj, namirnice koje voliš, plan obroka i obroci koje si označio kao pojedene.</li>
          <li><strong>Fotografije napretka</strong> koje sam dodaš. Čuvaju se u privatnom skladištu i prikazuju samo preko linka koji važi sat vremena.</li>
          <li><strong>Poruke</strong> koje razmenjuješ sa trenerom, uključujući fotografije koje pošalješ.</li>
        </ul>
      </Section>

      <Section title="Zašto i na osnovu čega">
        <p>Podatke koristimo samo da bi aplikacija radila: plan treninga i ishrane, praćenje napretka i dopisivanje sa trenerom.
          Podatke o telu i zdravlju, uključujući fotografije napretka, obrađujemo na osnovu tvog <strong>izričitog pristanka</strong>, koji daješ pri prvoj prijavi.
          Ne koristimo ih za reklame, ne prodajemo ih i ne delimo ih ni sa kim van onoga što je navedeno ispod.</p>
      </Section>

      <Section title="Ko vidi tvoje podatke">
        <p>Tvoje podatke vidiš ti i trener ({TRAINER_NAME}). Drugi korisnici ih ne vide; to obezbeđuju pravila same baze, ne samo aplikacija.</p>
        <p>Za rad aplikacije koristimo ove pružaoce usluga:</p>
        <ul>
          <li><strong>Supabase</strong>: baza podataka, skladište fotografija i prijava. Podaci se čuvaju u Evropskoj uniji (Irska).</li>
          <li><strong>Netlify</strong>: isporučuje samu aplikaciju. Ne čuva podatke koje uneseš, ali kao svaki server vidi tehničke podatke zahteva (npr. IP adresu).</li>
          <li><strong>Google Fonts</strong>: slova koja aplikacija koristi; Google pri učitavanju vidi tvoju IP adresu.</li>
          <li><strong>YouTube</strong>: video snimci vežbi, u režimu bez kolačića za praćenje. Kad pokreneš video, YouTube (Google) dobija tehničke podatke o pregledu.</li>
        </ul>
      </Section>

      <Section title="Koliko dugo čuvamo podatke">
        <p>Dok imaš nalog. Kad zatražiš brisanje naloga, brišemo sve tvoje podatke najkasnije u roku od 30 dana.</p>
      </Section>

      <Section title="Tvoja prava">
        <p>Imaš pravo da tražiš uvid u svoje podatke, ispravku, brisanje, ograničenje obrade i kopiju podataka u uobičajenom formatu.
          Pristanak možeš povući u svakom trenutku; to ne utiče na obradu pre povlačenja, ali bez njega aplikacija ne može da radi.
          Zahtev pošalji na <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> ili treneru u porukama; odgovaramo najkasnije u roku od 30 dana.</p>
        <p>Ako smatraš da su ti prava povređena, možeš podneti pritužbu Povereniku za informacije od javnog značaja i zaštitu podataka
          o ličnosti (<a href="https://www.poverenik.rs" target="_blank" rel="noreferrer">poverenik.rs</a>).</p>
      </Section>

      <Section title="Bezbednost i uređaj">
        <p>Veza sa aplikacijom je šifrovana (HTTPS). Na tvom uređaju aplikacija čuva samo podatke o prijavi i sopstvene datoteke za rad bez interneta;
          ne koristimo kolačiće za praćenje ni analitiku.</p>
      </Section>

      <Section title="Uzrast">
        <p>Aplikacija je namenjena punoletnim osobama. Ako si mlađi od 18 godina, koristi je samo uz saglasnost roditelja ili staratelja.</p>
      </Section>

      <Section title="Izmene politike">
        <p>Ako promenimo ovu politiku, obavestićemo te u aplikaciji. Datum poslednje izmene je na vrhu.</p>
      </Section>
    </main>
  );
}
