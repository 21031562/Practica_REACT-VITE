import { pool } from '../src/db.js';
import { loadStarWars } from '../src/loader.js';

try {
  await loadStarWars();
} catch (err) {
  console.error('Error en la carga:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
