-- Migration: Prepare account/user separation for B2B multi-user support
-- PASO 4: Preparar separación account/user (sin usarla aún)
-- Description: Creates tables for multi-user B2B model without affecting current system
-- Created: 2026-01-07

-- ============================================================================
-- ACCOUNTS TABLE
-- Represents a company/organization (B2B customer)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    domain VARCHAR(255) UNIQUE NOT NULL, -- Primary domain for the organization

    -- Subscription info (will eventually replace clients.is_subscribed)
    is_subscribed BOOLEAN DEFAULT false,
    stripe_customer_id VARCHAR(255) UNIQUE,

    -- Account settings
    settings JSONB DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP, -- Soft delete support

    -- Contact info
    billing_email VARCHAR(255),
    phone TEXT,
    address TEXT
);

-- ============================================================================
-- USERS TABLE
-- Represents individual users within an account
-- One account can have multiple users with different roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,

    -- User identity
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,

    -- Role-based access control
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'

    -- Token version for logout (same as clients.token_version)
    token_version INTEGER DEFAULT 0 NOT NULL,

    -- User status
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    deleted_at TIMESTAMP, -- Soft delete support

    -- Settings
    preferences JSONB DEFAULT '{}'
);

-- ============================================================================
-- ACCOUNT_SUBSCRIPTIONS TABLE
-- Links accounts to their subscription plans
-- Replaces the current subscriptions table structure
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_subscriptions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,

    -- Plan details (same as current subscriptions table)
    plan_type VARCHAR(50), -- 'starter', 'business', 'enterprise'
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'active',

    -- Limits
    domains_allowed INTEGER DEFAULT 1,
    openings_limit INTEGER DEFAULT 3000,
    custom_places_limit INTEGER DEFAULT 0,
    users_limit INTEGER DEFAULT 1, -- NEW: Limit on number of users per account

    -- Usage tracking
    current_openings_used INTEGER DEFAULT 0,
    extra_domains_purchased INTEGER DEFAULT 0,

    -- Billing
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    next_billing_date TIMESTAMP,
    auto_renew BOOLEAN DEFAULT true,
    cancel_at_period_end BOOLEAN DEFAULT false,

    -- Stripe integration
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    stripe_price_id VARCHAR(255),

    -- Cancellation
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(id, token_version);
CREATE INDEX IF NOT EXISTS idx_account_subscriptions_account_id ON account_subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_domain ON accounts(domain);
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer ON accounts(stripe_customer_id);

-- ============================================================================
-- MIGRATION HELPER VIEW
-- This view helps maintain compatibility while migrating from clients to accounts/users
-- ============================================================================
CREATE OR REPLACE VIEW clients_compatibility AS
SELECT
    c.id,
    c.name,
    c.email,
    c.password,
    c.created_at,
    c.updated_at,
    c.phone,
    c.addresses,
    c.is_subscribed,
    c.domain,
    c.stripe_customer_id,
    c.token_version,
    'legacy' as account_type
FROM clients c
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.email = c.email
);

-- ============================================================================
-- COMMENTS for documentation
-- ============================================================================
COMMENT ON TABLE accounts IS 'B2B customer accounts (companies/organizations). One account can have multiple users.';
COMMENT ON TABLE users IS 'Individual users within an account. Multiple users can belong to one account with different roles.';
COMMENT ON TABLE account_subscriptions IS 'Subscription plans for accounts. Replaces the clients-based subscription model.';

COMMENT ON COLUMN users.role IS 'User role: owner (full access), admin (manage users), member (normal access), viewer (read-only)';
COMMENT ON COLUMN users.token_version IS 'Version number incremented on logout to invalidate tokens (same as clients.token_version)';
COMMENT ON COLUMN account_subscriptions.users_limit IS 'Maximum number of users allowed per account based on plan';

-- ============================================================================
-- NOTES FOR FUTURE MIGRATION
-- ============================================================================
-- When ready to migrate existing clients to the new model:
--
-- 1. Create an account for each existing client:
--    INSERT INTO accounts (name, domain, is_subscribed, stripe_customer_id, billing_email)
--    SELECT name, domain, is_subscribed, stripe_customer_id, email
--    FROM clients;
--
-- 2. Create a user for each client (they become the 'owner'):
--    INSERT INTO users (account_id, email, name, password, role, token_version)
--    SELECT a.id, c.email, c.name, c.password, 'owner', c.token_version
--    FROM clients c
--    JOIN accounts a ON a.billing_email = c.email;
--
-- 3. Migrate subscriptions to account_subscriptions:
--    INSERT INTO account_subscriptions (account_id, plan_type, is_active, status, ...)
--    SELECT a.id, s.plan_type, s.is_active, s.status, ...
--    FROM subscriptions s
--    JOIN clients c ON s.client_id = c.id
--    JOIN accounts a ON a.billing_email = c.email;
--
-- 4. Update all foreign keys pointing to clients.id to point to accounts.id or users.id
-- 5. Deprecate the clients table (or keep for legacy compatibility)
