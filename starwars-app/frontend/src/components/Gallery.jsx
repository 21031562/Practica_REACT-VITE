import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { genero } from '../format.js';
import Spinner from './Spinner.jsx';
import CharacterCard from './CharacterCard.jsx';
import CharacterModal from './CharacterModal.jsx';
import Pagination from './Pagination.jsx';

const LIMIT = 12;

export default function Gallery() {
  const { user, logout } = useAuth();
  const [generos, setGeneros] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [sync, setSync] = useState({ running: false, msg: '' });

  useEffect(() => {
    const t = setTimeout(() => { setQ(busqueda.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cargarGeneros = useCallback(() => {
    api('/api/generos').then(setGeneros).catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (q) params.set('q', q);
      if (filtro) params.set('genero', filtro);
      setResult(await api(`/api/personajes?${params}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, q, filtro]);

  useEffect(cargarGeneros, [cargarGeneros]);
  useEffect(() => { cargar(); }, [cargar]);

  const sincronizar = async () => {
    setSync({ running: true, msg: '' });
    try {
      const r = await api('/api/carga', { method: 'POST' });
      setSync({ running: false, msg: `Carga completa: ${r.personajes} personajes y ${r.planetas} planetas.` });
      cargarGeneros();
      cargar();
    } catch (err) {
      setSync({ running: false, msg: `Error en la carga: ${err.message}` });
    }
  };

  const vacio = result && result.total === 0 && !q && !filtro;

  return (
    <div className="app">
      <div className="stars" aria-hidden="true" />

      <header className="topbar">
        <span className="logo">HOLO<span>ARCHIVO</span></span>
        <div className="topbar__user">
          <button className="btn btn--ghost" onClick={sincronizar} disabled={sync.running}>
            {sync.running ? 'Sincronizando…' : '↻ Sincronizar'}
          </button>
          <img src={user.avatar_url} alt="" className="avatar" />
          <span className="topbar__login">{user.nombre || user.login}</span>
          <button className="btn btn--primary" onClick={logout}>Cerrar sesión</button>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <p className="kicker">Base de datos de personajes</p>
          <h1 className="title title--md">Personajes de la galaxia</h1>
        </section>

        {sync.running && <div className="center-block"><Spinner label="Transfiriendo datos desde SWAPI…" /></div>}
        {sync.msg && <p className="alert alert--info" role="status">{sync.msg}</p>}

        <section className="toolbar">
          <input
            className="search"
            type="search"
            placeholder="Buscar personaje…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar personaje"
          />
          <select className="select" value={filtro} onChange={(e) => { setFiltro(e.target.value); setPage(1); }} aria-label="Filtrar por género">
            <option value="">Todos los géneros</option>
            {generos.map((g) => (
              <option key={g.genero} value={g.genero}>{genero(g.genero)} ({g.total})</option>
            ))}
          </select>
        </section>

        {result && !loading && !error && result.total > 0 && (
          <p className="count">{result.total} registros · página {result.page} de {result.totalPages}</p>
        )}

        {loading && <div className="center-block"><Spinner label="Cargando personajes…" /></div>}

        {!loading && error && (
          <div className="state">
            <p>{error}</p>
            <button className="btn btn--primary" onClick={cargar}>Reintentar</button>
          </div>
        )}

        {!loading && !error && vacio && (
          <div className="state">
            <p>El archivo está vacío. Transfiere los registros desde SWAPI.</p>
            <button className="btn btn--primary" onClick={sincronizar} disabled={sync.running}>Cargar personajes</button>
          </div>
        )}

        {!loading && !error && result?.total === 0 && !vacio && (
          <div className="state"><p>Ningún registro coincide con la búsqueda.</p></div>
        )}

        {!loading && !error && result?.data.length > 0 && (
          <>
            <section className="grid">
              {result.data.map((p, i) => (
                <CharacterCard key={p.id} personaje={p} index={i} onClick={() => setSeleccionado(p.id)} />
              ))}
            </section>
            <Pagination page={result.page} totalPages={result.totalPages} onChange={setPage} />
          </>
        )}
      </main>

      {seleccionado && <CharacterModal id={seleccionado} onClose={() => setSeleccionado(null)} />}
    </div>
  );
}
