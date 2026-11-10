# ASN Production Environment & Secrets Checklist

This document details all required environment variables, secret generation procedures, security hardening checks, and automated database backup protocols for production deployment of the Automotive Supply Network (ASN) platform.

---

## 1. Secrets Generation Protocol

**NEVER reuse development passwords or default secrets in production.** Generate cryptographically secure random values on your local terminal or target server:

```bash
# Generate 64-character hex strings for JWT secrets
openssl rand -hex 32
# Output example: 4f8b2c91d8e7a6305f12e8b4c7a90d3e51a62f83c79e01d4a8f2b6c7e901a4b2

# Generate strong PostgreSQL password
openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20

# Generate strong Redis password
openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24
```

---

## 2. Production Environment Variables Reference

Create `.env.production` on the production server (chmod 600):

```ini
# =============================================================================
# ENVIRONMENT & GENERAL CONFIG
# =============================================================================
NODE_ENV=production
PORT=4000

# =============================================================================
# DATABASE & STORAGE (PostgreSQL 16 + PostGIS)
# =============================================================================
DB_NAME=asn_prod
DB_USER=asn_prod_user
# Strong generated password (no special characters that require URL-encoding)
DB_PASSWORD=YOUR_STRONG_GENERATED_DB_PASSWORD
# Full connection string used by Prisma ORM
DATABASE_URL=postgresql://asn_prod_user:YOUR_STRONG_GENERATED_DB_PASSWORD@postgres:5432/asn_prod?schema=public

# =============================================================================
# CACHE & DISTRIBUTED LOCKS (Redis 7)
# =============================================================================
REDIS_PASSWORD=YOUR_STRONG_GENERATED_REDIS_PASSWORD
REDIS_URL=redis://:YOUR_STRONG_GENERATED_REDIS_PASSWORD@redis:6379

# =============================================================================
# AUTHENTICATION & SECURITY TOKENS
# =============================================================================
# Minimum 32 characters, unique, generated with `openssl rand -hex 32`
JWT_SECRET=4f8b2c91d8e7a6305f12e8b4c7a90d3e51a62f83c79e01d4a8f2b6c7e901a4b2
JWT_REFRESH_SECRET=a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0

# STRICT PRODUCTION ENFORCEMENT:
# Must be set to "false". The backend will crash on boot if set to "true" in production.
ALLOW_DEV_OTP=false

# CORS Whitelist (comma-separated production domain origins)
CORS_ORIGIN=https://asn.in,https://buyer.asn.in,https://supplier.asn.in,https://admin.asn.in

# =============================================================================
# FRONTEND BUILD ARGUMENTS (NEXT_PUBLIC_*)
# =============================================================================
NEXT_PUBLIC_API_URL=https://api.asn.in/api/v1

# =============================================================================
# OBJECT STORAGE (Cloudflare R2 or AWS S3)
# =============================================================================
# Cloudflare R2 is recommended ($0 egress fees)
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=YOUR_CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY
R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME=asn-production-assets
R2_PUBLIC_URL=https://assets.asn.in

# =============================================================================
# TRANSACTIONAL SMS & OTP PROVIDER (India DLT Compliant)
# =============================================================================
# Msg91 / Fast2SMS / Twilio
OTP_PROVIDER_TYPE=msg91
MSG91_AUTH_KEY=YOUR_MSG91_AUTH_KEY
MSG91_SENDER_ID=ASNIND
MSG91_DLT_TE_ID=YOUR_GOVERNMENT_DLT_TEMPLATE_ID

# =============================================================================
# INDIAN PAYMENT GATEWAY (Phase 4 Ready)
# =============================================================================
# Razorpay / Cashfree / PhonePe Payment Gateway
PAYMENT_GATEWAY_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_live_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
```

---

## 3. Pre-Deployment Security Audit Checklist

Before initiating traffic on the production server, verify each checkpoint:

- [ ] **1. `ALLOW_DEV_OTP=false`:** Confirm that `ALLOW_DEV_OTP` is set to `false`. Running `BackendEnvSchema.safeParse()` must pass with 0 errors.
- [ ] **2. Insecure Secrets Check:** Confirm neither `JWT_SECRET` nor `JWT_REFRESH_SECRET` contains `change-me`, `secret`, or default strings.
- [ ] **3. Internal Port Isolation:** Confirm via `nmap` or `netstat` that ports `5432` (PostgreSQL) and `6379` (Redis) are NOT listening on `0.0.0.0` of the public network interface.
- [ ] **4. Firewall Verification:** Confirm `ufw status` shows only `22/tcp`, `80/tcp`, and `443/tcp` allowed.
- [ ] **5. TLS Certificate Status:** Visit `https://api.asn.in/health` in a browser and verify a valid Let's Encrypt / ZeroSSL TLS certificate is served without warnings.
- [ ] **6. Production CORS Check:** Verify making an API call with an unauthorized Origin header (e.g., `Origin: https://evil-site.com`) is rejected by the API server.

---

## 4. Automated Database Backup & Disaster Recovery

To prevent data loss on a lean single-node VPS, set up automated daily encrypted backups to S3 or Cloudflare R2.

### 4.1 Backup Script (`/opt/asn/scripts/backup-db.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Configuration
BACKUP_DIR="/opt/asn/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="asn_prod_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

mkdir -p "${BACKUP_DIR}"

echo "Starting PostgreSQL backup: ${FILENAME}..."

# Execute dump inside Docker container
docker compose -f /opt/asn/docker-compose.prod.yml exec -T postgres \
  pg_dump -U asn_prod_user -d asn_prod --clean --if-exists | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "Backup created successfully ($(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1))."

# Optional: Upload to S3/R2 using AWS CLI or rclone
if command -v aws &> /dev/null; then
  echo "Uploading backup to offsite storage..."
  aws s3 cp "${BACKUP_DIR}/${FILENAME}" "s3://asn-production-backups/${FILENAME}" \
    --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
fi

# Prune local backups older than RETENTION_DAYS
find "${BACKUP_DIR}" -name "asn_prod_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "Pruning complete."
```

### 4.2 Cron Configuration

Add to root cron (`sudo crontab -e`):

```cron
# Run daily at 03:00 AM IST (21:30 UTC)
30 21 * * * /opt/asn/scripts/backup-db.sh >> /var/log/asn-backup.log 2>&1
```

### 4.3 Database Restoration Drill

```bash
# Restore from backup archive
gunzip < /opt/asn/backups/asn_prod_backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f /opt/asn/docker-compose.prod.yml exec -T postgres \
  psql -U asn_prod_user -d asn_prod
```
