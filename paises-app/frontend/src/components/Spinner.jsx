export default function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__globe" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
