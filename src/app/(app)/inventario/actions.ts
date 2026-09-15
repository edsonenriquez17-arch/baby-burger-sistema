"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { D, cantidadBase, obtenerCostosVigentes, INCLUDE_ITEM_COSTEABLE } from "@/lib/costeo/costeo";
import { moverInventario } from "@/lib/pos/venta";
import type { Resultado } from "@/components/form-accion";

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function revalidar(insumoId?: string) {
  revalidatePath("/inventario");
  if (insumoId) revalidatePath(`/inventario/${insumoId}`);
  revalidatePath("/insumos");
  revalidatePath("/empaques");
  revalidatePath("/");
}

/** Ajuste manual: fija el stock real contado (diferencia se registra como ajuste con motivo). */
export async function ajustarStock(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("inventario.ajustar");
  const insumoId = texto(fd.get("insumoId"));
  const modo = texto(fd.get("modo")); // "fijar" | "sumar" | "restar"
  const cantidadTexto = texto(fd.get("cantidad"));
  const motivo = texto(fd.get("motivo"));
  const cantidad = Number(cantidadTexto);
  if (!Number.isFinite(cantidad) || cantidad < 0) return { error: "Cantidad inválida" };
  if (!motivo) return { error: "Indica el motivo del ajuste" };
  const insumo = await db.insumo.findUnique({ where: { id: insumoId }, include: { unidadBase: true } });
  if (!insumo) return { error: "Insumo no encontrado" };

  let delta = new D(cantidadTexto);
  if (modo === "fijar") delta = new D(cantidadTexto).sub(insumo.stockActual);
  else if (modo === "restar") delta = delta.neg();
  if (delta.isZero()) return { ok: true, mensaje: "Sin cambios." };

  const costo = (await obtenerCostosVigentes(db, [insumoId])).get(insumoId)?.costo ?? null;
  const tipo = modo === "fijar" && insumo.stockActual.isZero() ? "STOCK_INICIAL" : delta.gt(0) ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO";

  await db.$transaction(async (tx) => {
    await moverInventario(tx, [{ insumoId, cantidad: delta, costoUnitario: costo }], tipo, null, u.id, motivo);
    await registrarAuditoria({ usuarioId: u.id, accion: "AJUSTE_INVENTARIO", entidad: "Insumo", entidadId: insumoId, descripcion: `${insumo.nombre}: ${motivo}`, valorAnterior: { stock: insumo.stockActual }, valorNuevo: { stock: insumo.stockActual.add(delta) } }, tx);
  });
  revalidar(insumoId);
  return { ok: true, mensaje: "Stock actualizado." };
}

/** Producir un lote de una preparación: entra el resultado, salen los ingredientes según la receta. */
export async function producirLote(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("inventario.ajustar");
  const preparacionId = texto(fd.get("preparacionId"));
  const cantidadTexto = texto(fd.get("cantidad"));
  const cantidad = Number(cantidadTexto);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return { error: "Cantidad producida inválida" };

  const prep = await db.preparacion.findUnique({
    where: { id: preparacionId },
    include: { rendimientoUnidad: true, insumoResultado: { include: { unidadBase: true } }, items: { include: INCLUDE_ITEM_COSTEABLE } },
  });
  if (!prep) return { error: "Preparación no encontrada" };
  if (!prep.rendimientoCantidad || prep.rendimientoCantidad.lte(0)) return { error: "Define primero cuánto rinde el lote en la preparación." };
  const pendientes = prep.items.filter((i) => cantidadBase(i).valor === null);
  if (pendientes.length > 0) return { error: `Faltan cantidades en: ${pendientes.map((i) => i.insumo.nombre).join(", ")}` };

  // La cantidad producida se ingresa en la unidad del rendimiento (ej. kg); se convierte a base.
  const producidoBase = new D(cantidadTexto).mul(prep.rendimientoUnidad.factorABase);
  const factorLote = producidoBase.div(prep.rendimientoCantidad.mul(prep.rendimientoUnidad.factorABase));
  const costos = await obtenerCostosVigentes();

  await db.$transaction(async (tx) => {
    const salidas = prep.items.map((i) => ({ insumoId: i.insumoId, cantidad: cantidadBase(i).valor!.mul(factorLote).neg(), costoUnitario: costos.get(i.insumoId)?.costo ?? null }));
    await moverInventario(tx, salidas, "SALIDA_PREPARACION", { tipo: "Preparacion", id: preparacionId }, u.id, `Lote de ${prep.nombre}`);
    await moverInventario(tx, [{ insumoId: prep.insumoResultadoId, cantidad: producidoBase, costoUnitario: costos.get(prep.insumoResultadoId)?.costo ?? null }], "ENTRADA_PREPARACION", { tipo: "Preparacion", id: preparacionId }, u.id, `Lote de ${prep.nombre}`);
    await registrarAuditoria({ usuarioId: u.id, accion: "AJUSTE_INVENTARIO", entidad: "Preparacion", entidadId: preparacionId, descripcion: `Producido ${cantidadTexto} ${prep.rendimientoUnidad.codigo} de ${prep.nombre}` }, tx);
  });
  revalidar(prep.insumoResultadoId);
  revalidatePath(`/preparaciones/${preparacionId}`);
  return { ok: true, mensaje: `Lote registrado: +${cantidadTexto} ${prep.rendimientoUnidad.codigo}.` };
}
