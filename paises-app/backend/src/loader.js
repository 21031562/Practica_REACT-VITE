// Proceso de carga: REST Countries (API pública) → PostgreSQL local
import { pool } from './db.js';

// REST Countries v5 (v3.1 fue deprecada): requiere API key y pagina con limit/offset
const BASE = (process.env.COUNTRIES_API_URL || 'https://api.restcountries.com/countries/v5').replace(/\/$/, '');
const API_KEY = process.env.RESTCOUNTRIES_API_KEY;
const LIMIT = 100; // máximo del plan gratuito

async function fetchJson(url, retries = 3) {
  for (let intento = 1; intento <= retries; intento++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      const body = await res.json().catch(() => null);
      if (body?.errors?.length) {
        const err = new Error(body.errors.map((e) => e.message).join('; '));
        err.final = res.status === 401 || res.status === 403 || res.status === 400;
        throw err;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return body;
    } catch (err) {
      if (err.final || intento === retries) throw new Error(`REST Countries: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * intento));
    }
  }
}

// Recorre todas las páginas (limit/offset) hasta que meta.more sea false
async function fetchAllCountries(log) {
  const todos = [];
  let offset = 0;
  while (true) {
    const body = await fetchJson(`${BASE}?limit=${LIMIT}&offset=${offset}`);
    const objetos = body?.data?.objects;
    if (!Array.isArray(objetos)) {
      throw new Error(`Respuesta inesperada del API público: ${JSON.stringify(body).slice(0, 200)}`);
    }
    todos.push(...objetos);
    const meta = body.data.meta || {};
    log(`  página offset=${offset}: ${todos.length}/${meta.total ?? '?'}`);
    if (!meta.more || objetos.length === 0) break;
    offset += objetos.length;
  }
  return todos;
}

// --- Normalización del formato v5 al formato que usa la carga ---

// { a: { b: 'x' } } → { 'a.b': 'x' } (para localizar llaves sin depender de su nombre exacto)
function aplanar(obj, prefijo = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const llave = prefijo ? `${prefijo}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) aplanar(v, llave, out);
    else if (typeof v === 'string' && v) out[llave] = v;
  }
  return out;
}

function buscar(obj, patrones) {
  const plano = aplanar(obj);
  for (const re of patrones) {
    for (const [k, v] of Object.entries(plano)) if (re.test(k)) return v;
  }
  return null;
}

function idiomas(langs) {
  if (!langs) return {};
  if (!Array.isArray(langs)) return langs; // formato antiguo { spa: 'Spanish' }
  const out = {};
  for (const l of langs) {
    if (typeof l === 'string') { out[l] = l; continue; }
    const codigo = buscar(l, [/639.*3$/i, /639.*2[bt]?$/i, /639.*1$/i, /^(code|id)$/i, /bcp/i]);
    const nombre = buscar(l, [/^(english_?name|name_?en|name\.english|name\.en|english)$/i, /^name(\.common)?$/i, /^(?!native).*name/i]);
    if (codigo) out[codigo] = nombre || codigo;
  }
  return out;
}

function monedas(curr) {
  if (!curr) return {};
  const out = {};
  const entradas = Array.isArray(curr) ? curr.map((c) => [null, c]) : Object.entries(curr);
  for (const [llave, c] of entradas) {
    if (typeof c === 'string') { out[llave || c] = { name: c }; continue; }
    const codigo = (llave && /^[A-Z]{3}$/.test(llave) ? llave : null)
      || buscar(c, [/4217/i, /^(code|id|alpha_?3?)$/i]) || llave;
    if (!codigo) continue;
    out[codigo] = {
      name: buscar(c, [/^(english_?)?name$/i, /^name\./i, /name/i]) || codigo,
      symbol: buscar(c, [/^symbol$/i, /symbol/i]),
    };
  }
  return out;
}

function normalizar(c) {
  const capitales = (c.capitals || c.capital || [])
    .map((x) => (typeof x === 'string' ? x : x?.name))
    .filter(Boolean);
  return {
    cca3: c.codes?.alpha_3 || c.cca3,
    name: { common: c.names?.common || c.name?.common, official: c.names?.official || c.name?.official },
    capital: capitales,
    region: c.region,
    subregion: c.subregion,
    population: c.population,
    area: c.area?.kilometers ?? (typeof c.area === 'number' ? c.area : undefined),
    flags: {
      png: c.flag?.url_png || c.flags?.png,
      svg: c.flag?.url_svg || c.flags?.svg,
      alt: c.flag?.description || c.flags?.alt,
    },
    languages: idiomas(c.languages),
    currencies: monedas(c.currencies),
    borders: Array.isArray(c.borders) ? c.borders : [],
  };
}

export async function loadCountries(log = console.log) {
  if (!API_KEY) throw new Error('Falta RESTCOUNTRIES_API_KEY en .env (créala en https://restcountries.com/sign-up)');
  log('Consultando REST Countries v5…');
  const crudos = await fetchAllCountries(log);
  const paises = crudos.map(normalizar);
  const fronteras = paises.map((p) => ({ cca3: p.cca3, borders: p.borders }));
  log(`Recibidos ${paises.length} países. Guardando…`);

  // Aviso si el formato de idiomas/monedas no se reconoció
  const ejemplo = crudos.find((c) => c.codes?.alpha_3 === 'MEX') || crudos[0];
  if (paises.filter((p) => Object.keys(p.languages).length).length < paises.length / 2) {
    log(`Aviso: formato de idiomas no reconocido. Ejemplo: ${JSON.stringify(ejemplo?.languages).slice(0, 300)}`);
  }
  if (paises.filter((p) => Object.keys(p.currencies).length).length < paises.length / 2) {
    log(`Aviso: formato de monedas no reconocido. Ejemplo: ${JSON.stringify(ejemplo?.currencies).slice(0, 300)}`);
  }

  const client = await pool.connect();
  const inicio = new Date();
  try {
    await client.query('BEGIN');
    const regionIds = new Map();
    const subregionIds = new Map();
    let omitidos = 0;

    for (const p of paises) {
      if (!p.cca3 || !p.name?.common) { omitidos++; continue; }

      const regionNombre = p.region || 'Sin región';
      if (!regionIds.has(regionNombre)) {
        const { rows } = await client.query(
          `INSERT INTO regiones (nombre) VALUES ($1)
           ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
          [regionNombre]
        );
        regionIds.set(regionNombre, rows[0].id);
      }
      const regionId = regionIds.get(regionNombre);

      let subregionId = null;
      if (p.subregion) {
        const key = `${regionId}|${p.subregion}`;
        if (!subregionIds.has(key)) {
          const { rows } = await client.query(
            `INSERT INTO subregiones (nombre, region_id) VALUES ($1, $2)
             ON CONFLICT (nombre, region_id) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
            [p.subregion, regionId]
          );
          subregionIds.set(key, rows[0].id);
        }
        subregionId = subregionIds.get(key);
      }

      await client.query(
        `INSERT INTO paises (cca3, nombre_comun, nombre_oficial, capital, poblacion, area,
                             bandera_png, bandera_svg, bandera_alt, region_id, subregion_id, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
         ON CONFLICT (cca3) DO UPDATE SET
           nombre_comun = EXCLUDED.nombre_comun, nombre_oficial = EXCLUDED.nombre_oficial,
           capital = EXCLUDED.capital, poblacion = EXCLUDED.poblacion, area = EXCLUDED.area,
           bandera_png = EXCLUDED.bandera_png, bandera_svg = EXCLUDED.bandera_svg,
           bandera_alt = EXCLUDED.bandera_alt, region_id = EXCLUDED.region_id,
           subregion_id = EXCLUDED.subregion_id, actualizado_en = now()`,
        [
          p.cca3,
          p.name.common,
          p.name.official || p.name.common,
          p.capital?.length ? p.capital.join(', ') : null,
          Number.isFinite(p.population) ? p.population : null,
          Number.isFinite(p.area) && p.area >= 0 ? p.area : null,
          p.flags?.png ?? null,
          p.flags?.svg ?? null,
          p.flags?.alt ?? null,
          regionId,
          subregionId,
        ]
      );

      // Relaciones N:M — se reemplazan para mantener consistencia con el API
      await client.query('DELETE FROM pais_idioma WHERE pais_cca3 = $1', [p.cca3]);
      for (const [codigo, nombre] of Object.entries(p.languages || {})) {
        await client.query(
          `INSERT INTO idiomas (codigo, nombre) VALUES ($1, $2)
           ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre`,
          [codigo, nombre]
        );
        await client.query('INSERT INTO pais_idioma VALUES ($1, $2)', [p.cca3, codigo]);
      }

      await client.query('DELETE FROM pais_moneda WHERE pais_cca3 = $1', [p.cca3]);
      for (const [codigo, m] of Object.entries(p.currencies || {})) {
        await client.query(
          `INSERT INTO monedas (codigo, nombre, simbolo) VALUES ($1, $2, $3)
           ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, simbolo = EXCLUDED.simbolo`,
          [codigo, m?.name || codigo, m?.symbol ?? null]
        );
        await client.query('INSERT INTO pais_moneda VALUES ($1, $2)', [p.cca3, codigo]);
      }
    }

    // Fronteras: solo entre países que existen en la BD
    await client.query('DELETE FROM fronteras');
    for (const f of fronteras) {
      for (const vecino of f.borders || []) {
        await client.query(
          `INSERT INTO fronteras (pais_cca3, vecino_cca3)
           SELECT $1, $2
           WHERE EXISTS (SELECT 1 FROM paises WHERE cca3 = $1)
             AND EXISTS (SELECT 1 FROM paises WHERE cca3 = $2)
           ON CONFLICT DO NOTHING`,
          [f.cca3, vecino]
        );
      }
    }

    const total = paises.length - omitidos;
    await client.query(
      `INSERT INTO cargas (iniciado_en, finalizado_en, estado, registros, mensaje)
       VALUES ($1, clock_timestamp(), 'ok', $2, $3)`,
      [inicio, total, omitidos ? `${omitidos} registros omitidos por datos incompletos` : null]
    );
    await client.query('COMMIT');
    log(`Carga completa: ${total} países.`);
    return { paises: total, omitidos };
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
