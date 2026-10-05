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
