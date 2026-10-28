import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authRouter, requireAuth } from './auth.js';
import { paisesRouter } from './routes/paises.js';

if (!process.env.JWT_SECRET) throw new Error('Falta JWT_SECRET en .env');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRouter);
app.use('/api', requireAuth, paisesRouter);

// En producción sirve el build de React desde el mismo puerto
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|auth).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Países en http://localhost:${PORT}`));
