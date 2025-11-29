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
    is_pothole BOOLEAN DEFAULT FALSE
);

-----------------------------------------------------------
-- NEW: Users table (for authentication)
-----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL
);

-----------------------------------------------------------
-- Permissions
-----------------------------------------------------------
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stream_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stream_user;
