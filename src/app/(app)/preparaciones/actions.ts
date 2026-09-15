"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularCostos } from "@/lib/costeo/recalculo";
import { leerItemForm } from "@/lib/costeo/items";
import type { Resultado } from "@/components/form-accion";

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function revalidar(id?: string) {
  revalidatePath("/preparaciones");
  if (id) revalidatePath(`/preparaciones/${id}`);
  revalidatePath("/recetas");
  revalidatePath("/insumos");
}

async function snapshot(tx: Prisma.TransactionClient, id: string) {
  const p = await tx.preparacion.findUniqueOrThrow({
    where: { id },
    include: { rendimientoUnidad: true, items: { include: { insumo: { select: { nombre: true } }, unidadMedida: true, unidadInsumo: true } } },
  });
  return {
    nombre: p.nombre,
    rendimiento: p.rendimientoCantidad ? `${p.rendimientoCantidad} ${p.rendimientoUnidad.codigo}` : null,
    items: p.items.map((i) => `${i.insumo.nombre}: ${i.cantidad ?? "pendiente"} ${i.unidadInsumo?.nombre ?? i.unidadMedida?.codigo ?? ""}`.trim()),
  };
}

function leerRendimiento(fd: FormData) {
  const t = texto(fd.get("rendimientoCantidad"));
  if (t === "") return { valor: null as Prisma.Decimal | null };
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return { error: "Rendimiento inválido" };
  return { valor: new Prisma.Decimal(t) };
}

export async function crearPreparacion(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("recetas.editar");
  const nombre = texto(fd.get("nombre"));
  const unidadId = texto(fd.get("rendimientoUnidadId"));
  const instrucciones = texto(fd.get("instrucciones")) || null;
  const rend = leerRendimiento(fd);
  if ("error" in rend) return { error: rend.error };
  if (nombre.length < 2) return { error: "Nombre muy corto" };
  if (await db.insumo.findUnique({ where: { nombre } })) return { error: `Ya existe un insumo llamado "${nombre}"` };
  const unidad = await db.unidadMedida.findUnique({ where: { id: unidadId } });
  if (!unidad) return { error: "Unidad inválida" };
  const base = await db.unidadMedida.findFirstOrThrow({ where: { tipo: unidad.tipo, esBase: true } });
  const categoria = await db.categoriaInsumo.findFirst({ where: { tipo: "PREPARACION" } });

  const creada = await db.$transaction(async (tx) => {
    const insumo = await tx.insumo.create({ data: { nombre, tipo: "PREPARACION", unidadBaseId: base.id, categoriaId: categoria?.id } });
    const prep = await tx.preparacion.create({ data: { insumoResultadoId: insumo.id, nombre, rendimientoCantidad: rend.valor, rendimientoUnidadId: unidadId, instrucciones } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "Preparacion", entidadId: prep.id, valorNuevo: await snapshot(tx, prep.id) }, tx);
    return prep;
  });
  revalidar();
  redirect(`/preparaciones/${creada.id}`);
}

export async function editarPreparacion(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("recetas.editar");
  const id = texto(fd.get("id"));
  const nombre = texto(fd.get("nombre"));
  const unidadId = texto(fd.get("rendimientoUnidadId"));
  const instrucciones = texto(fd.get("instrucciones")) || null;
  const rend = leerRendimiento(fd);
  if ("error" in rend) return { error: rend.error };
  if (nombre.length < 2) return { error: "Nombre muy corto" };

  const prep = await db.preparacion.findUnique({ where: { id }, include: { insumoResultado: { include: { unidadBase: true } } } });
  if (!prep) return { error: "No encontrada" };
  const unidad = await db.unidadMedida.findUnique({ where: { id: unidadId } });
  if (!unidad || unidad.tipo !== prep.insumoResultado.unidadBase.tipo) return { error: `La unidad debe ser de tipo ${prep.insumoResultado.unidadBase.tipo.toLowerCase()}` };
  const dup = await db.insumo.findFirst({ where: { nombre, id: { not: prep.insumoResultadoId } } });
  if (dup) return { error: `Ya existe "${nombre}"` };

  await db.$transaction(async (tx) => {
    const antes = await snapshot(tx, id);
    await tx.preparacion.update({ where: { id }, data: { nombre, rendimientoCantidad: rend.valor, rendimientoUnidadId: unidadId, instrucciones } });
    await tx.insumo.update({ where: { id: prep.insumoResultadoId }, data: { nombre } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CAMBIO_RECETA", entidad: "Preparacion", entidadId: id, valorAnterior: antes, valorNuevo: await snapshot(tx, id) }, tx);
    await recalcularCostos(u.id, `Preparación ${nombre} editada`, tx);
  });
  revalidar(id);
  return { ok: true, mensaje: "Guardado." };
}

export async function agregarItemPreparacion(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("recetas.editar");
  const preparacionId = texto(fd.get("preparacionId"));
  const prep = await db.preparacion.findUnique({ where: { id: preparacionId }, include: { items: true } });
  if (!prep) return { error: "No encontrada" };
  const item = await leerItemForm(fd);
  if ("error" in item) return { error: item.error };
  if (item.insumo.id === prep.insumoResultadoId) return { error: "Una preparación no puede usarse a sí misma" };
  if (prep.items.some((i) => i.insumoId === item.insumo.id)) return { error: "Ese insumo ya está en la lista; edítalo en su fila." };

  await db.$transaction(async (tx) => {
    const antes = await snapshot(tx, preparacionId);
    await tx.preparacionItem.create({ data: { preparacionId, insumoId: item.insumo.id, cantidad: item.cantidad, unidadMedidaId: item.unidadMedidaId, unidadInsumoId: item.unidadInsumoId, orden: prep.items.length } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CAMBIO_RECETA", entidad: "Preparacion", entidadId: preparacionId, descripcion: `+ ${item.insumo.nombre}`, valorAnterior: antes, valorNuevo: await snapshot(tx, preparacionId) }, tx);
    await recalcularCostos(u.id, `Preparación ${prep.nombre}: + ${item.insumo.nombre}`, tx);
  });
  revalidar(preparacionId);
  return { ok: true };
}

export async function editarItemPreparacion(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("recetas.editar");
  const itemId = texto(fd.get("itemId"));
  const existente = await db.preparacionItem.findUnique({ where: { id: itemId }, include: { preparacion: true } });
  if (!existente) return { error: "Ítem no encontrado" };
  const item = await leerItemForm(fd);
  if ("error" in item) return { error: item.error };
  const notas = texto(fd.get("notas")) || null;

  await db.$transaction(async (tx) => {
    const antes = await snapshot(tx, existente.preparacionId);
    await tx.preparacionItem.update({ where: { id: itemId }, data: { cantidad: item.cantidad, unidadMedidaId: item.unidadMedidaId, unidadInsumoId: item.unidadInsumoId, notas } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CAMBIO_RECETA", entidad: "Preparacion", entidadId: existente.preparacionId, descripcion: item.insumo.nombre, valorAnterior: antes, valorNuevo: await snapshot(tx, existente.preparacionId) }, tx);
    await recalcularCostos(u.id, `Preparación ${existente.preparacion.nombre}: ${item.insumo.nombre}`, tx);
  });
  revalidar(existente.preparacionId);
  return { ok: true, mensaje: "Guardado." };
}

export async function quitarItemPreparacion(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("recetas.editar");
  const itemId = texto(fd.get("itemId"));
  const existente = await db.preparacionItem.findUnique({ where: { id: itemId }, include: { preparacion: true, insumo: true } });
  if (!existente) return { error: "Ítem no encontrado" };
  await db.$transaction(async (tx) => {
    const antes = await snapshot(tx, existente.preparacionId);
    await tx.preparacionItem.delete({ where: { id: itemId } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CAMBIO_RECETA", entidad: "Preparacion", entidadId: existente.preparacionId, descripcion: `− ${existente.insumo.nombre}`, valorAnterior: antes, valorNuevo: await snapshot(tx, existente.preparacionId) }, tx);
    await recalcularCostos(u.id, `Preparación ${existente.preparacion.nombre}: − ${existente.insumo.nombre}`, tx);
  });
  revalidar(existente.preparacionId);
  return { ok: true };
}

export async function alternarActivaPreparacion(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("recetas.editar");
  const id = texto(fd.get("id"));
  const prep = await db.preparacion.findUnique({ where: { id } });
  if (!prep) return { error: "No encontrada" };
  await db.$transaction(async (tx) => {
    await tx.preparacion.update({ where: { id }, data: { activa: !prep.activa } });
    await tx.insumo.update({ where: { id: prep.insumoResultadoId }, data: { activo: !prep.activa } });
    await registrarAuditoria({ usuarioId: u.id, accion: prep.activa ? "DESACTIVAR" : "ACTIVAR", entidad: "Preparacion", entidadId: id, descripcion: prep.nombre }, tx);
  });
  revalidar(id);
  return { ok: true };
}
