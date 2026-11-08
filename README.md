# Treniraj sa Akijem

PWA aplikacija trenera za klijente: video programi i praćenje treninga. Instalira se iz browsera,
bez App Store-a i Google Play-a. Vite + React, dizajn iz Claude Design-a (Organic sistem).

## Pokretanje
Potreban je Node.js 20+ (https://nodejs.org, LTS verzija).

```bash
npm install
npm run dev
```
Otvori adresu koju ispiše (npr. http://localhost:5173). Sa telefona u istoj Wi-Fi mreži: `Network:` adresa.

## IntelliJ / VS Code
- **IntelliJ IDEA Ultimate**: File → Open → izaberi folder. Prepoznaje `package.json`;
  `npm run dev` pokreneš iz npm prozora ili terminala. (Community verzija nema JS/React podršku.)
- **VS Code**: File → Open Folder. Besplatan i odličan za React.
- **Claude Code**: u terminalu, u ovom folderu, pokreni `claude`. Sam čita `CLAUDE.md`.

## Git + GitHub + Netlify
```bash
git init
git add .
git commit -m "Faza 1: frontend"
git branch -M main
git remote add origin https://github.com/<tvoj-user>/aki-fitness.git
git push -u origin main
```
Netlify → Add new site → Import from GitHub → izaberi repo:
- Build command: `npm run build`
- Publish directory: `dist`

Od tada svaki `git push` automatski objavi novu verziju.

## Gde je šta
- `src/screens/`: ekrani
- `src/data/api.js`: svi podaci (sada lokalno, u fazi 2 Supabase)
- `src/data/mockData.js`: demo programi i vežbe. **Ovde trener upisuje YouTube linkove** (`videoUrl`)
- `design/`: originalni dizajn
- `docs/PLAN.md`: šta sledi, po fazama
- `docs/supabase-schema.sql`: baza za fazu 2 (testirana)
