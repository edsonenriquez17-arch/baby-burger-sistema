"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { D, registrarPrecioInsumo, type Dec } from "@/lib/costeo/costeo";
import { recalcularCostos } from "@/lib/costeo/recalculo";
import { moverInventario } from "@/lib/pos/venta";
import type { Resultado } from "@/components/form-accion";

export type LineaCompra = {
  insumoId: string;
  presentacionId: string | null; // null = se compra directo en unidad base
  cantidad: string; // nº de presentaciones, o cantidad en unidad base si no hay presentación
  precioUnitario: string; // precio por presentación (o por unidad base)
  observaciones?: string;
};

export type DatosCompra = {
  fecha: string; // yyyy-mm-dd
  proveedor: string;
  numeroComprobante: string;
  metodoPagoId: string;
  pagadoDesdeCaja: boolean;
  observaciones: string;
  lineas: LineaCompra[];
};

export async function registrarCompra(datos: DatosCompra): Promise<Resultado & { compraId?: string }> {
  const u = await requerirPermiso("compras.registrar");
  const lineas = datos.lineas.filter((l) => l.insumoId && Number(l.cantidad) > 0);
  if (lineas.length === 0) return { error: "Agrega al menos un insumo" };
  for (const l of lineas) {
    if (!Number.isFinite(Number(l.precioUnitario)) || Number(l.precioUnitario) < 0) return { error: "Precio inválido en una línea" };
  }
  const fecha = datos.fecha ? new Date(`${datos.fecha}T12:00:00`) : new Date();

  try {
    const compra = await db.$transaction(async (tx) => {
      const proveedorId = datos.proveedor.trim() ? (await tx.proveedor.upsert({ where: { nombre: datos.proveedor.trim() }, update: {}, create: { nombre: datos.proveedor.trim() } })).id : null;
      const compra = await tx.compra.create({
        data: { fecha, proveedorId, numeroComprobante: datos.numeroComprobante.trim() || null, metodoPagoId: datos.metodoPagoId || null, pagadoDesdeCaja: datos.pagadoDesdeCaja, observaciones: datos.observaciones.trim() || null, usuarioId: u.id },
      });

      let total = new D(0);
      const entradas: { insumoId: string; cantidad: Dec; costoUnitario: Dec }[] = [];
      for (const l of lineas) {
        const insumo = await tx.insumo.findUnique({ where: { id: l.insumoId }, include: { unidadBase: true } });
        if (!insumo) throw new Error("Insumo no encontrado");
        const pres = l.presentacionId ? await tx.presentacion.findUnique({ where: { id: l.presentacionId }, include: { unidadContenido: true } }) : null;
        if (l.presentacionId && (!pres || pres.insumoId !== insumo.id)) throw new Error("Presentación inválida");
        if (pres && (pres.contenido === null || pres.contenido.lte(0))) throw new Error(`Define el contenido de la presentación "${pres.nombre}" de ${insumo.nombre} antes de comprarla.`);

        const cantidad = new D(l.cantidad);
        const precioUnitario = new D(l.precioUnitario);
        const totalLinea = cantidad.mul(precioUnitario);
        const cantidadBase = pres ? cantidad.mul(pres.contenido!).mul(pres.unidadContenido.factorABase) : cantidad;
        const costoUnitarioBase = cantidadBase.gt(0) ? totalLinea.div(cantidadBase) : new D(0);
        total = total.add(totalLinea);

        const item = await tx.compraItem.create({
          data: { compraId: compra.id, insumoId: insumo.id, presentacionId: pres?.id ?? null, cantidad, precioUnitario, total: totalLinea, cantidadBase, costoUnitarioBase, observaciones: l.observaciones?.trim() || null },
        });
        if (totalLinea.gt(0)) {
          await registrarPrecioInsumo(tx, { insumoId: insumo.id, presentacionId: pres?.id ?? null, precioPresentacion: precioUnitario, costoUnitarioBase, origen: "COMPRA", compraItemId: item.id, usuarioId: u.id, nota: `Compra ${datos.numeroComprobante || ""}`.trim() });
        }
        entradas.push({ insumoId: insumo.id, cantidad: cantidadBase, costoUnitario: costoUnitarioBase });
      }
      await tx.compra.update({ where: { id: compra.id }, data: { total } });
      await moverInventario(tx, entradas, "ENTRADA_COMPRA", { tipo: "Compra", id: compra.id }, u.id, `Compra${datos.proveedor ? ` a ${datos.proveedor}` : ""}`);
      await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "Compra", entidadId: compra.id, descripcion: `Compra S/ ${total.toFixed(2)} (${lineas.length} líneas)`, valorNuevo: { proveedor: datos.proveedor, total: total.toString(), lineas: lineas.length } }, tx);
      await recalcularCostos(u.id, `Compra${datos.proveedor ? ` a ${datos.proveedor}` : ""} ${datos.fecha}`, tx);
      return compra;
    }, { timeout: 30000 });

    revalidatePath("/compras");
    revalidatePath("/inventario");
    revalidatePath("/insumos");
    revalidatePath("/empaques");
    revalidatePath("/recetas");
    revalidatePath("/caja");
    return { ok: true, compraId: compra.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar la compra" };
  }
}
