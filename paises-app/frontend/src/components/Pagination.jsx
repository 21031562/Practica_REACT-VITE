export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(totalPages, page + 2);
  for (let i = from; i <= to; i++) pages.push(i);

  const go = (p) => {
    onChange(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="pagination" aria-label="Paginación">
      <button className="page" disabled={page === 1} onClick={() => go(page - 1)}>‹ Anterior</button>
      {from > 1 && <><button className="page" onClick={() => go(1)}>1</button>{from > 2 && <span>…</span>}</>}
      {pages.map((p) => (
        <button key={p} className={`page ${p === page ? 'page--on' : ''}`} onClick={() => go(p)} aria-current={p === page ? 'page' : undefined}>
          {p}
        </button>
      ))}
      {to < totalPages && <>{to < totalPages - 1 && <span>…</span>}<button className="page" onClick={() => go(totalPages)}>{totalPages}</button></>}
      <button className="page" disabled={page === totalPages} onClick={() => go(page + 1)}>Siguiente ›</button>
    </nav>
  );
}
