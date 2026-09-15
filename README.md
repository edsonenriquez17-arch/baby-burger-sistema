# Baby Burger — Sistema de gestión

Sistema a medida para la operación de Baby Burger: pedidos, recetas, costos, inventario, empaques, compras, gastos, caja, retiros y rentabilidad, todo conectado.

Las reglas de negocio que gobiernan el diseño están en [docs/REGLAS.md](docs/REGLAS.md). Léelas antes de tocar cualquier módulo.

## Stack

- **Next.js 16** (App Router, Server Actions) + TypeScript + Tailwind CSS 4, PWA-ready.
- **PostgreSQL en Supabase** + **Prisma 6** (migraciones versionadas).
- **Auth propia**: usuario + PIN, cookie firmada (jose). Roles ADMIN / CAJA / COCINA con permisos configurables.

## Puesta en marcha

1. **Variables de entorno** — copia `.env.example` a `.env` y completa:
   - `DATABASE_URL` y `DIRECT_URL`: en Supabase → *Connect* → *ORMs* → *Prisma*. Reemplaza `[PASSWORD]` por la contraseña de la base de datos del proyecto.
   - `SESSION_SECRET`: cualquier texto largo y aleatorio.
2. **Instalar y crear la base de datos**:

   ```bash
   npm install
   npm run db:migrate -- --name inicial
   npm run db:seed
   ```

3. **Arrancar**:

   ```bash
   npm run dev
   ```

   Abre http://localhost:3000 e ingresa con `admin` / PIN `1234` (o el `ADMIN_PIN_INICIAL` que hayas puesto). **Cambia ese PIN** en Configuración → Usuarios.

## Scripts

| Script               | Qué hace                                                     |
| -------------------- | ------------------------------------------------------------ |
| `npm run dev`        | Servidor de desarrollo                                       |
| `npm run build`      | Build de producción                                          |
| `npm run typecheck`  | Verificación de tipos                                        |
| `npm run lint`       | ESLint                                                       |
| `npm run db:migrate` | Crea/aplica migraciones en desarrollo (`-- --name <nombre>`) |
| `npm run db:deploy`  | Aplica migraciones en producción                             |
| `npm run db:seed`    | Carga datos iniciales (idempotente)                          |
| `npm run db:studio`  | Explorador visual de la base de datos                        |
| `npm run db:reset`   | ⚠️ Borra todo, re-aplica migraciones y vuelve a sembrar      |

## Estructura

```
prisma/
  schema.prisma        Modelo de datos completo (todas las fases)
  seed.ts              Carta, insumos, empaques, preparaciones, reglas, permisos
src/
  proxy.ts             Redirige a /login sin sesión válida
  lib/
    db.ts              Cliente Prisma
    auditoria.ts       registrarAuditoria() — valor anterior / nuevo
    navegacion.ts      Menú (con la fase en que se habilita cada módulo)
    auth/
      permisos.ts      Catálogo de permisos y permisos por rol
      session.ts       Cookie de sesión, obtenerUsuarioActual(), requerirPermiso()
      actions.ts       iniciarSesion / cerrarSesion
  app/
    login/             Pantalla de ingreso (usuario + PIN)
    (app)/             Todo lo que requiere sesión
      layout.tsx       Shell: barra lateral (tablet/PC) + barra inferior (celular)
      page.tsx         Inicio
      configuracion/   Usuarios y permisos · General · Auditoría
```

## Plan por fases

1. ✅ **Fundación** — proyecto, esquema completo, auth y roles, seed.
2. Costeo — ingredientes con conversión y historial de precios, recetas, preparaciones.
3. Empaques y costo real por canal.
4. POS y caja — pedidos, congelamiento de costo, pagos divididos, cierre.
5. Inventario conectado — descuento automático, compras, ajustes, mermas, alertas.
6. Compras, gastos, cortesías, incidencias, retiros.
7. Reportes, dashboard, "¿por qué terminé en S/0?", punto de equilibrio.
8. Pulido — auditoría fina, UX de mostrador, branding definitivo.
