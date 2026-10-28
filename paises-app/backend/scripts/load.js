import { pool } from '../src/db.js';
import { loadCountries } from '../src/loader.js';

try {
  await loadCountries();
} catch (err) {
  console.error('Error en la carga:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
