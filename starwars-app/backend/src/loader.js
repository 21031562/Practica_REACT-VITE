// Proceso de carga: SWAPI (API pública) → PostgreSQL local
import { pool } from './db.js';

const BASE = (process.env.SWAPI_URL || 'https://swapi.dev/api').replace(/\/$/, '');

async function fetchJson(url, retries = 3) {
  for (let intento = 1; intento <= retries; intento++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
      return await res.json();
    } catch (err) {
      if (intento === retries) throw new Error(`No se pudo consultar SWAPI: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * intento));
    }
  }
}

// SWAPI pagina de 10 en 10: se recorre "next" hasta que sea null
async function fetchAll(recurso, log) {
  const items = [];
  let url = `${BASE}/${recurso}/?page=1`;
  let pagina = 1;
  while (url) {
    const data = await fetchJson(url);
    if (!Array.isArray(data.results)) throw new Error(`Respuesta inesperada de SWAPI en ${recurso}`);
    items.push(...data.results);
    log(`  ${recurso}: página ${pagina} (${items.length}/${data.count})`);
    url = data.next;
    pagina++;
  }
  return items;
}

const idFromUrl = (url) => {
  const m = /\/(\d+)\/?$/.exec(url || '');
  return m ? Number(m[1]) : null;
};

// "unknown", "n/a", "1,358" → null o número
const num = (v) => {
  if (v == null) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const texto = (v) => (v && !['unknown', 'n/a', 'none'].includes(v) ? v : null);

export async function loadStarWars(log = console.log) {
  log('Consultando SWAPI…');
  const planetas = await fetchAll('planets', log);
  const personajes = await fetchAll('people', log);
  log(`Recibidos ${planetas.length} planetas y ${personajes.length} personajes. Guardando…`);

  const client = await pool.connect();
  const inicio = new Date();
  try {
    await client.query('BEGIN');
    const planetaIds = new Set();

    for (const p of planetas) {
      const id = idFromUrl(p.url);
      // SWAPI usa un planeta llamado "unknown" (id 28) para origen desconocido → se guarda como NULL
      if (!id || !p.name || p.name === 'unknown') continue;
      await client.query(
        `INSERT INTO planetas (id, nombre, clima, terreno, gravedad, diametro_km, poblacion, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now())
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre, clima = EXCLUDED.clima, terreno = EXCLUDED.terreno,
           gravedad = EXCLUDED.gravedad, diametro_km = EXCLUDED.diametro_km,
           poblacion = EXCLUDED.poblacion, actualizado_en = now()`,
        [id, p.name, texto(p.climate), texto(p.terrain), texto(p.gravity), num(p.diameter), num(p.population)]
      );
      planetaIds.add(id);
    }

    let omitidos = 0;
    for (const c of personajes) {
      const id = idFromUrl(c.url);
      if (!id || !c.name) { omitidos++; continue; }
      const planetaId = idFromUrl(c.homeworld);
      await client.query(
        `INSERT INTO personajes (id, nombre, genero, anio_nacimiento, altura_cm, peso_kg,
                                 color_ojos, color_cabello, color_piel, planeta_id, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre, genero = EXCLUDED.genero, anio_nacimiento = EXCLUDED.anio_nacimiento,
           altura_cm = EXCLUDED.altura_cm, peso_kg = EXCLUDED.peso_kg, color_ojos = EXCLUDED.color_ojos,
           color_cabello = EXCLUDED.color_cabello, color_piel = EXCLUDED.color_piel,
           planeta_id = EXCLUDED.planeta_id, actualizado_en = now()`,
        [
          id,
          c.name,
          c.gender || 'n/a',
          texto(c.birth_year),
          num(c.height),
          num(c.mass),
          texto(c.eye_color),
          texto(c.hair_color),
          texto(c.skin_color),
          planetaIds.has(planetaId) ? planetaId : null,
        ]
      );
    }

    const total = personajes.length - omitidos;
    await client.query(
      `INSERT INTO cargas (iniciado_en, finalizado_en, estado, registros, mensaje)
       VALUES ($1, clock_timestamp(), 'ok', $2, $3)`,
      [inicio, total, `${planetaIds.size} planetas${omitidos ? `, ${omitidos} personajes omitidos` : ''}`]
    );
    await client.query('COMMIT');
    log(`Carga completa: ${total} personajes, ${planetaIds.size} planetas.`);
    return { personajes: total, planetas: planetaIds.size, omitidos };
  } catch (err) {
    await client.query('ROLLBACK');
    await pool.query(
      `INSERT INTO cargas (iniciado_en, finalizado_en, estado, mensaje) VALUES ($1, now(), 'error', $2)`,
      [inicio, err.message]
    ).catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
