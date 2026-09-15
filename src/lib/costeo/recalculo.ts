import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { D, costearItems, obtenerCostosVigentes, registrarPrecioInsumo, INCLUDE_ITEM_COSTEABLE, type LineaCosto } from "./costeo";
import { canalPredeterminado, costearReglas, empaquesPorItem, obtenerReglasEmpaque } from "./empaques";

type Cliente = Prisma.TransactionClient | typeof db;

/**
 * Recalcula hacia adelante (regla 3: nunca toca ventas pasadas):
 *  1. Costo de cada preparación → nuevo PrecioInsumo (origen PREPARACION) si cambió.
 *     Se itera varias veces porque una preparación puede usar otra preparación.
 *  2. Costo de cada producto → nuevo CostoProductoHistorial si cambió.
 *
 * Llamar después de: registrar precio, editar preparación/receta, cambiar factor
 * de unidad propia o presentación predeterminada.
 */
export async function recalcularCostos(usuarioId: string | null, motivo: string, tx: Cliente = db) {
  await recalcularPreparaciones(usuarioId, motivo, tx);
  await recalcularProductos(motivo, tx);
}

async function recalcularPreparaciones(usuarioId: string | null, motivo: string, tx: Cliente) {
  const preparaciones = await tx.preparacion.findMany({
    where: { activa: true },
    include: {
      rendimientoUnidad: { select: { factorABase: true } },
      items: { include: INCLUDE_ITEM_COSTEABLE },
    },
  });

  for (let pasada = 0; pasada < 6; pasada++) {
    const costos = await obtenerCostosVigentes(tx);
    let huboCambio = false;

    for (const prep of preparaciones) {
      if (prep.rendimientoCantidad === null || prep.rendimientoCantidad.lte(0)) continue;
      const { total, completo } = costearItems(prep.items, costos);
      if (!completo) continue; // no se inventa: sin datos completos no hay costo

      const rendimientoBase = prep.rendimientoCantidad.mul(prep.rendimientoUnidad.factorABase);
      const costoUnitario = total.div(rendimientoBase);
      const vigente = costos.get(prep.insumoResultadoId);
      const cambio = !vigente || !vigente.costo.sub(costoUnitario).abs().lt(new D("0.00000001"));
      if (!cambio) continue;

      await registrarPrecioInsumo(tx, {
        insumoId: prep.insumoResultadoId,
        presentacionId: null,
        costoUnitarioBase: costoUnitario,
        precioPresentacion: total,
        origen: "PREPARACION",
        usuarioId,
        nota: motivo,
      });
      huboCambio = true;
    }
    if (!huboCambio) break;
  }
}

async function recalcularProductos(motivo: string, tx: Cliente) {
  const [costos, reglas, canal] = await Promise.all([obtenerCostosVigentes(tx), obtenerReglasEmpaque(tx), canalPredeterminado(tx)]);
  const productos = await tx.producto.findMany({
    where: { activo: true },
    include: {
      receta: { include: { items: { include: INCLUDE_ITEM_COSTEABLE } } },
      costosHist: { orderBy: { fecha: "desc" }, take: 1 },
    },
  });

  for (const p of productos) {
    const items = p.receta?.items ?? [];
    const { lineas, total, completo } = costearItems(items, costos);
    // Empaque de referencia: reglas POR_ITEM del canal predeterminado (los POR_PEDIDO se reparten en la venta real).
    const empaque = costearReglas(empaquesPorItem(reglas, canal, { id: p.id, categoriaId: p.categoriaId }), costos);
    const costoTotal = total.add(empaque.total);
    const completoTotal = completo && empaque.completo;
    const ultimo = p.costosHist[0];
    const detalle = [
      ...lineas.map(serializarLinea),
      ...empaque.lineas.map((l) => ({ insumoId: l.insumoId, nombre: `${l.nombre} (empaque ${canal.toLowerCase()})`, cantidad: `${l.cantidad} unidad`, cantidadBase: l.cantidad.toString(), unidadBase: "unidad", costoUnitario: l.costoUnitario?.toString() ?? null, costoTotal: l.costoTotal?.toString() ?? null, pendiente: l.costoTotal ? null : ("precio" as const) })),
    ];
    const sinCambio =
      ultimo &&
      ultimo.completo === completoTotal &&
      ultimo.costoTotal.sub(costoTotal).abs().lt(new D("0.0001")) &&
      JSON.stringify(ultimo.detalle) === JSON.stringify(detalle);
    if (sinCambio) continue;

    await tx.costoProductoHistorial.create({
      data: {
        productoId: p.id,
        costoComida: total,
        costoEmpaque: empaque.total,
        costoTotal,
        completo: completoTotal,
        detalle,
        motivo,
      },
    });
  }
}

function serializarLinea(l: LineaCosto) {
  return {
    insumoId: l.insumoId,
    nombre: l.nombre,
    cantidad: l.cantidadTexto,
    cantidadBase: l.cantidadBase?.toString() ?? null,
    unidadBase: l.unidadBase,
    costoUnitario: l.costoUnitario?.toString() ?? null,
    costoTotal: l.costoTotal?.toString() ?? null,
    pendiente: l.pendiente,
  };
}
