-- Migration: Add token_version column to clients table
-- PASO 3: Token version for real logout and token invalidation
-- Description: Allows server-side token invalidation by incrementing version on logout
-- Created: 2026-01-07

-- Add token_version column (default 0 for existing users)
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0 NOT NULL;

-- Add index for faster lookups during authentication
CREATE INDEX IF NOT EXISTS idx_clients_token_version ON clients(id, token_version);

-- Comment for documentation
COMMENT ON COLUMN clients.token_version IS 'Version number incremented on logout to invalidate all previous tokens. Used for server-side token revocation.';
