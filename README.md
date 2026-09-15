# Baby Burger — Sistema de gestión

**En producción:** https://baby-burger-sistema.vercel.app · Base de datos: Supabase (proyecto `baby-burger`, São Paulo) · Publicar cambios: `npx vercel --prod`

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

### Alternativa sin Supabase (probar en tu PC)

```bash
npx prisma dev --name babyburger --detach --db-port 51214
```

y en `.env`: `DATABASE_URL="postgres://postgres:postgres@localhost:51214/template1?sslmode=disable&pgbouncer=true&connection_limit=1"` (igual para `DIRECT_URL`). Luego `npm run db:migrate`, `npm run db:seed`, `npm run dev`.

> `pgbouncer=true` es obligatorio con cualquier pooler (Supabase incluido); sin él aparece el error *prepared statement already exists*.

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

## Módulos

| Ruta | Qué hace |
| --- | --- |
| `/` | Dashboard: ventas de hoy, costo, utilidad estimada y alertas (stock bajo, margen bajo, subidas de precio, costos que subieron) |
| `/pedidos`, `/pedidos/[id]` | POS: mesas, barra, para llevar, delivery. Productos → cantidad → extras → observación → cobrar (pagos divididos). Al cobrar se congela el costo real y se descuenta inventario |
| `/cocina` | Tablero de cocina con auto-refresco y estados por ítem |
| `/caja` | Apertura con fondo, resumen en vivo, cierre con efectivo real y sobrante/faltante |
| `/insumos`, `/empaques` | Ingredientes y empaques: presentaciones, marcas, proveedores, precio manual, historial (actual/anterior/mín/máx/promedio), unidades propias (slice, bola) |
| `/empaques/reglas` | Qué empaques van por pedido o por ítem según canal |
| `/preparaciones` | Subrecetas (mayonesa, ají, chimichurri, chicha…) con costo por g/ml/unidad |
| `/recetas`, `/recetas/[id]` | Fichas técnicas, costo real por canal, margen/markup/precio recomendado, historial de costo y de precio |
| `/productos` | Carta, agotados, componentes base por categoría |
| `/inventario` | Stock, mínimos, valor, movimientos, ajustes, producción de lotes |
| `/compras` | Compras multilínea por presentación → inventario + precio vigente |
| `/gastos`, `/retiros`, `/perdidas` | Gastos operativos, retiros del negocio, mermas / cortesías / incidencias |
| `/reportes` | Resumen, productos y rentabilidad, "¿por qué terminé en S/0?", punto de equilibrio, ventas en detalle, evolución de costos |
| `/configuracion` | Usuarios y permisos, permisos por rol, parámetros generales, catálogos, auditoría |

## Despliegue (Vercel + Supabase)

1. Importa el repo en [vercel.com/new](https://vercel.com/new).
2. En *Environment Variables* pega `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` (y opcionalmente `ADMIN_PIN_INICIAL`).
3. *Build Command*: `prisma generate && prisma migrate deploy && next build` (o deja el default y ejecuta `npm run db:deploy` una vez desde tu máquina).
4. Tras el primer deploy, corre `npm run db:seed` desde tu máquina apuntando al `.env` de producción.
5. Cada `git push` a `main` redespliega. En el celular/tablet: abrir la URL → "Agregar a pantalla de inicio" (PWA).

## Plan por fases (todas completadas)

1. ✅ Fundación — proyecto, esquema completo, auth y roles, seed.
2. ✅ Costeo — ingredientes con conversión y historial de precios, recetas, preparaciones.
3. ✅ Empaques y costo real por canal.
4. ✅ POS y caja — pedidos, congelamiento de costo, pagos divididos, cierre.
5. ✅ Inventario conectado — descuento automático, compras, ajustes, lotes, alertas.
6. ✅ Gastos, retiros, mermas, cortesías, incidencias.
7. ✅ Reportes, dashboard, "¿por qué terminé en S/0?", punto de equilibrio, búsqueda y filtros.
8. ✅ Pulido — auditoría con filtros, permisos por rol, PWA, páginas de error.

## Lo que el negocio debe completar desde el sistema

Ver la lista al final de [docs/REGLAS.md](docs/REGLAS.md): cantidades de receta pendientes, peso del slice de queso, unidades por bolsa de Petit Pan, ingredientes de salsa secreta / chicha / maracuyá, marca de cheddar predeterminada, servilletas y tenedores por pedido, y el stock inicial de cada insumo (Inventario → Ajustar → "Fijar en").
