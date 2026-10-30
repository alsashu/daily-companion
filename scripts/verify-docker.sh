#!/usr/bin/env bash
# End-to-end check of the running Docker Compose stack:
#   health, proxy, create/update, monthly listing, export, invalid import rejection,
#   persistence across a full container restart, and the single-table schema.
# Usage: ./scripts/verify-docker.sh   (stack must be running: docker compose up --build -d)
# Writes a marker entry on 2000-01-01 and removes it at the end.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a

API="http://localhost:${BACKEND_PORT:-5000}/api"
UI="http://localhost:${FRONTEND_PORT:-3000}"
DATE="2000-01-01"
PASS=0

ok()   { echo "  PASS  $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL  $1"; exit 1; }
psql_q() { docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$1"; }
wait_healthy() {
  for _ in $(seq 1 40); do
    curl -fs "$API/health" >/dev/null 2>&1 && curl -fs "$UI/api/health" >/dev/null 2>&1 && return 0
    sleep 2
  done
  fail "stack did not become healthy"
}

echo "Waiting for the stack to become healthy..."
wait_healthy

curl -fs "$API/health" | grep -q '"database":"up"' && ok "backend health reports database up"
curl -fs "$UI/api/health" | grep -q '"status":"ok"' && ok "frontend proxies /api to backend"
curl -fs "$UI/some/client/route" | grep -q '<div id="root">' && ok "frontend route fallback serves index.html"

BODY='{"tasks":[{"id":"t1","text":"Verify persistence","completed":false}],"mood":"Good","journal":"marker","habits":{"exercise":true}}'
curl -fs -X PUT -H 'Content-Type: application/json' -d "$BODY" "$API/entries/$DATE" | grep -q '"mood":"Good"' && ok "create entry"
curl -fs -X PUT -H 'Content-Type: application/json' -d "${BODY/Good/Excellent}" "$API/entries/$DATE" | grep -q '"mood":"Excellent"' && ok "update entry"
[ "$(psql_q "SELECT COUNT(*) FROM daily_entries WHERE entry_date = '$DATE'")" = "1" ] && ok "upsert keeps one row per date"
[ "$(psql_q "SELECT updated_at > created_at FROM daily_entries WHERE entry_date = '$DATE'")" = "t" ] && ok "updated_at changes on update"

code=$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type: application/json' -d "$BODY" "$API/entries/2000-02-30")
[ "$code" = "400" ] && ok "invalid date rejected (400)"
code=$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type: application/json' -d '{"mood":"Ecstatic"}' "$API/entries/$DATE")
[ "$code" = "400" ] && ok "invalid payload rejected (400)"

curl -fs "$API/entries?month=2000-01" | grep -q "\"date\":\"$DATE\"" && ok "monthly listing includes entry"
curl -fs "$API/export" | grep -q '"app":"daily-companion"' && ok "export returns JSON backup"

BEFORE=$(psql_q "SELECT COUNT(*) FROM daily_entries")
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d '{"entries":[{"date":"2000-01-02","tasks":[]},{"date":"not-a-date","tasks":[]}]}' "$API/import")
AFTER=$(psql_q "SELECT COUNT(*) FROM daily_entries")
[ "$code" = "400" ] && [ "$BEFORE" = "$AFTER" ] && ok "invalid import rejected without partial changes"

echo "Restarting all containers (volume kept)..."
docker compose down >/dev/null 2>&1
docker compose up -d >/dev/null 2>&1
wait_healthy
curl -fs "$API/entries/$DATE" | grep -q '"journal":"marker"' && ok "data persists across container restarts"

TABLES=$(psql_q "SELECT string_agg(table_name, ',') FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
[ "$TABLES" = "daily_entries" ] && ok "exactly one application table (daily_entries)"

psql_q "DELETE FROM daily_entries WHERE entry_date = '$DATE'" >/dev/null
echo "All $PASS checks passed."
