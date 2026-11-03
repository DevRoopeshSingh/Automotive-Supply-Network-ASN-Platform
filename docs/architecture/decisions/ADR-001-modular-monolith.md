# ADR-001: Modular Monolith vs Microservices for Initial Launch

## Status

**Accepted**

## Context

The ASN platform connects buyers, automotive suppliers, wholesale trading desks, and logistics partners into a coordinated network. Meeting the **60-Minute Delivery SLA** requires low-latency evaluation of inventory, multi-pickup routes, driver availability, and stock reservation.

We evaluated two architectural approaches:

1. Distributed Microservices (separate services for Catalog, Inventory, Reservation, Orders, Logistics, and Payments).
2. Modular Monolith (a single cohesive codebase with strict domain module boundaries in NestJS).

## Decision

We choose the **Modular Monolith** architecture for the MVP and early expansion phases.

## Rationale

1. **Transaction Atomicity:** Reserving stock across multiple suppliers and issuing holds on delivery partners requires ACID transactions. A monolith allows transactional guarantees within PostgreSQL without the overhead and failure modes of distributed Two-Phase Commit (2PC) or asynchronous Saga orchestrators.
2. **Network Performance:** In-memory method calls and in-process event emission (`EventEmitter2`) execute in microseconds, ensuring that the 60-minute route eligibility check finishes in under 200ms.
3. **Operational Overhead:** A single backend reduces deployment complexity, monitoring fragmentation, and infrastructure costs during the Mumbai pilot.
4. **Extraction Path:** Each NestJS module is architected with Clean Architecture principles (Domain $\to$ Application $\to$ Infrastructure $\to$ Presentation). If a specific module (e.g., the Logistics Routing Engine) demands independent horizontal scaling later, it can be extracted into an independent microservice with zero changes to its business domain logic.
