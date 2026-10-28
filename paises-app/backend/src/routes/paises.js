// API propia: la interfaz solo consume estos endpoints (nunca REST Countries)
import { Router } from 'express';
import { pool } from '../db.js';
import { loadCountries } from '../loader.js';

export const paisesRouter = Router();

const toInt = (v, def, min, max) => {
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? def : Math.min(Math.max(n, min), max);
};

// GET /api/regiones → regiones con número de países
paisesRouter.get('/regiones', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.nombre, COUNT(p.cca3)::int AS total
       FROM regiones r LEFT JOIN paises p ON p.region_id = r.id
      GROUP BY r.id ORDER BY r.nombre`
  );
  res.json(rows);
});

// GET /api/paises?q=&region=&page=&limit=
paisesRouter.get('/paises', async (req, res) => {
  const page = toInt(req.query.page, 1, 1, 10000);
  const limit = toInt(req.query.limit, 12, 1, 60);
  const q = (req.query.q || '').toString().trim();
  const region = toInt(req.query.region, 0, 0, 1e9);

  const where = [];
  const params = [];
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`(lower(p.nombre_comun) LIKE $${params.length} OR lower(p.nombre_oficial) LIKE $${params.length})`);
  }
  if (region) {
    params.push(region);
    where.push(`p.region_id = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM paises p ${whereSql}`, params);
  const total = totalRes.rows[0].total;

  params.push(limit, (page - 1) * limit);
  const { rows } = await pool.query(
    `SELECT p.cca3, p.nombre_comun AS nombre, p.capital, p.poblacion::float8 AS poblacion,
            p.bandera_png AS bandera, p.bandera_alt, r.nombre AS region, s.nombre AS subregion
       FROM paises p
       JOIN regiones r ON r.id = p.region_id
       LEFT JOIN subregiones s ON s.id = p.subregion_id
       ${whereSql}
      ORDER BY p.nombre_comun
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ data: rows, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

// GET /api/paises/:cca3 → detalle
paisesRouter.get('/paises/:cca3', async (req, res) => {
  const cca3 = req.params.cca3.toUpperCase();
  if (!/^[A-Z]{3}$/.test(cca3)) return res.status(400).json({ error: 'Código inválido' });

  const { rows } = await pool.query(
    `SELECT p.cca3, p.nombre_comun AS nombre, p.nombre_oficial, p.capital, p.poblacion::float8 AS poblacion,
            p.area::float AS area, p.bandera_svg, p.bandera_png, p.bandera_alt,
            r.nombre AS region, s.nombre AS subregion, p.actualizado_en
       FROM paises p
       JOIN regiones r ON r.id = p.region_id
       LEFT JOIN subregiones s ON s.id = p.subregion_id
      WHERE p.cca3 = $1`,
    [cca3]
  );
  if (!rows.length) return res.status(404).json({ error: 'País no encontrado' });

  const [idiomas, monedas, vecinos] = await Promise.all([
    pool.query(
      `SELECT i.codigo, i.nombre FROM pais_idioma pi JOIN idiomas i ON i.codigo = pi.idioma_codigo
        WHERE pi.pais_cca3 = $1 ORDER BY i.nombre`, [cca3]),
    pool.query(
      `SELECT m.codigo, m.nombre, m.simbolo FROM pais_moneda pm JOIN monedas m ON m.codigo = pm.moneda_codigo
        WHERE pm.pais_cca3 = $1 ORDER BY m.codigo`, [cca3]),
    pool.query(
      `SELECT p.cca3, p.nombre_comun AS nombre, p.bandera_png AS bandera
         FROM fronteras f JOIN paises p ON p.cca3 = f.vecino_cca3
        WHERE f.pais_cca3 = $1 ORDER BY p.nombre_comun`, [cca3]),
  ]);

  res.json({ ...rows[0], idiomas: idiomas.rows, monedas: monedas.rows, vecinos: vecinos.rows });
});

// Estado de la última carga
paisesRouter.get('/carga', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM cargas ORDER BY id DESC LIMIT 1');
  const { rows: [{ total }] } = await pool.query('SELECT COUNT(*)::int AS total FROM paises');
  res.json({ ultima: rows[0] || null, totalPaises: total });
});

// POST /api/carga → ejecuta el proceso de carga API pública → BD
let cargando = false;
paisesRouter.post('/carga', async (req, res) => {
  if (cargando) return res.status(409).json({ error: 'Ya hay una carga en curso' });
  cargando = true;
  try {
    const resultado = await loadCountries();
    res.json(resultado);
  } catch (err) {
    res.status(502).json({ error: err.message });
  } finally {
    cargando = false;
  }
});
