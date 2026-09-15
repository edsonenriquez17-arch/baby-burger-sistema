# Reglas no negociables del sistema

Estas reglas vienen del dueño del negocio y están por encima de cualquier decisión técnica. Cada módulo nuevo debe respetarlas y, si hay conflicto, se pregunta antes de programar.

## 1. Nunca inventar datos

Gramos de lechuga, tomate, salsa, papas, peso del slice de queso, unidades por bolsa de Petit Pan, aceite de plancha… **si no lo entregó el negocio, va en `null`** y se muestra como "pendiente" en pantalla. Nada de valores "razonables".

En el esquema: `RecetaItem.cantidad`, `PreparacionItem.cantidad`, `Preparacion.rendimientoCantidad`, `UnidadInsumo.factorABase`, `Presentacion.contenido` y `Presentacion.unidadesPorPaquete` son nullable por esta razón.

Cuando un cálculo depende de un dato pendiente, el resultado se marca como incompleto (`CostoProductoHistorial.completo = false`, `PedidoItemConsumo.pendiente = true`), nunca se rellena con cero silenciosamente.

## 2. Nunca borrar historial

Precios de insumos (`PrecioInsumo`), precios de venta (`PrecioProductoHistorial`), costos de producto (`CostoProductoHistorial`) y configuración se versionan con `vigenteDesde / vigenteHasta`. Un cambio **cierra** el registro vigente y **crea** uno nuevo; jamás se hace `update` del valor.

Toda acción sensible (recetas, precios, inventario, anulaciones, gastos, compras, ajustes, usuarios, configuración) pasa por `registrarAuditoria()` con valor anterior y valor nuevo, dentro de la misma transacción que el cambio.

Los catálogos no se eliminan: se desactivan (`activo = false`).

## 3. Los costos de ventas pasadas no se recalculan

Al cobrar un pedido se guarda en `PedidoItemConsumo` la lista exacta de insumos consumidos con el **costo unitario de ese momento**. Ese registro es inmutable. Si la carne sube el viernes, las ventas del lunes conservan su costo.

Para "cuánto costaba la Smash en agosto" se consulta `CostoProductoHistorial` o los propios consumos de las ventas de agosto — nunca se recalcula con precios actuales.

## 4. Todo configurable sin tocar código

Ingredientes, recetas, cantidades, precios, proveedores, marcas, presentaciones, unidades, productos, extras, empaques, reglas de empaque por canal, mesas, métodos de pago, stock mínimo, margen objetivo, categorías, motivos, usuarios y permisos viven en tablas. Si algo termina hardcodeado, es un bug.

## 5. Compra de inventario ≠ costo de venta

- `Compra` = salida de dinero + entrada de stock (`MovimientoInventario ENTRADA_COMPRA`).
- Costo de venta = suma de `PedidoItemConsumo.costoTotal` de lo efectivamente vendido.

Los reportes muestran ambas cifras **siempre por separado**. Comprar S/100 de carne hoy no significa S/100 de costo hoy.

## 6. Mobile-first en el mostrador

La pantalla de pedidos se usa en celular/tablet mientras se atiende: botones grandes, mínimos toques entre elegir producto y cobrar. Flujo: canal → producto → cantidad → extras → observación → cobrar.

---

## Decisiones tomadas con el negocio (15-sep-2026)

| Tema                                   | Decisión                                                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base de datos                          | Proyecto Supabase existente (solo Postgres; no se usa Supabase Auth).                                                                                            |
| Costo vigente con varias marcas        | El de la **presentación predeterminada** del insumo (`Presentacion.esPredeterminada`), con su último precio. Si no hay predeterminada, el último precio registrado. |
| Login                                  | Usuario + PIN, gestionado por el administrador desde el sistema.                                                                                                 |
| Precios de la carta                    | Se cargaron los de la carta actual como precio inicial editable, con historial "Precio inicial".                                                                 |
| Ingredientes y empaques                | Una sola tabla `Insumo` con `tipo` (INGREDIENTE / PREPARACION / EMPAQUE). En pantalla son módulos separados.                                                     |
| Mini burger                            | Es una preparación (20 g carne + 1 slice + 1 petit pan) que los Baby Boxes usan ×4 o ×6.                                                                        |
| Alitas BBQ                             | La receta apunta a "Salsa BBQ especial" (preparación). Si se usa la BBQ comprada, se cambia desde Recetas.                                                       |
| Margen objetivo / alerta               | Valores de partida 60 % / 40 % en Configuración → General. **Son configurables, no datos del negocio.**                                                          |
| Empaques "por pedido" al cobrar        | Se consumen una vez por pedido y se registran en el primer ítem del pedido (`PedidoItemConsumo` origen `REGLA_EMPAQUE`).                                          |
| Cortesías, mermas e incidencias        | Descuentan solo la receta del producto (sin empaques por canal), con costo vigente al momento de registrarlas.                                                   |
| Costo de referencia de un producto     | `CostoProductoHistorial` usa comida + empaques *por ítem* del canal predeterminado (`pos.canal_predeterminado`). El costo real de cada venta usa el canal real.  |
| Punto de equilibrio                    | Gastos fijos = gastos marcados como fijos en el período llevados a 30 días, o `pe.gastos_fijos_mensuales` si es > 0. Margen de contribución con datos reales.     |
| Anulación de venta pagada              | Los pagos y consumos se conservan (historial); el inventario se devuelve con movimientos `REVERSION`.                                                            |

## Pendientes que el negocio debe completar desde el sistema

- Cantidades de lechuga, tomate, papas, salsas, tocino, jalapeños, chorizo, salchicha, apio, zanahoria por producto.
- Peso del slice de queso; unidades por bolsa de Petit Pan y su precio real.
- Marca de cheddar predeterminada (Milkuns vs Braedt).
- Ingredientes y rendimiento de: salsa secreta, chicha, maracuyá, cebolla caramelizada, piña glaseada; completar chimichurri y BBQ especial.
- Servilletas y tenedores por pedido según canal.
- Precios de todos los insumos sin precio (se registran al cargar compras).
- Stock inicial de cada insumo (Inventario → insumo → Ajustar → "Fijar en") y stock mínimo para alertas.
