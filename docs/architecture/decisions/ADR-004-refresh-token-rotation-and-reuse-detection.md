# ADR-004: Refresh Token Rotation with Automatic Reuse Detection & Tenant-Aware Sessions

## Status

**Accepted**

## Context

ASN supports multi-role users (garage owners, fleet managers, suppliers) accessing the platform across web browsers and mobile apps. We required a session management strategy that:

1. Minimizes the exposure window of compromised access tokens.
2. Defends against token theft and replay attacks without degrading user experience.
3. Allows immediate session revocation upon logout or detected security breach.
4. Enforces multi-tenant context boundaries so a user cannot impersonate another business.

## Decision

1. **Short-Lived Access Tokens (15 Minutes):** Stateless JWTs signed with `JWT_SECRET`.
2. **Refresh Token Rotation (RTR):** Every time a refresh token is exchanged, a new refresh token is issued and the old one is marked as revoked.
3. **Cryptographic Family Tracking:** Refresh tokens belong to an immutable `familyId`. If an already-revoked refresh token is presented (indicating token interception or replay attack), the system immediately revokes **all tokens within that family**, terminating the attacker and forcing the legitimate user to re-authenticate via OTP.
4. **Hashed Token Storage:** Only SHA-256 hashes of refresh tokens are stored in the database (`token_hash`), preventing token exposure in the event of database snapshots being leaked.
5. **Multi-Tenant Context Scoping:** Access tokens embed the active `businessId` and role, allowing fast authorization checks with database validation via `TenantContextGuard`.
