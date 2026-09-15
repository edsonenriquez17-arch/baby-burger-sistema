"use server";

import type { TipoIncidencia } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { D, obtenerCostosVigentes, type Dec } from "@/lib/costeo/costeo";
import { consumoDeProducto, moverInventario } from "@/lib/pos/venta";
import type { Resultado } from "@/components/form-accion";

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const leerFecha = (v: string) => (v ? new Date(`${v}T12:00:00-05:00`) : new Date());

function revalidar() {
  revalidatePath("/perdidas");
  revalidatePath("/inventario");
  revalidatePath("/");
}

/** Merma de un insumo (cantidad en unidad elegida) o de un producto terminado (unidades). */
export async function registrarMerma(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("inventario.mermas");
  const objetivo = texto(fd.get("objetivo")); // "insumo:<id>" | "producto:<id>"
  const cantidadTexto = texto(fd.get("cantidad"));
  const unidadId = texto(fd.get("unidadId"));
  const motivoId = texto(fd.get("motivoId"));
  const observaciones = texto(fd.get("observaciones")) || null;
  const fecha = leerFecha(texto(fd.get("fecha")));
  const cantidad = Number(cantidadTexto);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return { error: "Cantidad inválida" };
  const motivo = await db.motivoMerma.findUnique({ where: { id: motivoId } });
  if (!motivo) return { error: "Elige un motivo" };

  try {
    await db.$transaction(async (tx) => {
      if (objetivo.startsWith("insumo:")) {
        const insumoId = objetivo.slice(7);
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: insumoId }, include: { unidadBase: true } });
        const unidad = unidadId ? await tx.unidadMedida.findUniqueOrThrow({ where: { id: unidadId } }) : insumo.unidadBase;
        if (unidad.tipo !== insumo.unidadBase.tipo) throw new Error("Unidad incompatible");
        const cantidadBase = new D(cantidadTexto).mul(unidad.factorABase);
        const costoUnit = (await obtenerCostosVigentes(tx, [insumoId])).get(insumoId)?.costo ?? null;
        const costo = costoUnit ? cantidadBase.mul(costoUnit) : new D(0);
        const m = await tx.merma.create({ data: { fecha, insumoId, cantidad: cantidadBase, unidadMedidaId: insumo.unidadBaseId, motivoId, costo, observaciones, usuarioId: u.id } });
        await moverInventario(tx, [{ insumoId, cantidad: cantidadBase.neg(), costoUnitario: costoUnit }], "SALIDA_MERMA", { tipo: "Merma", id: m.id }, u.id, `Merma: ${motivo.nombre}`);
        await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "Merma", entidadId: m.id, descripcion: `${insumo.nombre} ${cantidadTexto} ${unidad.codigo} — ${motivo.nombre} (S/ ${costo.toFixed(2)})` }, tx);
      } else if (objetivo.startsWith("producto:")) {
        const productoId = objetivo.slice(9);
        const { producto, lineas, total } = await consumoDeProducto(tx, productoId, cantidad);
        const m = await tx.merma.create({ data: { fecha, productoId, cantidad: new D(cantidad), motivoId, costo: total, observaciones, usuarioId: u.id } });
        await moverInventario(tx, lineas.map((l) => ({ insumoId: l.insumoId, cantidad: l.cantidad.neg(), costoUnitario: l.costoUnitario })), "SALIDA_MERMA", { tipo: "Merma", id: m.id }, u.id, `Merma ${producto.nombre}: ${motivo.nombre}`);
        await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "Merma", entidadId: m.id, descripcion: `${cantidad}× ${producto.nombre} — ${motivo.nombre} (S/ ${total.toFixed(2)})` }, tx);
      } else throw new Error("Elige un insumo o producto");
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar" };
  }
  revalidar();
  return { ok: true, mensaje: "Merma registrada y descontada del inventario." };
}

export async function registrarCortesia(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("cortesias.registrar");
  const productoId = texto(fd.get("productoId"));
  const cantidad = Number(texto(fd.get("cantidad")));
  const motivoId = texto(fd.get("motivoId"));
  const observaciones = texto(fd.get("observaciones")) || null;
  const fecha = leerFecha(texto(fd.get("fecha")));
  if (!Number.isInteger(cantidad) || cantidad <= 0) return { error: "Cantidad inválida" };
  const motivo = await db.motivoCortesia.findUnique({ where: { id: motivoId } });
  if (!motivo) return { error: "Elige un motivo" };

  try {
    await db.$transaction(async (tx) => {
      const { producto, lineas, total } = await consumoDeProducto(tx, productoId, cantidad);
      const c = await tx.cortesia.create({
        data: {
          fecha, productoId, cantidad, motivoId, costoTotal: total, observaciones, usuarioId: u.id,
          consumos: { create: lineas.map((l) => ({ insumoId: l.insumoId, cantidad: l.cantidad, costoUnitario: l.costoUnitario ?? new D(0), costoTotal: l.costoUnitario ? l.cantidad.mul(l.costoUnitario) : new D(0) })) },
        },
      });
      await moverInventario(tx, lineas.map((l) => ({ insumoId: l.insumoId, cantidad: l.cantidad.neg(), costoUnitario: l.costoUnitario })), "SALIDA_CORTESIA", { tipo: "Cortesia", id: c.id }, u.id, `Cortesía ${producto.nombre}: ${motivo.nombre}`);
      await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "Cortesia", entidadId: c.id, descripcion: `${cantidad}× ${producto.nombre} — ${motivo.nombre} (costo S/ ${total.toFixed(2)})` }, tx);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar" };
  }
  revalidar();
  return { ok: true, mensaje: "Cortesía registrada (no cuenta como venta)." };
}

export async function registrarIncidencia(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("incidencias.registrar");
  const tipo = texto(fd.get("tipo")) as TipoIncidencia;
  const productoId = texto(fd.get("productoId")) || null;
  const pedidoNumero = texto(fd.get("pedidoNumero"));
  const cantidad = Number(texto(fd.get("cantidad")) || 1);
  const motivo = texto(fd.get("motivo"));
  const ajusta = fd.get("ajustaInventario") === "on";
  const costoManual = texto(fd.get("costoManual"));
  const observaciones = texto(fd.get("observaciones")) || null;
  const fecha = leerFecha(texto(fd.get("fecha")));
  if (!motivo) return { error: "Indica el motivo" };
  if (!Number.isInteger(cantidad) || cantidad <= 0) return { error: "Cantidad inválida" };
  const pedido = pedidoNumero ? await db.pedido.findUnique({ where: { numero: Number(pedidoNumero) } }) : null;
  if (pedidoNumero && !pedido) return { error: `No existe el pedido #${pedidoNumero}` };

  try {
    await db.$transaction(async (tx) => {
      let costo = costoManual ? new D(costoManual) : new D(0);
      let lineas: { insumoId: string; cantidad: Dec; costoUnitario: Dec | null }[] = [];
      let nombre = "";
      if (productoId) {
        const r = await consumoDeProducto(tx, productoId, cantidad);
        nombre = r.producto.nombre;
        lineas = r.lineas;
        if (!costoManual) costo = r.total;
      }
      const inc = await tx.incidencia.create({ data: { fecha, tipo, pedidoId: pedido?.id ?? null, productoId, cantidad, motivo, costoGenerado: costo, ajustaInventario: ajusta && lineas.length > 0, observaciones, usuarioId: u.id } });
      if (ajusta && lineas.length > 0) {
        await moverInventario(tx, lineas.map((l) => ({ insumoId: l.insumoId, cantidad: l.cantidad.neg(), costoUnitario: l.costoUnitario })), "SALIDA_INCIDENCIA", { tipo: "Incidencia", id: inc.id }, u.id, `${tipo}: ${motivo}`);
      }
      await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "Incidencia", entidadId: inc.id, descripcion: `${tipo} ${nombre ? `${cantidad}× ${nombre}` : ""} — ${motivo} (S/ ${costo.toFixed(2)})` }, tx);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar" };
  }
  revalidar();
  return { ok: true, mensaje: "Incidencia registrada." };
}
