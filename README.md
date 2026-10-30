# ✦ Daily Companion — Daily Aesthetic Planner

A small, self-hosted daily planner: tasks, a gratitude and mood journal, habit tracking and a monthly calendar. All data goes into PostgreSQL. It's built for local development, functional testing and learning Docker-based deployment.

## 1. Overview

**Features**
- Today's Tasks: add a task, check it off (it gets a strikethrough), delete it. Saves straight away.
- Gratitude & Mood Journal: five moods (Excellent, Good, Average, Poor, Bad) plus free text, saved for each date.
- Monthly calendar: previous/next month, the selected day highlighted, and a dot on days that have saved data.
- Habit Tracker: Morning Meditation, Exercise and Read 20 Pages, ticked off per date. The habits are defined in `frontend/src/config/planner.ts`.
- Three tabs: Daily Planner, Habit Tracker (with monthly counts) and Monthly View (a list of saved days).
- Export as JSON, export as plain text, and import from a JSON backup. Imports are validated and run in one transaction.
- Light and dark themes, a responsive layout, accessible labels and keyboard support.

**Stack:** React 18 + TypeScript + Vite · Node.js 22 + Express 4 · PostgreSQL 16 · plain CSS · REST · Docker + Docker Compose.

**Architecture**

```
 Browser ──► http://localhost:3000 ─┐
                                     │  frontend (nginx-unprivileged :8080)
                                     │   ├─ /        → static React build (SPA fallback)
                                     │   └─ /api/*   → proxy ─┐
                         frontend-net│                        ▼
 curl ─────► http://localhost:5000 ──┼──────────► backend (Express :5000, user "node")
                                     │                        │  DATABASE_URL=…@postgres:5432
                         backend-net │ (internal, no egress)  ▼
                                     └──────────► postgres :5432 (not published)
                                                  volume: pgdata
```

**Project structure**

```
daily-companion/
├── frontend/            React app (components/, services/api.ts, types/, utils/, config/)
│   ├── nginx.conf       Static serving, SPA fallback, /api proxy
│   └── Dockerfile
├── backend/             Express API
│   ├── src/routes/      entries.ts (entries, export, import), health.ts
│   ├── src/services/    entriesService.ts (SQL / repository)
│   ├── src/validation/  entry.ts (date, mood, task, habit, import validation)
│   ├── src/database/    pool.ts, init.ts
│   ├── tests/unit/      validation + API tests (in-memory repository)
│   ├── tests/integration/ PostgreSQL tests
│   └── Dockerfile
├── database/init.sql    The only schema: table daily_entries
├── scripts/verify-docker.sh  End-to-end check of the running stack
├── docker-compose.yml   frontend, backend, postgres
├── docker-compose.dev.yml  Dev only: publishes postgres on 127.0.0.1
└── .env.example
```

**API** (base `/api`; errors look like `{ "error": "...", "details": [...] }`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `200 {status:"ok",database:"up"}` or `503` |
| GET | `/api/entries/:date` | Entry for a `YYYY-MM-DD` date. If nothing is saved, returns a default entry without creating a row. |
| PUT | `/api/entries/:date` | Validates the full entry, then upserts it |
| GET | `/api/entries?month=YYYY-MM` | All entries in that month |
| GET | `/api/export` | `{app, version, exportedAt, entries[]}` |
| POST | `/api/import` | `{entries:[...]}` or a bare array. The whole backup is validated first, then written in one transaction. **Entries whose dates match existing ones replace those records.** Invalid backups change nothing. |

Status codes: `400` for invalid input, `404` for an unknown route, `413` if the body is too large, `500` for server errors, `503` if the database is down.

## 2. Prerequisites

| Tool | Version |
|---|---|
| Node.js / npm | Node 20 LTS or 22 LTS (tested with 22/24), npm 10+ |
| Docker Engine / Docker Desktop | 24+ (tested with 28.5) |
| Docker Compose | v2.20+ (`docker compose`, tested with 2.40) |
| Git | 2.30+ |

## 3. Local development setup

```bash
git clone <repo-url> daily-companion && cd daily-companion
(cd frontend && npm ci)
(cd backend && npm ci)
cp .env.example .env            # then set POSTGRES_PASSWORD (and the same value in DATABASE_URL)

# Start only PostgreSQL, published on 127.0.0.1:5432 by the dev override
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres

# Initialize the table (it's created automatically on first start; this is idempotent)
cd backend
export DATABASE_URL="postgresql://daily_companion_user:<password>@localhost:5432/daily_companion"
npm run db:init
npm run dev                     # API on http://localhost:5000

cd ../frontend && npm run dev   # UI on http://localhost:3000 (Vite proxies /api → :5000)
```

On Windows PowerShell, use `$env:DATABASE_URL="..."` in place of `export`. If port 5432 is already taken (for example by a local PostgreSQL install), set `POSTGRES_PORT=55432` in `.env` and use that port in `DATABASE_URL` and `TEST_DATABASE_URL`.

To check it's working, open http://localhost:3000, add a task, and refresh: the task should still be there. Then `curl http://localhost:5000/api/health` should return `"database":"up"`. You can also look at the row directly (see §5).

## 4. Docker setup

```bash
cp .env.example .env            # set a real POSTGRES_PASSWORD in both places
docker compose up --build -d
docker compose ps               # all three services should become (healthy)
docker compose logs -f          # Ctrl+C to stop following
docker compose down             # stops and removes containers; data is KEPT
```

- UI: http://localhost:3000
- API: http://localhost:5000/api/entries/2026-10-29
- Health: http://localhost:5000/api/health (also reachable through the proxy at http://localhost:3000/api/health)

Start order is enforced: `postgres` must be healthy before `backend` starts, and `backend` must be healthy before `frontend` starts. To change the published ports, set `FRONTEND_PORT` and `BACKEND_PORT` in `.env`.

## 5. Database operations

- **Schema:** `database/init.sql` creates the single table `daily_entries`: `id`, `entry_date` (UNIQUE), `tasks` JSONB, `mood`, `journal`, `habits` JSONB, `created_at`, `updated_at`. Compose mounts it into `/docker-entrypoint-initdb.d`, so it runs **only when the volume is empty**. Writes go through `INSERT … ON CONFLICT (entry_date) DO UPDATE … updated_at = NOW()`.
- **Connection:** the backend reads `DATABASE_URL`. In Compose the host must be `postgres`; when running on the host it's `localhost` (needs the dev override).
- **Apply or re-apply the schema to an existing volume:**
  ```bash
  docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/init.sql
  ```
- **Inspect the data:**
  ```bash
  docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
  \dt
  SELECT entry_date, mood, jsonb_array_length(tasks) AS tasks, habits, updated_at FROM daily_entries ORDER BY entry_date DESC LIMIT 10;
  ```
- **Backup:**
  ```bash
  mkdir -p backups
  docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/daily_companion_$(date +%F).dump
  ```
  You can also use the app's **Export as JSON** button.
- **Restore** (replaces the table contents):
  ```bash
  docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < backups/daily_companion_YYYY-MM-DD.dump
  ```
- **Migrations:** there's no migration tool yet. Keep `init.sql` idempotent. For future changes, add numbered scripts such as `database/002_xxx.sql` using `ALTER TABLE … IF NOT EXISTS`, run them with the `psql` command above, and **take a backup first**.
- **Persistence:** data lives in the named volume `daily-companion_pgdata`. It survives `restart`, `down`, `up --build` and image upgrades.

> ⚠️ **`docker compose down -v` deletes the `pgdata` volume and all planner data permanently.** Back up first.

## 6. Testing

```bash
# Backend
cd backend
npm test                 # unit + API tests (validation, CRUD, import/export, rollback); no DB needed
npm run typecheck && npm run lint
npm run build

# Backend integration tests against real PostgreSQL. Use a DEDICATED test database: tests TRUNCATE it.
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" daily_companion_test'
TEST_DATABASE_URL="postgresql://daily_companion_user:<password>@localhost:5432/daily_companion_test" npm run test:integration
#   covers: one application table only, upsert + updated_at, JSONB storage, transactional import rollback

# Frontend
cd ../frontend
npm test                 # tasks add/complete/delete, journal + mood, habits, date and month navigation, import validation
npm run typecheck && npm run lint
npm run build

# Full stack (with docker compose up running): health, proxy, CRUD, validation,
# export, invalid import, persistence across restart, single-table check
./scripts/verify-docker.sh
```

**Manual checklist**
1. **Tasks:** add two tasks, tick one (it gets a strikethrough), delete the other, then refresh: the state is kept.
2. **Journal and mood:** pick a mood, type some text, click Save Journal Entry. Pick another day, then come back: the entry reloads.
3. **Calendar:** use ‹ and › to change month (crossing December into January works). Days with data show a dot. Clicking a day loads it, and "Go to today" brings you back.
4. **Habits:** tick Exercise, switch to the Habit Tracker tab and check the "days this month" count.
5. **Import/export:** Export as JSON and as Text, then check the downloaded files. Import the JSON file and confirm the prompt; you get a success message. Import a broken file: you get an error and no data changes.
6. **Theme:** toggle ☾/☀. Check the layout at phone width.

## 7. Release process

1. `git status` should be clean, on the release branch, with the changelog and version updated.
2. Run the automated tests: `npm test` in `backend/` and `frontend/`, plus `npm run test:integration`.
3. Run `npm run lint && npm run typecheck` in both packages.
4. Run `npm run build` in both packages.
5. Check the images build: `docker compose build --pull`.
6. Check the environment: `docker compose config -q`. It fails if a required variable is missing. Make sure `DATABASE_URL` matches the `POSTGRES_*` values.
7. Review any new `database/*.sql` scripts and make sure they're idempotent and backwards compatible.
8. Tag the images explicitly:
   ```bash
   export IMAGE_TAG=1.0.0
   docker compose build
   git tag v$IMAGE_TAG && git push origin v$IMAGE_TAG
   # optional: docker tag daily-companion-backend:$IMAGE_TAG <registry>/daily-companion-backend:$IMAGE_TAG && docker push …
   ```
9. **Back up the production database** (§5) before upgrading.
10. Deploy: set `IMAGE_TAG=1.0.0` in the server's `.env`, run `docker compose up -d`, then apply any schema scripts.
11. Verify: `curl -f http://<host>:5000/api/health`, open the UI, and run `./scripts/verify-docker.sh` against staging.
12. Watch the logs: `docker compose logs --since 10m backend frontend`. **To roll back**, set `IMAGE_TAG` to the previous version and run `docker compose up -d`. If a schema change broke data, restore the backup from step 9.

Always deploy explicit version tags. `local` and `latest` are only for development.

## 8. Production deployment

Docker Compose is fine for testing and for some small single-host deployments. A real production environment has to meet your organization's infrastructure requirements:

- **HTTPS:** terminate TLS at an approved reverse proxy or ingress in front of `frontend`. Don't publish `BACKEND_PORT` publicly; the UI only needs the proxied `/api`.
- **Secrets:** inject them from a secret manager or the platform's environment. Never commit `.env`, and use a strong, unique database password.
- **Storage and backups:** keep the database on persistent, backed-up storage. Schedule `pg_dump` and **test restores regularly**.
- **Network:** PostgreSQL stays on the internal network (`backend-net` has `internal: true`) with no published port.
- **Containers:** both run as non-root (`node`, `nginx-unprivileged`). Both have health checks and `restart: unless-stopped`. The backend shuts down cleanly on SIGTERM and closes the connection pool.
- **Logging and monitoring:** containers log to stdout/stderr, so ship those logs to your platform. Monitor `/api/health`.
- **Migrations:** use versioned SQL scripts, applied after a backup (§5).
- **Versioning and rollback:** use immutable image tags (§7).

## 9. Troubleshooting

| Problem | What to do |
|---|---|
| Port already in use | Change `FRONTEND_PORT` or `BACKEND_PORT` in `.env`. Find the process using the port with `netstat -ano \| findstr :3000` (Windows) or `lsof -i :3000`. |
| PostgreSQL not ready / backend waiting | `docker compose logs postgres`. The backend only starts once `pg_isready` passes. |
| Wrong credentials / `password authentication failed` | The `POSTGRES_*` values only take effect on the **first** volume init. Make `DATABASE_URL` match the original values, or (destructive) back up, run `down -v`, and start again. |
| Connection refused | Inside Compose the host must be `postgres`, not `localhost`. On the host you need `docker-compose.dev.yml`. |
| `Set POSTGRES_PASSWORD in .env` / missing variables | Run `cp .env.example .env` and fill in the values, then `docker compose config -q`. |
| UI shows "Unable to reach the server" | `docker compose ps` should show the backend healthy. Check `docker compose logs backend`. In dev, check that `npm run dev` is running on :5000. |
| CORS or proxy errors | The browser should call the same-origin `/api`: nginx (`frontend/nginx.conf`) in Docker, Vite's proxy in dev. Don't point the UI straight at :5000. 502 from nginx means the backend is down. |
| Table `daily_entries` missing | The volume existed before `init.sql` ran. Apply it manually (§5). |
| Container keeps restarting | `docker compose logs <service>` and `docker inspect --format '{{json .State.Health}}' daily-companion-backend-1`. |
| All data gone | Someone ran `docker compose down -v` or deleted the volume. Restore from a backup (§5). |

## 10. Cleanup

```bash
docker compose stop                 # stop; containers and data remain
docker compose down                 # remove containers and networks; data remains in the volume
docker compose build --no-cache && docker compose up -d   # rebuild images from scratch
docker compose down -v              # ⚠️ ONLY to reset intentionally: deletes all planner data
```
