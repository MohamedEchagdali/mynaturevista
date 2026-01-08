-- Tabla ACCOUNTS (empresas/organizaciones)
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    domain VARCHAR(255) UNIQUE NOT NULL,
    is_subscribed BOOLEAN DEFAULT false,
    stripe_customer_id VARCHAR(255) UNIQUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    billing_email VARCHAR(255),
    phone TEXT,
    address TEXT
);

-- Tabla USERS (usuarios individuales)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    token_version INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    deleted_at TIMESTAMP,
    preferences JSONB DEFAULT '{}'
);

-- Tabla ACCOUNT_SUBSCRIPTIONS (suscripciones por cuenta)
CREATE TABLE IF NOT EXISTS account_subscriptions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    plan_type VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'active',
    domains_allowed INTEGER DEFAULT 1,
    openings_limit INTEGER DEFAULT 3000,
    custom_places_limit INTEGER DEFAULT 0,
    users_limit INTEGER DEFAULT 1,
    current_openings_used INTEGER DEFAULT 0,
    extra_domains_purchased INTEGER DEFAULT 0,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    next_billing_date TIMESTAMP,
    auto_renew BOOLEAN DEFAULT true,
    cancel_at_period_end BOOLEAN DEFAULT false,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(id, token_version);
CREATE INDEX IF NOT EXISTS idx_account_subscriptions_account_id ON account_subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_domain ON accounts(domain);
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer ON accounts(stripe_customer_id);

-- Comentarios de documentación
COMMENT ON TABLE accounts IS 'B2B customer accounts (companies/organizations). One account can have multiple users.';
COMMENT ON TABLE users IS 'Individual users within an account. Multiple users can belong to one account with different roles.';
COMMENT ON TABLE account_subscriptions IS 'Subscription plans for accounts. Replaces the clients-based subscription model.';
COMMENT ON COLUMN users.role IS 'User role: owner (full access), admin (manage users), member (normal access), viewer (read-only)';
COMMENT ON COLUMN users.token_version IS 'Version number incremented on logout to invalidate tokens (same as clients.token_version)';
COMMENT ON COLUMN account_subscriptions.users_limit IS 'Maximum number of users allowed per account based on plan';

RAISE NOTICE 'PASO 4 completado: Tablas account/user creadas (preparadas, no activadas)';

-- ============================================================================
-- FINALIZAR MIGRACIÓN
-- ============================================================================

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================

-- Mostrar resumen de cambios
DO $$
DECLARE
    clients_token_version_exists BOOLEAN;
    accounts_exists BOOLEAN;
    users_exists BOOLEAN;
BEGIN
    -- Verificar token_version
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clients' AND column_name = 'token_version'
    ) INTO clients_token_version_exists;

    -- Verificar tablas nuevas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'accounts'
    ) INTO accounts_exists;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'users'
    ) INTO users_exists;

    -- Mostrar resultados
    RAISE NOTICE '============================================';
    RAISE NOTICE 'RESUMEN DE MIGRACIÓN';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'clients.token_version: %', CASE WHEN clients_token_version_exists THEN '✅ OK' ELSE '❌ FALTA' END;
    RAISE NOTICE 'Tabla accounts: %', CASE WHEN accounts_exists THEN '✅ OK' ELSE '❌ FALTA' END;
    RAISE NOTICE 'Tabla users: %', CASE WHEN users_exists THEN '✅ OK' ELSE '❌ FALTA' END;
    RAISE NOTICE '============================================';

    IF clients_token_version_exists AND accounts_exists AND users_exists THEN
        RAISE NOTICE '✅ MIGRACIÓN COMPLETADA EXITOSAMENTE';
    ELSE
        RAISE EXCEPTION '❌ MIGRACIÓN INCOMPLETA. Revisa los errores arriba.';
    END IF;
END $$;

-- Mostrar conteo de clientes actuales
SELECT
    COUNT(*) as total_clients,
    COUNT(*) FILTER (WHERE is_subscribed = true) as subscribed_clients,
    COUNT(*) FILTER (WHERE is_subscribed = false) as free_clients
FROM clients;
