# Costos WhatsApp

Panel (Next.js + React + TypeScript + Tailwind, mismo stack que henry-portfolio) para ver el gasto de mensajería de WhatsApp Business por cliente. Datos de `pricing_analytics` (Graph API) guardados en SQL Server.

## Puesta en marcha
1. `cp .env.local.example .env.local` y completar (DB, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`; generar con `openssl rand -base64 32`).
2. `npm install`
3. `npm run db:init` — crea las tablas.
4. `npm run user:create -- admin@correo.com 'clave-segura' admin`
5. `npm run dev` → entrar como admin, **Clientes** → crear cliente (WABA ID + token de System User) → *Sincronizar ahora* (hasta 365 días de histórico).

## Vercel
- Cargar las mismas variables de entorno. El SQL Server del VPS debe aceptar conexiones desde internet (puerto 1433; idealmente restringido y con cifrado TLS).
- `vercel.json` programa `/api/cron/sync` a diario (07:00 UTC); resincroniza los últimos 7 días de cada cliente activo.

## Roles
- **admin**: selector de cliente en la barra lateral, gestión de clientes/usuarios.
- **client**: solo ve su propio cliente (forzado en el servidor).
