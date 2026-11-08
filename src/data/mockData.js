// DEMO SADRŽAJ: programi, treninzi i vežbe.
// U fazi 2 ovo dolazi iz Supabase baze (tabele programs, workouts, exercises).
// Trener ovde (ili kasnije kroz admin panel) upisuje svoje programe i YouTube linkove.
//
// videoUrl: YouTube link (može i "unlisted"). Prazno = prikazuje se placeholder.

export const exercises = {
  cucanj:        { name: 'Čučanj',                 videoUrl: '', cue: 'Stopala u širini ramena, kolena prate prste.' },
  iskorak:       { name: 'Iskorak sa bučicama',    videoUrl: '', cue: 'Zadnje koleno skoro do poda, trup uspravan.' },
  rameni:        { name: 'Rameni potisak',         videoUrl: '', cue: 'Ne izvijaj leđa, laktovi blago ispred.' },
  sklek:         { name: 'Sklekovi',               videoUrl: '', cue: 'Telo u jednoj liniji, grudi do poda.' },
  veslanje:      { name: 'Veslanje bučicom',       videoUrl: '', cue: 'Lakat vuci ka kuku, leđa ravna.' },
  pregib:        { name: 'Biceps pregib',          videoUrl: '', cue: 'Laktovi uz telo, kontrolisano spuštanje.' },
  plank:         { name: 'Plank',                  videoUrl: '', cue: 'Stomak i guza stegnuti, ne propadaj u kukovima.' },
  gluteusMost:   { name: 'Gluteus most',           videoUrl: '', cue: 'Pritisni pete, zadrži gore 1 sekundu.' },
  mrtvo:         { name: 'Rumunsko mrtvo dizanje', videoUrl: '', cue: 'Kukovi nazad, šipka blizu nogu.' },
  bench:         { name: 'Bench press',            videoUrl: '', cue: 'Lopatice skupljene, šipka do donjeg dela grudi.' },
  zgib:          { name: 'Lat pulldown',           videoUrl: '', cue: 'Vuci ka gornjem delu grudi, ne ljuljaj se.' },
  jumpingJacks:  { name: 'Jumping jacks',          videoUrl: '', cue: 'Ujednačen ritam, meko doskakanje.' },
  mountain:      { name: 'Mountain climbers',      videoUrl: '', cue: 'Kukovi nisko, brza kolena ka grudima.' },
};

// Jedna vežba u treningu: sets × reps (ili seconds za vežbe na vreme), kg = predlog, rest = pauza u sekundama.
export const workouts = {
  gornji:  { title: 'Gornji deo tela', minutes: 35, equipment: 'bučice', items: [
    { ex: 'sklek', sets: 3, reps: 10, rest: 45 },
    { ex: 'veslanje', sets: 3, reps: 12, kg: 8, rest: 45 },
    { ex: 'rameni', sets: 3, reps: 12, kg: 6, rest: 45 },
    { ex: 'pregib', sets: 3, reps: 12, kg: 6, rest: 30 },
    { ex: 'plank', sets: 3, seconds: 30, rest: 30 },
  ] },
  donji:   { title: 'Donji deo tela', minutes: 30, equipment: 'bučice', items: [
    { ex: 'cucanj', sets: 3, reps: 15, rest: 45 },
    { ex: 'iskorak', sets: 4, reps: 12, kg: 6, rest: 45 },
    { ex: 'gluteusMost', sets: 3, reps: 15, rest: 30 },
    { ex: 'plank', sets: 2, seconds: 40, rest: 30 },
  ] },
  kardio:  { title: 'Kardio krug', minutes: 20, equipment: 'bez opreme', items: [
    { ex: 'jumpingJacks', sets: 3, seconds: 40, rest: 20 },
    { ex: 'mountain', sets: 3, seconds: 30, rest: 20 },
    { ex: 'cucanj', sets: 3, reps: 20, rest: 20 },
    { ex: 'sklek', sets: 3, reps: 8, rest: 20 },
  ] },
  noge:    { title: 'Noge — teretana', minutes: 50, equipment: 'šipka, mašine', items: [
    { ex: 'cucanj', sets: 4, reps: 8, kg: 60, rest: 120 },
    { ex: 'mrtvo', sets: 4, reps: 10, kg: 50, rest: 90 },
    { ex: 'iskorak', sets: 3, reps: 10, kg: 14, rest: 60 },
  ] },
  guranje: { title: 'Grudi i ramena', minutes: 50, equipment: 'šipka, bučice', items: [
    { ex: 'bench', sets: 4, reps: 8, kg: 50, rest: 120 },
    { ex: 'rameni', sets: 3, reps: 10, kg: 14, rest: 90 },
    { ex: 'sklek', sets: 2, reps: 15, rest: 60 },
  ] },
  vucenje: { title: 'Leđa i ruke', minutes: 45, equipment: 'mašine, bučice', items: [
    { ex: 'zgib', sets: 4, reps: 10, kg: 45, rest: 90 },
    { ex: 'veslanje', sets: 3, reps: 10, kg: 20, rest: 90 },
    { ex: 'pregib', sets: 3, reps: 12, kg: 10, rest: 60 },
  ] },
};

// location: 'kuca' | 'teretana'; tone: boja kartice iz dizajna ('accent' | 'sage' | 'neutral')
// schedule: redosled treninga; ukupno treninga u programu = weeks × perWeek
export const programs = [
  { id: 'lagano', title: 'Lagano do forme', weeks: 4, perWeek: 3, location: 'kuca', level: 'Početnik', tone: 'sage',
    description: 'Četiri nedelje da vratiš ritam: kratki treninzi celog tela, kod kuće, sa bučicama.',
    schedule: ['gornji', 'donji', 'kardio'] },
  { id: 'snaga-kuca', title: 'Snaga bez teretane', weeks: 6, perWeek: 4, location: 'kuca', level: 'Početnik', tone: 'accent',
    description: 'Jače telo samo sa bučicama i sopstvenom težinom.',
    schedule: ['gornji', 'donji', 'gornji', 'kardio'] },
  { id: 'masa', title: 'Masa i snaga', weeks: 8, perWeek: 3, location: 'teretana', level: 'Srednji', tone: 'sage',
    description: 'Klasičan push / pull / legs program za mišićnu masu.',
    schedule: ['guranje', 'vucenje', 'noge'] },
  { id: 'pauza', title: '20 minuta u pauzi', weeks: 4, perWeek: 5, location: 'kuca', level: 'Svi nivoi', tone: 'neutral',
    description: 'Brzi treninzi kad nemaš vremena. Bez opreme.',
    schedule: ['kardio'] },
];
