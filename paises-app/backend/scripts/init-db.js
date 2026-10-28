import fs from 'node:fs';
import { pool } from '../src/db.js';

const sql = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
try {
  await pool.query(sql);
  console.log('Esquema creado.');
} catch (err) {
  console.error('Error creando el esquema:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
