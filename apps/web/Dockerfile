# Multi-stage build for Next.js + Prisma
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY package-lock.json* ./
COPY pnpm-lock.yaml* ./
COPY .npmrc* ./
RUN npm i -g pnpm && pnpm fetch || true

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules/
COPY . .
RUN npm i -g pnpm && pnpm install --frozen-lockfile || pnpm install
RUN npx prisma generate --schema ./prisma/schema.prisma
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built app & prisma client
COPY --from=builder /app .
COPY ./entrypoint.sh ./entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
