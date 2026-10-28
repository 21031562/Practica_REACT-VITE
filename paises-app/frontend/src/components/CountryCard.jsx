const fmt = new Intl.NumberFormat('es-MX');

export default function CountryCard({ pais, onClick }) {
  return (
    <button className="card" onClick={onClick}>
      <div className="card__flag">
        <img src={pais.bandera} alt={pais.bandera_alt || `Bandera de ${pais.nombre}`} loading="lazy" />
      </div>
      <div className="card__body">
        <span className="card__region">{pais.region}{pais.subregion ? ` · ${pais.subregion}` : ''}</span>
        <h3 className="card__name">{pais.nombre}</h3>
        <dl className="card__meta">
          <div><dt>Capital</dt><dd>{pais.capital || '—'}</dd></div>
          <div><dt>Población</dt><dd>{pais.poblacion != null ? fmt.format(pais.poblacion) : '—'}</dd></div>
        </dl>
      </div>
    </button>
  );
}
