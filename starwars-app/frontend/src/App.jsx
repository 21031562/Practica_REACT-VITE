import { useAuth } from './AuthContext.jsx';
import Login from './components/Login.jsx';
import Gallery from './components/Gallery.jsx';
import Spinner from './components/Spinner.jsx';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen"><Spinner label="Verificando credenciales…" /></div>;
  return user ? <Gallery /> : <Login />;
}
