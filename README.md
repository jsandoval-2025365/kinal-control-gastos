# Sistema de autenticación y autorización

Angular + Node.js/Express + PostgreSQL + Prisma + JWT firmado + sesiones persistentes revocables.

## Estructura

```text
project/
├── frontend/   # Angular (standalone components)
├── backend/    # Node.js + Express + TypeScript + Prisma
├── package.json
└── pnpm-workspace.yaml
```

## 9. Instalación y ejecución

### 0. Requisitos previos
- Node.js `24.16.0`, pnpm `11.6.0` (`corepack enable && corepack prepare pnpm@11.6.0 --activate`)
- PostgreSQL `18.4` corriendo localmente (o Docker)
- Angular CLI `22.0.8` (`pnpm add -g @angular/cli@22.0.8`) — opcional, `pnpm --filter frontend start` ya lo resuelve como devDependency

> Nota: si al instalar alguna de estas versiones exactas no está disponible en el registro npm/PostgreSQL en tu entorno, ajusta el patch/minor más cercano — el código no depende de ninguna característica exclusiva de un patch específico.

### 1. Instalar dependencias (desde la raíz del proyecto)
```bash
pnpm install
```

### 2. Configurar variables de entorno
```bash
cp backend/.env.example backend/.env
# Edita backend/.env y coloca valores reales para:
#   DATABASE_URL, JWT_SECRET (32+ chars), CSRF_SECRET (32+ chars),
#   ADMIN_EMAIL, ADMIN_PASSWORD
```

Genera secretos aleatorios seguros, por ejemplo:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Configurar PostgreSQL
Crea la base de datos indicada en `DATABASE_URL` (por defecto `auth_system`):
```bash
psql -U postgres -c "CREATE DATABASE auth_system;"
```

### 4. Ejecutar migraciones de Prisma
```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate
```

### 5. Ejecutar el seed (crea el primer ADMIN)
```bash
pnpm --filter backend prisma:seed
```

### 6. Iniciar el backend (desarrollo)
```bash
pnpm dev:backend
# http://localhost:3000
```

### 7. Iniciar el frontend (desarrollo)
```bash
pnpm dev:frontend
# http://localhost:4200
```

### 8. Ejecutar en producción
```bash
# Backend
pnpm --filter backend build
NODE_ENV=production pnpm --filter backend start

# Frontend
pnpm --filter frontend build
# Sirve frontend/dist/frontend con nginx/otro servidor estático,
# proxeando /api hacia el backend.
```

## Pruebas del backend

Requiere una base de datos de pruebas (usa un `DATABASE_URL` distinto al de desarrollo):
```bash
pnpm --filter backend test
```

Cobertura: registro (éxito/inválido), login (éxito/credenciales incorrectas/usuario inexistente),
acceso sin autenticación, acceso USER vs ADMIN a rutas administrativas, intento de escalamiento
de privilegios vía JWT manipulado, acceso a recursos de otro usuario (IDOR), token expirado,
sesión revocada, logout + no reutilización de sesión, rate limiting.

## Decisiones de seguridad clave (resumen)

- **Contraseñas**: Argon2id (OWASP recomendado), nunca en texto plano, nunca devueltas al frontend.
- **JWT**: firmado con HS256 (no cifrado), vida corta (15 min por defecto), sin datos sensibles.
- **Sesiones**: persistidas en PostgreSQL; cada request protegida revalida que la sesión no esté
  revocada ni expirada — así el logout invalida el acceso de inmediato, sin depender de la
  expiración del JWT.
- **Cookies**: `HttpOnly`, `Secure` (en producción), `SameSite=Lax`; el JWT nunca se guarda en
  `localStorage`.
- **CSRF**: doble cookie (`csrf-csrf`) para todas las peticiones mutantes en endpoints autenticados.
- **RBAC**: `USER`/`ADMIN` aplicado exclusivamente en el backend (`authorize` middleware); el
  registro público siempre fuerza `role: USER`.
- **IDOR**: los recursos con dueño (`Note`) verifican `resource.userId === req.user.id` salvo `ADMIN`.
- **Timing/enumeración**: el login siempre ejecuta una verificación Argon2 (real o "dummy") y
  responde con el mismo mensaje de error, exista o no el usuario.
