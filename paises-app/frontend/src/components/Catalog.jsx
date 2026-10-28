import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Spinner from './Spinner.jsx';
import CountryCard from './CountryCard.jsx';
import CountryDrawer from './CountryDrawer.jsx';
import Pagination from './Pagination.jsx';

const LIMIT = 12;

export default function Catalog() {
  const { user, logout } = useAuth();
  const [regiones, setRegiones] = useState([]);
  const [region, setRegion] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [sync, setSync] = useState({ running: false, msg: '' });

  // Debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => { setQ(busqueda.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cargarRegiones = useCallback(() => {
    api('/api/regiones').then(setRegiones).catch(() => {});
  }, []);

  const cargarPaises = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (q) params.set('q', q);
      if (region) params.set('region', region);
      setResult(await api(`/api/paises?${params}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, q, region]);

  useEffect(cargarRegiones, [cargarRegiones]);
  useEffect(() => { cargarPaises(); }, [cargarPaises]);

  const sincronizar = async () => {
    setSync({ running: true, msg: '' });
    try {
      const r = await api('/api/carga', { method: 'POST' });
      setSync({ running: false, msg: `Carga completa: ${r.paises} países guardados.` });
      cargarRegiones();
      cargarPaises();
    } catch (err) {
      setSync({ running: false, msg: `Error en la carga: ${err.message}` });
    }
  };

  const vacio = result && result.total === 0 && !q && !region;

  return (
    <>
      <header className="topbar">
        <div className="topbar__brand">
          <span className="logo">Atlas</span>
          <span className="topbar__sub">Catálogo de países</span>
        </div>
        <div className="topbar__user">
          <button className="btn btn--ghost" onClick={sincronizar} disabled={sync.running}>
            {sync.running ? 'Sincronizando…' : '↻ Sincronizar datos'}
          </button>
          <img src={user.avatar_url} alt="" className="avatar" />
          <span className="topbar__login">{user.nombre || user.login}</span>
          <button className="btn btn--dark" onClick={logout}>Cerrar sesión</button>
        </div>
      </header>

      <main className="container">
        {sync.msg && <p className="alert alert--info" role="status">{sync.msg}</p>}

        <section className="toolbar">
          <input
            className="search"
            type="search"
            placeholder="Buscar país por nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar país"
          />
          <div className="chips" role="group" aria-label="Filtrar por región">
            <button className={`chip ${region === 0 ? 'chip--on' : ''}`} onClick={() => { setRegion(0); setPage(1); }}>
              Todas
            </button>
            {regiones.map((r) => (
              <button
                key={r.id}
                className={`chip ${region === r.id ? 'chip--on' : ''}`}
                onClick={() => { setRegion(r.id); setPage(1); }}
              >
                {r.nombre} <small>{r.total}</small>
              </button>
            ))}
          </div>
        </section>

        {result && !loading && !error && (
          <p className="count">{result.total} {result.total === 1 ? 'país' : 'países'}</p>
        )}

        {loading && <div className="center-block"><Spinner label="Cargando países…" /></div>}

        {!loading && error && (
          <div className="state">
            <p>{error}</p>
            <button className="btn btn--dark" onClick={cargarPaises}>Reintentar</button>
          </div>
        )}

        {!loading && !error && vacio && (
          <div className="state">
            <p>La base de datos está vacía. Ejecuta la carga desde el API público.</p>
            <button className="btn btn--dark" onClick={sincronizar} disabled={sync.running}>Cargar países</button>
          </div>
        )}

        {!loading && !error && result?.total === 0 && !vacio && (
          <div className="state"><p>No hay países que coincidan con la búsqueda.</p></div>
        )}

        {!loading && !error && result?.data.length > 0 && (
          <>
            <section className="grid">
              {result.data.map((p) => (
                <CountryCard key={p.cca3} pais={p} onClick={() => setSeleccionado(p.cca3)} />
              ))}
            </section>
            <Pagination page={result.page} totalPages={result.totalPages} onChange={setPage} />
          </>
        )}
      </main>

      {seleccionado && (
        <CountryDrawer cca3={seleccionado} onClose={() => setSeleccionado(null)} onSelect={setSeleccionado} />
      )}
    </>
  );
}
