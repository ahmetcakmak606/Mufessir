-- Optional init script for local development
-- Docker will run this only on first container initialization.

-- Ensure pgvector is available (safe if already enabled by migrations)
CREATE EXTENSION IF NOT EXISTS vector;


