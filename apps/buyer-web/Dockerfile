# Production Multi-Stage Dockerfile for Buyer Web Portal (Next.js 14)
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/buyer-web ./apps/buyer-web

ARG NEXT_PUBLIC_API_URL=https://api.asn.in/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @asn/buyer-web build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/buyer-web ./apps/buyer-web

RUN pnpm install --frozen-lockfile --prod

EXPOSE 3000

CMD ["pnpm", "--filter", "@asn/buyer-web", "start"]

