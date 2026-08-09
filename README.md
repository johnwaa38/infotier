[![CI](https://github.com/infotier/infotier/actions/workflows/ci.yml/badge.svg)](https://github.com/infotier/infotier/actions/workflows/ci.yml)
[![release-please](https://img.shields.io/badge/release-please-blue)](https://github.com/infotier/infotier/actions/workflows/release-please.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

# Infotier — Deployable Demo Stack

- **api-nest/** — NestJS + Prisma + S3 (AWS by default) + signed webhooks + provider toggles
- **dashboard/** — React (Vite) Approve/Reject + Audit logs
- **docs/** — OpenAPI + Redoc
- **postman/** — Collection + Environment
- **deploy/** — Docker Compose (AWS-first)
- **examples/webhook-receiver/** — Express HMAC verifier
- **.github/** — CI + release-please
- **seeds/** — DB seeds

## Verified repairs

- NestJS API and Vite dashboard compile successfully.
- Prisma schema is valid and includes an initial PostgreSQL migration.
- `/health` is available for Render health checks.
- The API Docker image builds the app before startup and applies migrations on startup.
- Render's free-demo configuration does not require AWS credentials.

## Quick start (local Docker)
```
cp api-nest/.env.example api-nest/.env
docker compose -f deploy/docker-compose.yml up --build -d
docker compose -f deploy/docker-compose.yml exec api npx prisma migrate deploy
docker compose -f deploy/docker-compose.yml exec api node /app/../seeds/seed.js
```

## Render deployment

Import the repository as a Blueprint using `render.yaml`. During initial setup, set:

- `VITE_API_BASE` to the API's public URL plus `/v1`, for example `https://infotier-api.onrender.com/v1`.
- `WEBHOOK_SECRET` to a long random value.

The included Blueprint uses Render's free plans and local temporary evidence storage. Evidence files disappear whenever the free API service restarts. Render's free PostgreSQL database also expires after 30 days. This is appropriate for a demo only, not real identity documents or production use.

For production, replace the temporary file store with a private object-storage implementation and use paid persistent PostgreSQL. Never commit credentials or identity evidence to Git.
