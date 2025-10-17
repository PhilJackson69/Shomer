#!/usr/bin/env sh
set -e

# Wait for DB
until nc -z ${DATABASE_HOST:-db} ${DATABASE_PORT:-5432}; do
  echo "Waiting for database..."; sleep 1;
done

# Prisma
npx prisma generate --schema ./prisma/schema.prisma
npx prisma migrate deploy --schema ./prisma/schema.prisma

# Optional seed
if [ "$SEED" = "1" ]; then
  node -e "import('./prisma/seed.ts')"
fi

# Start
pnpm start


