#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Stonegate one-line bootstrap
#
# Use this when you can't easily paste long commands (e.g. a noVNC web console
# without clipboard support). Run this on the VPS as root and it will prompt
# you for the 3 secrets it needs, generate SESSION_SECRET for you, and then
# hand off to deploy.sh with everything pre-filled.
#
# Usage (run as root on a fresh Ubuntu 22.04 / 24.04 VPS):
#
#   curl -sSL https://raw.githubusercontent.com/Jogoo772/stonegate/main/bootstrap.sh | bash
#
# Or if curl piping is blocked / disliked:
#
#   curl -sSL https://raw.githubusercontent.com/Jogoo772/stonegate/main/bootstrap.sh -o b.sh
#   bash b.sh
# ----------------------------------------------------------------------------
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run as root (try: sudo -i, then re-run this command)" >&2
  exit 1
fi

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
dim()  { printf '\033[2m%s\033[0m\n' "$*"; }
green(){ printf '\033[32m%s\033[0m\n' "$*"; }
red()  { printf '\033[31m%s\033[0m\n' "$*"; }

clear || true
bold "======================================"
bold " Stonegate VPS bootstrap"
bold "======================================"
echo
dim "This will install Stonegate on this VPS."
dim "You'll be asked for 3 things. Take your time."
echo

# ----------------------------------------------------------------------------
# Pre-baked values (you can edit these by exporting before running, e.g.:
#   DOMAIN=other.com bash bootstrap.sh
# ----------------------------------------------------------------------------
: "${DOMAIN:=stonegatemarketsllc.com}"
: "${REPO_URL:=https://github.com/Jogoo772/stonegate.git}"
: "${GIT_BRANCH:=main}"
: "${ADMIN_KEY:=HG-ADMIN-AT6768665G-2026}"
: "${BOT_UNLOCK_KEY:=AT6768665G}"
: "${CLERK_PUBLISHABLE_KEY:=pk_test_ZHJpdmVuLW1vbGx1c2stMzEuY2xlcmsuYWNjb3VudHMuZGV2JA}"

# Read input safely whether stdin is a tty or a pipe (curl|bash gives us a pipe).
TTY_DEV=/dev/tty
if [[ ! -r $TTY_DEV ]]; then
  red "ERROR: cannot read from /dev/tty. Re-run without piping, e.g.:"
  red "  curl -sSL https://raw.githubusercontent.com/Jogoo772/stonegate/main/bootstrap.sh -o b.sh && bash b.sh"
  exit 1
fi

ask() {
  local prompt="$1"
  local varname="$2"
  local hint="${3:-}"
  local current="${!varname:-}"
  echo
  bold "$prompt"
  [[ -n $hint ]] && dim "$hint"
  if [[ -n $current ]]; then
    dim "(press Enter to keep current value)"
  fi
  printf "> "
  local answer
  IFS= read -r answer < $TTY_DEV
  if [[ -z $answer ]]; then
    if [[ -z $current ]]; then
      red "Value is required, please try again."
      ask "$prompt" "$varname" "$hint"
      return
    fi
  else
    printf -v "$varname" '%s' "$answer"
  fi
}

ask "1/3 - Your email address (used for the HTTPS certificate)" EMAIL "Example: you@gmail.com"
ask "2/3 - Your NOWPayments API key" NOWPAYMENTS_API_KEY "From nowpayments.io dashboard"
ask "3/3 - Your Clerk SECRET key (starts with sk_test_ or sk_live_)" CLERK_SECRET_KEY "From your Clerk dashboard, NOT the publishable pk_ key"

# Validate Clerk secret format to catch the most common copy/paste mistake.
if [[ ! $CLERK_SECRET_KEY =~ ^sk_(test|live)_ ]]; then
  echo
  red "WARNING: Clerk secret should start with 'sk_test_' or 'sk_live_'."
  red "You entered something that does not look right."
  printf "Continue anyway? [y/N] "
  yn=""
  IFS= read -r yn < $TTY_DEV
  if [[ ! $yn =~ ^[Yy]$ ]]; then
    red "Aborted. Re-run when you have the correct key."
    exit 1
  fi
fi

# Auto-generated, no need to ask.
SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p -c 64)

echo
bold "--------------------------------------"
bold " Summary (review before continuing)"
bold "--------------------------------------"
echo "Domain               : $DOMAIN"
echo "Email                : $EMAIL"
echo "Repo                 : $REPO_URL"
echo "Branch               : $GIT_BRANCH"
echo "NOWPayments key      : ${NOWPAYMENTS_API_KEY:0:6}...${NOWPAYMENTS_API_KEY: -4}"
echo "Clerk publishable    : ${CLERK_PUBLISHABLE_KEY:0:14}..."
echo "Clerk secret         : ${CLERK_SECRET_KEY:0:8}...${CLERK_SECRET_KEY: -4}"
echo "Session secret       : (auto-generated, 64 chars)"
echo "Admin key            : $ADMIN_KEY"
echo "Bot unlock key       : $BOT_UNLOCK_KEY"
echo
printf "Looks right? Press Enter to deploy, or Ctrl+C to abort. "
IFS= read -r _ < $TTY_DEV

echo
bold "--------------------------------------"
bold " Downloading deploy.sh"
bold "--------------------------------------"
DEPLOY_URL="https://raw.githubusercontent.com/Jogoo772/stonegate/${GIT_BRANCH}/deploy.sh"
curl -fsSL "$DEPLOY_URL" -o /tmp/stonegate-deploy.sh
chmod +x /tmp/stonegate-deploy.sh
green "OK: downloaded $(wc -c < /tmp/stonegate-deploy.sh) bytes from $DEPLOY_URL"

echo
bold "--------------------------------------"
bold " Running deploy.sh (5-10 minutes)"
bold "--------------------------------------"
echo

export DOMAIN EMAIL REPO_URL GIT_BRANCH SESSION_SECRET NOWPAYMENTS_API_KEY \
       ADMIN_KEY BOT_UNLOCK_KEY CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY

/tmp/stonegate-deploy.sh

echo
green "======================================"
green " Bootstrap finished."
green " Visit: https://${DOMAIN}"
green "======================================"
