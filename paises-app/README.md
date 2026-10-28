# Práctica 3 · Buscador de Países (Atlas)

React + Vite · Express · PostgreSQL local · OAuth con GitHub · API pública: REST Countries

```
REST Countries ──(proceso de carga)──▶ PostgreSQL local ◀── API propia (Express) ◀── React + Vite
                                                                 ▲
                                                   Login/Logout OAuth GitHub (cookie httpOnly + JWT)
```

La interfaz **solo** consume `/api/*` (API propia). REST Countries únicamente se consulta en el proceso de carga.

## Requisitos (WSL Debian 13)

```bash
sudo apt update && sudo apt install -y postgresql
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER app WITH PASSWORD 'app' CREATEDB;"
sudo -u postgres createdb -O app paises_db
```
Node.js 20+ (`nvm install --lts`).

## 1. OAuth App en GitHub

GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**

| Campo | Valor |
|---|---|
| Homepage URL | `http://localhost:5173` |
| Authorization callback URL | `http://localhost:5173/auth/github/callback` |

Copia el **Client ID** y genera un **Client Secret**.

## 2. Backend

```bash
cd backend
cp .env.example .env      # llena GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET y JWT_SECRET
npm install
npm run db:init           # crea las tablas
npm run load              # carga REST Countries → PostgreSQL
npm run dev               # API en http://localhost:3000
```

`JWT_SECRET` aleatorio: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## 3. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Vite hace proxy de `/api` y `/auth` al puerto 3000, así la cookie de sesión funciona sin CORS.

## Base de datos (normalizada)

| Tabla | Contenido |
|---|---|
| `usuarios` | Usuarios que iniciaron sesión con GitHub |
| `regiones` / `subregiones` | Catálogos (cada región/subregión se guarda una sola vez) |
| `paises` | PK `cca3`, FK a región y subregión, bandera, capital, población, área |
| `idiomas`, `pais_idioma` | Relación N:M |
| `monedas`, `pais_moneda` | Relación N:M |
| `fronteras` | Auto-relación N:M entre países |
| `cargas` | Bitácora de cada ejecución del proceso de carga |

Consistencia: llaves foráneas, `CHECK`, `UNIQUE`, *upserts* (`ON CONFLICT`) para que la carga sea repetible sin duplicados, y toda la carga corre en una **transacción** (si falla, `ROLLBACK`).

## Proceso de carga

- `npm run load` (terminal) o botón **Sincronizar datos** (`POST /api/carga`, requiere sesión).
- REST Countries limita `/all` a 10 campos, por eso se hacen 2 peticiones (datos + fronteras).
- Reintentos con espera, timeout de 30 s y registro de error en `cargas`.

## API propia (todas requieren sesión)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/auth/github` | Inicia OAuth |
| GET | `/auth/github/callback` | Callback de GitHub |
| GET | `/auth/me` | Usuario actual |
| POST | `/auth/logout` | Cierra sesión |
| GET | `/api/regiones` | Regiones con conteo |
| GET | `/api/paises?q=&region=&page=&limit=` | Búsqueda, filtro y paginación |
| GET | `/api/paises/:cca3` | Detalle (idiomas, monedas, fronteras) |
| GET/POST | `/api/carga` | Estado / ejecutar carga |

## Interfaz

Catálogo con tarjetas, buscador con *debounce*, filtro por región (chips), paginación, vista lateral de detalle (navegable por países vecinos), indicador de carga, manejo de errores y diseño responsive.

## Producción (opcional)

`cd frontend && npm run build` → el backend sirve `frontend/dist` en el puerto 3000. Cambia `APP_URL` y la callback URL de GitHub a `http://localhost:3000`.
