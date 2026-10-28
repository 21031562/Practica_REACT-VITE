import { genero, ICONO_GENERO, iniciales } from '../format.js';

export default function CharacterCard({ personaje, onClick, index }) {
  const hue = (personaje.id * 47) % 360;
  return (
    <button className="card" onClick={onClick} style={{ '--hue': hue, animationDelay: `${index * 40}ms` }}>
      <span className="card__id">#{String(personaje.id).padStart(3, '0')}</span>
      <div className="card__avatar" aria-hidden="true">{iniciales(personaje.nombre)}</div>
      <h3 className="card__name">{personaje.nombre}</h3>
      <dl className="card__meta">
        <div>
          <dt>Género</dt>
          <dd>{ICONO_GENERO[personaje.genero] ? `${ICONO_GENERO[personaje.genero]} ` : ''}{genero(personaje.genero)}</dd>
        </div>
        <div>
          <dt>Nacimiento</dt>
          <dd>{personaje.anio_nacimiento || 'Desconocido'}</dd>
        </div>
      </dl>
      <span className="card__cta">Ver registro →</span>
    </button>
  );
}
