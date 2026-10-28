import { useAuth } from './AuthContext.jsx';
import Login from './components/Login.jsx';
import Catalog from './components/Catalog.jsx';
import Spinner from './components/Spinner.jsx';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen"><Spinner label="Verificando sesión…" /></div>;
  return user ? <Catalog /> : <Login />;
}
