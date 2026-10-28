// API propia: la interfaz solo consume estos endpoints (nunca SWAPI)
import { Router } from 'express';
import { pool } from '../db.js';
import { loadStarWars } from '../loader.js';

export const personajesRouter = Router();

const toInt = (v, def, min, max) => {
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? def : Math.min(Math.max(n, min), max);
};

// GET /api/generos
personajesRouter.get('/generos', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT genero, COUNT(*)::int AS total FROM personajes GROUP BY genero ORDER BY total DESC'
  );
  res.json(rows);
});

// GET /api/personajes?q=&genero=&page=&limit=
personajesRouter.get('/personajes', async (req, res) => {
  const page = toInt(req.query.page, 1, 1, 10000);
  const limit = toInt(req.query.limit, 12, 1, 60);
  const q = (req.query.q || '').toString().trim();
  const genero = (req.query.genero || '').toString().trim();

  const where = [];
  const params = [];
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`lower(c.nombre) LIKE $${params.length}`);
  }
  if (genero) {
    params.push(genero);
    where.push(`c.genero = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM personajes c ${whereSql}`, params
  );

  params.push(limit, (page - 1) * limit);
  const { rows } = await pool.query(
    `SELECT c.id, c.nombre, c.genero, c.anio_nacimiento, p.nombre AS planeta
       FROM personajes c LEFT JOIN planetas p ON p.id = c.planeta_id
       ${whereSql}
      ORDER BY c.id
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ data: rows, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

// GET /api/personajes/:id → detalle con planeta de origen
personajesRouter.get('/personajes/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Id inválido' });

  const { rows } = await pool.query(
    `SELECT c.id, c.nombre, c.genero, c.anio_nacimiento, c.altura_cm, c.peso_kg::float AS peso_kg,
            c.color_ojos, c.color_cabello, c.color_piel,
            CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object(
              'id', p.id, 'nombre', p.nombre, 'clima', p.clima, 'terreno', p.terreno,
              'gravedad', p.gravedad, 'diametro_km', p.diametro_km, 'poblacion', p.poblacion::float8
            ) END AS planeta
       FROM personajes c LEFT JOIN planetas p ON p.id = c.planeta_id
      WHERE c.id = $1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Personaje no encontrado' });
  res.json(rows[0]);
});

// Estado de la última carga
personajesRouter.get('/carga', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM cargas ORDER BY id DESC LIMIT 1');
  const { rows: [{ total }] } = await pool.query('SELECT COUNT(*)::int AS total FROM personajes');
  res.json({ ultima: rows[0] || null, totalPersonajes: total });
});

// POST /api/carga → ejecuta el proceso de carga SWAPI → BD
let cargando = false;
personajesRouter.post('/carga', async (req, res) => {
  if (cargando) return res.status(409).json({ error: 'Ya hay una carga en curso' });
  cargando = true;
  try {
    res.json(await loadStarWars());
  } catch (err) {
    res.status(502).json({ error: err.message });
  } finally {
    cargando = false;
  }
});
