-- Create user (safe if re-run)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles WHERE rolname = 'stream_user'
   ) THEN
      CREATE ROLE stream_user LOGIN PASSWORD 'stream_pass';
   END IF;
END
$do$;

-- Create database (if not exists)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_database WHERE datname = 'stream_db'
   ) THEN
      CREATE DATABASE stream_db OWNER stream_user;
   END IF;
END
$do$;

-- Switch connection
\c stream_db;

-----------------------------------------------------------
-- Frames table (existing)
-----------------------------------------------------------
CREATE TABLE IF NOT EXISTS frames (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    file_path TEXT NOT NULL,
    is_pothole BOOLEAN DEFAULT FALSE,
    porthole_area_percentage DOUBLE PRECISION DEFAULT 0.0 NOT NULL
);

-----------------------------------------------------------
-- User role enum
-----------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE userrole AS ENUM ('admin', 'ordinary');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-----------------------------------------------------------
-- Organizations table
-----------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create default organization
INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization')
ON CONFLICT (name) DO NOTHING;

-----------------------------------------------------------
-- Users table (for authentication)
-----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role userrole NOT NULL DEFAULT 'ordinary',
    organization_id UUID REFERENCES organizations(id)
);

-----------------------------------------------------------
-- Permissions & Ownership
-----------------------------------------------------------
-- Grant privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stream_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stream_user;

-- Change table ownership to stream_user
ALTER TABLE IF EXISTS frames OWNER TO stream_user;
ALTER TABLE IF EXISTS users OWNER TO stream_user;
ALTER TABLE IF EXISTS organizations OWNER TO stream_user;

-----------------------------------------------------------
-- Migrations for existing databases
-----------------------------------------------------------
-- Add porthole_area_percentage column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'frames' AND column_name = 'porthole_area_percentage'
    ) THEN
        ALTER TABLE frames ADD COLUMN porthole_area_percentage DOUBLE PRECISION DEFAULT 0.0 NOT NULL;
    END IF;
END $$;

-- Add role column to users if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role userrole NOT NULL DEFAULT 'ordinary';
    END IF;
END $$;

-- Add organization_id column to users if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- Update existing users to have default organization
UPDATE users
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;
