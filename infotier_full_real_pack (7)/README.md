[![CI](https://github.com/infotier/infotier/actions/workflows/ci.yml/badge.svg)](https://github.com/infotier/infotier/actions/workflows/ci.yml)
[![release-please](https://img.shields.io/badge/release-please-blue)](https://github.com/infotier/infotier/actions/workflows/release-please.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

# Infotier — Full Real Stack

- **api-nest/** — NestJS + Prisma + S3 (AWS by default) + signed webhooks + provider toggles
- **dashboard/** — React (Vite) Approve/Reject + Audit logs
- **docs/** — OpenAPI + Redoc
- **postman/** — Collection + Environment
- **deploy/** — Docker Compose (AWS-first)
- **examples/webhook-receiver/** — Express HMAC verifier
- **.github/** — CI + release-please
- **seeds/** — DB seeds

Quick start (local Docker):
```
cp api-nest/.env.example api-nest/.env
docker compose -f deploy/docker-compose.yml up --build -d
docker compose -f deploy/docker-compose.yml exec api npx prisma migrate deploy
docker compose -f deploy/docker-compose.yml exec api node /app/../seeds/seed.js
```

Render deploy: import repo, apply `render.yaml`, set API env (AWS keys/bucket), run migrations, set dashboard `VITE_API_BASE`.
