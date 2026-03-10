-- Migration 020: Authentication
-- Adds password hash and auth tracking columns to users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Index for email lookup during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
