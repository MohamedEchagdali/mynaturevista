# ✅ Checklist de Implementación - Mejoras Seguridad B2B

**Fecha**: 2026-01-07
**Proyecto**: myNaturevista SaaS
**Tiempo estimado**: 15-20 minutos

---

## 📋 Pre-requisitos

Antes de empezar, asegúrate de tener:

- [ ] PostgreSQL instalado y funcionando
- [ ] Acceso a la base de datos con permisos de ALTER TABLE
- [ ] Backup de la base de datos actual
- [ ] Node.js funcionando
- [ ] Acceso al código fuente

```bash
# Crear backup
pg_dump -U postgres mynaturevista_db > backup_before_security_update_$(date +%Y%m%d).sql
```

---

## 🔧 Paso 1: Aplicar Migraciones SQL (5 min)

### Windows
- [ ] Abre CMD/PowerShell como administrador
- [ ] Navega al directorio del proyecto
  ```cmd
  cd D:\AAA-mynaturevista-saas
  ```
- [ ] Ejecuta el script de migración
  ```cmd
  apply-security-improvements.bat
  ```

### Linux/Mac
- [ ] Abre terminal
- [ ] Navega al directorio del proyecto
- [ ] Ejecuta:
  ```bash
  psql -U postgres -d mynaturevista_db -f db/migrations/apply_all_migrations.sql
  ```

### Verificación
- [ ] No hay errores en la salida del script
- [ ] Mensaje "✅ MIGRACIÓN COMPLETADA EXITOSAMENTE" aparece
- [ ] Verifica la columna token_version:
  ```sql
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name='clients' AND column_name='token_version';
  ```
  **Resultado esperado**: `token_version | integer | 0`

---

## 🔄 Paso 2: Verificar Cambios en Código (3 min)

### Archivos Modificados
- [ ] `controllers/authController.js` - Verificar cambios en login (línea 62-71)
- [ ] `controllers/authController.js` - Verificar cambios en signup (línea 156-164)
- [ ] `controllers/authController.js` - Verificar cambios en logout (línea 217-241)
- [ ] `middlewares/authMiddleware.js` - Verificar validación token_version (línea 24-49)
- [ ] `routes/authRoutes.js` - Verificar logout protegido (línea 179)

### Archivos Nuevos
- [ ] `middlewares/index.js` existe y exporta `requireAuth`, `requireSubscription`
- [ ] `db/migrations/001_add_token_version.sql` existe
- [ ] `db/migrations/002_prepare_account_user_separation.sql` existe
- [ ] `db/migrations/apply_all_migrations.sql` existe

```bash
# Listar archivos nuevos
ls -la middlewares/index.js
ls -la db/migrations/*.sql
```

---

## 🚀 Paso 3: Reiniciar Aplicación (2 min)

- [ ] Detener servidor Node.js
  ```bash
  # Si usas pm2
  pm2 stop mynaturevista

  # O si usas npm/node directamente
  # Ctrl+C en la terminal
  ```

- [ ] Limpiar cache de node_modules (opcional pero recomendado)
  ```bash
  npm cache clean --force
  ```

- [ ] Reiniciar servidor
  ```bash
  # Si usas pm2
  pm2 restart mynaturevista

  # O si usas npm
  npm start
  ```

- [ ] Verificar que arranca sin errores
  ```bash
  # Si usas pm2
  pm2 logs mynaturevista --lines 50

  # O revisa los logs directamente
  tail -f logs/error.log
  ```

---

## 🧪 Paso 4: Testing Manual (10 min)

### Test 1: Login y Verificación de JWT

- [ ] Hacer login con usuario existente
  ```bash
  curl -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"email":"TU_EMAIL", "password":"TU_PASSWORD"}'
  ```

- [ ] Copiar el token recibido
- [ ] Pegar token en https://jwt.io
- [ ] Verificar que el payload contiene:
  - [ ] `userId` (en lugar de `id`)
  - [ ] `email`
  - [ ] `tokenVersion` (debe ser 0 para usuarios existentes)
  - [ ] ❌ NO debe contener `is_subscribed`

**Payload esperado**:
```json
{
  "userId": 1,
  "email": "user@example.com",
  "tokenVersion": 0,
  "iat": 1704638400,
  "exp": 1704642000
}
```

### Test 2: Acceso a Ruta Protegida

- [ ] Usar el token para acceder al perfil
  ```bash
  curl -X GET http://localhost:3000/api/profile \
    -H "Authorization: Bearer TU_TOKEN_AQUI"
  ```

- [ ] Verificar respuesta 200 OK
- [ ] Verificar que recibes datos del usuario

### Test 3: Logout e Invalidación de Token

- [ ] Hacer logout
  ```bash
  curl -X GET http://localhost:3000/api/logout \
    -H "Authorization: Bearer TU_TOKEN_AQUI"
  ```

- [ ] Verificar respuesta:
  ```json
  {
    "message": "Logout successful. All tokens have been invalidated."
  }
  ```

- [ ] Verificar en DB que token_version se incrementó:
  ```sql
  SELECT id, email, token_version FROM clients WHERE email = 'TU_EMAIL';
  ```
  **Resultado esperado**: `token_version = 1`

### Test 4: Token Invalidado No Funciona

- [ ] Intentar usar el token antiguo (de antes del logout)
  ```bash
  curl -X GET http://localhost:3000/api/profile \
    -H "Authorization: Bearer TU_TOKEN_ANTIGUO"
  ```

- [ ] Verificar respuesta 401 Unauthorized
- [ ] Verificar mensaje:
  ```json
  {
    "message": "Token has been invalidated. Please login again.",
    "reason": "token_invalidated"
  }
  ```

### Test 5: Nuevo Login Funciona

- [ ] Hacer login nuevamente
  ```bash
  curl -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"email":"TU_EMAIL", "password":"TU_PASSWORD"}'
  ```

- [ ] Copiar el nuevo token
- [ ] Verificar en jwt.io que tiene `tokenVersion: 1`
- [ ] Verificar que el nuevo token funciona para acceder a rutas protegidas

### Test 6: Validación de Suscripción en Tiempo Real

- [ ] Cambiar suscripción en DB manualmente:
  ```sql
  UPDATE clients SET is_subscribed = false WHERE email = 'TU_EMAIL';
  ```

- [ ] Intentar acceder a ruta que requiere suscripción (sin nuevo login):
  ```bash
  curl -X GET http://localhost:3000/api/dashboard \
    -H "Authorization: Bearer TU_TOKEN_VALIDO"
  ```

- [ ] Verificar que se rechaza inmediatamente (sin necesidad de nuevo login)
- [ ] Restaurar suscripción:
  ```sql
  UPDATE clients SET is_subscribed = true WHERE email = 'TU_EMAIL';
  ```

---

## 📊 Paso 5: Verificación de Base de Datos (3 min)

### Verificar token_version

- [ ] Ejecutar query:
  ```sql
  SELECT id, email, token_version, created_at
  FROM clients
  ORDER BY id
  LIMIT 10;
  ```

- [ ] Todos los clientes deben tener `token_version >= 0`

### Verificar tablas nuevas

- [ ] Ejecutar:
  ```sql
  \dt accounts users account_subscriptions
  ```

- [ ] Las tres tablas deben existir
- [ ] Ejecutar:
  ```sql
  SELECT COUNT(*) FROM accounts;
  SELECT COUNT(*) FROM users;
  SELECT COUNT(*) FROM account_subscriptions;
  ```

- [ ] Todas deben retornar 0 (tablas vacías, preparadas para el futuro)

### Verificar índices

- [ ] Ejecutar:
  ```sql
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'clients' AND indexname = 'idx_clients_token_version';
  ```

- [ ] El índice debe existir

---

## 🌐 Paso 6: Testing desde Frontend (si aplica) (5 min)

Si tienes un frontend:

### Login
- [ ] Abrir aplicación web
- [ ] Hacer login desde el formulario
- [ ] Verificar que se guarda el token en localStorage/sessionStorage
- [ ] Verificar en DevTools → Application → Local Storage que el token está presente

### Navegación
- [ ] Navegar a páginas protegidas (dashboard, perfil, etc.)
- [ ] Verificar que cargan correctamente

### Logout
- [ ] Hacer logout desde la UI
- [ ] Verificar que se elimina el token del localStorage
- [ ] Intentar acceder a ruta protegida (debe redirigir a login)

### Token Invalidado
- [ ] Login desde navegador
- [ ] Hacer logout desde API (curl)
- [ ] Intentar navegar en el navegador (debe redirigir a login)

---

## 📝 Paso 7: Documentación y Comunicación (2 min)

- [ ] Lee `MEJORAS_SEGURIDAD_B2B.md` para entender todos los cambios
- [ ] Lee `RESUMEN_CAMBIOS_APLICADOS.md` para referencia rápida
- [ ] Si tienes equipo, comunícales los cambios:
  - [ ] Frontend necesita manejar `userId` en lugar de `id`
  - [ ] Frontend debe manejar error `token_invalidated`
  - [ ] Logout ahora es efectivo del lado del servidor

---

## 🔍 Paso 8: Monitoreo Post-Despliegue (Continuo)

### Primeras 24 horas
- [ ] Monitorear logs de errores
  ```bash
  tail -f logs/error.log | grep -i "token\|auth\|jwt"
  ```

- [ ] Verificar que no hay aumento en errores 401
- [ ] Verificar que usuarios pueden hacer login/logout normalmente

### Primera semana
- [ ] Monitorear rendimiento de queries de token_version
  ```sql
  SELECT query, calls, mean_exec_time
  FROM pg_stat_statements
  WHERE query LIKE '%token_version%'
  ORDER BY mean_exec_time DESC;
  ```

- [ ] Verificar que no hay degradación de rendimiento
- [ ] Recoger feedback de usuarios sobre login/logout

---

## ⚠️ Troubleshooting

### ❌ Error: "Column token_version does not exist"

**Solución**:
```bash
psql -U postgres -d mynaturevista_db -f db/migrations/001_add_token_version.sql
```

### ❌ Error: "Cannot find module '../middlewares'"

**Solución**:
Verifica que `middlewares/index.js` existe:
```bash
ls -la middlewares/index.js
```

### ❌ Tokens antiguos fallan después de migración

**Causa**: Token_version mismatch en tokens pre-existentes
**Solución**: Pide a usuarios que hagan logout/login

### ❌ Rendimiento degradado en autenticación

**Causa**: Índice no creado
**Solución**:
```sql
CREATE INDEX IF NOT EXISTS idx_clients_token_version ON clients(id, token_version);
```

---

## 🎉 Checklist Final

### Migración
- [ ] ✅ Migraciones SQL aplicadas sin errores
- [ ] ✅ Columna `token_version` existe en `clients`
- [ ] ✅ Tablas `accounts`, `users`, `account_subscriptions` creadas
- [ ] ✅ Índices creados correctamente

### Código
- [ ] ✅ JWT no contiene `is_subscribed`
- [ ] ✅ JWT contiene `userId` y `tokenVersion`
- [ ] ✅ Logout invalida tokens
- [ ] ✅ Middleware valida `token_version`

### Testing
- [ ] ✅ Login funciona
- [ ] ✅ Logout invalida token
- [ ] ✅ Token invalidado rechazado (401)
- [ ] ✅ Nuevo login funciona con nuevo `tokenVersion`
- [ ] ✅ Suscripción se valida en tiempo real

### Documentación
- [ ] ✅ Equipo informado de cambios
- [ ] ✅ Documentación leída y entendida
- [ ] ✅ Frontend actualizado (si necesario)

---

## 📞 ¿Problemas?

Si encuentras problemas que no están en el troubleshooting:

1. **Revisa los logs**: `tail -f logs/error.log`
2. **Verifica DB**: `psql -U postgres -d mynaturevista_db`
3. **Consulta documentación**: `MEJORAS_SEGURIDAD_B2B.md`
4. **Rollback** (último recurso):
   ```sql
   BEGIN;
   ALTER TABLE clients DROP COLUMN IF EXISTS token_version;
   COMMIT;
   ```
   Y revierte los cambios en código con git:
   ```bash
   git checkout HEAD -- controllers/authController.js middlewares/authMiddleware.js routes/authRoutes.js
   ```

---

## ✅ Estado Final

Una vez completados todos los pasos:

**🎯 Tu aplicación ahora tiene**:
- ✅ JWT seguro sin estado cacheado
- ✅ Logout real con invalidación de tokens
- ✅ Protección contra tokens robados
- ✅ Arquitectura preparada para B2B multi-usuario
- ✅ Validación de suscripción en tiempo real

**🚀 Siguiente paso**: Desplegar en staging y luego en producción

---

**Fecha de completado**: _______________
**Completado por**: _______________
**Notas adicionales**: _______________
