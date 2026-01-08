# myNaturevista SaaS Platform

> Plataforma SaaS para embeber widgets interactivos de naturaleza y turismo en sitios web

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.9-blue.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

---

## 📋 Tabla de Contenidos

- [Descripción General](#-descripción-general)
- [Arquitectura](#-arquitectura)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Variables de Entorno](#-variables-de-entorno)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Desarrollo](#-desarrollo)
- [API Reference](#-api-reference)
- [Widget Integration](#-widget-integration)
- [Base de Datos](#-base-de-datos)
- [Deployment](#-deployment)
- [Seguridad](#-seguridad)
- [Troubleshooting](#-troubleshooting)
- [Team Guidelines](#-team-guidelines)

---

## 🎯 Descripción General

**myNaturevista** es una plataforma SaaS que permite a clientes embeber widgets interactivos de lugares naturales y turísticos en sus sitios web. El sistema incluye:

- **Dashboard de cliente**: Panel de control para gestionar suscripciones, API keys, lugares personalizados y estadísticas
- **Widget embebible**: JavaScript snippet configurable que se renderiza en un iframe
- **Sistema de suscripciones**: Planes con Stripe (Starter, Business, Enterprise)
- **Analytics avanzado**: Tracking de uso, estadísticas por dominio, exportación PDF/CSV
- **Lugares personalizados**: Los clientes pueden añadir sus propios lugares con imágenes (Cloudinary)

### Características Principales

✅ Autenticación JWT con bcrypt
✅ Pagos recurrentes con Stripe
✅ Storage de imágenes con Cloudinary
✅ Widget con validación de dominios multi-capa
✅ Rate limiting por suscripción
✅ Sanitización XSS (sanitize-html + DOMPurify)
✅ Analytics en tiempo real
✅ Exportación de estadísticas (PDF/CSV)
✅ Email transaccional (Nodemailer)
✅ GDPR compliance

---

## 🏗️ Arquitectura

### Stack Tecnológico

#### Backend
- **Framework**: Express.js 5.1.0
- **Runtime**: Node.js 18+
- **Base de datos**: PostgreSQL 16.9
- **Autenticación**: JWT + bcryptjs
- **Pagos**: Stripe API v18
- **Storage**: Cloudinary
- **Email**: Nodemailer (SMTP)

#### Frontend
- **Dashboard**: HTML5 + CSS3 + Vanilla JavaScript
- **Widget**: JavaScript embebible con plantillas HTML
- **Charts**: Librerías de gráficos personalizadas

#### Servicios Externos
- **Stripe**: Suscripciones recurrentes y pagos
- **Cloudinary**: Almacenamiento y optimización de imágenes
- **Hostinger SMTP**: Envío de emails transaccionales

### Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENTES (Browsers)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dashboard   │  │ Website con  │  │    Stripe    │      │
│  │  (SPA HTML)  │  │   Widget     │  │   Checkout   │      │
│  └───────┬──────┘  └───────┬──────┘  └──────┬───────┘      │
└──────────┼─────────────────┼────────────────┼──────────────┘
           │                 │                │
           │ JWT Auth        │ API Key        │ Webhooks
           │                 │                │
┌──────────▼─────────────────▼────────────────▼──────────────┐
│              mynaturevista-saas Server (Express)            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Routes & Middlewares                              │    │
│  │  - authMiddleware (JWT)                            │    │
│  │  - subscriptionMiddleware (limites)                │    │
│  │  - domainValidationMiddleware (widget)             │    │
│  │  - usageTrackingMiddleware (analytics)             │    │
│  │  - errorHandler (global)                           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ Controllers│  │  Services  │  │   Utils    │           │
│  │ - auth     │  │ - email    │  │ - sanitizer│           │
│  │ - contact  │  │ - apiKey   │  │            │           │
│  │ - gdpr     │  │            │  │            │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└──────────┬──────────────────┬──────────────────┬───────────┘
           │                  │                  │
           │                  │                  │
┌──────────▼────────┐  ┌──────▼──────┐  ┌────────▼──────────┐
│   PostgreSQL      │  │  Cloudinary │  │  Stripe API       │
│   - clients       │  │  - images   │  │  - subscriptions  │
│   - subscriptions │  │  - storage  │  │  - payments       │
│   - api_keys      │  │             │  │  - customers      │
│   - widget_usage  │  │             │  │                   │
└───────────────────┘  └─────────────┘  └───────────────────┘
```

---

## 📦 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** >= 18.0.0 ([Descargar](https://nodejs.org/))
- **PostgreSQL** >= 16.0 ([Descargar](https://www.postgresql.org/download/))
- **npm** >= 9.0.0 (viene con Node.js)
- **Git** ([Descargar](https://git-scm.com/))

### Cuentas de Servicios Externos

Necesitarás crear cuentas en:

1. **Stripe** ([stripe.com](https://stripe.com))
   - Modo Test para desarrollo
   - Modo Live para producción

2. **Cloudinary** ([cloudinary.com](https://cloudinary.com))
   - Plan gratuito suficiente para desarrollo

3. **SMTP Provider** (Hostinger, Gmail, SendGrid, etc.)
   - Para envío de emails transaccionales

---

## 🚀 Instalación y Configuración

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd mynaturevista-saas
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Base de Datos

#### Crear la base de datos PostgreSQL

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE mynaturevista;

# Conectar a la base de datos
\c mynaturevista

# Salir de psql
\q
```

#### Ejecutar el schema

```bash
# Desde la raíz del proyecto
psql -U postgres -d mynaturevista -f db/schema.sql
```

#### Verificar que las tablas se crearon

```bash
psql -U postgres -d mynaturevista

# Listar tablas
\dt

# Deberías ver: clients, subscriptions, api_keys, widget_usage, etc.
```

### 4. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales (ver sección [Variables de Entorno](#-variables-de-entorno))

### 5. Inicializar Datos de Prueba (Opcional)

```bash
# Ejecutar script de inicialización
node db/init-db.js
```

Esto crea:
- Datos de países y lugares naturales
- Usuario de prueba (opcional)

### 6. Ejecutar el Servidor

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

El servidor estará disponible en `http://localhost:3000`

### 7. Verificar la Instalación

Abre tu navegador y visita:

- Dashboard: `http://localhost:3000/dashboard/loginSignup.html`
- API Health: `http://localhost:3000/api/health` (si existe)
- Widget Test: `http://localhost:3000/public/widget/testPageCloude.html`

---

## 🔐 Variables de Entorno

Crea un archivo `.env` en la raíz con las siguientes variables:

```env
# ==================================================
# SERVER CONFIGURATION
# ==================================================
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ==================================================
# DATABASE
# ==================================================
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mynaturevista
DB_USER=postgres
DB_PASSWORD=tu_password_postgres

# ==================================================
# JWT AUTHENTICATION
# ==================================================
JWT_SECRET=tu_secreto_super_seguro_cambialo_en_produccion_123456

# ==================================================
# STRIPE PAYMENTS
# ==================================================
# Test keys (desarrollo)
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_PUBLISHABLE_KEY=pk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (crear en Stripe Dashboard)
STRIPE_PRICE_STARTER=price_1SKYiRC00...
STRIPE_PRICE_BUSINESS=price_1SKYjRC00...
STRIPE_PRICE_ENTERPRISE=price_1SKYjrC00...

# Success/Cancel URLs
STRIPE_SUCCESS_URL=http://localhost:3000/dashboard/success.html
STRIPE_CANCEL_URL=http://localhost:3000/dashboard/updatePlan.html

# ==================================================
# CLOUDINARY
# ==================================================
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=tu_api_secret

# ==================================================
# EMAIL (SMTP)
# ==================================================
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=info@mynaturevista.com
EMAIL_PASS=tu_password_email

# ==================================================
# FIREBASE (OPCIONAL - si usas Firebase Auth)
# ==================================================
FIREBASE_PROJECT_ID=mynaturevista-22b64
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@...iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ==================================================
# CORS
# ==================================================
ALLOWED_ORIGINS=http://localhost:3000,https://tudominio.com
```

### ⚠️ Importante

- **NUNCA** commitear el archivo `.env` a Git
- Usar `.env.example` como template (sin valores sensibles)
- Cambiar `JWT_SECRET` a un valor seguro y único
- En producción, usar variables de entorno del servidor

---

## 📁 Estructura del Proyecto

```
mynaturevista-saas/
├── config/                 # Configuraciones centralizadas
│   ├── cloudinary.js      # Config Cloudinary
│   ├── cors.js            # Config CORS
│   └── email.js           # Config Nodemailer
│
├── controllers/           # Lógica de negocio
│   ├── authController.js
│   ├── contactController.js
│   └── gdprController.js
│
├── db/                    # Base de datos
│   ├── config.js          # Pool PostgreSQL
│   ├── schema.sql         # Schema completo
│   ├── init-db.js         # Script inicialización
│   └── firebase-admin.js  # Firebase Admin (opcional)
│
├── middlewares/           # Middlewares Express
│   ├── authMiddleware.js           # JWT verification
│   ├── subscriptionMiddleware.js   # Límites de plan
│   ├── domainValidationMiddleware.js
│   ├── usageTrackingMiddleware.js
│   ├── cacheMiddleware.js
│   └── errorHandler.js
│
├── routes/                # Definición de rutas
│   ├── authRoutes.js
│   ├── apikeysRoutes.js
│   ├── stripeRoutes.js
│   ├── stripeWebhook.js
│   ├── billingRoutes.js
│   ├── customPlacesRoutes.js
│   ├── statsRoutes.js
│   ├── widgetRoute.js
│   ├── domains.js
│   ├── countries.js
│   ├── places.js
│   ├── contactRoutes.js
│   └── gdprRoutes.js
│
├── services/              # Servicios externos
│   ├── emailService.js
│   └── apiKeyService.js
│
├── utils/                 # Utilidades
│   └── sanitizer.js       # Sanitización XSS (backend)
│
├── scripts/               # Scripts mantenimiento
│   ├── apikeyManager.js
│   ├── renewalReminder.js
│   ├── cleanupCloudinary.js
│   └── migrateToCloudinary.js
│
├── public/                # Frontend estático
│   ├── dashboard/         # Panel de control
│   │   ├── *.html
│   │   ├── css/
│   │   └── js/
│   │
│   ├── widget/            # Widget embebible
│   │   ├── widget.html
│   │   ├── widget-country.html
│   │   ├── widget-eachPlace.html
│   │   ├── widget.js
│   │   └── src/
│   │
│   ├── landing/           # Landing page
│   │   └── landingpage.html
│   │
│   └── js/
│       └── sanitizer.js   # Sanitización XSS (frontend)
│
├── cache/                 # Cache temporal
│   └── exports/          # PDFs/CSVs cacheados
│
├── .env                   # Variables de entorno (NO commitear)
├── .env.example           # Template de .env
├── .gitignore
├── package.json
├── server.js              # Punto de entrada
└── README.md
```

---

## 💻 Desarrollo

### Comandos Disponibles

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start

# Ejecutar tests (si están configurados)
npm test

# Linting (si está configurado)
npm run lint

# Formatear código
npm run format
```

### Workflow de Desarrollo

1. **Crear nueva rama** para cada feature/bugfix
   ```bash
   git checkout -b feature/nombre-feature
   ```

2. **Hacer cambios** y commitear frecuentemente
   ```bash
   git add .
   git commit -m "feat: descripción del cambio"
   ```

3. **Probar localmente** antes de push
   ```bash
   npm run dev
   # Verificar en http://localhost:3000
   ```

4. **Push y crear Pull Request**
   ```bash
   git push origin feature/nombre-feature
   ```

### Convenciones de Código

- **Nombres de archivos**: camelCase para JS, kebab-case para HTML/CSS
- **Nombres de variables**: camelCase
- **Nombres de constantes**: UPPER_CASE para constantes globales
- **Indentación**: 2 espacios (no tabs)
- **Comillas**: Simples `'` para strings
- **Punto y coma**: Siempre al final de statements

### Testing Local del Widget

Edita `public/widget/testPageCloude.html` con una API key válida:

```html
<script src="http://localhost:3000/widget.js"
  data-api-key="tu_api_key_de_prueba"
  data-name="Test Blog"
  data-primary-color="#667eea"
  data-secondary-color="#764ba2">
</script>
```

Abre en el navegador:
```
http://localhost:3000/public/widget/testPageCloude.html
```

---

## 🔌 API Reference

### Autenticación

Todas las rutas protegidas requieren header:
```
Authorization: Bearer <jwt_token>
```

### Endpoints Principales

#### Auth

```http
POST   /api/signup
POST   /api/login
POST   /api/forgot-password
POST   /api/reset-password
POST   /api/changePassword
GET    /api/profile
DELETE /api/delete-account
```

#### API Keys

```http
GET    /api/keys/my-keys
POST   /api/keys/
PUT    /api/keys/:id
DELETE /api/keys/:id
GET    /api/keys/validate
```

#### Stripe

```http
POST   /api/stripe/create-checkout-session
POST   /api/stripe/webhook
GET    /api/stripe/subscription-status
POST   /api/stripe/cancel-subscription
POST   /api/stripe/update-payment-method
```

#### Billing

```http
GET    /api/billing/invoices
GET    /api/billing/invoices/:id/pdf
GET    /api/billing/subscription
POST   /api/billing/upgrade
POST   /api/billing/add-domain
```

#### Custom Places

```http
GET    /api/custom-places/
POST   /api/custom-places/
PUT    /api/custom-places/:id
DELETE /api/custom-places/:id
```

#### Stats

```http
GET    /api/stats/overview
GET    /api/stats/charts?period=30
GET    /api/stats/by-domain
GET    /api/stats/export/pdf
GET    /api/stats/export/csv
```

#### Widget (público, requiere API key)

```http
GET    /widget.html?apikey=xxx&name=Blog
GET    /widget-country.html?country=Spain&apikey=xxx
GET    /widget-eachPlace.html?place=Teide&apikey=xxx
```

### Ejemplos de Uso

#### Login

```javascript
const response = await fetch('http://localhost:3000/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { token, user } = await response.json();
localStorage.setItem('token', token);
```

#### Crear API Key

```javascript
const response = await fetch('http://localhost:3000/api/keys/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    domain: 'blog.ejemplo.com',
    description: 'Mi blog personal'
  })
});

const { api_key } = await response.json();
```

#### Obtener Estadísticas

```javascript
const response = await fetch('http://localhost:3000/api/stats/charts?period=30', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const stats = await response.json();
```

---

## 🎨 Widget Integration

### Instalación Básica

Copia este código en el sitio web del cliente:

```html
<script src="https://api.mynaturevista.com/widget.js"
  data-api-key="tu_api_key_aqui"
  data-name="Nombre de tu Sitio">
</script>
```

### Configuración Avanzada

```html
<script src="https://api.mynaturevista.com/widget.js"
  data-api-key="abc123..."
  data-name="Mi Blog de Naturaleza"
  data-primary-color="#00b894"
  data-secondary-color="#6c5ce7"
  data-font-family="Poppins, sans-serif"
  data-font-size="16"
  data-auto-open="false"
  data-debug="false">
</script>
```

### Parámetros Disponibles

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `data-api-key` | string | ✅ Sí | - | API key del cliente |
| `data-name` | string | ❌ No | "myNaturevista" | Nombre personalizado |
| `data-primary-color` | hex | ❌ No | "#667eea" | Color primario (hex) |
| `data-secondary-color` | hex | ❌ No | "#764ba2" | Color secundario (hex) |
| `data-font-family` | string | ❌ No | "Arial, sans-serif" | Fuente |
| `data-font-size` | number | ❌ No | "14" | Tamaño fuente (px) |
| `data-auto-open` | boolean | ❌ No | "false" | Auto-abrir al cargar |
| `data-debug` | boolean | ❌ No | "false" | Modo debug (logs) |

### Validaciones del Widget

El widget valida automáticamente:

1. ✅ **API Key válida** y activa
2. ✅ **Suscripción activa** del cliente
3. ✅ **Dominio permitido** (Origin validation)
4. ✅ **Límite de aperturas** mensuales no excedido

Si alguna validación falla, el widget muestra un mensaje de error.

---

## 💾 Base de Datos

### Tablas Principales

- **clients**: Usuarios registrados
- **subscriptions**: Suscripciones activas con límites
- **api_keys**: Claves API para widgets
- **extra_domains**: Dominios adicionales comprados
- **client_custom_places**: Lugares personalizados con imágenes
- **widget_usage**: Tracking de uso del widget
- **payment_logs**: Log de pagos Stripe
- **countries**: Datos de países
- **natural_places**: Lugares naturales disponibles

### Funciones Útiles

#### Ver límites de un cliente

```sql
SELECT * FROM check_client_limits('user@example.com');
```

#### Reset contador mensual de aperturas

```sql
SELECT reset_monthly_openings();
```

#### Limpiar datos antiguos

```sql
-- Mantener solo 90 días de widget_usage
SELECT cleanup_old_usage_data(90);
```

### Backups

#### Crear backup

```bash
pg_dump -U postgres mynaturevista > backup_$(date +%Y%m%d).sql
```

#### Restaurar backup

```bash
psql -U postgres mynaturevista < backup_20260106.sql
```

### Migraciones

Para cambios en el schema:

1. Crear archivo SQL en `db/migrations/`
2. Aplicar manualmente:
   ```bash
   psql -U postgres -d mynaturevista -f db/migrations/001_add_new_column.sql
   ```

---

## 🚢 Deployment

### Preparación para Producción

1. **Configurar variables de entorno de producción**
   ```bash
   NODE_ENV=production
   STRIPE_SECRET_KEY=sk_live_...  # Cambiar a Live keys
   JWT_SECRET=<generar_secreto_seguro_aleatorio>
   ```

2. **Actualizar URLs en Stripe**
   - Success URL: `https://tudominio.com/dashboard/success.html`
   - Cancel URL: `https://tudominio.com/dashboard/updatePlan.html`
   - Webhook URL: `https://tudominio.com/api/stripe/webhook`

3. **Configurar SSL/HTTPS**
   - Usar Let's Encrypt o certificado válido
   - Redirigir todo HTTP → HTTPS

4. **Optimizar PostgreSQL**
   ```sql
   -- Ajustar configuración para producción
   ALTER SYSTEM SET shared_buffers = '256MB';
   ALTER SYSTEM SET max_connections = 100;
   ALTER SYSTEM SET work_mem = '4MB';
   ```

### Deployment en VPS (DigitalOcean, AWS, etc.)

```bash
# 1. Conectar al servidor
ssh root@tu_servidor_ip

# 2. Instalar dependencias
apt update
apt install nodejs npm postgresql nginx

# 3. Clonar repositorio
git clone <repo-url> /var/www/mynaturevista
cd /var/www/mynaturevista

# 4. Instalar dependencias Node
npm install --production

# 5. Configurar .env (usar variables de entorno del servidor)

# 6. Ejecutar con PM2 (process manager)
npm install -g pm2
pm2 start server.js --name mynaturevista
pm2 save
pm2 startup

# 7. Configurar Nginx como reverse proxy
# (ver configuración en sección siguiente)
```

### Configuración Nginx

```nginx
server {
    listen 80;
    server_name api.mynaturevista.com;

    # Redirigir a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.mynaturevista.com;

    ssl_certificate /etc/letsencrypt/live/api.mynaturevista.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.mynaturevista.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Monitoreo y Logs

```bash
# Ver logs de PM2
pm2 logs mynaturevista

# Ver logs en tiempo real
pm2 logs mynaturevista --lines 100

# Monitoreo
pm2 monit

# Restart
pm2 restart mynaturevista

# Stop
pm2 stop mynaturevista
```

---

## 🔒 Seguridad

### Protecciones Implementadas

✅ **XSS Protection**: Sanitización con `sanitize-html` y `DOMPurify`
✅ **SQL Injection**: Queries parametrizadas con `pg`
✅ **CSRF**: JWT en headers (no cookies)
✅ **Rate Limiting**: Express-rate-limit en exports
✅ **Helmet**: CSP headers configurados
✅ **CORS**: Configuración estricta
✅ **Password Hashing**: bcryptjs con 10 rounds
✅ **Domain Validation**: Multi-capa en widget

### Checklist de Seguridad Pre-Deployment

- [ ] Cambiar `JWT_SECRET` a valor aleatorio seguro (min 32 caracteres)
- [ ] Usar Stripe Live keys (no Test keys)
- [ ] Configurar Stripe Webhook secret
- [ ] Verificar que `.env` está en `.gitignore`
- [ ] Habilitar HTTPS con certificado válido
- [ ] Configurar CSP headers en Helmet
- [ ] Revisar CORS allowed origins
- [ ] Habilitar rate limiting en endpoints críticos
- [ ] Configurar backups automáticos de BD
- [ ] Configurar monitoreo de logs
- [ ] Verificar que passwords de BD son seguros
- [ ] Revisar permisos de archivos en servidor

### Gestión de Secretos

**NUNCA** commitear en Git:
- `.env`
- Claves privadas (`.pem`, `.key`)
- Credenciales de BD
- API keys de servicios

Usar `.env.example` como template sin valores sensibles.

---

## 🐛 Troubleshooting

### Problemas Comunes

#### 1. Error "Database connection failed"

**Solución:**
```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar credenciales en .env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<password_correcto>

# Probar conexión manual
psql -U postgres -d mynaturevista
```

#### 2. Widget no carga / Error 403

**Causas posibles:**
- API key inválida o inactiva
- Dominio no permitido
- Suscripción expirada
- Límite de aperturas alcanzado

**Solución:**
```bash
# Verificar API key en BD
psql -U postgres -d mynaturevista

SELECT ak.*, c.is_subscribed, s.is_active, s.current_openings_used, s.openings_limit
FROM api_keys ak
JOIN clients c ON ak.client_id = c.id
LEFT JOIN subscriptions s ON c.id = s.client_id
WHERE ak.api_key = 'tu_api_key';

# Verificar allowed_origins
SELECT allowed_origins FROM api_keys WHERE api_key = 'tu_api_key';
```

#### 3. Stripe Webhook falla

**Solución:**
```bash
# Verificar webhook secret en .env
STRIPE_WEBHOOK_SECRET=whsec_...

# Probar webhook localmente con Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Ver logs del webhook
pm2 logs mynaturevista | grep webhook
```

#### 4. Emails no se envían

**Solución:**
```bash
# Verificar configuración SMTP
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=info@mynaturevista.com
EMAIL_PASS=<password_correcto>

# Probar conexión SMTP manualmente
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 587,
  auth: { user: 'info@mynaturevista.com', pass: 'password' }
});
transporter.verify().then(console.log).catch(console.error);
"
```

#### 5. Cloudinary upload falla

**Solución:**
```bash
# Verificar credenciales
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=<api_secret_correcto>

# Verificar límites de Cloudinary (plan gratuito)
# - Max 25 credits/month
# - Max 25GB storage
```

#### 6. High memory usage

**Solución:**
```bash
# Verificar uso de memoria
pm2 monit

# Reiniciar aplicación
pm2 restart mynaturevista

# Ajustar límite de memoria en PM2
pm2 start server.js --max-memory-restart 1G

# Limpiar cache de exports antiguos
rm -rf cache/exports/*
```

### Logs Útiles

```bash
# Ver todos los logs
pm2 logs mynaturevista

# Ver solo errores
pm2 logs mynaturevista --err

# Ver logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## 👥 Team Guidelines

### Git Workflow

1. **Main branch**: `main` (solo código de producción)
2. **Development branch**: `dev` (código en desarrollo)
3. **Feature branches**: `feature/nombre-feature`
4. **Bugfix branches**: `bugfix/nombre-bug`

#### Proceso de desarrollo:

```bash
# 1. Crear branch desde dev
git checkout dev
git pull origin dev
git checkout -b feature/nueva-feature

# 2. Hacer cambios y commits
git add .
git commit -m "feat: descripción del cambio"

# 3. Push y crear PR
git push origin feature/nueva-feature
# Crear Pull Request en GitHub: feature/nueva-feature → dev

# 4. Code review y merge
# Después de aprobación, mergear a dev

# 5. Deployment a producción
# Cuando dev esté estable, mergear dev → main
```

### Convención de Commits

Usar formato [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: Añadir nueva funcionalidad
fix: Corregir bug
docs: Actualizar documentación
style: Cambios de formato (no afectan código)
refactor: Refactorizar código
test: Añadir tests
chore: Tareas de mantenimiento
```

Ejemplos:
```bash
git commit -m "feat: añadir exportación de stats en CSV"
git commit -m "fix: corregir validación de dominios en widget"
git commit -m "docs: actualizar README con nuevos endpoints"
```

### Code Review Checklist

Antes de aprobar un PR, verificar:

- [ ] Código sigue convenciones del proyecto
- [ ] No hay console.logs innecesarios
- [ ] Funciona en local sin errores
- [ ] Variables de entorno documentadas (si aplica)
- [ ] No se commitean archivos sensibles (.env, keys, etc.)
- [ ] Queries de BD usan parámetros (no concatenación)
- [ ] Inputs del usuario están sanitizados
- [ ] Errores manejados apropiadamente
- [ ] Comentarios claros en código complejo

### Tareas de Mantenimiento

#### Diarias
- Monitorear logs de errores
- Verificar webhooks de Stripe

#### Semanales
- Revisar uso de recursos (CPU, memoria, disco)
- Verificar backups de BD

#### Mensuales
- Ejecutar `cleanup_old_usage_data(90)` en BD
- Limpiar archivos antiguos de cache
- Revisar límites de Cloudinary
- Actualizar dependencias de npm (con precaución)

### Contactos del Equipo

- **Backend Lead**: [Nombre] - [email]
- **Frontend Lead**: [Nombre] - [email]
- **DevOps**: [Nombre] - [email]
- **Product Owner**: [Nombre] - [email]

### Recursos Útiles

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Cloudinary Console**: https://cloudinary.com/console
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Express.js Docs**: https://expressjs.com/

---

## 📄 License

Proprietary - Copyright © 2025 myNaturevista. All rights reserved.

---

## 📞 Support

Para soporte técnico, contactar a:
- Email: dev@mynaturevista.com
- Slack: #dev-mynaturevista (si aplica)

---

**¡Happy Coding!** 🚀
