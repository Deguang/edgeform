#!/usr/bin/env bash
set -euo pipefail

# EdgeForm one-command deploy script
# Usage: npm run deploy

WRANGLER="npx wrangler"
TOML="wrangler.toml"
MIGRATION="migrations/0001_init.sql"

cd "$(dirname "$0")/.."

echo "==> Checking Cloudflare login..."
if ! $WRANGLER whoami &>/dev/null; then
  echo "Not logged in. Running wrangler login..."
  $WRANGLER login
fi

echo "==> Checking D1 database..."
DB_ID=$(grep 'database_id' "$TOML" 2>/dev/null | head -1 | sed 's/.*= *"\(.*\)".*/\1/' || echo "")
if [ -z "$DB_ID" ] || [[ "$DB_ID" == x* ]]; then
  echo "    Creating D1 database 'edgeform-db'..."
  DB_OUTPUT=$($WRANGLER d1 create edgeform-db 2>&1 || true)

  # Handle "already exists"
  if echo "$DB_OUTPUT" | grep -q "already exists"; then
    echo "    Database already exists, fetching ID..."
    DB_ID=$($WRANGLER d1 list --json 2>/dev/null | node -e "
      let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        const dbs=JSON.parse(d);
        const db=dbs.find(x=>x.name==='edgeform-db');
        if(db)console.log(db.uuid);
      })")
  else
    DB_ID=$(echo "$DB_OUTPUT" | grep 'database_id' | sed 's/.*= *"\(.*\)".*/\1/')
  fi

  if [ -n "$DB_ID" ]; then
    echo "    D1 ID: $DB_ID"
    # Update wrangler.toml
    sed -i.bak "s|database_id = .*|database_id = \"$DB_ID\"|" "$TOML" && rm -f "$TOML.bak"
  else
    echo "    ERROR: Could not get D1 database ID"
    exit 1
  fi
fi

echo "==> Checking KV namespace..."
KV_LINE=$(grep -A1 'binding = "FORM_KV"' "$TOML" | grep 'id' || echo "")
KV_ID=$(echo "$KV_LINE" | sed 's/.*= *"\(.*\)".*/\1/' || echo "")
if [ -z "$KV_ID" ] || [[ "$KV_ID" == x* ]]; then
  echo "    Creating KV namespace 'FORM_KV'..."
  KV_OUTPUT=$($WRANGLER kv namespace create FORM_KV 2>&1 || true)

  if echo "$KV_OUTPUT" | grep -q "already exists\|already been used"; then
    echo "    KV namespace may exist, fetching ID..."
    KV_ID=$($WRANGLER kv namespace list 2>/dev/null | node -e "
      let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        const ns=JSON.parse(d);
        const kv=ns.find(x=>x.title.includes('FORM_KV'));
        if(kv)console.log(kv.id);
      })")
  else
    KV_ID=$(echo "$KV_OUTPUT" | grep '^id = ' | sed 's/id = "\(.*\)"/\1/')
  fi

  if [ -n "$KV_ID" ]; then
    echo "    KV ID: $KV_ID"
    sed -i.bak "/binding = \"FORM_KV\"/{ n; s|id = .*|id = \"$KV_ID\"|; }" "$TOML" && rm -f "$TOML.bak"
  else
    echo "    WARNING: Could not get KV ID, wrangler will auto-provision"
  fi
fi

echo "==> Running D1 migration..."
$WRANGLER d1 execute edgeform-db --remote --file="$MIGRATION" 2>&1 || true

echo "==> Building..."
npx astro build

echo "==> Deploying..."
$WRANGLER deploy

echo ""
echo "==> Setting secrets..."
SECRET_LIST=$($WRANGLER secret list 2>/dev/null || echo "")
if echo "$SECRET_LIST" | grep -q "ADMIN_PASSWORD"; then
  echo "    ADMIN_PASSWORD already set, skipping"
else
  echo "    Please enter your admin password:"
  $WRANGLER secret put ADMIN_PASSWORD || true
fi

echo ""
echo "==> Done! Your EdgeForm is live."
echo "    Dashboard: https://dash.cloudflare.com"
