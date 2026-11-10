# Production Multi-Stage Dockerfile for Admin Control Centre (Next.js 14)
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/admin-web ./apps/admin-web

ARG NEXT_PUBLIC_API_URL=https://api.asn.in/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @asn/admin-web build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/admin-web ./apps/admin-web

RUN pnpm install --frozen-lockfile --prod

EXPOSE 3002

CMD ["pnpm", "--filter", "@asn/admin-web", "start"]
