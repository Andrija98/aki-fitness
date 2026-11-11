// Predlog programa posle onboardinga: bira se po osobinama (mesto, nivo), a ne po fiksnim ID-jevima,
// pa radi sa bilo kojim programom koji trener napravi. Čista funkcija (testovi u e2e/programs.spec.js).

const LEVEL_LABEL = { pocetnik: 'Početnik', srednji: 'Srednji', napredni: 'Napredni' };

// Mesto je važnije od nivoa: bez opreme se teretana ne može odraditi, a nivo se prilagođava serijama.
function locationScore(programLocation, wanted) {
  if (!programLocation) return 1;                 // program bez mesta važi svuda
  if (wanted === 'oba') return 2;                 // klijent trenira i kod kuće i u teretani
  return programLocation === wanted ? 3 : 0;
}

function levelScore(programLevel, wanted) {
  if (!programLevel || programLevel === 'Svi nivoi') return 1;
  return programLevel === LEVEL_LABEL[wanted] ? 2 : 0;
}

// programs: objavljeni programi redom kojim se prikazuju (abecedno); vraća najbolji ili null ako ih nema.
// Kod istog rezultata pobeđuje prvi u listi.
export function pickSuggestedProgram(programs, profile) {
  let best = null;
  let bestScore = -1;
  for (const p of programs) {
    const score = locationScore(p.location, profile.location) + levelScore(p.level, profile.level);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}
