# Production Multi-Stage Dockerfile for NestJS API Server
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api-server ./apps/api-server

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @asn/database db:generate
RUN pnpm --filter @asn/api-server build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache openssl wget libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api-server/package.json ./apps/api-server/package.json
COPY apps/api-server/dist ./apps/api-server/dist

RUN pnpm install --frozen-lockfile --prod

EXPOSE 4000

CMD ["node", "apps/api-server/dist/main.js"]
