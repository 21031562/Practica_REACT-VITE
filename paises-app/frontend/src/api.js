// Cliente de la API propia. Nunca se consulta REST Countries desde aquí.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0);
  }
  if (res.status === 401) {
    window.dispatchEvent(new Event('session-expired'));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Error ${res.status}`, res.status);
  }
  return res.status === 204 ? null : res.json();
}
