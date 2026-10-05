-- SQL Server. Ejecutar con: npm run db:init (o manualmente).

IF OBJECT_ID('dbo.clients') IS NULL
CREATE TABLE dbo.clients (
  id              INT IDENTITY PRIMARY KEY,
  name            NVARCHAR(200) NOT NULL,
  waba_id         NVARCHAR(50)  NULL,
  access_token_enc NVARCHAR(MAX) NULL,      -- token de System User, cifrado AES-256-GCM
  currency        NVARCHAR(10)  NOT NULL DEFAULT 'USD',
  active          BIT NOT NULL DEFAULT 1,
  last_synced_at  DATETIME2 NULL,
  last_sync_error NVARCHAR(500) NULL,
  created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.users') IS NULL
CREATE TABLE dbo.users (
  id            INT IDENTITY PRIMARY KEY,
  email         NVARCHAR(200) NOT NULL UNIQUE,
  password_hash NVARCHAR(100) NOT NULL,
  role          NVARCHAR(10)  NOT NULL CHECK (role IN ('admin','client')),
  client_id     INT NULL REFERENCES dbo.clients(id),
  created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_users_client CHECK ((role = 'admin') OR (client_id IS NOT NULL))
);

IF OBJECT_ID('dbo.message_costs') IS NULL
BEGIN
  CREATE TABLE dbo.message_costs (
    client_id        INT NOT NULL REFERENCES dbo.clients(id),
    day              DATE NOT NULL,
    phone_number     NVARCHAR(30)  NOT NULL DEFAULT '',
    country          NVARCHAR(10)  NOT NULL DEFAULT '',
    pricing_category NVARCHAR(30)  NOT NULL DEFAULT '',
    pricing_type     NVARCHAR(30)  NOT NULL DEFAULT '',
    volume           INT NOT NULL DEFAULT 0,
    cost             DECIMAL(18,6) NOT NULL DEFAULT 0,
    currency         NVARCHAR(10)  NOT NULL DEFAULT 'USD',
    CONSTRAINT pk_message_costs PRIMARY KEY (client_id, day, phone_number, country, pricing_category, pricing_type)
  );
  CREATE INDEX ix_message_costs_day ON dbo.message_costs (client_id, day);
END

-- Límite de intentos de login (por email y por IP)
IF OBJECT_ID('dbo.login_attempts') IS NULL
CREATE TABLE dbo.login_attempts (
  [key]        NVARCHAR(260) NOT NULL PRIMARY KEY,   -- 'e:<email>' o 'i:<ip>'
  fails        INT NOT NULL DEFAULT 0,               -- fallos desde el último bloqueo
  level        INT NOT NULL DEFAULT 0,               -- cantidad de bloqueos acumulados
  locked_until DATETIME2 NULL,
  updated_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Sincronización automática al entrar (evita lanzar varias a la vez)
IF COL_LENGTH('dbo.clients', 'last_sync_attempt_at') IS NULL
  ALTER TABLE dbo.clients ADD last_sync_attempt_at DATETIME2 NULL;

-- Base de datos propia de cada cliente (para contar viajes en VIAJES_HISTORICOS)
IF COL_LENGTH('dbo.clients', 'trips_db_server') IS NULL
  ALTER TABLE dbo.clients ADD
    trips_db_server       NVARCHAR(200) NULL,
    trips_db_port         INT NULL,
    trips_db_name         NVARCHAR(200) NULL,
    trips_db_user         NVARCHAR(200) NULL,
    trips_db_password_enc NVARCHAR(MAX) NULL,   -- cifrada AES-256-GCM
    trips_db_encrypt      BIT NOT NULL DEFAULT 1,
    trips_db_trust_cert   BIT NOT NULL DEFAULT 1,
    trips_users           NVARCHAR(500) NULL;   -- nro_usuario_telefonista separados por coma
