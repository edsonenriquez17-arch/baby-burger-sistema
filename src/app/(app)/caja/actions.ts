"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { D } from "@/lib/costeo/costeo";
import { cajaAbierta, resumenCaja } from "@/lib/pos/caja";
import type { Resultado } from "@/components/form-accion";

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function abrirCaja(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("caja.cerrar");
  const fondo = Number(texto(fd.get("fondoInicial")) || 0);
  if (!Number.isFinite(fondo) || fondo < 0) return { error: "Fondo inválido" };
  if (await cajaAbierta()) return { error: "Ya hay una caja abierta" };

  await db.$transaction(async (tx) => {
    const caja = await tx.cierreCaja.create({ data: { fondoInicial: new D(fondo), abiertoPorId: u.id } });
    // Ventas pagadas sin caja (cobradas antes de abrir) se asocian a esta caja.
    await tx.pedido.updateMany({ where: { estado: "PAGADO", cierreCajaId: null }, data: { cierreCajaId: caja.id } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "CierreCaja", entidadId: caja.id, descripcion: `Caja abierta con fondo S/ ${fondo}` }, tx);
  });
  revalidatePath("/caja");
  return { ok: true };
}

export async function cerrarCaja(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("caja.cerrar");
  const efectivoReal = Number(texto(fd.get("efectivoReal")));
  const observaciones = texto(fd.get("observaciones")) || null;
  if (!Number.isFinite(efectivoReal) || efectivoReal < 0) return { error: "Ingresa el efectivo real contado" };
  const caja = await cajaAbierta();
  if (!caja) return { error: "No hay caja abierta" };
  const abiertos = await db.pedido.count({ where: { estado: { in: ["ABIERTO", "EN_PREPARACION", "LISTO", "ESPERANDO_PAGO"] } } });
  if (abiertos > 0) return { error: `Hay ${abiertos} pedido(s) sin cobrar o anular. Ciérralos antes de cerrar la caja.` };

  await db.$transaction(async (tx) => {
    await tx.cierreCaja.update({ where: { id: caja.id }, data: { fechaCierre: new Date() } });
    const r = await resumenCaja(caja.id, tx);
    await tx.retiroCaja.updateMany({ where: { cierreCajaId: null, fecha: { gte: caja.fechaApertura } }, data: { cierreCajaId: caja.id } });
    const diferencia = new D(efectivoReal).sub(r.efectivoEsperado);
    await tx.cierreCaja.update({
      where: { id: caja.id },
      data: {
        estado: "CERRADA", cerradoPorId: u.id, observaciones,
        ventasTotal: r.ventasTotal, numeroPedidos: r.numeroPedidos, numeroAnulados: r.numeroAnulados, descuentosTotal: r.descuentosTotal,
        retirosTotal: r.retirosTotal, gastosEfectivo: r.gastosEfectivo, comprasEfectivo: r.comprasEfectivo,
        efectivoEsperado: r.efectivoEsperado, efectivoReal: new D(efectivoReal), diferencia,
        lineas: { create: r.porMetodo.map((m) => ({ metodoPagoId: m.metodoPagoId, monto: m.monto })) },
      },
    });
    await registrarAuditoria({ usuarioId: u.id, accion: "EDITAR", entidad: "CierreCaja", entidadId: caja.id, descripcion: "Caja cerrada", valorNuevo: { ventas: r.ventasTotal.toString(), esperado: r.efectivoEsperado.toString(), real: efectivoReal, diferencia: diferencia.toString() } }, tx);
  });
  revalidatePath("/caja");
  return { ok: true, mensaje: "Caja cerrada." };
}
