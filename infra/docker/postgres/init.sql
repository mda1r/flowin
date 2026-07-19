-- NexusPOS PostgreSQL Initialization
-- Creates the public schema and the super-admin tenant

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- GIN index support

-- ── Custom types ──────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE outbox_message_status AS ENUM ('Pending', 'Published', 'Failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Public schema (system-level tables) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT        UNIQUE NOT NULL,
    name        TEXT        NOT NULL,
    name_ar     TEXT        NOT NULL,
    max_branches    INT     NOT NULL DEFAULT 1,
    max_users       INT     NOT NULL DEFAULT 5,
    max_products    INT     NOT NULL DEFAULT 1000,
    features    JSONB       NOT NULL DEFAULT '{}',
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT            UNIQUE NOT NULL,
    name            TEXT            NOT NULL,
    name_ar         TEXT            NOT NULL,
    plan_id         UUID            REFERENCES public.subscription_plans(id),
    status          tenant_status   NOT NULL DEFAULT 'trial',
    schema_name     TEXT            UNIQUE NOT NULL,
    settings        JSONB           NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ     NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants (status) WHERE deleted_at IS NULL;

-- ── Migration tracking (per tenant migration runs) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.migration_runs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id),
    schema_name     TEXT        NOT NULL,
    migration_name  TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ NULL,
    error           TEXT        NULL
);

CREATE INDEX IF NOT EXISTS idx_migration_runs_tenant ON public.migration_runs (tenant_id);

-- ── Seed: Default subscription plans ─────────────────────────────────────────

INSERT INTO public.subscription_plans (code, name, name_ar, max_branches, max_users, max_products, features)
VALUES
    ('starter',    'Starter',     'المبتدئ',    1,  5,   1000,  '{"pos": true, "reports": true}'),
    ('professional', 'Professional', 'المحترف', 5,  25,  10000, '{"pos": true, "reports": true, "crm": true, "purchasing": true}'),
    ('enterprise', 'Enterprise',  'المؤسسي',   -1, -1,  -1,    '{"pos": true, "reports": true, "crm": true, "purchasing": true, "restaurant": true, "hotel": true, "gaming": true, "api": true}')
ON CONFLICT (code) DO NOTHING;

-- ── Function: provision tenant schema ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.provision_tenant_schema(p_schema_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_schema_name);
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO nexuspos', p_schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexuspos', p_schema_name);
END;
$$ LANGUAGE plpgsql;
