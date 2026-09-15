import "server-only";
import type { Prisma, TipoMovimiento } from "@prisma/client";
import { D, type Dec, cantidadBase, obtenerCostosVigentes, INCLUDE_ITEM_COSTEABLE } from "@/lib/costeo/costeo";
import { empaquesPorItem, empaquesPorPedido, obtenerReglasEmpaque } from "@/lib/costeo/empaques";

type Tx = Prisma.TransactionClient;

export const ESTADOS_ABIERTOS = ["ABIERTO", "EN_PREPARACION", "LISTO", "ESPERANDO_PAGO"] as const;

/** Recalcula subtotal y total del pedido a partir de sus ítems y extras. */
export async function recalcularTotales(tx: Tx, pedidoId: string) {
  const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: { items: { include: { extras: true } } } });
  let subtotal = new D(0);
  for (const it of pedido.items) {
    subtotal = subtotal.add(it.precioUnitario.mul(it.cantidad));
    for (const ex of it.extras) subtotal = subtotal.add(ex.precioUnitario.mul(ex.cantidad).mul(it.cantidad));
  }
  const descuento = pedido.descuentoMonto.gt(subtotal) ? subtotal : pedido.descuentoMonto;
  const total = subtotal.sub(descuento);
  await tx.pedido.update({ where: { id: pedidoId }, data: { subtotal, descuentoMonto: descuento, total } });
  return { subtotal, total };
}

type Consumo = { insumoId: string; cantidad: Dec; costoUnitario: Dec | null; pendiente: boolean; origen: "RECETA" | "EXTRA" | "REGLA_EMPAQUE" };

/** Consumo de insumos de una receta multiplicado por `veces`. Cantidades pendientes → consumo 0 marcado como pendiente. */
function consumoDeReceta(items: Parameters<typeof cantidadBase>[0][], veces: number, costos: Map<string, { costo: Dec }>, origen: Consumo["origen"]): Consumo[] {
  return items.map((it) => {
    const { valor, pendiente } = cantidadBase(it);
    const cu = costos.get(it.insumoId)?.costo ?? null;
    return { insumoId: it.insumoId, cantidad: (valor ?? new D(0)).mul(veces), costoUnitario: cu, pendiente: pendiente !== null || cu === null, origen };
  });
}

/**
 * Al cobrar: congela el costo de cada ítem (regla 3) en PedidoItemConsumo y descuenta
 * inventario (SALIDA_VENTA). Los empaques "por pedido" se registran en el primer ítem.
 */
export async function congelarCostosYDescontar(tx: Tx, pedidoId: string, usuarioId: string) {
  const pedido = await tx.pedido.findUniqueOrThrow({
    where: { id: pedidoId },
    include: {
      items: {
        orderBy: { creadoEn: "asc" },
        include: {
          producto: { include: { receta: { include: { items: { include: INCLUDE_ITEM_COSTEABLE } } } } },
          extras: { include: { producto: { include: { receta: { include: { items: { include: INCLUDE_ITEM_COSTEABLE } } } } } } },
        },
      },
    },
  });
  const [costos, reglas] = await Promise.all([obtenerCostosVigentes(tx), obtenerReglasEmpaque(tx)]);

  let costoPedido = new D(0);
  const porInsumo = new Map<string, { cantidad: Dec; costoUnitario: Dec | null }>();
  const acumular = (c: Consumo) => {
    const prev = porInsumo.get(c.insumoId);
    porInsumo.set(c.insumoId, { cantidad: (prev?.cantidad ?? new D(0)).add(c.cantidad), costoUnitario: c.costoUnitario ?? prev?.costoUnitario ?? null });
  };

  for (const [idx, item] of pedido.items.entries()) {
    const consumos: Consumo[] = [
      ...consumoDeReceta(item.producto.receta?.items ?? [], item.cantidad, costos, "RECETA"),
      ...item.extras.flatMap((ex) => consumoDeReceta(ex.producto.receta?.items ?? [], ex.cantidad * item.cantidad, costos, "EXTRA")),
      ...empaquesPorItem(reglas, pedido.tipoServicio, { id: item.productoId, categoriaId: item.producto.categoriaId }).map((r) => ({
        insumoId: r.insumoId, cantidad: r.cantidad.mul(item.cantidad), costoUnitario: costos.get(r.insumoId)?.costo ?? null, pendiente: !costos.has(r.insumoId), origen: "REGLA_EMPAQUE" as const,
      })),
    ];
    if (idx === 0) {
      consumos.push(
        ...empaquesPorPedido(reglas, pedido.tipoServicio).map((r) => ({
          insumoId: r.insumoId, cantidad: r.cantidad, costoUnitario: costos.get(r.insumoId)?.costo ?? null, pendiente: !costos.has(r.insumoId), origen: "REGLA_EMPAQUE" as const,
        })),
      );
    }

    let costoItem = new D(0);
    for (const c of consumos) {
      const costoTotal = c.costoUnitario ? c.cantidad.mul(c.costoUnitario) : new D(0);
      costoItem = costoItem.add(costoTotal);
      await tx.pedidoItemConsumo.create({
        data: { pedidoItemId: item.id, insumoId: c.insumoId, origen: c.origen, cantidad: c.cantidad, costoUnitario: c.costoUnitario ?? new D(0), costoTotal, pendiente: c.pendiente },
      });
      acumular(c);
    }
    costoPedido = costoPedido.add(costoItem);
    await tx.pedidoItem.update({ where: { id: item.id }, data: { costoUnitario: item.cantidad > 0 ? costoItem.div(item.cantidad) : costoItem } });
    for (const ex of item.extras) {
      const costoExtra = consumoDeReceta(ex.producto.receta?.items ?? [], 1, costos, "EXTRA").reduce((a, c) => a.add(c.costoUnitario ? c.cantidad.mul(c.costoUnitario) : new D(0)), new D(0));
      await tx.pedidoItemExtra.update({ where: { id: ex.id }, data: { costoUnitario: costoExtra } });
    }
  }

  await tx.pedido.update({ where: { id: pedidoId }, data: { costoTotal: costoPedido } });
  await moverInventario(tx, [...porInsumo.entries()].map(([insumoId, v]) => ({ insumoId, cantidad: v.cantidad.neg(), costoUnitario: v.costoUnitario })), "SALIDA_VENTA", { tipo: "Pedido", id: pedidoId }, usuarioId, `Venta pedido #${pedido.numero}`);
  return costoPedido;
}

/** Devuelve al inventario lo consumido por un pedido pagado que se anula. */
export async function revertirConsumo(tx: Tx, pedidoId: string, usuarioId: string, numero: number) {
  const consumos = await tx.pedidoItemConsumo.findMany({ where: { pedidoItem: { pedidoId } } });
  const porInsumo = new Map<string, Dec>();
  for (const c of consumos) porInsumo.set(c.insumoId, (porInsumo.get(c.insumoId) ?? new D(0)).add(c.cantidad));
  await moverInventario(tx, [...porInsumo.entries()].map(([insumoId, cantidad]) => ({ insumoId, cantidad, costoUnitario: null })), "REVERSION", { tipo: "Pedido", id: pedidoId }, usuarioId, `Anulación pedido #${numero}`);
}

/** Aplica movimientos de inventario y actualiza el stock cacheado. Cantidad positiva entra, negativa sale. */
export async function moverInventario(
  tx: Tx,
  lineas: { insumoId: string; cantidad: Dec; costoUnitario: Dec | null }[],
  tipo: TipoMovimiento,
  referencia: { tipo: string; id: string } | null,
  usuarioId: string | null,
  motivo?: string,
) {
  for (const l of lineas) {
    if (l.cantidad.isZero()) continue;
    const insumo = await tx.insumo.update({ where: { id: l.insumoId }, data: { stockActual: { increment: l.cantidad } } });
    await tx.movimientoInventario.create({
      data: { insumoId: l.insumoId, tipo, cantidad: l.cantidad, stockResultante: insumo.stockActual, costoUnitario: l.costoUnitario, motivo, referenciaTipo: referencia?.tipo, referenciaId: referencia?.id, usuarioId },
    });
  }
}
