-- Create user
CREATE USER stream_user WITH PASSWORD 'stream_pass';

-- Create database
CREATE DATABASE stream_db OWNER stream_user;

\c stream_db;

-- Create table
CREATE TABLE IF NOT EXISTS frames (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    file_path TEXT NOT NULL,
    is_pothole BOOLEAN DEFAULT FALSE
);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stream_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stream_user;
