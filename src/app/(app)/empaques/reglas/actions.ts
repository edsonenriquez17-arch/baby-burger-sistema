"use server";

import { Prisma, type TipoServicio } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularCostos } from "@/lib/costeo/recalculo";
import type { Resultado } from "@/components/form-accion";

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const CANALES: TipoServicio[] = ["MESA", "BARRA", "LLEVAR", "DELIVERY"];

function revalidar() {
  revalidatePath("/empaques/reglas");
  revalidatePath("/recetas");
}

export async function crearRegla(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("empaques.editar");
  const tipoServicio = texto(fd.get("tipoServicio")) as TipoServicio;
  const insumoId = texto(fd.get("insumoId"));
  const cantidadTexto = texto(fd.get("cantidad"));
  const alcance = texto(fd.get("alcance")) === "POR_PEDIDO" ? "POR_PEDIDO" : "POR_ITEM";
  const aplica = texto(fd.get("aplica")); // "", "cat:<id>", "prod:<id>"
  if (!CANALES.includes(tipoServicio)) return { error: "Canal inválido" };
  const cantidad = Number(cantidadTexto);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return { error: "Cantidad inválida" };
  const insumo = await db.insumo.findUnique({ where: { id: insumoId } });
  if (!insumo || insumo.tipo !== "EMPAQUE") return { error: "Elige un empaque" };
  const categoriaId = alcance === "POR_ITEM" && aplica.startsWith("cat:") ? aplica.slice(4) : null;
  const productoId = alcance === "POR_ITEM" && aplica.startsWith("prod:") ? aplica.slice(5) : null;

  await db.$transaction(async (tx) => {
    const r = await tx.reglaEmpaque.create({ data: { tipoServicio, insumoId, cantidad: new Prisma.Decimal(cantidadTexto), alcance, categoriaId, productoId } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "ReglaEmpaque", entidadId: r.id, valorNuevo: { tipoServicio, insumo: insumo.nombre, cantidad, alcance, categoriaId, productoId } }, tx);
    await recalcularCostos(u.id, `Regla de empaque: ${insumo.nombre} (${tipoServicio})`, tx);
  });
  revalidar();
  return { ok: true };
}

export async function editarCantidadRegla(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("empaques.editar");
  const id = texto(fd.get("id"));
  const cantidadTexto = texto(fd.get("cantidad"));
  const cantidad = Number(cantidadTexto);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return { error: "Cantidad inválida" };
  const r = await db.reglaEmpaque.findUnique({ where: { id }, include: { insumo: true } });
  if (!r) return { error: "No encontrada" };
  await db.$transaction(async (tx) => {
    await tx.reglaEmpaque.update({ where: { id }, data: { cantidad: new Prisma.Decimal(cantidadTexto) } });
    await registrarAuditoria({ usuarioId: u.id, accion: "EDITAR", entidad: "ReglaEmpaque", entidadId: id, descripcion: `${r.insumo.nombre} (${r.tipoServicio})`, valorAnterior: { cantidad: r.cantidad }, valorNuevo: { cantidad } }, tx);
    await recalcularCostos(u.id, `Regla de empaque: ${r.insumo.nombre} (${r.tipoServicio}) = ${cantidad}`, tx);
  });
  revalidar();
  return { ok: true, mensaje: "Guardado." };
}

export async function quitarRegla(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("empaques.editar");
  const id = texto(fd.get("id"));
  const r = await db.reglaEmpaque.findUnique({ where: { id }, include: { insumo: true } });
  if (!r) return { error: "No encontrada" };
  await db.$transaction(async (tx) => {
    await tx.reglaEmpaque.update({ where: { id }, data: { activa: false } });
    await registrarAuditoria({ usuarioId: u.id, accion: "DESACTIVAR", entidad: "ReglaEmpaque", entidadId: id, descripcion: `${r.insumo.nombre} (${r.tipoServicio})` }, tx);
    await recalcularCostos(u.id, `Regla de empaque quitada: ${r.insumo.nombre} (${r.tipoServicio})`, tx);
  });
  revalidar();
  return { ok: true };
}
