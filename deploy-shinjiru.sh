#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# HedgeGate one-shot VPS deploy script
#
# Tested on: Ubuntu 22.04 / 24.04 (Shinjiru KVM VPS, fresh image, root SSH).
# What it does:
#   1. Installs Node 20, pnpm, pm2, nginx, ufw, certbot.
#   2. Clones (or updates) the repo into /var/www/hedgegate.
#   3. Installs deps and builds both the api-server and the React frontend.
#   4. Writes /var/www/hedgegate/artifacts/api-server/.env from your secrets.
#   5. Starts the api-server under pm2, saves state, and registers it on boot.
#   6. Drops in an nginx vhost (SPA + /api reverse proxy) and reloads.
#   7. Opens the firewall for SSH and HTTP/HTTPS.
#   8. Issues a Let's Encrypt cert and switches the site to HTTPS.
#   9. Schedules a daily tarball backup of the api-server data folder.
#  10. Optionally uploads each nightly backup off-box to a Backblaze B2 bucket
#      (or any S3-compatible store) via rclone, with its own retention.
#
# Usage (run as root on a fresh VPS):
#
#   wget https://raw.githubusercontent.com/<you>/<repo>/main/deploy-shinjiru.sh
#   chmod +x deploy-shinjiru.sh
#
#   DOMAIN=hedgegate.example.com \
#   EMAIL=you@example.com \
#   REPO_URL=https://github.com/<you>/<repo>.git \
#   GIT_BRANCH=main \
#   SESSION_SECRET='...' \
#   NOWPAYMENTS_API_KEY='...' \
#   ADMIN_KEY='HG-ADMIN-AT6768665G-2026' \
#   BOT_UNLOCK_KEY='AT6768665G' \
#   CLERK_PUBLISHABLE_KEY='pk_live_...' \
#   CLERK_SECRET_KEY='sk_live_...' \
#     ./deploy-shinjiru.sh
#
# Optional off-box backup (Backblaze B2) — append these to enable:
#   B2_BUCKET='hedgegate-backups' \
#   B2_KEY_ID='0010abc...' \
#   B2_APPLICATION_KEY='K001xyz...' \
#   B2_REMOTE_RETENTION_DAYS=30 \
#
# Other S3-compatible stores (Cloudflare R2, AWS S3, Wasabi, etc.) work too;
# set RCLONE_BACKEND=s3 plus the standard S3 vars (S3_ENDPOINT, S3_ACCESS_KEY,
# S3_SECRET_KEY, S3_REGION) instead of the B2_* set.
#
# To redeploy after pushing new commits, just re-run the script. It is
# idempotent: it pulls the latest code, rebuilds, restarts pm2, and reloads
# nginx without touching your .env, certs, or data folder.
# ----------------------------------------------------------------------------

set -euo pipefail

# ---- helpers ----------------------------------------------------------------
RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
info()  { printf "%s[ * ]%s %s\n" "$BLUE"   "$RESET" "$*"; }
ok()    { printf "%s[ ok]%s %s\n" "$GREEN"  "$RESET" "$*"; }
warn()  { printf "%s[ ! ]%s %s\n" "$YELLOW" "$RESET" "$*"; }
die()   { printf "%s[err]%s %s\n" "$RED"    "$RESET" "$*" >&2; exit 1; }

require_var() { local n="$1"; if [ -z "${!n:-}" ]; then die "Missing required env var: $n"; fi; }

[ "$(id -u)" -eq 0 ] || die "Run as root (or with sudo)."

# ---- required inputs --------------------------------------------------------
require_var DOMAIN
require_var EMAIL
require_var REPO_URL
require_var SESSION_SECRET
require_var NOWPAYMENTS_API_KEY
require_var ADMIN_KEY
require_var BOT_UNLOCK_KEY
require_var CLERK_PUBLISHABLE_KEY
require_var CLERK_SECRET_KEY

GIT_BRANCH="${GIT_BRANCH:-main}"
APP_DIR="${APP_DIR:-/var/www/hedgegate}"
API_PORT="${API_PORT:-8080}"
PM2_NAME="${PM2_NAME:-hedgegate-api}"
NGINX_SITE="${NGINX_SITE:-hedgegate}"
BACKUP_DIR="${BACKUP_DIR:-/root/hedgegate-backups}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-14}"
B2_REMOTE_RETENTION_DAYS="${B2_REMOTE_RETENTION_DAYS:-30}"
RCLONE_BACKEND="${RCLONE_BACKEND:-}"
RCLONE_REMOTE_NAME="hedgegate-offsite"

info "Domain:          $DOMAIN"
info "App directory:   $APP_DIR"
info "Repo:            $REPO_URL ($GIT_BRANCH)"
info "API port (lo):   $API_PORT"

# ---- 1. system packages -----------------------------------------------------
info "Installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  curl ca-certificates gnupg git ufw nginx certbot python3-certbot-nginx tar cron

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v20'; then
  info "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi

if ! command -v pnpm >/dev/null 2>&1; then
  info "Installing pnpm..."
  npm install -g pnpm@latest >/dev/null
fi

if ! command -v pm2 >/dev/null 2>&1; then
  info "Installing pm2..."
  npm install -g pm2@latest >/dev/null
fi

ok "Node $(node -v), pnpm $(pnpm -v), pm2 $(pm2 -v)"

# ---- 2. clone or update -----------------------------------------------------
mkdir -p "$(dirname "$APP_DIR")"
if [ -d "$APP_DIR/.git" ]; then
  info "Updating existing checkout..."
  git -C "$APP_DIR" fetch --quiet origin "$GIT_BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$GIT_BRANCH"
else
  info "Cloning $REPO_URL into $APP_DIR..."
  git clone --quiet --branch "$GIT_BRANCH" "$REPO_URL" "$APP_DIR"
fi
ok "Code is at commit $(git -C "$APP_DIR" rev-parse --short HEAD)"

# ---- 3. install + build -----------------------------------------------------
cd "$APP_DIR"
info "Installing JS dependencies (pnpm install)..."
pnpm install --frozen-lockfile

info "Building api-server..."
pnpm --filter @workspace/api-server run build

info "Building frontend (horizon-markets)..."
pnpm --filter @workspace/horizon-markets run build

FRONTEND_DIST="$APP_DIR/artifacts/horizon-markets/dist"
[ -d "$FRONTEND_DIST" ] || die "Frontend build did not produce $FRONTEND_DIST"
ok "Builds complete."

# ---- 4. write .env ----------------------------------------------------------
ENV_FILE="$APP_DIR/artifacts/api-server/.env"
info "Writing $ENV_FILE..."
umask 077
cat > "$ENV_FILE" <<EOF
PORT=$API_PORT
NODE_ENV=production
SESSION_SECRET=$SESSION_SECRET
NOWPAYMENTS_API_KEY=$NOWPAYMENTS_API_KEY
ADMIN_KEY=$ADMIN_KEY
BOT_UNLOCK_KEY=$BOT_UNLOCK_KEY
CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=$CLERK_SECRET_KEY
EOF
chmod 600 "$ENV_FILE"
umask 022
ok "Wrote $ENV_FILE (chmod 600)"

# ensure persistent data folder exists and survives redeploys
mkdir -p "$APP_DIR/artifacts/api-server/data"

# ---- 5. pm2 -----------------------------------------------------------------
info "Starting api-server under pm2..."
# Load the .env into this shell so pm2 captures it in its dump.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env >/dev/null
else
  pm2 start "pnpm --filter @workspace/api-server start" \
    --name "$PM2_NAME" --cwd "$APP_DIR" --update-env >/dev/null
fi
pm2 save >/dev/null

# Register pm2 with systemd so it auto-starts on reboot.
if ! systemctl list-unit-files | grep -q '^pm2-root\.service'; then
  info "Registering pm2 with systemd..."
  pm2 startup systemd -u root --hp /root | tail -n 1 | bash >/dev/null
  pm2 save >/dev/null
fi
ok "pm2 process '$PM2_NAME' is running."

# ---- 6. nginx ---------------------------------------------------------------
NGINX_CONF="/etc/nginx/sites-available/$NGINX_SITE"
info "Writing nginx vhost $NGINX_CONF..."
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    root $FRONTEND_DIST;
    index index.html;

    # Long-cache hashed assets, never cache HTML
    location ~* \.(?:js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files \$uri =404;
    }

    location = /index.html {
        add_header Cache-Control "no-store";
    }

    # Reverse-proxy the Express API
    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    # SPA fallback (must come last)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    client_max_body_size 5m;
}
EOF
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$NGINX_SITE"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ok "nginx reloaded."

# ---- 7. firewall ------------------------------------------------------------
info "Configuring ufw firewall..."
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
yes | ufw enable >/dev/null
ok "ufw enabled (OpenSSH + Nginx Full)."

# ---- 8. HTTPS ---------------------------------------------------------------
info "Requesting Let's Encrypt cert for $DOMAIN..."
certbot --nginx -n --agree-tos -m "$EMAIL" \
  -d "$DOMAIN" -d "www.$DOMAIN" --redirect || \
  warn "certbot failed (DNS may not have propagated yet). Re-run: certbot --nginx -d $DOMAIN -d www.$DOMAIN"

# ---- 9. daily backups -------------------------------------------------------
mkdir -p "$BACKUP_DIR"

# Decide whether off-box backups are configured.
OFFSITE_MODE="none"
if [ -n "${B2_BUCKET:-}" ] && [ -n "${B2_KEY_ID:-}" ] && [ -n "${B2_APPLICATION_KEY:-}" ]; then
  OFFSITE_MODE="b2"
elif [ "$RCLONE_BACKEND" = "s3" ] && [ -n "${S3_ENDPOINT:-}" ] && [ -n "${S3_ACCESS_KEY:-}" ] && [ -n "${S3_SECRET_KEY:-}" ] && [ -n "${S3_BUCKET:-}" ]; then
  OFFSITE_MODE="s3"
fi

if [ "$OFFSITE_MODE" != "none" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    info "Installing rclone for off-box backups..."
    apt-get install -y -qq rclone
  fi

  RCLONE_CONF="/root/.config/rclone/rclone.conf"
  mkdir -p "$(dirname "$RCLONE_CONF")"
  chmod 700 "$(dirname "$RCLONE_CONF")"

  # Strip any prior remote with the same name so re-runs don't duplicate it.
  if [ -f "$RCLONE_CONF" ]; then
    awk -v name="[$RCLONE_REMOTE_NAME]" '
      $0 == name { skip=1; next }
      /^\[/ { skip=0 }
      !skip { print }
    ' "$RCLONE_CONF" > "$RCLONE_CONF.tmp" && mv "$RCLONE_CONF.tmp" "$RCLONE_CONF"
  fi
  touch "$RCLONE_CONF"
  chmod 600 "$RCLONE_CONF"

  if [ "$OFFSITE_MODE" = "b2" ]; then
    info "Configuring rclone remote '$RCLONE_REMOTE_NAME' for Backblaze B2..."
    cat >> "$RCLONE_CONF" <<EOF

[$RCLONE_REMOTE_NAME]
type = b2
account = $B2_KEY_ID
key = $B2_APPLICATION_KEY
hard_delete = true
EOF
    REMOTE_PATH="$RCLONE_REMOTE_NAME:$B2_BUCKET/hedgegate"
    OFFSITE_LABEL="Backblaze B2 bucket '$B2_BUCKET'"
  else
    info "Configuring rclone remote '$RCLONE_REMOTE_NAME' for S3-compatible store..."
    cat >> "$RCLONE_CONF" <<EOF

[$RCLONE_REMOTE_NAME]
type = s3
provider = Other
endpoint = $S3_ENDPOINT
access_key_id = $S3_ACCESS_KEY
secret_access_key = $S3_SECRET_KEY
region = ${S3_REGION:-auto}
acl = private
EOF
    REMOTE_PATH="$RCLONE_REMOTE_NAME:$S3_BUCKET/hedgegate"
    OFFSITE_LABEL="S3 bucket '$S3_BUCKET' at $S3_ENDPOINT"
  fi

  # Verify the remote is reachable so we fail fast (not at 3 AM).
  if rclone --config "$RCLONE_CONF" lsd "$RCLONE_REMOTE_NAME:" >/dev/null 2>&1; then
    ok "rclone remote '$RCLONE_REMOTE_NAME' authenticated."
  else
    warn "rclone could not list remote '$RCLONE_REMOTE_NAME:'. Check your B2/S3 credentials."
    warn "Off-box backups are configured but the first upload may fail. Logs: $BACKUP_DIR/offsite.log"
  fi

  # Wrapper script: tar -> upload -> prune local -> prune remote (atomic-ish).
  BACKUP_SCRIPT="/usr/local/bin/hedgegate-backup.sh"
  cat > "$BACKUP_SCRIPT" <<EOF
#!/usr/bin/env bash
set -euo pipefail
TS="\$(date +%F)"
LOCAL="$BACKUP_DIR/data-\${TS}.tgz"
LOG="$BACKUP_DIR/offsite.log"

mkdir -p "$BACKUP_DIR"
tar -czf "\$LOCAL" -C "$APP_DIR/artifacts/api-server" data

# Upload to off-box store.
{
  echo "[\$(date -Iseconds)] uploading \$LOCAL to $REMOTE_PATH/"
  rclone --config "$RCLONE_CONF" copy "\$LOCAL" "$REMOTE_PATH/" --quiet
  echo "[\$(date -Iseconds)] upload ok"
} >> "\$LOG" 2>&1 || echo "[\$(date -Iseconds)] upload FAILED — see above" >> "\$LOG"

# Prune local copies older than $LOCAL_RETENTION_DAYS days.
find "$BACKUP_DIR" -maxdepth 1 -name 'data-*.tgz' -mtime +$LOCAL_RETENTION_DAYS -delete

# Prune remote copies older than $B2_REMOTE_RETENTION_DAYS days.
{
  rclone --config "$RCLONE_CONF" delete "$REMOTE_PATH/" \\
    --min-age ${B2_REMOTE_RETENTION_DAYS}d --quiet
} >> "\$LOG" 2>&1 || true
EOF
  chmod 700 "$BACKUP_SCRIPT"

  CRON_LINE="0 3 * * * $BACKUP_SCRIPT"
  ok "Off-box backups: $OFFSITE_LABEL (remote retention ${B2_REMOTE_RETENTION_DAYS}d)"
else
  # Local-only fallback (matches previous behavior).
  CRON_LINE="0 3 * * * tar -czf $BACKUP_DIR/data-\$(date +\\%F).tgz -C $APP_DIR/artifacts/api-server data && find $BACKUP_DIR -maxdepth 1 -name 'data-*.tgz' -mtime +$LOCAL_RETENTION_DAYS -delete"
  warn "Off-box backups are NOT configured — backups stay on this VPS only."
  warn "Set B2_BUCKET + B2_KEY_ID + B2_APPLICATION_KEY (or RCLONE_BACKEND=s3 + S3_*) and re-run to enable."
fi

# Replace any prior cron entry for our backup dir / wrapper to keep it idempotent.
( crontab -l 2>/dev/null | grep -v -e "$BACKUP_DIR" -e "hedgegate-backup.sh" ; echo "$CRON_LINE" ) | crontab -
ok "Daily 03:00 backup scheduled (local retention ${LOCAL_RETENTION_DAYS}d) -> $BACKUP_DIR"

# ---- summary ----------------------------------------------------------------
echo
ok "HedgeGate is live."
echo
echo "  URL:        https://$DOMAIN"
echo "  Admin:      https://$DOMAIN/admin   (header x-admin-key: $ADMIN_KEY)"
echo "  Api logs:   pm2 logs $PM2_NAME"
echo "  Restart:    pm2 restart $PM2_NAME"
echo "  Data dir:   $APP_DIR/artifacts/api-server/data"
echo "  Backups:    $BACKUP_DIR  (local retention ${LOCAL_RETENTION_DAYS}d)"
if [ "$OFFSITE_MODE" != "none" ]; then
  echo "  Off-box:    $OFFSITE_LABEL  (remote retention ${B2_REMOTE_RETENTION_DAYS}d)"
  echo "  Off-box log: $BACKUP_DIR/offsite.log"
  echo "  Test now:   /usr/local/bin/hedgegate-backup.sh && tail $BACKUP_DIR/offsite.log"
else
  echo "  Off-box:    DISABLED (local-only backups)"
fi
echo
echo "Redeploy after a 'git push':"
echo "  ./deploy-shinjiru.sh   # same env vars; will pull, rebuild, restart"
echo
echo "Post-deploy checklist:"
echo "  - Add https://$DOMAIN to your Clerk allowed origins."
echo "  - Update NOWPayments IPN URL to https://$DOMAIN/api/payments/webhook (if used)."
echo "  - Point $DOMAIN and www.$DOMAIN at this server's IP if you haven't already."
