# Guía Completa de Deployment a Producción - MyNatureVista SaaS

> **Fecha de análisis:** 2026-01-01
> **Proyecto:** MyNatureVista - Plataforma SaaS de Widgets de Destinos Naturales

---

## Tabla de Contenidos

1. [Análisis de la Arquitectura Actual](#1-análisis-de-la-arquitectura-actual)
2. [Opciones de Hosting Recomendadas](#2-opciones-de-hosting-recomendadas)
3. [Arquitectura Recomendada para Producción](#3-arquitectura-recomendada-para-producción)
4. [Cambios Necesarios para Producción](#4-cambios-necesarios-para-producción)
5. [Plan de Deployment Paso a Paso](#5-plan-de-deployment-paso-a-paso)
6. [Costos Mensuales Estimados](#6-costos-mensuales-estimados)
7. [Monitoreo y Mantenimiento](#7-monitoreo-y-mantenimiento)

---

## 1. Análisis de la Arquitectura Actual

### Stack Tecnológico

**Frontend:**
- Vanilla JavaScript (sin frameworks)
- HTML5/CSS3
- Multi-página: Dashboard, Landing, Widget embebible
- 91 archivos frontend
- Archivos estáticos servidos desde `/public/`

**Backend:**
- Node.js (>= v18.0.0) con Express.js v5.1.0
- 15 archivos de rutas
- 3 controladores
- 7 middlewares
- JWT + bcrypt para autenticación
- reCAPTCHA v2 y v3 para seguridad

**Base de Datos:**
- PostgreSQL 16.9
- 16 tablas (clientes, subscripciones, api_keys, usage tracking, etc.)
- Conexión con pool (max 20 conexiones)
- Transacciones con COMMIT/ROLLBACK

**Servicios Externos:**
- **Stripe:** Pagos y subscripciones
- **Cloudinary:** Hosting de imágenes
- **Firebase Admin SDK:** Servicios en tiempo real
- **Nodemailer + SMTP Hostinger:** Envío de emails
- **Google reCAPTCHA:** Protección anti-bots

**Características Clave:**
- Multi-tenant (múltiples clientes aislados)
- Sistema de API keys con rate limiting
- Widget embebible para sitios de terceros
- 3 planes de subscripción (Starter, Business, Enterprise)
- Cron jobs para recordatorios de renovación
- GDPR compliance (exportación y eliminación de datos)

### Componentes que Necesitan Hosting

1. **Frontend estático** (HTML/CSS/JS)
   - Dashboard de clientes
   - Landing page de marketing
   - Widget embebible

2. **Backend API** (Node.js/Express)
   - API RESTful
   - Webhooks de Stripe
   - Autenticación JWT
   - Procesamiento de imágenes

3. **Base de Datos PostgreSQL**
   - 16 tablas con datos relacionales
   - Backups automatizados necesarios

4. **Almacenamiento de archivos**
   - Ya resuelto con Cloudinary (imágenes)
   - Cache local de PDFs e invoices (`/cache/`)

---

## 2. Opciones de Hosting Recomendadas

### OPCIÓN 1: Hostinger VPS + PostgreSQL (RECOMENDADA) ⭐

**Ventajas:**
- Ya tienes un dominio en Hostinger
- Mejor control total del servidor
- Mejor relación calidad-precio para proyectos SaaS
- Sin limitaciones de cold starts o timeouts
- Soporte nativo para Node.js y PostgreSQL

**Configuración:**
```
- VPS KVM 2: $5.99/mes (2 vCPU, 8 GB RAM, 100 GB SSD NVMe)
- Sistema operativo: Ubuntu 22.04 con Node.js preinstalado
- PostgreSQL instalado en el mismo VPS
- SSL gratuito incluido (Let's Encrypt)
- Panel de control opcional (hPanel o cPanel)
```

**Dónde hostear cada componente:**
- **Frontend:** Servido desde el mismo VPS vía Express estático
- **Backend:** Node.js corriendo con PM2 en el VPS
- **Database:** PostgreSQL instalado en el mismo VPS
- **Dominio:** mynaturevista.com (ya lo tienes)
- **Subdominios:**
  - `app.mynaturevista.com` → Dashboard
  - `api.mynaturevista.com` → Backend API
  - Landing en dominio principal

**Costo total mensual:** ~$5.99/mes (precio promocional)

**Limitaciones:**
- Requiere conocimientos de administración de servidores Linux
- Necesitas configurar manualmente NGINX, PM2, PostgreSQL
- Backups manuales o con scripts automáticos

---

### OPCIÓN 2: Railway (Todo en Uno) 💡

**Ventajas:**
- Deploy con un solo comando (`railway up`)
- PostgreSQL incluido y administrado
- Backups automáticos
- Escalabilidad automática
- CI/CD integrado desde GitHub
- Sin gestión de servidores

**Configuración:**
```
- Backend Node.js: $5-10/mes (según uso)
- PostgreSQL database: Incluido en los créditos
- Pago por uso real (RAM hours, CPU hours, storage)
- $5 gratis el primer mes, luego $1/mes gratis si usas menos
```

**Dónde hostear cada componente:**
- **Frontend:** Servido desde Railway (mismo contenedor del backend Express)
- **Backend:** Railway con deploy automático desde Git
- **Database:** Railway PostgreSQL managed
- **Dominio:** Apuntar mynaturevista.com a Railway con DNS

**Costo total mensual:** ~$5-15/mes dependiendo del tráfico

**Limitaciones:**
- Menos control sobre el servidor
- Costos pueden aumentar con más tráfico
- No hay free tier permanente (solo $1/mes de crédito)

---

### OPCIÓN 3: Render (Frontend + Backend + DB) 🔵

**Ventajas:**
- Tier gratuito disponible para empezar
- PostgreSQL incluido
- Deploy automático desde GitHub
- SSL automático
- Fácil de usar

**Configuración:**
```
- Web Service (Node.js): Gratis o $7/mes (sin cold starts)
- PostgreSQL: Gratis (30 días) o $7/mes (básico)
- Static Site (frontend separado): Gratis
```

**Dónde hostear cada componente:**
- **Frontend:** Render Static Site (gratis, servido desde CDN)
- **Backend:** Render Web Service ($7/mes para evitar cold starts)
- **Database:** Render PostgreSQL ($7/mes, 1GB storage)

**Costo total mensual:**
- Gratis (con limitaciones severas)
- $14/mes (sin cold starts, DB persistente)

**Limitaciones importantes:**
- **Plan gratuito:**
  - Servicio se detiene después de 15 min de inactividad (cold starts)
  - Base de datos se elimina después de 30 días
  - No apto para producción
- **Plan de pago:** Más caro que Railway para casos de uso similares

---

### OPCIÓN 4: Híbrida - Vercel (Frontend) + Railway/Render (Backend + DB)

**Ventajas:**
- Frontend ultra-rápido en CDN global de Vercel
- Backend separado para mejor escalabilidad
- Vercel gratis para frontend estático

**Configuración:**
```
- Frontend: Vercel (gratis, 100GB bandwidth/mes)
- Backend + DB: Railway o Render ($5-14/mes)
```

**Dónde hostear cada componente:**
- **Frontend:** Vercel (gratis, CDN global)
- **Backend:** Railway o Render
- **Database:** Railway PostgreSQL o Render PostgreSQL

**Costo total mensual:** ~$5-14/mes

**Limitaciones:**
- Arquitectura más compleja (dos servicios)
- CORS configuración necesaria
- Dos deploys separados

---

### OPCIÓN 5: Supabase (Backend as a Service) + VPS/Vercel

**Ventajas:**
- PostgreSQL gratis hasta 500MB
- Autenticación incluida (alternativa a JWT)
- Real-time subscriptions
- Storage para archivos

**Configuración:**
```
- Supabase PostgreSQL: Gratis (hasta 500MB) o $25/mes (8GB)
- Backend en VPS Hostinger o Railway
- Frontend en Vercel
```

**Costo total mensual:** ~$0-30/mes

**Limitaciones:**
- Requiere migración de autenticación si usas Supabase Auth
- Límite de 500MB en tier gratuito (tu DB podría crecer)

---

## 3. Arquitectura Recomendada para Producción

### ✅ RECOMENDACIÓN FINAL: Hostinger VPS

**Razones:**
1. Ya tienes el dominio en Hostinger
2. Mejor relación calidad-precio ($5.99/mes todo incluido)
3. Control total para un proyecto SaaS
4. Sin cold starts ni limitaciones de tiempo de ejecución
5. Escalable cuando crezcas (upgrade a VPS más grande)

**Arquitectura propuesta:**

```
┌─────────────────────────────────────────────────────┐
│           Hostinger VPS KVM 2                       │
│         (Ubuntu 22.04, 8GB RAM)                     │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  NGINX (Reverse Proxy + SSL)                 │  │
│  │  - mynaturevista.com → /public/landing       │  │
│  │  - app.mynaturevista.com → /public/dashboard │  │
│  │  - api.mynaturevista.com → Node.js:3000      │  │
│  └──────────────────────────────────────────────┘  │
│                      ↓                              │
│  ┌──────────────────────────────────────────────┐  │
│  │  Node.js + Express (PM2)                     │  │
│  │  - Puerto 3000                               │  │
│  │  - Cluster mode (2-4 workers)                │  │
│  │  - Auto-restart en crashes                   │  │
│  └──────────────────────────────────────────────┘  │
│                      ↓                              │
│  ┌──────────────────────────────────────────────┐  │
│  │  PostgreSQL 16                               │  │
│  │  - Puerto 5432 (localhost only)              │  │
│  │  - Backups diarios automáticos               │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Servicios externos                          │  │
│  │  - Cloudinary (imágenes)                     │  │
│  │  - Stripe (pagos)                            │  │
│  │  - Firebase (real-time)                      │  │
│  │  - SMTP Hostinger (emails)                   │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 4. Cambios Necesarios para Producción

### 4.1 Variables de Entorno (.env)

**CRÍTICO:** Actualizar todas las URLs y credenciales para producción.

```bash
# ===============================
# ENTORNO
# ===============================
NODE_ENV=production

# ===============================
# SERVIDOR
# ===============================
PORT=3000
BASE_URL=https://mynaturevista.com
APP_URL=https://app.mynaturevista.com
API_URL=https://api.mynaturevista.com

# ===============================
# CORS - ALLOWED ORIGINS
# ===============================
# Actualizar con tus dominios reales
ALLOWED_ORIGINS=https://mynaturevista.com,https://app.mynaturevista.com,https://api.mynaturevista.com

# ===============================
# BASE DE DATOS POSTGRESQL
# ===============================
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mynaturevista_production
DB_USER=mynaturevista_user
DB_PASSWORD=<CREAR_PASSWORD_SEGURO>
# EJEMPLO: DB_PASSWORD=Np7!xK9$mQ2#vL5&

# ===============================
# JWT
# ===============================
# Generar nuevo secret: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<GENERAR_NUEVO_SECRET_64_BYTES>

# ===============================
# STRIPE (MODO PRODUCCIÓN)
# ===============================
# CAMBIAR de test keys a production keys
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXX
STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXX

# Actualizar Price IDs a los de producción
STRIPE_PRICE_ID_STARTER=price_XXXXXXXXXXXXXXXX
STRIPE_PRICE_ID_BUSINESS=price_XXXXXXXXXXXXXXXX
STRIPE_PRICE_ID_ENTERPRISE=price_XXXXXXXXXXXXXXXX

# ===============================
# EMAIL (HOSTINGER SMTP)
# ===============================
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=info@mynaturevista.com
EMAIL_PASSWORD=<TU_PASSWORD_EMAIL>
EMAIL_FROM=info@mynaturevista.com

# ===============================
# CLOUDINARY
# ===============================
CLOUDINARY_CLOUD_NAME=<tu_cloud_name>
CLOUDINARY_API_KEY=<tu_api_key>
CLOUDINARY_API_SECRET=<tu_api_secret>

# ===============================
# FIREBASE
# ===============================
FIREBASE_PROJECT_ID=mynaturevista-22b64
FIREBASE_PRIVATE_KEY=<clave_privada_firebase>
FIREBASE_CLIENT_EMAIL=<email_service_account>
FIREBASE_DATABASE_URL=https://mynaturevista-22b64.firebaseio.com

# ===============================
# GOOGLE reCAPTCHA
# ===============================
RECAPTCHA_SITE_KEY_V3=<tu_site_key_v3>
RECAPTCHA_SECRET_KEY_V3=<tu_secret_key_v3>
RECAPTCHA_SITE_KEY_V2=<tu_site_key_v2>
RECAPTCHA_SECRET_KEY_V2=<tu_secret_key_v2>
```

### 4.2 Archivos de Configuración a Modificar

#### `server.js`

```javascript
// CAMBIO 1: Configurar trust proxy para NGINX
const app = express();
app.set('trust proxy', 1); // Confiar en el primer proxy (NGINX)

// CAMBIO 2: Logging en producción
if (process.env.NODE_ENV === 'production') {
  const morgan = require('morgan');
  app.use(morgan('combined')); // Logs más detallados
}

// CAMBIO 3: Manejo de errores sin exponer stack traces
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// CAMBIO 4: Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    // Cerrar conexiones de DB
    process.exit(0);
  });
});
```

#### `config/cors.js`

```javascript
// Verificar que ALLOWED_ORIGINS está correctamente configurado
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

// En producción, ser estricto con CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, curl, etc.)
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
```

#### `db/config.js`

```javascript
// CAMBIO: Configuración de pool para producción
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Máximo de conexiones
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,

  // NUEVO: Conexión SSL para producción si usas DB externa
  ssl: process.env.NODE_ENV === 'production' && process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false
});

// Agregar health check
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
```

### 4.3 Frontend: Actualizar URLs en JavaScript

Buscar y reemplazar en todos los archivos `.js` del frontend:

**Archivos a revisar:**
- `/public/dashboard/js/*.js`
- `/public/landing/js/*.js`
- `/public/widget/widget.js`

**Cambios:**

```javascript
// ANTES (desarrollo)
const API_URL = 'http://localhost:3000';

// DESPUÉS (producción)
const API_URL = 'https://api.mynaturevista.com';
```

**Script de búsqueda y reemplazo:**

```bash
# Encontrar todas las referencias a localhost
grep -r "localhost:3000" public/

# O usar un script de reemplazo
find public/ -type f -name "*.js" -exec sed -i 's|http://localhost:3000|https://api.mynaturevista.com|g' {} +
```

### 4.4 Stripe: Migrar a Producción

**Pasos:**

1. **Activar cuenta de Stripe en modo producción:**
   - Dashboard de Stripe → Activar cuenta
   - Proveer información bancaria
   - Verificar identidad

2. **Actualizar Price IDs:**
   - Crear productos y precios en modo producción
   - Actualizar variables de entorno con nuevos IDs

3. **Configurar Webhook endpoint:**
   ```
   URL: https://api.mynaturevista.com/stripe/webhook
   Eventos: payment_intent.succeeded, customer.subscription.*
   ```

4. **Actualizar frontend con clave pública de producción:**
   ```javascript
   // En public/dashboard/js/billing.js o similar
   const stripe = Stripe('pk_live_XXXXXXXXXXXXXXXX'); // Clave de producción
   ```

### 4.5 reCAPTCHA: Keys de Producción

1. Registrar dominios en Google reCAPTCHA:
   - mynaturevista.com
   - app.mynaturevista.com
   - api.mynaturevista.com

2. Actualizar site keys en frontend:
   ```html
   <!-- En archivos HTML con reCAPTCHA -->
   <script src="https://www.google.com/recaptcha/api.js?render=TU_SITE_KEY_V3_PRODUCCION"></script>
   ```

### 4.6 Seguridad Adicional

#### Instalar dependencias de seguridad

```bash
npm install express-rate-limit helmet cors
```

#### Rate Limiting más estricto en producción

```javascript
// En middlewares o server.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Más estricto en producción
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

#### Headers de seguridad con Helmet

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://js.stripe.com", "https://www.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "https://api.mynaturevista.com"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 4.7 Logging y Monitoreo

#### Instalar Morgan para logs

```bash
npm install morgan
```

```javascript
// En server.js
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Crear stream de logs
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'logs', 'access.log'),
  { flags: 'a' }
);

// Usar morgan
app.use(morgan('combined', { stream: accessLogStream }));
```

#### Crear directorio de logs

```bash
mkdir -p logs
echo "logs/*.log" >> .gitignore
```

### 4.8 Scripts de Backup de Base de Datos

Crear `scripts/backup-db.sh`:

```bash
#!/bin/bash

# Configuración
DB_NAME="mynaturevista_production"
DB_USER="mynaturevista_user"
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mynaturevista_$DATE.sql"

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

# Realizar backup
pg_dump -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# Comprimir
gzip $BACKUP_FILE

# Eliminar backups antiguos (más de 7 días)
find $BACKUP_DIR -name "mynaturevista_*.sql.gz" -mtime +7 -delete

echo "Backup completado: $BACKUP_FILE.gz"
```

Hacer ejecutable:

```bash
chmod +x scripts/backup-db.sh
```

Configurar cron para backups diarios:

```bash
# Editar crontab
crontab -e

# Agregar línea para backup diario a las 2 AM
0 2 * * * /ruta/completa/scripts/backup-db.sh
```

### 4.9 Archivos .gitignore

Asegurar que `.env` y archivos sensibles no se suben a Git:

```
# .gitignore
.env
.env.production
.env.local
node_modules/
cache/
logs/
*.log
npm-debug.log*
.DS_Store
```

---

## 5. Plan de Deployment Paso a Paso

### OPCIÓN A: Deployment en Hostinger VPS (RECOMENDADO)

#### Paso 1: Contratar VPS en Hostinger

1. Acceder a Hostinger → VPS Hosting
2. Seleccionar plan **VPS KVM 2** ($5.99/mes):
   - 2 vCPU cores
   - 8 GB RAM
   - 100 GB SSD NVMe
3. Sistema operativo: **Ubuntu 22.04 LTS**
4. Ubicación del servidor: Seleccionar la más cercana a tu audiencia
5. Completar compra

#### Paso 2: Configuración Inicial del Servidor

**Conectar vía SSH:**

```bash
ssh root@tu-ip-del-vps
```

**Actualizar sistema:**

```bash
apt update && apt upgrade -y
```

**Crear usuario no-root:**

```bash
adduser mynaturevista
usermod -aG sudo mynaturevista
```

**Configurar firewall:**

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

**Cambiar a usuario nuevo:**

```bash
su - mynaturevista
```

#### Paso 3: Instalar Node.js

```bash
# Instalar Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version  # Debe mostrar v20.x.x
npm --version   # Debe mostrar v10.x.x
```

#### Paso 4: Instalar PostgreSQL

```bash
# Instalar PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# Verificar que está corriendo
sudo systemctl status postgresql

# Configurar PostgreSQL
sudo -u postgres psql
```

**Dentro de psql:**

```sql
-- Crear usuario
CREATE USER mynaturevista_user WITH PASSWORD 'TU_PASSWORD_SEGURO';

-- Crear base de datos
CREATE DATABASE mynaturevista_production OWNER mynaturevista_user;

-- Dar permisos
GRANT ALL PRIVILEGES ON DATABASE mynaturevista_production TO mynaturevista_user;

-- Salir
\q
```

#### Paso 5: Instalar NGINX

```bash
sudo apt install -y nginx

# Verificar instalación
sudo systemctl status nginx
```

#### Paso 6: Instalar PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

#### Paso 7: Clonar/Subir el Proyecto

**Opción A: Usar Git (recomendado)**

```bash
# Instalar Git si no está
sudo apt install -y git

# Ir al directorio home
cd ~

# Clonar repositorio (si tienes uno en GitHub/GitLab)
git clone https://github.com/tu-usuario/mynaturevista-saas.git
cd mynaturevista-saas
```

**Opción B: Subir archivos con SCP/SFTP**

Desde tu computadora local:

```bash
# Comprimir proyecto (excluyendo node_modules y .env)
tar -czf mynaturevista.tar.gz \
  --exclude=node_modules \
  --exclude=.env \
  --exclude=cache \
  --exclude=logs \
  --exclude=trash \
  mynaturevista-saas/

# Subir al servidor
scp mynaturevista.tar.gz mynaturevista@tu-ip:/home/mynaturevista/

# En el servidor, descomprimir
cd ~
tar -xzf mynaturevista.tar.gz
cd mynaturevista-saas
```

#### Paso 8: Configurar Variables de Entorno

```bash
# Crear archivo .env en el servidor
nano .env
```

Copiar el contenido de la sección 4.1 con tus valores reales.

**Importante:** NO subir el `.env` a Git. Crearlo manualmente en el servidor.

#### Paso 9: Instalar Dependencias e Inicializar DB

```bash
# Instalar dependencias
npm install --production

# Inicializar base de datos
node db/init-db.js

# Verificar que las tablas se crearon
psql -U mynaturevista_user -d mynaturevista_production -c "\dt"
```

#### Paso 10: Configurar PM2

```bash
# Iniciar aplicación con PM2
pm2 start server.js --name mynaturevista -i 2

# Comandos útiles de PM2:
pm2 list                  # Ver procesos
pm2 logs mynaturevista    # Ver logs
pm2 restart mynaturevista # Reiniciar
pm2 stop mynaturevista    # Detener

# Configurar PM2 para auto-inicio
pm2 startup
pm2 save
```

#### Paso 11: Configurar NGINX como Reverse Proxy

```bash
# Crear configuración de NGINX
sudo nano /etc/nginx/sites-available/mynaturevista
```

**Contenido:**

```nginx
# Redirigir HTTP a HTTPS
server {
    listen 80;
    server_name mynaturevista.com www.mynaturevista.com app.mynaturevista.com api.mynaturevista.com;
    return 301 https://$server_name$request_uri;
}

# Landing Page - mynaturevista.com
server {
    listen 443 ssl http2;
    server_name mynaturevista.com www.mynaturevista.com;

    # SSL (se configurará con Certbot)
    ssl_certificate /etc/letsencrypt/live/mynaturevista.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mynaturevista.com/privkey.pem;

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
}

# Dashboard - app.mynaturevista.com
server {
    listen 443 ssl http2;
    server_name app.mynaturevista.com;

    ssl_certificate /etc/letsencrypt/live/mynaturevista.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mynaturevista.com/privkey.pem;

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
}

# API - api.mynaturevista.com
server {
    listen 443 ssl http2;
    server_name api.mynaturevista.com;

    ssl_certificate /etc/letsencrypt/live/mynaturevista.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mynaturevista.com/privkey.pem;

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

        # Rate limiting para API
        limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
        limit_req zone=api_limit burst=20 nodelay;
    }
}
```

**Activar configuración:**

```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/mynaturevista /etc/nginx/sites-enabled/

# Eliminar configuración por defecto
sudo rm /etc/nginx/sites-enabled/default

# Verificar configuración
sudo nginx -t

# NO reiniciar NGINX aún (primero configurar SSL)
```

#### Paso 12: Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL para todos los subdominios
sudo certbot --nginx -d mynaturevista.com -d www.mynaturevista.com -d app.mynaturevista.com -d api.mynaturevista.com

# Seguir las instrucciones:
# - Ingresar email
# - Aceptar términos
# - Seleccionar opción 2 (redirigir HTTP a HTTPS)

# Verificar auto-renovación
sudo certbot renew --dry-run
```

**Reiniciar NGINX:**

```bash
sudo systemctl restart nginx
```

#### Paso 13: Configurar DNS en Hostinger

1. Ir a Hostinger → Dominios → mynaturevista.com → DNS/Name Servers
2. Agregar/modificar registros DNS:

```
Tipo    Nombre              Valor                       TTL
A       @                   IP_DE_TU_VPS                14400
A       www                 IP_DE_TU_VPS                14400
A       app                 IP_DE_TU_VPS                14400
A       api                 IP_DE_TU_VPS                14400
```

**Nota:** La propagación DNS puede tardar 24-48 horas.

#### Paso 14: Configurar Cron Jobs

```bash
# Editar crontab
crontab -e

# Agregar tareas programadas:

# Recordatorios de renovación diarios a las 9 AM
0 9 * * * cd /home/mynaturevista/mynaturevista-saas && /usr/bin/node scripts/renewalReminder.js >> logs/cron.log 2>&1

# Backup de base de datos diario a las 2 AM
0 2 * * * /home/mynaturevista/mynaturevista-saas/scripts/backup-db.sh >> logs/backup.log 2>&1
```

#### Paso 15: Testing y Verificación

**Verificar que todo funciona:**

```bash
# Ver logs de PM2
pm2 logs mynaturevista

# Ver logs de NGINX
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Verificar que Node.js está corriendo
curl http://localhost:3000

# Verificar PostgreSQL
psql -U mynaturevista_user -d mynaturevista_production -c "SELECT COUNT(*) FROM clients;"
```

**Probar desde navegador:**

- https://mynaturevista.com (Landing page)
- https://app.mynaturevista.com/login.html (Dashboard)
- https://api.mynaturevista.com/health (Endpoint de health check, si existe)

#### Paso 16: Monitoreo y Mantenimiento

**Instalar herramientas de monitoreo:**

```bash
# Instalar htop para monitorear recursos
sudo apt install -y htop

# Ver uso de recursos
htop

# Ver uso de disco
df -h

# Ver memoria
free -h
```

---

### OPCIÓN B: Deployment en Railway (Alternativa Rápida)

#### Paso 1: Preparar el Repositorio

**Crear repositorio en GitHub:**

```bash
cd D:\AAA-mynaturevista-saas

# Inicializar Git si no está
git init

# Agregar archivos
git add .
git commit -m "Initial commit for deployment"

# Crear repositorio en GitHub y pushear
git remote add origin https://github.com/tu-usuario/mynaturevista-saas.git
git branch -M main
git push -u origin main
```

#### Paso 2: Crear Cuenta en Railway

1. Ir a https://railway.app
2. Sign up con GitHub
3. Conectar tu cuenta de GitHub

#### Paso 3: Crear Proyecto en Railway

1. Click "New Project"
2. Seleccionar "Deploy from GitHub repo"
3. Seleccionar repositorio `mynaturevista-saas`
4. Railway detectará automáticamente Node.js

#### Paso 4: Agregar PostgreSQL

1. En el proyecto, click "New"
2. Seleccionar "Database" → "PostgreSQL"
3. Railway proveerá automáticamente las credenciales

#### Paso 5: Configurar Variables de Entorno

1. Click en tu servicio Node.js → "Variables"
2. Agregar todas las variables del archivo `.env`
3. Railway automáticamente provee `DATABASE_URL`, pero puedes usar las variables individuales:

```
NODE_ENV=production
PORT=3000
JWT_SECRET=<tu_secret>
STRIPE_SECRET_KEY=<tu_key>
...etc
```

#### Paso 6: Configurar Dominio Personalizado

1. En Railway → Settings → Domains
2. Click "Add Domain"
3. Ingresar `mynaturevista.com`
4. Railway te dará instrucciones de DNS:

```
Tipo    Nombre    Valor
CNAME   @         your-app.up.railway.app
CNAME   app       your-app.up.railway.app
CNAME   api       your-app.up.railway.app
```

5. Agregar estos registros en Hostinger DNS

#### Paso 7: Deploy

Railway automáticamente hace deploy cuando haces push a GitHub:

```bash
# Hacer cambios
git add .
git commit -m "Configure for production"
git push origin main

# Railway automáticamente detecta y despliega
```

#### Paso 8: Verificar Deployment

1. Ver logs en Railway Dashboard
2. Probar URLs:
   - https://mynaturevista.com
   - https://app.mynaturevista.com
   - https://api.mynaturevista.com

---

## 6. Costos Mensuales Estimados

### Comparativa de Costos

| Servicio | Opción 1: Hostinger VPS | Opción 2: Railway | Opción 3: Render |
|----------|------------------------|-------------------|------------------|
| **Hosting/Server** | $5.99/mes | $5-15/mes (uso variable) | $7/mes (Web Service) |
| **Base de Datos** | Incluido | Incluido | $7/mes (PostgreSQL) |
| **SSL** | Gratis (Let's Encrypt) | Incluido | Incluido |
| **Dominio** | Ya lo tienes | Ya lo tienes | Ya lo tienes |
| **Cloudinary** | Gratis (25 créditos) | Gratis (25 créditos) | Gratis (25 créditos) |
| **Stripe** | Gratis + % transacción | Gratis + % transacción | Gratis + % transacción |
| **Firebase** | Gratis (Spark Plan) | Gratis (Spark Plan) | Gratis (Spark Plan) |
| **TOTAL MENSUAL** | **~$6/mes** | **~$10-15/mes** | **~$14/mes** |

**Costos adicionales variables:**
- **Stripe:** 2.9% + $0.30 por transacción exitosa
- **Cloudinary:** Gratis hasta 25GB bandwidth/mes, luego $0.10/GB
- **Firebase:** Gratis hasta ciertos límites, luego pay-as-you-go

### Proyección de Costos a Escala

**Con 100 clientes pagando ~$20/mes promedio:**

- Ingresos: $2,000/mes
- Hosting (Hostinger VPS): $6/mes
- Stripe fees (5% estimado): $100/mes
- Cloudinary (si se excede): $10-20/mes
- **Total gastos operativos:** ~$120-150/mes
- **Margen:** ~$1,850/mes (92%)

---

## 7. Monitoreo y Mantenimiento

### 7.1 Herramientas de Monitoreo Recomendadas

#### Uptime Monitoring (GRATIS)

**UptimeRobot:** https://uptimerobot.com

- Monitorea hasta 50 sitios gratis
- Alertas por email/SMS cuando el sitio cae
- Verificaciones cada 5 minutos

**Configuración:**
1. Agregar monitors para:
   - https://mynaturevista.com
   - https://app.mynaturevista.com
   - https://api.mynaturevista.com/health
2. Configurar alertas a tu email

#### Error Tracking (GRATIS con límites)

**Sentry:** https://sentry.io

```bash
npm install @sentry/node
```

```javascript
// En server.js
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://tu-dsn@sentry.io/proyecto",
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

// Middleware de Sentry
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

#### Analytics (GRATIS)

**Google Analytics:** Ya tienes las integraciones necesarias en tu frontend.

### 7.2 Tareas de Mantenimiento Regular

**Diario (automatizado):**
- ✅ Backups de base de datos (cron job)
- ✅ Envío de recordatorios de renovación (cron job)

**Semanal (manual):**
- Revisar logs de errores
- Verificar uso de recursos (RAM, CPU, disco)
- Revisar métricas de Stripe (pagos, refunds)

**Mensual (manual):**
- Actualizar dependencias npm: `npm outdated` → `npm update`
- Revisar métricas de uso de Cloudinary
- Analizar tráfico y performance
- Verificar backups de DB

**Trimestral (manual):**
- Actualizar Node.js a versión LTS más reciente
- Revisar y actualizar políticas de seguridad
- Auditoría de seguridad: `npm audit fix`

### 7.3 Scripts Útiles de Mantenimiento

**Script: health-check.sh**

```bash
#!/bin/bash
# Verificar salud del sistema

echo "=== HEALTH CHECK ==="
echo "Fecha: $(date)"
echo ""

# 1. Verificar Node.js está corriendo
echo "1. PM2 Status:"
pm2 list

# 2. Verificar PostgreSQL
echo "2. PostgreSQL Status:"
sudo systemctl status postgresql --no-pager

# 3. Verificar uso de disco
echo "3. Disk Usage:"
df -h | grep -E "/$|/var|/home"

# 4. Verificar memoria
echo "4. Memory Usage:"
free -h

# 5. Verificar logs recientes de errores
echo "5. Recent Errors:"
pm2 logs mynaturevista --lines 20 --err

echo ""
echo "=== END HEALTH CHECK ==="
```

**Script: update-app.sh**

```bash
#!/bin/bash
# Script para actualizar la aplicación

echo "Iniciando actualización..."

# 1. Ir al directorio del proyecto
cd /home/mynaturevista/mynaturevista-saas

# 2. Hacer backup de DB antes de actualizar
echo "Haciendo backup de DB..."
./scripts/backup-db.sh

# 3. Pull de cambios de Git
echo "Pulling from Git..."
git pull origin main

# 4. Instalar nuevas dependencias
echo "Installing dependencies..."
npm install --production

# 5. Reiniciar PM2
echo "Restarting application..."
pm2 restart mynaturevista

# 6. Verificar estado
echo "Checking status..."
pm2 list

echo "Actualización completada!"
```

---

## Checklist Final Pre-Producción

Antes de lanzar a producción, verificar:

### Configuración

- [ ] Variables de entorno actualizadas en `.env` de producción
- [ ] JWT_SECRET generado de forma segura (64+ bytes)
- [ ] Stripe keys cambiadas a modo producción
- [ ] URLs de frontend actualizadas (API_URL, etc.)
- [ ] CORS configurado con dominios de producción
- [ ] ALLOWED_ORIGINS actualizado
- [ ] reCAPTCHA keys de producción configuradas

### Seguridad

- [ ] Archivo `.env` NO está en Git (.gitignore configurado)
- [ ] Helmet configurado con CSP estricto
- [ ] Rate limiting activado
- [ ] HTTPS/SSL configurado (Let's Encrypt)
- [ ] PostgreSQL solo acepta conexiones localhost
- [ ] Firewall configurado (UFW)
- [ ] Passwords de DB son seguros (>16 caracteres)

### Base de Datos

- [ ] PostgreSQL instalado y corriendo
- [ ] Base de datos creada (`mynaturevista_production`)
- [ ] Tablas inicializadas correctamente
- [ ] Backup automatizado configurado
- [ ] Pool de conexiones configurado

### Servidor

- [ ] Node.js >= 18.0.0 instalado
- [ ] PM2 configurado para auto-inicio
- [ ] NGINX configurado como reverse proxy
- [ ] DNS apuntando correctamente a VPS
- [ ] Logs configurados (`/logs/`)

### Servicios Externos

- [ ] Stripe webhooks configurados
- [ ] Cloudinary configurado
- [ ] Firebase configurado
- [ ] SMTP de email funcionando
- [ ] reCAPTCHA funcionando

### Testing

- [ ] Landing page carga correctamente
- [ ] Login/registro funciona
- [ ] Dashboard carga sin errores
- [ ] Widget se puede embebir
- [ ] Pagos de Stripe funcionan
- [ ] Emails se envían correctamente
- [ ] API responde correctamente
- [ ] CORS permite requests desde frontend

### Monitoreo

- [ ] UptimeRobot configurado
- [ ] Sentry configurado (opcional)
- [ ] Logs accesibles y legibles
- [ ] Cron jobs configurados

---

## Recursos y Referencias

### Documentación Oficial

- **Node.js:** https://nodejs.org/docs
- **Express.js:** https://expressjs.com/
- **PostgreSQL:** https://www.postgresql.org/docs/
- **PM2:** https://pm2.keymetrics.io/docs/
- **NGINX:** https://nginx.org/en/docs/
- **Let's Encrypt:** https://letsencrypt.org/docs/

### Servicios Externos

- **Hostinger VPS:** https://www.hostinger.com/vps-hosting
- **Railway:** https://railway.app
- **Render:** https://render.com
- **Stripe:** https://stripe.com/docs
- **Cloudinary:** https://cloudinary.com/documentation

### Herramientas de Monitoreo

- **UptimeRobot:** https://uptimerobot.com
- **Sentry:** https://sentry.io
- **Google Analytics:** https://analytics.google.com

---

## Soporte y Ayuda

Si encuentras problemas durante el deployment:

1. **Revisar logs:**
   ```bash
   pm2 logs mynaturevista
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Verificar status de servicios:**
   ```bash
   sudo systemctl status nginx
   sudo systemctl status postgresql
   pm2 status
   ```

3. **Comunidades útiles:**
   - Stack Overflow: https://stackoverflow.com/questions/tagged/node.js
   - Hostinger Community: https://community.hostinger.com/
   - Railway Discord: https://discord.gg/railway

---

**Fecha de creación de esta guía:** 2026-01-01
**Última actualización:** 2026-01-01
**Versión:** 1.0

---

## Notas Finales

- Esta guía asume que tienes conocimientos básicos de Linux y terminal
- Los comandos mostrados son para Ubuntu/Debian
- Ajusta las configuraciones según tus necesidades específicas
- Siempre haz backups antes de cambios importantes
- Prueba en un entorno de staging antes de producción si es posible

**¡Buena suerte con tu deployment!** 🚀
