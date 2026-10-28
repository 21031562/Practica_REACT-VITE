import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  JWT_SECRET,
  APP_URL = 'http://localhost:5173',
} = process.env;

const SESSION_COOKIE = 'paises_session';
const STATE_COOKIE = 'paises_oauth_state';
const SESSION_HOURS = 8;
const REDIRECT_URI = `${APP_URL}/auth/github/callback`;

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export const authRouter = Router();

// 1) Redirige a GitHub con un "state" anti-CSRF
authRouter.get('/github', (req, res) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(500).send('OAuth no configurado: revisa GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET');
  }
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, { ...cookieOpts, maxAge: 10 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'read:user',
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// 2) GitHub regresa con ?code&state → se cambia el code por un token
authRouter.get('/github/callback', async (req, res) => {
  const { code, state } = req.query;
  const expected = req.cookies[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, cookieOpts);

  if (req.query.error) return res.redirect(`${APP_URL}/?error=denied`);
  if (!code || !state || state !== expected) return res.redirect(`${APP_URL}/?error=state`);

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error(tokenData.error_description || 'GitHub no devolvió token');

    const ghRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'practica-react-vite',
      },
    });
    if (!ghRes.ok) throw new Error(`GitHub /user respondió ${ghRes.status}`);
    const gh = await ghRes.json();

    const { rows } = await pool.query(
      `INSERT INTO usuarios (github_id, login, nombre, avatar_url, ultimo_acceso)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (github_id) DO UPDATE
         SET login = EXCLUDED.login, nombre = EXCLUDED.nombre,
             avatar_url = EXCLUDED.avatar_url, ultimo_acceso = now()
       RETURNING id`,
      [gh.id, gh.login, gh.name, gh.avatar_url]
    );

    const token = jwt.sign({ sub: rows[0].id }, JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
    res.cookie(SESSION_COOKIE, token, { ...cookieOpts, maxAge: SESSION_HOURS * 3600 * 1000 });
    res.redirect(`${APP_URL}/`);
  } catch (err) {
    console.error('[oauth]', err.message);
    res.redirect(`${APP_URL}/?error=oauth`);
  }
});

// Middleware: exige sesión válida
export async function requireAuth(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const { sub } = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, login, nombre, avatar_url FROM usuarios WHERE id = $1',
      [sub]
    );
    if (!rows.length) return res.status(401).json({ error: 'Usuario no encontrado' });
    req.user = rows[0];
    next();
  } catch {
    res.clearCookie(SESSION_COOKIE, cookieOpts);
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

authRouter.get('/me', requireAuth, (req, res) => res.json(req.user));

authRouter.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieOpts);
  res.status(204).end();
});
