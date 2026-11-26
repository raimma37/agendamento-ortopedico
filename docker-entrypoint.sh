#!/bin/sh
set -e

echo ">> Aplicando migrations do Prisma..."
npx prisma migrate deploy

if [ "$RUN_SEED_ON_BOOT" = "true" ]; then
  echo ">> Verificando seed inicial..."
  npx tsx prisma/seed.ts || true
fi

echo ">> Iniciando servidor Next.js..."
exec node server.js
