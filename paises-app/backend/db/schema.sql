-- Esquema normalizado para la práctica "Buscador de Países"
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

CREATE TABLE IF NOT EXISTS regiones (
  id     SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS subregiones (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT NOT NULL,
  region_id INT NOT NULL REFERENCES regiones(id) ON DELETE CASCADE,
  UNIQUE (nombre, region_id)
);

CREATE TABLE IF NOT EXISTS paises (
  cca3           CHAR(3) PRIMARY KEY,
  nombre_comun   TEXT NOT NULL,
  nombre_oficial TEXT NOT NULL,
  capital        TEXT,
  poblacion      BIGINT CHECK (poblacion >= 0),
  area           NUMERIC(14,2) CHECK (area >= 0),
  bandera_png    TEXT,
  bandera_svg    TEXT,
  bandera_alt    TEXT,
  region_id      INT NOT NULL REFERENCES regiones(id),
  subregion_id   INT REFERENCES subregiones(id),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_paises_region ON paises(region_id);
CREATE INDEX IF NOT EXISTS idx_paises_nombre ON paises(lower(nombre_comun));

CREATE TABLE IF NOT EXISTS idiomas (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pais_idioma (
  pais_cca3     CHAR(3) REFERENCES paises(cca3) ON DELETE CASCADE,
  idioma_codigo TEXT REFERENCES idiomas(codigo) ON DELETE CASCADE,
  PRIMARY KEY (pais_cca3, idioma_codigo)
);

CREATE TABLE IF NOT EXISTS monedas (
  codigo  TEXT PRIMARY KEY,
  nombre  TEXT NOT NULL,
  simbolo TEXT
);

CREATE TABLE IF NOT EXISTS pais_moneda (
  pais_cca3     CHAR(3) REFERENCES paises(cca3) ON DELETE CASCADE,
  moneda_codigo TEXT REFERENCES monedas(codigo) ON DELETE CASCADE,
  PRIMARY KEY (pais_cca3, moneda_codigo)
);

CREATE TABLE IF NOT EXISTS fronteras (
  pais_cca3   CHAR(3) REFERENCES paises(cca3) ON DELETE CASCADE,
  vecino_cca3 CHAR(3) REFERENCES paises(cca3) ON DELETE CASCADE,
  PRIMARY KEY (pais_cca3, vecino_cca3),
  CHECK (pais_cca3 <> vecino_cca3)
);

-- Bitácora de cargas desde el API público
CREATE TABLE IF NOT EXISTS cargas (
  id            SERIAL PRIMARY KEY,
  iniciado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_en TIMESTAMPTZ,
  estado        TEXT NOT NULL CHECK (estado IN ('ok', 'error')),
  registros     INT NOT NULL DEFAULT 0,
  mensaje       TEXT
);
