-- Esquema para la práctica "Explorador de Personajes de Star Wars"
-- Ejecutar con: npm run db:init

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  github_id     BIGINT UNIQUE NOT NULL,
  login         TEXT NOT NULL,
  nombre        TEXT,
  avatar_url    TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_acceso TIMESTAMPTZ
);

-- Planetas: se guardan una sola vez y los personajes los referencian (sin redundancia)
CREATE TABLE IF NOT EXISTS planetas (
  id             INT PRIMARY KEY,            -- id de SWAPI
  nombre         TEXT NOT NULL,
  clima          TEXT,
  terreno        TEXT,
  gravedad       TEXT,
  diametro_km    INT CHECK (diametro_km >= 0),
  poblacion      BIGINT CHECK (poblacion >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personajes (
  id              INT PRIMARY KEY,           -- id de SWAPI
  nombre          TEXT NOT NULL,
  genero          TEXT NOT NULL DEFAULT 'n/a',
  anio_nacimiento TEXT,
  altura_cm       INT CHECK (altura_cm > 0),
  peso_kg         NUMERIC(7,2) CHECK (peso_kg > 0),
  color_ojos      TEXT,
  color_cabello   TEXT,
  color_piel      TEXT,
  planeta_id      INT REFERENCES planetas(id) ON DELETE SET NULL,
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personajes_nombre ON personajes(lower(nombre));
CREATE INDEX IF NOT EXISTS idx_personajes_genero ON personajes(genero);

-- Bitácora de cargas desde SWAPI
CREATE TABLE IF NOT EXISTS cargas (
  id            SERIAL PRIMARY KEY,
  iniciado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_en TIMESTAMPTZ,
  estado        TEXT NOT NULL CHECK (estado IN ('ok', 'error')),
  registros     INT NOT NULL DEFAULT 0,
  mensaje       TEXT
);
