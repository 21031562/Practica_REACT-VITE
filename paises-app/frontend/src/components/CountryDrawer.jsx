import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Spinner from './Spinner.jsx';

const fmt = new Intl.NumberFormat('es-MX');

export default function CountryDrawer({ cca3, onClose, onSelect }) {
  const [pais, setPais] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    setPais(null);
    setError('');
    api(`/api/paises/${cca3}`)
      .then((d) => activo && setPais(d))
      .catch((e) => activo && setError(e.message));
    return () => { activo = false; };
  }, [cca3]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Detalle del país">
        <button className="drawer__close" onClick={onClose} aria-label="Cerrar">×</button>

        {!pais && !error && <div className="center-block"><Spinner label="Cargando detalle…" /></div>}
        {error && <p className="alert">{error}</p>}

        {pais && (
          <>
            <img className="drawer__flag" src={pais.bandera_svg || pais.bandera_png} alt={pais.bandera_alt || ''} />
            <p className="eyebrow">{pais.region}{pais.subregion ? ` · ${pais.subregion}` : ''}</p>
            <h2 className="drawer__title">{pais.nombre}</h2>
            <p className="drawer__official">{pais.nombre_oficial}</p>

            <dl className="facts">
              <div><dt>Código</dt><dd>{pais.cca3}</dd></div>
              <div><dt>Capital</dt><dd>{pais.capital || '—'}</dd></div>
              <div><dt>Población</dt><dd>{pais.poblacion != null ? fmt.format(pais.poblacion) : '—'}</dd></div>
              <div><dt>Área</dt><dd>{pais.area != null ? `${fmt.format(pais.area)} km²` : '—'}</dd></div>
            </dl>

            <h4 className="drawer__h">Idiomas</h4>
            <div className="tags">
              {pais.idiomas.length ? pais.idiomas.map((i) => <span key={i.codigo} className="tag">{i.nombre}</span>) : <span className="muted">Sin datos</span>}
            </div>

            <h4 className="drawer__h">Monedas</h4>
            <div className="tags">
              {pais.monedas.length ? pais.monedas.map((m) => (
                <span key={m.codigo} className="tag">{m.nombre} ({m.codigo}{m.simbolo ? ` ${m.simbolo}` : ''})</span>
              )) : <span className="muted">Sin datos</span>}
            </div>

            <h4 className="drawer__h">Fronteras</h4>
            <div className="neighbors">
              {pais.vecinos.length ? pais.vecinos.map((v) => (
                <button key={v.cca3} className="neighbor" onClick={() => onSelect(v.cca3)}>
                  <img src={v.bandera} alt="" /> {v.nombre}
                </button>
              )) : <span className="muted">Sin fronteras terrestres</span>}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
