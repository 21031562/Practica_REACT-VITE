export default function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="loader" role="status">
      <div className="loader__saber" aria-hidden="true"><span /></div>
      <span className="loader__label">{label}</span>
    </div>
  );
}
