import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en .env');
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
