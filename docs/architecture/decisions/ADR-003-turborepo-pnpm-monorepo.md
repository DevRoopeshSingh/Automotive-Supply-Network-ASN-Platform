# ADR-003: Monorepo Architecture with pnpm Workspaces & Turborepo

## Status

**Accepted**

## Context

The platform includes 5 distinct user-facing applications (Buyer Marketplace, Supplier OS, Supply Network, Logistics Partner Mobile App, Admin Control Centre) and a shared backend API.

We needed a repository strategy that:

- Prevents schema and validation drift between frontend and backend.
- Enables shared UI components and design systems across three web applications.
- Maintains fast build and test times with intelligent caching.

## Decision

We adopt **pnpm Workspaces** managed by **Turborepo**.

## Rationale

1. **Zero Drift:** Shared Zod schemas (`@asn/validators`) and TypeScript types (`@asn/types`) are referenced directly via workspace packages (`workspace:*`). API contract changes immediately trigger compile-time errors in consumer frontends before reaching production.
2. **Disk Efficiency:** pnpm uses content-addressable storage and hard linking, avoiding duplicate dependencies across the 5 applications.
3. **High-Performance Caching:** Turborepo hashes inputs and outputs, skipping builds and tests for unchanged packages during CI and local development.
