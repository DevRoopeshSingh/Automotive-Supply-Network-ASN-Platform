# Step-by-Step Server Setup & Deployment Runbook

This runbook provides complete, copy-pasteable terminal instructions for provisioning a fresh Ubuntu 24.04 or 22.04 LTS server (DigitalOcean, AWS Lightsail, Hetzner, or Linode) in the India region (`ap-south-1` Mumbai) and deploying the full Automotive Supply Network (ASN) platform.

---

## Prerequisites

- Fresh Ubuntu 24.04 / 22.04 LTS Server (Minimum 4 GB RAM, 8 GB recommended for build phase, 2+ vCPUs, 60+ GB SSD).
- Static Public IP address.
- Domain name managed on Cloudflare or DNS registrar (e.g., `asn.in`).
- Local SSH client.

---

## Step 1: Initial Server Hardening & User Setup

Log in to the server as root:

```bash
ssh root@YOUR_SERVER_IP
```

Update system packages:

```bash
apt update && apt upgrade -y
apt install -y ufw curl wget git htop fail2ban unzip
```

Create a dedicated deploy user with sudo privileges:

```bash
adduser --gecos "" asn-deploy
usermod -aG sudo asn-deploy

# Copy authorized SSH keys from root
mkdir -p /home/asn-deploy/.ssh
cp ~/.ssh/authorized_keys /home/asn-deploy/.ssh/
chown -R asn-deploy:asn-deploy /home/asn-deploy/.ssh
chmod 700 /home/asn-deploy/.ssh
chmod 600 /home/asn-deploy/.ssh/authorized_keys
```

Configure Firewall (UFW):

```bash
# Allow SSH, HTTP, and HTTPS only
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose
```

Enable Fail2Ban for SSH brute force mitigation:

```bash
systemctl enable fail2ban
systemctl start fail2ban
```

---

## Step 2: Install Docker Engine & Docker Compose

Install official Docker using Docker's official apt repository:

```bash
# Add Docker's official GPG key:
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Grant non-root deploy user Docker access:
usermod -aG docker asn-deploy
systemctl enable docker
systemctl start docker
```

Configure 4 GB Swap space (crucial for Next.js builds on low-memory VPS):

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Switch to the deploy user:

```bash
su - asn-deploy
```

---

## Step 3: Configure DNS Records

In your DNS provider (e.g. Cloudflare DNS dashboard), create `A` records pointing to your server's public IP:

| Type | Name              | Content / IPv4   | Proxy Status                       |
| :--- | :---------------- | :--------------- | :--------------------------------- |
| `A`  | `asn.in`          | `YOUR_SERVER_IP` | Proxied (Orange cloud) or DNS-only |
| `A`  | `api.asn.in`      | `YOUR_SERVER_IP` | Proxied or DNS-only                |
| `A`  | `buyer.asn.in`    | `YOUR_SERVER_IP` | Proxied or DNS-only                |
| `A`  | `supplier.asn.in` | `YOUR_SERVER_IP` | Proxied or DNS-only                |
| `A`  | `admin.asn.in`    | `YOUR_SERVER_IP` | Proxied or DNS-only                |

> [!TIP]
> If using Cloudflare proxy, set the SSL/TLS encryption mode to **Full (strict)** under Cloudflare SSL settings. Caddy will automatically generate valid Let's Encrypt certificates.

---

## Step 4: Clone Repository & Configure Directory Layout

```bash
sudo mkdir -p /opt/asn
sudo chown -R asn-deploy:asn-deploy /opt/asn

git clone https://github.com/DevRoopeshSingh/Automotive-Supply-Network-ASN-Platform.git /opt/asn
cd /opt/asn
```

Create production environment configuration:

```bash
cp .env.example .env.production
nano .env.production
```

Fill in your production values as specified in the [Environment & Secrets Checklist](file:///Users/rupeshsingh/Documents/WorkSpace/ASN-Platform/docs/deployment/environment-and-secrets-checklist.md):

- Set strong random values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_PASSWORD`, `REDIS_PASSWORD`.
- Confirm `ALLOW_DEV_OTP=false`.
- Set `NEXT_PUBLIC_API_URL=https://api.asn.in/api/v1`.
- Set `CORS_ORIGIN=https://asn.in,https://buyer.asn.in,https://supplier.asn.in,https://admin.asn.in`.

Restrict permissions on `.env.production`:

```bash
chmod 600 .env.production
```

---

## Step 5: Build & Launch Docker Containers

Run Docker Compose with the production configuration:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Monitor initial container startup:

```bash
docker compose -f docker-compose.prod.yml ps
```

Verify that all 7 containers are healthy and running:

- `asn-caddy` (Ports 80/443)
- `asn-postgres-prod` (healthy)
- `asn-redis-prod` (healthy)
- `asn-api-server-prod` (healthy)
- `asn-buyer-web-prod`
- `asn-supplier-web-prod`
- `asn-admin-web-prod`

---

## Step 6: Initialize Database Schema & Seed Data

Once PostgreSQL is healthy, execute the Prisma database sync inside the running API container:

```bash
# Push Prisma schema to create tables, indexes, and PostGIS extensions:
docker compose -f docker-compose.prod.yml exec api-server pnpm --filter @asn/database db:push

# Seed the master catalog (vehicle brands, models, product categories, master parts):
docker compose -f docker-compose.prod.yml exec api-server pnpm --filter @asn/database seed
```

---

## Step 7: Verify Live Endpoints

Test HTTP/HTTPS responses directly from the command line:

```bash
# 1. Core API Server Health Check
curl -I https://api.asn.in/health
# Expected: HTTP/2 200 with {"status":"ok","service":"asn-api-server"}

# 2. Swagger OpenAPI Documentation
curl -I https://api.asn.in/docs
# Expected: HTTP/2 200

# 3. Buyer Marketplace
curl -I https://buyer.asn.in
# Expected: HTTP/2 200

# 4. Supplier OS Portal
curl -I https://supplier.asn.in
# Expected: HTTP/2 200

# 5. Admin Control Centre
curl -I https://admin.asn.in
# Expected: HTTP/2 200
```

---

## Step 8: Setup Automated Nightly Backups

Create the backup directory and script:

```bash
sudo mkdir -p /opt/asn/scripts /opt/asn/backups
sudo chown -R asn-deploy:asn-deploy /opt/asn/scripts /opt/asn/backups
```

Create `/opt/asn/scripts/backup-db.sh` using the template from [Environment & Secrets Checklist](file:///Users/rupeshsingh/Documents/WorkSpace/ASN-Platform/docs/deployment/environment-and-secrets-checklist.md#41-backup-script-optasnscriptsbackup-dbsh).

Make the script executable:

```bash
chmod +x /opt/asn/scripts/backup-db.sh
```

Add to cron:

```bash
crontab -e
```

Add the line:

```cron
30 21 * * * /opt/asn/scripts/backup-db.sh >> /var/log/asn-backup.log 2>&1
```

---

## Step 9: Ongoing Maintenance & Deployment Upgrades

To deploy new code updates with zero downtime:

```bash
cd /opt/asn

# 1. Pull latest commits
git pull origin main

# 2. Rebuild updated containers in background
docker compose -f docker-compose.prod.yml --env-file .env.production build api-server buyer-web supplier-web admin-web

# 3. Apply any database migrations
docker compose -f docker-compose.prod.yml exec api-server pnpm --filter @asn/database db:push

# 4. Gracefully recreate app containers without touching PostgreSQL or Redis
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-deps api-server buyer-web supplier-web admin-web

# 5. Clean up stale build caches and old images
docker image prune -f
```
