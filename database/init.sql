-- Daily Companion schema.
-- Creates the single application table. Idempotent: safe to run more than once.
-- Runs automatically the first time the PostgreSQL volume is initialized
-- (mounted into /docker-entrypoint-initdb.d by docker-compose.yml).

CREATE TABLE IF NOT EXISTS daily_entries (
    id          BIGSERIAL PRIMARY KEY,
    entry_date  DATE NOT NULL UNIQUE,
    tasks       JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tasks) = 'array'),
    mood        VARCHAR(20) CHECK (mood IN ('Excellent', 'Good', 'Average', 'Poor', 'Bad')),
    journal     TEXT,
    habits      JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(habits) = 'object'),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
