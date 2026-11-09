// Koren aplikacije: odlučuje koji ekran se prikazuje.
// 1) Nije prijavljen → login.  2) Nema profila → onboarding.  3) Inače ekran prema adresi (#/...).

import { useRoute, navigate, back } from './lib/router.js';
import { useData } from './lib/useData.js';
import { useToast, toast } from './lib/toast.js';
import { useAuth } from './lib/useAuth.js';
import { getProfile } from './data/api.js';
import TabBar from './components/TabBar.jsx';
import Login from './screens/Login.jsx';
import NewPassword from './screens/NewPassword.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Home from './screens/Home.jsx';
import Programs from './screens/Programs.jsx';
import ProgramDetail from './screens/ProgramDetail.jsx';
import WorkoutSession from './screens/WorkoutSession.jsx';
import ClientDetail from './screens/ClientDetail.jsx';
import Clients from './screens/Clients.jsx';
import Exercises from './screens/Exercises.jsx';
import WorkoutEditor from './screens/WorkoutEditor.jsx';
import WorkoutsAdmin from './screens/WorkoutsAdmin.jsx';
import Profile from './screens/Profile.jsx';
import Progress from './screens/Progress.jsx';
import ComingSoon from './screens/ComingSoon.jsx';

// Ekrani na kojima se vidi donja navigacija i koji tab je tada aktivan.
const TAB_FOR_ROUTE = {
  pocetna: 'pocetna',
  profil: 'pocetna',
  treninzi: 'treninzi',
  program: 'treninzi',
  ishrana: 'ishrana',
  napredak: 'napredak',
  poruke: 'poruke',
};

export default function App() {
  const { session, loading, recovering, finishRecovery } = useAuth();

  if (loading) return null;
  if (!session) return <Login />;
  // Oporavak ima prednost nad ruterom: link iz mejla nosi token u #, isto gde ruter čita adresu.
  if (recovering) {
    return <NewPassword onDone={() => { finishRecovery(); navigate('pocetna'); }} />;
  }
  return <AuthedApp />;
}

// Odvojena komponenta da se getProfile i ostali podaci učitaju tek posle prijave.
function AuthedApp() {
  const route = useRoute();
  const { data: profile, loading, error, reload } = useData(getProfile);
  const toastMessage = useToast();

  if (loading) return null;

  // Bez ovoga bi pad mreže izgledao kao "nema profila" i klijent bi dobio onboarding.
  if (error) {
    return (
      <div className="screen screen--no-tabbar">
        <h1 className="ob-title">Nema veze</h1>
        <p className="muted" style={{ margin: 0 }}>Podaci nisu učitani. Proveri internet i pokušaj ponovo.</p>
        <button className="pill-btn" style={{ marginTop: 'auto' }} onClick={reload}>Pokušaj ponovo</button>
      </div>
    );
  }

  if (!profile || route.name === 'ciljevi') {
    return <Onboarding initial={profile} onDone={reload} />;
  }

  const [p1, p2] = route.params;
  const isTrainer = profile.role === 'trainer';
  let screen;
  switch (route.name) {
    case 'treninzi': screen = <Programs />; break;
    case 'program': screen = <ProgramDetail programId={p1} />; break;
    case 'trening': screen = <WorkoutSession programId={p1} workoutId={p2} />; break;
    case 'profil': screen = <Profile profile={profile} />; break;
    case 'lozinka': screen = <NewPassword onDone={() => { toast('Lozinka promenjena'); navigate('profil'); }} onCancel={() => back('profil')} />; break;
    case 'ishrana': screen = <ComingSoon title="Ishrana" icon="utensils" text="Plan ishrane, kalorije i makroi koje ti trener pripremi." phase="Faza 3" />; break;
    case 'napredak': screen = <Progress />; break;
    case 'vezbe': screen = isTrainer ? <Exercises /> : <Home profile={profile} />; break;
    case 'trener-treninzi': screen = isTrainer ? <WorkoutsAdmin /> : <Home profile={profile} />; break;
    case 'trener-trening': screen = isTrainer ? <WorkoutEditor workoutId={p1} /> : <Home profile={profile} />; break;
    case 'klijenti': screen = isTrainer ? <Clients /> : <Home profile={profile} />; break;
    case 'klijent': screen = isTrainer ? <ClientDetail clientId={p1} /> : <Home profile={profile} />; break;
    case 'poruke': screen = <ComingSoon title="Poruke" icon="message" text="Direktne poruke sa trenerom, pitanja i novi planovi." phase="Faza 3" />; break;
    default: screen = <Home profile={profile} />;
  }

  const tab = TAB_FOR_ROUTE[route.name] ?? (['trening', 'lozinka', 'trener-trening'].includes(route.name) ? null : 'pocetna');

  return (
    <>
      {/* key: kad se promeni adresa, ekran se kreira iznova (svež state) */}
      <main key={route.name + route.params.join('/')}>{screen}</main>
      {tab && <TabBar active={tab} />}
      {toastMessage && <div className="toast" role="status">{toastMessage}</div>}
    </>
  );
}
