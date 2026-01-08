@echo off
REM ============================================================================
REM Script de Aplicación de Mejoras de Seguridad B2B
REM Fecha: 2026-01-07
REM ============================================================================

echo ============================================
echo MEJORAS DE SEGURIDAD B2B - myNaturevista
echo ============================================
echo.

echo Este script aplicará las siguientes mejoras:
echo [1] PASO 1: Eliminar is_subscribed del JWT
echo [2] PASO 2: Middleware único y central
echo [3] PASO 3: Token version para logout real
echo [4] PASO 4: Preparar separación account/user
echo.

echo Archivos modificados:
echo - controllers/authController.js
echo - middlewares/authMiddleware.js
echo - middlewares/index.js (nuevo)
echo - db/migrations/*.sql (nuevo)
echo.

pause

echo.
echo ============================================
echo PASO 1: Verificando requisitos
echo ============================================
echo.

REM Verificar que PostgreSQL está instalado
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PostgreSQL no encontrado en PATH
    echo Por favor, instala PostgreSQL o añádelo al PATH
    pause
    exit /b 1
)

echo [OK] PostgreSQL encontrado
echo.

echo ============================================
echo PASO 2: Aplicando migraciones SQL
echo ============================================
echo.

echo Introduce los datos de conexión a PostgreSQL:
set /p DB_HOST="Host (localhost): " || set DB_HOST=localhost
set /p DB_PORT="Puerto (5432): " || set DB_PORT=5432
set /p DB_NAME="Nombre de base de datos: "
set /p DB_USER="Usuario (postgres): " || set DB_USER=postgres

echo.
echo Conectando a PostgreSQL...
echo Host: %DB_HOST%
echo Puerto: %DB_PORT%
echo Base de datos: %DB_NAME%
echo Usuario: %DB_USER%
echo.

REM Aplicar migraciones
echo Aplicando migraciones...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "db\migrations\apply_all_migrations.sql"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Fallo al aplicar migraciones
    echo Revisa los errores arriba
    pause
    exit /b 1
)

echo.
echo [OK] Migraciones aplicadas exitosamente
echo.

echo ============================================
echo PASO 3: Verificando cambios
echo ============================================
echo.

REM Verificar token_version
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='clients' AND column_name='token_version';"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Columna token_version creada
) else (
    echo [ERROR] Columna token_version no encontrada
)

echo.

REM Verificar tablas nuevas
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "\dt accounts users account_subscriptions"

echo.
echo ============================================
echo PASO 4: Instalación completada
echo ============================================
echo.

echo Las siguientes mejoras han sido aplicadas:
echo [✓] JWT sin is_subscribed (PASO 1)
echo [✓] Middleware separado (PASO 2)
echo [✓] Token version implementado (PASO 3)
echo [✓] Tablas account/user creadas (PASO 4)
echo.

echo IMPORTANTE: Ahora debes:
echo 1. Reiniciar tu aplicación Node.js
echo 2. Probar el login/logout
echo 3. Verificar que las rutas protegidas funcionan
echo 4. Actualizar el frontend si es necesario
echo.

echo Lee MEJORAS_SEGURIDAD_B2B.md para más detalles
echo.

pause
