import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { color, fmt, genero, iniciales } from '../format.js';
import Spinner from './Spinner.jsx';

export default function CharacterModal({ id, onClose }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    api(`/api/personajes/${id}`)
      .then((d) => activo && setP(d))
      .catch((e) => activo && setError(e.message));
    return () => { activo = false; };
  }, [id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Detalle del personaje" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Cerrar">×</button>

        {!p && !error && <div className="center-block"><Spinner label="Descifrando registro…" /></div>}
        {error && <p className="alert">{error}</p>}

        {p && (
          <div style={{ '--hue': (p.id * 47) % 360 }}>
            <header className="modal__head">
              <div className="card__avatar card__avatar--lg" aria-hidden="true">{iniciales(p.nombre)}</div>
              <div>
                <p className="kicker">Registro #{String(p.id).padStart(3, '0')}</p>
                <h2 className="modal__title">{p.nombre}</h2>
                <p className="muted">{genero(p.genero)} · Nacimiento {p.anio_nacimiento || 'desconocido'}</p>
              </div>
            </header>

            <section className="stats">
              <Stat label="Altura" value={p.altura_cm ? `${fmt.format(p.altura_cm)} cm` : 'Desconocida'} bar={p.altura_cm ? Math.min(p.altura_cm / 264, 1) : 0} />
              <Stat label="Peso" value={p.peso_kg ? `${fmt.format(p.peso_kg)} kg` : 'Desconocido'} bar={p.peso_kg ? Math.min(p.peso_kg / 160, 1) : 0} />
              <Stat label="Color de ojos" value={color(p.color_ojos)} />
              <Stat label="Color de cabello" value={color(p.color_cabello)} />
              <Stat label="Color de piel" value={color(p.color_piel)} />
            </section>

            <h4 className="section-h">Planeta de origen</h4>
            {p.planeta ? (
              <div className="planet">
                <div className="planet__orb" aria-hidden="true" />
                <div>
                  <h3 className="planet__name">{p.planeta.nombre}</h3>
                  <dl className="planet__facts">
                    <div><dt>Clima</dt><dd>{p.planeta.clima || '—'}</dd></div>
                    <div><dt>Terreno</dt><dd>{p.planeta.terreno || '—'}</dd></div>
                    <div><dt>Diámetro</dt><dd>{p.planeta.diametro_km ? `${fmt.format(p.planeta.diametro_km)} km` : '—'}</dd></div>
                    <div><dt>Población</dt><dd>{p.planeta.poblacion ? fmt.format(p.planeta.poblacion) : '—'}</dd></div>
                  </dl>
                </div>
              </div>
            ) : (
              <p className="muted">Planeta desconocido</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, bar }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {bar !== undefined && <span className="stat__bar"><span style={{ width: `${bar * 100}%` }} /></span>}
    </div>
  );
}
