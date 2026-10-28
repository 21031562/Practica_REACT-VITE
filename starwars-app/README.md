# Práctica 4 · Explorador de Personajes de Star Wars (Holoarchivo)

React + Vite · Express · PostgreSQL local · OAuth con GitHub · API pública: SWAPI

```
SWAPI ──(proceso de carga)──▶ PostgreSQL local ◀── API propia (Express) ◀── React + Vite
                                                        ▲
                                          Login/Logout OAuth GitHub (cookie httpOnly + JWT)
```

La interfaz **solo** consume `/api/*` (API propia). SWAPI únicamente se consulta en el proceso de carga.

Usa puertos distintos a la práctica de Países (API **3001**, frontend **5174**) para poder correr ambas a la vez.

## Requisitos (WSL Debian 13)

```bash
sudo apt update && sudo apt install -y postgresql
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER app WITH PASSWORD 'app' CREATEDB;"   # si no existe
sudo -u postgres createdb -O app starwars_db
```
Node.js 20+ (`nvm install --lts`).

## 1. OAuth App en GitHub (una distinta a la de Países)

| Campo | Valor |
|---|---|
| Homepage URL | `http://localhost:5174` |
| Authorization callback URL | `http://localhost:5174/auth/github/callback` |

## 2. Backend

```bash
cd backend
cp .env.example .env      # llena GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET y JWT_SECRET
npm install
npm run db:init
npm run load              # SWAPI → PostgreSQL (recorre todas las páginas)
npm run dev               # API en http://localhost:3001
```

Si `swapi.dev` falla (certificado o caída), en `.env` usa el espejo: `SWAPI_URL=https://swapi.py4e.com/api`

## 3. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5174
```

## Base de datos

| Tabla | Contenido |
|---|---|
| `usuarios` | Usuarios que iniciaron sesión con GitHub |
| `planetas` | PK = id de SWAPI; cada planeta se guarda una vez |
| `personajes` | PK = id de SWAPI, FK `planeta_id` → `planetas` (sin repetir datos del planeta) |
| `cargas` | Bitácora de cada ejecución del proceso de carga |

Limpieza en la carga: `"unknown"`/`"n/a"` → `NULL`, `"1,358"` → `1358`, el planeta “unknown” de SWAPI se guarda como `planeta_id NULL`. *Upserts* + transacción.

## Proceso de carga

- `npm run load` o botón **Sincronizar** (`POST /api/carga`).
- Paginación de SWAPI: sigue el campo `next` hasta `null` (planetas y personajes).
- Reintentos, timeout y registro de errores en `cargas`.

## API propia (todas requieren sesión)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/auth/github` · `/auth/github/callback` | OAuth |
| GET | `/auth/me` | Usuario actual |
| POST | `/auth/logout` | Cierra sesión |
| GET | `/api/personajes?q=&genero=&page=&limit=` | Listado paginado (nombre, género, nacimiento) |
| GET | `/api/personajes/:id` | Detalle (altura, peso, ojos, cabello, planeta) |
| GET | `/api/generos` | Géneros con conteo |
| GET/POST | `/api/carga` | Estado / ejecutar carga |

## Interfaz

Diseño temático (campo de estrellas, amarillo/holográfico), galería de tarjetas, modal de detalle con planeta de origen, paginación, búsqueda, filtro por género, indicador de carga tipo sable, manejo de errores y responsive.
