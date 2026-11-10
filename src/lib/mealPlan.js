// Generator plana ishrane. Čista funkcija: isti ulaz uvek daje isti plan, bez baze i React-a.
//
// Za svaki dan i obrok (udeo > 0):
//   1. cilj obroka = dnevni cilj × udeo obroka
//   2. iz svake grupe obroka jedna namirnica: proverena, aktivna, dozvoljena za taj obrok, po mogućstvu
//      ona koju klijent voli (smenjuju se po danima); ako klijent ništa iz grupe nije čekirao, trenerov predlog
//   3. gramaže po ulogama: povrće fiksno, protein pogađa proteine, mast pogađa masti, a "punilac"
//      (UH/voće, inače mast, inače protein) popunjava kalorije; tri prolaza jer namirnice imaju mešane makroe
//   4. kad granice porcije spreče pogodak (npr. večera bez UH, a ulje na maksimumu), razlika u kalorijama dana
//      prebacuje se na UH i masti u svim obrocima tog dana; protein se dira tek u krajnjem slučaju,
//      da proteini ostanu tačni; na kraju zaokruživanje na 5 g.

export const PORTION_STEP = 5;
export const VEGETABLE_GRAMS = 150;

const ROLE = { protein: 'protein', mlecni: 'protein', mast: 'fat', uh: 'carbs', voce: 'carbs', povrce: 'fixed' };
const GROUP_LABEL = { protein: 'protein', mlecni: 'mlečni proizvodi', mast: 'mast', uh: 'ugljeni hidrati', voce: 'voće', povrce: 'povrće' };
const MACROS = ['kcal', 'protein', 'carbs', 'fat'];

export function nutrientsFor(food, grams) {
  const k = grams / 100;
  return { kcal: food.kcal * k, protein: food.protein * k, carbs: food.carbs * k, fat: food.fat * k };
}

function total(items) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const { food, grams } of items) {
    const n = nutrientsFor(food, grams);
    for (const m of MACROS) t[m] += n[m];
  }
  return t;
}

const clamp = (food, grams) => Math.min(food.maxG, Math.max(food.minG, grams));

function roundPortion(food, grams) {
  return clamp(food, Math.round(grams / PORTION_STEP) * PORTION_STEP);
}

// Ko popunjava kalorije: UH/voće; ako ih obrok nema, mast; ako ni nje nema, protein.
function fillerRole(chosen) {
  for (const role of ['carbs', 'fat', 'protein']) if (chosen.some((c) => c.role === role)) return role;
  return null;
}

// Neokrugljene gramaže za jedan obrok.
export function portionsFor(chosen, target) {
  const grams = chosen.map((c) => (c.role === 'fixed' ? clamp(c.food, VEGETABLE_GRAMS) : c.food.minG));
  const filler = fillerRole(chosen);
  const goal = { protein: 'protein', fat: 'fat', carbs: 'kcal' };

  for (let pass = 0; pass < 3; pass++) {
    for (const role of ['protein', 'fat', 'carbs']) {
      const idx = chosen.map((c, i) => (c.role === role ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) continue;
      const metric = role === filler ? 'kcal' : goal[role];
      const others = total(chosen.map((c, i) => ({ food: c.food, grams: idx.includes(i) ? 0 : grams[i] })));
      const need = Math.max(0, target[metric] - others[metric]) / idx.length;
      for (const i of idx) {
        const per100 = chosen[i].food[metric];
        grams[i] = per100 > 0 ? clamp(chosen[i].food, (need / per100) * 100) : chosen[i].food.minG;
      }
    }
  }
  return grams;
}

// Dnevna ravnoteža kalorija. entries: [{ food, role, grams }] za sve obroke dana (menja grams na mestu).
// Razliku preuzimaju UH, pa masti. Protein se dodaje samo ako drugo ne može, a nikad se ne smanjuje:
// manjak proteina je gori od malog viška kalorija (o višku plan upozori trenera).
function balanceDay(entries, targetKcal) {
  const close = (diff) => Math.abs(diff) <= targetKcal * 0.01;
  let diff = targetKcal - total(entries).kcal;
  const roles = diff > 0 ? ['carbs', 'fat', 'protein'] : ['carbs', 'fat'];
  for (const role of roles) {
    // Više prolaza po ulozi: kad jedna namirnica stigne do granice, ostale iste uloge preuzimaju ostatak
    // pre nego što se pređe na sledeću ulogu (inače bi protein rastao dok pirinač još ima mesta).
    for (let pass = 0; pass < 6 && !close(diff); pass++) {
      const room = entries.filter((e) => e.role === role && e.food.kcal > 0
        && (diff > 0 ? e.grams < e.food.maxG : e.grams > e.food.minG));
      if (!room.length) break;
      for (const e of room) {
        const before = e.grams;
        e.grams = clamp(e.food, before + (diff / room.length / e.food.kcal) * 100);
        diff -= ((e.grams - before) * e.food.kcal) / 100;
      }
    }
    if (close(diff)) return;
  }
}

// foods: [{ id, name, group, kcal, protein, carbs, fat, mealTypes, minG, maxG, verified, active }]
// templates: [{ mealType, label, sharePct, timeHint, groups }] redom kojim se obroci jedu
export function generatePlan({ target, templates, foods, likedIds, days = 7 }) {
  const liked = new Set(likedIds);
  const usable = foods.filter((f) => f.verified && f.active);
  const warnings = [];
  const warn = (text) => { if (!warnings.includes(text)) warnings.push(text); };

  const active = templates.filter((t) => t.sharePct > 0);
  // Proteini se dele samo na obroke koji imaju namirnicu sa proteinom (npr. užina voće + mast nema),
  // inače bi njihov deo proteina nestao iz dana.
  const hasProtein = (t) => t.groups.some((g) => ROLE[g] === 'protein');
  const proteinShare = active.filter(hasProtein).reduce((sum, t) => sum + t.sharePct, 0) || 100;

  const plan = Array.from({ length: days }, (_, day) => {
    const usedToday = new Set();
    const meals = active.map((t) => {
      const mealTarget = Object.fromEntries(MACROS.map((m) => [m, (target[m] * t.sharePct) / 100]));
      mealTarget.protein = hasProtein(t) ? (target.protein * t.sharePct) / proteinShare : 0;
      const chosen = [];
      for (const group of t.groups) {
        const allowed = usable.filter((f) => f.group === group && f.mealTypes.includes(t.mealType));
        const likedHere = allowed.filter((f) => liked.has(f.id));
        const pool = likedHere.length ? likedHere : allowed;
        if (!pool.length) {
          warn(`${t.label}: nema proverene namirnice iz grupe ${GROUP_LABEL[group]}.`);
          continue;
        }
        // Smena po danima; ista namirnica se izbegava u dva obroka istog dana kad ima izbora.
        const rotated = pool.map((_, k) => pool[(day + k) % pool.length]);
        const food = rotated.find((f) => !usedToday.has(f.id)) ?? rotated[0];
        usedToday.add(food.id);
        chosen.push({ food, role: ROLE[group], suggested: !likedHere.length });
      }
      const grams = portionsFor(chosen, mealTarget);
      return { template: t, entries: chosen.map((c, i) => ({ ...c, grams: grams[i] })) };
    });

    const dayEntries = meals.flatMap((m) => m.entries);
    const proteinBefore = dayEntries.map((e) => (e.role === 'protein' ? e.grams : null));
    balanceDay(dayEntries, target.kcal);
    // Protein raste u balansiranju samo kad UH i masti više nemaju mesta (granice porcija).
    const proteinPushed = dayEntries.some((e, i) => e.role === 'protein' && e.grams > proteinBefore[i] + 1);
    const dayTotals = total(dayEntries);
    if (dayTotals.kcal > target.kcal * 1.1) {
      warn('I najmanje porcije prelaze dnevni cilj kalorija. Trener treba da smanji najmanje porcije namirnica.');
    } else if (dayTotals.kcal < target.kcal * 0.9) {
      warn('Ni najveće porcije ne dostižu dnevni cilj kalorija. Trener treba da poveća najveće porcije namirnica.');
    } else if (proteinPushed && dayTotals.protein > target.protein * 1.15) {
      // Samo kad je uzrok granica porcije; UH namirnice i same nose nešto proteina, pa malo više je očekivano.
      warn('Porcije UH i masti su na maksimumu, pa ostatak kalorija daje protein (više proteina od cilja). Trener može da poveća najveće porcije.');
    }

    const finished = meals.map(({ template: t, entries }) => {
      for (const e of entries) e.grams = roundPortion(e.food, e.grams);
      return {
        mealType: t.mealType,
        label: t.label,
        timeHint: t.timeHint,
        items: entries.map((e) => ({ foodId: e.food.id, name: e.food.name, grams: e.grams, suggested: e.suggested })),
        totals: total(entries),
      };
    });
    return { day, meals: finished, totals: total(meals.flatMap((m) => m.entries)) };
  });

  return { days: plan, warnings };
}

// Dan u nedelji od ponedeljka (0) do nedelje (6).
export function weekdayIndex(date = new Date()) {
  return (date.getDay() + 6) % 7;
}

// ---------- Sačuvan plan ----------

const byPosition = (a, b) => a.position - b.position;

// Otisak svega od čega gramaže zavise: cilj, struktura obroka, proverene namirnice i klijentov izbor.
// Kad se otisak promeni, otključan plan se pravi ponovo. Naziv i vreme obroka se ne računaju jer ne menjaju gramaže.
export function inputsKey({ target, templates, foods, likedIds }) {
  const usable = foods
    .filter((f) => f.verified && f.active)
    .map((f) => [f.id, f.group, f.kcal, f.protein, f.carbs, f.fat, f.minG, f.maxG, [...f.mealTypes].sort()])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const json = JSON.stringify([
    MACROS.map((m) => target[m]),
    templates.map((t) => [t.mealType, t.sharePct, t.groups]),
    usable,
    [...likedIds].sort(),
  ]);
  let hash = 5381; // djb2: kratak otisak umesto celog JSON-a u bazi
  for (let i = 0; i < json.length; i++) hash = ((hash * 33) ^ json.charCodeAt(i)) >>> 0;
  return `v1-${hash.toString(36)}-${json.length}`;
}

// Plan iz generatora u redove za bazu: jedan red po namirnici.
export function planToItems(days) {
  return days.flatMap((d) => d.meals.flatMap((m) => m.items.map((it, position) => ({
    weekday: d.day, mealType: m.mealType, foodId: it.foodId, grams: it.grams, suggested: it.suggested, position,
  }))));
}

// Sačuvani redovi u isti oblik koji vraća generator. Obroci idu redom iz strukture obroka;
// namirnica koje više nema u bazi se preskače.
export function itemsToDays({ items, foods, templates }) {
  const byId = new Map(foods.map((f) => [f.id, f]));
  return Array.from({ length: 7 }, (_, day) => {
    const meals = templates.map((t) => {
      const entries = items
        .filter((i) => i.weekday === day && i.mealType === t.mealType)
        .sort(byPosition)
        .map((i) => ({ food: byId.get(i.foodId), grams: i.grams, suggested: i.suggested }))
        .filter((e) => e.food);
      if (!entries.length) return null;
      return {
        mealType: t.mealType,
        label: t.label,
        timeHint: t.timeHint,
        items: entries.map((e) => ({ foodId: e.food.id, name: e.food.name, grams: e.grams, suggested: e.suggested })),
        totals: total(entries),
        entries,
      };
    }).filter(Boolean);
    const dayTotals = total(meals.flatMap((m) => m.entries));
    return { day, meals: meals.map(({ entries, ...m }) => m), totals: dayTotals };
  });
}
