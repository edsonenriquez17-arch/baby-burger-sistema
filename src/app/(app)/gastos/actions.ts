"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { D } from "@/lib/costeo/costeo";
import { cajaAbierta } from "@/lib/pos/caja";
import type { Resultado } from "@/components/form-accion";

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const leerFecha = (v: string) => (v ? new Date(`${v}T12:00:00-05:00`) : new Date());
const leerMonto = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new D(v) : null;
};

export async function registrarGasto(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("gastos.registrar");
  const monto = leerMonto(texto(fd.get("monto")));
  const categoriaId = texto(fd.get("categoriaId"));
  const descripcion = texto(fd.get("descripcion"));
  if (!monto) return { error: "Monto inválido" };
  if (!descripcion) return { error: "Describe el gasto" };
  const categoria = await db.categoriaGasto.findUnique({ where: { id: categoriaId } });
  if (!categoria) return { error: "Elige una categoría" };

  await db.$transaction(async (tx) => {
    const g = await tx.gasto.create({
      data: {
        fecha: leerFecha(texto(fd.get("fecha"))), categoriaId, monto, descripcion,
        comprobanteUrl: texto(fd.get("comprobante")) || null, observaciones: texto(fd.get("observaciones")) || null,
        esFijo: fd.get("esFijo") === "on" || categoria.esFijo, metodoPagoId: texto(fd.get("metodoPagoId")) || null, pagadoDesdeCaja: fd.get("pagadoDesdeCaja") === "on", usuarioId: u.id,
      },
    });
    await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "Gasto", entidadId: g.id, descripcion: `${categoria.nombre}: ${descripcion} S/ ${monto}` }, tx);
  });
  revalidatePath("/gastos");
  revalidatePath("/caja");
  return { ok: true, mensaje: "Gasto registrado." };
}

export async function registrarRetiro(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("caja.retiros");
  const monto = leerMonto(texto(fd.get("monto")));
  const persona = texto(fd.get("persona"));
  const motivo = texto(fd.get("motivo"));
  if (!monto) return { error: "Monto inválido" };
  if (!persona || !motivo) return { error: "Indica quién retira y el motivo" };
  const caja = await cajaAbierta();
  await db.$transaction(async (tx) => {
    const r = await tx.retiroCaja.create({ data: { fecha: leerFecha(texto(fd.get("fecha"))), monto, persona, motivo, observaciones: texto(fd.get("observaciones")) || null, usuarioId: u.id, cierreCajaId: caja?.id ?? null } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "RetiroCaja", entidadId: r.id, descripcion: `${persona} retiró S/ ${monto}: ${motivo}` }, tx);
  });
  revalidatePath("/retiros");
  revalidatePath("/caja");
  return { ok: true, mensaje: "Retiro registrado." };
}
