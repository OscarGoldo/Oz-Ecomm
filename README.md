# Oz Ecom

Plataforma de ecommerce **multi-tenant** para PYMEs de Venezuela. Mismo código,
datos separados por `tenant_id` (store), cada tienda con su panel, catálogo y
link público. Primer tenant: **Alfa Electronic** (Maturín).

Stack: Next.js 14 (App Router) · TypeScript estricto · Tailwind + shadcn/ui ·
Supabase (Postgres + Auth + Storage) · Server Actions.

---

## Estado: completo (Fases 1–7) ✅

- **Base multi-tenant + auth** (F1): esquema con RLS + Storage, magic link,
  middleware multi-tenant, branding por tienda, seed de Alfa Electronic.
- **Gestión de productos** (F2): listado con búsqueda/filtros, alta/edición con
  fotos a Storage, categorías, control de stock.
- **Tienda pública** (F3): catálogo mobile-first con precios USD/Bs, búsqueda,
  filtros, detalle con galería.
- **Carrito y checkout** (F4): carrito en cookies, checkout invitado, métodos de
  pago con comprobante, descuento de stock, seguimiento del pedido.
- **Gestión de pedidos** (F5): listado con filtros, detalle con comprobante,
  confirmar pago (descuenta stock), cambios de estado, aviso de nuevos.
- **Dashboard, configuración y finanzas** (F6): métricas del día/mes, ajustes de
  tienda/pagos/entrega, tasa USD/Bs, página de **Finanzas**.
- **Super-admin** (F7): panel `/super` con métricas globales, listado de tiendas
  y **onboarding** de tiendas nuevas; loading/empty states; listo para deploy.

---

## Puesta en marcha

### 1. Crear el proyecto Supabase

1. https://supabase.com → **New project** (`oz-ecom`, región East US).
2. Project Settings → **API**: copiá `Project URL`, `anon key` y
   `service_role key`.

### 2. Variables de entorno

Completá `.env.local` (ya existe; está en `.gitignore`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # secreto, solo servidor
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Opcional para el seed: `SEED_OWNER_EMAIL=tu@correo.com` (el correo que podrá
entrar al panel de Alfa). Por defecto usa `ovalery1903@gmail.com`.

### 3. Aplicar el esquema

En Supabase → **SQL Editor**, ejecutá en orden el contenido de:

1. `supabase/migrations/0001_init_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_storage.sql`
4. `supabase/migrations/0004_delivery_fee.sql`

### 4. Configurar Auth (magic link)

En Supabase → **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** agregá `http://localhost:3000/**`

(Al desplegar a producción, agregá también la URL real de Vercel.)

### 5. Cargar Alfa Electronic

```bash
npm install
npm run seed
```

Crea la tienda, su dueño (usuario de auth + perfil), categorías, productos y
métodos de pago. Es **idempotente**: podés re-ejecutarlo.

### 6. Levantar la app

```bash
npm run dev
```

- Landing: http://localhost:3000
- Tienda pública: http://localhost:3000/alfa-electronic
- Panel del dueño: http://localhost:3000/login → ingresá el `SEED_OWNER_EMAIL`
  → te llega el magic link → entrás a `/panel`.

### 7. (Opcional) Crear tu usuario super-admin

```bash
SUPERADMIN_EMAIL=tu+super@gmail.com npm run create-superadmin
```

Entrás en `/login` con ese email → caés en `/super` (gestión de todas las
tiendas). Usá un alias `+super` para que sea una cuenta distinta de tu login de
dueño pero llegue al mismo inbox.

---

## Scripts

| Comando                     | Qué hace                                  |
| --------------------------- | ----------------------------------------- |
| `npm run dev`               | Servidor de desarrollo                    |
| `npm run build`             | Build de producción                       |
| `npm run typecheck`         | `tsc --noEmit` (TypeScript estricto)      |
| `npm run lint`              | ESLint                                    |
| `npm run seed`              | Crea/actualiza el tenant Alfa Electronic  |
| `npm run create-superadmin` | Crea un usuario super-admin               |

---

## Emails (opcional pero recomendado)

Dos cosas distintas:

1. **Magic links (login/registro)** — los envía Supabase Auth. El servicio
   integrado es solo para pruebas (limita a ~3-4 correos/hora). Para producción,
   conectá un SMTP propio: Supabase → **Authentication → Emails → SMTP Settings**
   y cargá los datos de un proveedor como [Resend](https://resend.com) (con tu
   dominio verificado).
2. **Aviso de pedido nuevo al dueño** — lo manda la app vía la API de Resend.
   Cargá `RESEND_API_KEY` y `EMAIL_FROM` (ver `.env.example`). Si lo dejás
   vacío, los pedidos funcionan igual pero sin enviar el email. Para enviar a
   cualquier dirección necesitás un **dominio verificado** en Resend.

---

## Deploy a Vercel

1. Subí el repo a GitHub (sin `.env.local`, ya está en `.gitignore`).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importá el repo
   (framework Next.js, detectado automáticamente).
3. **Environment Variables** (Project Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (secreto)
   - `NEXT_PUBLIC_APP_URL` = la URL de producción (ej. `https://oz-ecom.vercel.app`)
4. **Deploy**.
5. En Supabase → **Authentication → URL Configuration**: agregá tu dominio de
   Vercel como **Site URL** y a **Redirect URLs** (`https://tu-dominio.vercel.app/**`).
6. Asegurate de haber corrido las **migraciones** y el **seed** sobre el mismo
   proyecto Supabase.

> El `NEXT_PUBLIC_APP_URL` se usa para los magic links y los enlaces de la
> tienda; tiene que coincidir con el dominio real en producción.

---

## Estructura

```
src/
  app/
    (public)/                 landing + tienda pública /[store_slug]
    (admin)/login             login del dueño (magic link)
    (admin)/panel             panel del dueño (branding del store)
    (superadmin)/super        panel super-admin (yo)
    auth/callback             intercambio del magic link por sesión
  components/
    ui/                       shadcn primitives
    admin/                    componentes del panel
  lib/
    supabase/                 clients: client / server / admin / middleware
    auth.ts                   getSessionContext + guards
    format.ts color.ts slug.ts constants.ts
  types/database.ts           tipos de la BD (en sync con las migraciones)
  middleware.ts               multi-tenant: sesión + guards
supabase/migrations/          schema, RLS, storage
scripts/seed.ts               seed de Alfa Electronic
```

> El directorio `Alfa Electronic/` es el prototipo single-tenant anterior. Se
> conserva como referencia y puede archivarse/borrarse.

---

## Modelo de acceso

- **super_admin** — gestiona todos los tenants (`/super`).
- **store_owner** — dueño de la tienda, gestiona su panel (`/panel`).
- **store_staff** — empleado (a futuro).
- **Cliente final** — compra sin cuenta (checkout invitado, fases 3–4).

RLS: cada usuario solo ve datos de su `store_id`. Las tablas que la tienda
pública necesita (`stores`, `categories`, `products` activos,
`payment_methods` activos) tienen lectura pública para anónimos.
