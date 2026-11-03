# ADR-002: PostgreSQL as Source of Truth with Redis Coordination

## Status

**Accepted**

## Context

ASN requires zero overselling during multi-buyer concurrency (e.g. two garages purchasing the last remaining brake rotor simultaneously) and enforces a 5-minute stock hold policy during checkout.

We evaluated where inventory state, reservation locks, and financial ledger data should reside.

## Decision

1. **PostgreSQL 16 + PostGIS** is the sole, authoritative source of truth for all permanent domain entities (Inventory, Orders, Financial Ledger, Catalog, Spatial Coordinates).
2. **Redis 7** is used strictly for distributed atomic locking, ephemeral 5-minute reservation TTL keys, task queue management (BullMQ), and session caching.

## Rationale

1. **Financial Integrity:** PostgreSQL provides strong consistency, ACID compliance, and foreign key constraints required for multi-party financial reconciliation and GST audits.
2. **Atomic 5-Minute Locks:** Redis provides sub-millisecond distributed lock acquisition (`SET key token NX PX 300000`), immediately protecting physical stock against race conditions during high checkout concurrency.
3. **Resilience:** If Redis restarts, PostgreSQL retains the definitive order and inventory balance. All committed orders are persisted in PostgreSQL before release of the Redis lock.
