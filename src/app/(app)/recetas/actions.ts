"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularCostos } from "@/lib/costeo/recalculo";
import { leerItemForm } from "@/lib/costeo/items";
import type { Resultado } from "@/components/form-accion";

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function revalidar(productoId?: string) {
  revalidatePath("/recetas");
  revalidatePath("/productos");
  if (productoId) revalidatePath(`/recetas/${productoId}`);
}

async function snapshotReceta(tx: Prisma.TransactionClient, productoId: string) {
  const r = await tx.receta.findUnique({
    where: { productoId },
    include: { items: { include: { insumo: { select: { nombre: true } }, unidadMedida: true, unidadInsumo: true }, orderBy: { orden: "asc" } } },
  });
  return r?.items.map((i) => `${i.insumo.nombre}: ${i.cantidad ?? "pendiente"} ${i.unidadInsumo?.nombre ?? i.unidadMedida?.codigo ?? ""}${i.notas ? ` (${i.notas})` : ""}`.trim()) ?? [];
}

// ---------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------

const esquemaProducto = z.object({
  nombre: z.string().trim().min(2, "Nombre muy corto").max(80),
  categoriaId: z.string().min(1, "Elige una categoría"),
  precioVenta: z.string().trim().refine((s) => Number.isFinite(Number(s)) && Number(s) >= 0, "Precio inválido"),
  descripcion: z.string().trim().max(300).optional().transform((v) => v || null),
  esExtra: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function crearProducto(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("productos.editar");
  const parsed = esquemaProducto.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (await db.producto.findUnique({ where: { nombre: d.nombre } })) return { error: `Ya existe "${d.nombre}"` };

  const componentes = await db.componenteBase.findMany({ where: { categoriaId: d.categoriaId }, orderBy: { orden: "asc" } });
  const orden = await db.producto.count({ where: { categoriaId: d.categoriaId } });

  const nuevo = await db.$transaction(async (tx) => {
    const p = await tx.producto.create({
      data: {
        nombre: d.nombre,
        categoriaId: d.categoriaId,
        precioVenta: new Prisma.Decimal(d.precioVenta),
        descripcion: d.descripcion,
        esExtra: d.esExtra,
        orden,
        preciosHist: { create: { precio: new Prisma.Decimal(d.precioVenta), motivo: "Precio inicial", usuarioId: u.id } },
        receta: {
          create: {
            items: {
              create: componentes.map((c, idx) => ({ insumoId: c.insumoId, cantidad: c.cantidad, unidadMedidaId: c.unidadMedidaId, unidadInsumoId: c.unidadInsumoId, esComponenteBase: true, orden: idx })),
            },
          },
        },
      },
    });
    await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "Producto", entidadId: p.id, valorNuevo: { ...d, componentesBase: componentes.length } }, tx);
    await recalcularCostos(u.id, `Producto ${d.nombre} creado`, tx);
    return p;
  });
  revalidar();
  redirect(`/recetas/${nuevo.id}`);
}

export async function editarProducto(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("productos.editar");
  const id = texto(fd.get("id"));
  const actual = await db.producto.findUnique({ where: { id } });
  if (!actual) return { error: "Producto no encontrado" };
  const parsed = esquemaProducto.omit({ precioVenta: true }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const dup = await db.producto.findFirst({ where: { nombre: d.nombre, id: { not: id } } });
  if (dup) return { error: `Ya existe "${d.nombre}"` };

  await db.$transaction(async (tx) => {
    await tx.producto.update({ where: { id }, data: d });
    await registrarAuditoria({ usuarioId: u.id, accion: "EDITAR", entidad: "Producto", entidadId: id, valorAnterior: { nombre: actual.nombre, categoriaId: actual.categoriaId, descripcion: actual.descripcion, esExtra: actual.esExtra }, valorNuevo: d }, tx);
  });
  revalidar(id);
  return { ok: true, mensaje: "Guardado." };
}

export async function cambiarPrecioProducto(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("productos.precios");
  const id = texto(fd.get("id"));
  const precioTexto = texto(fd.get("precioVenta"));
  const motivo = texto(fd.get("motivo")) || null;
  const precio = Number(precioTexto);
  if (!Number.isFinite(precio) || precio < 0) return { error: "Precio inválido" };
  const actual = await db.producto.findUnique({ where: { id } });
  if (!actual) return { error: "Producto no encontrado" };
  if (actual.precioVenta.eq(precioTexto)) return { ok: true, mensaje: "El precio es el mismo." };

  await db.$transaction(async (tx) => {
    const ahora = new Date();
    await tx.precioProductoHistorial.updateMany({ where: { productoId: id, vigenteHasta: null }, data: { vigenteHasta: ahora } });
    await tx.precioProductoHistorial.create({ data: { productoId: id, precio: new Prisma.Decimal(precioTexto), vigenteDesde: ahora, motivo, usuarioId: u.id } });
    await tx.producto.update({ where: { id }, data: { precioVenta: new Prisma.Decimal(precioTexto) } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CAMBIO_PRECIO", entidad: "Producto", entidadId: id, descripcion: actual.nombre, valorAnterior: { precio: actual.precioVenta }, valorNuevo: { precio: precioTexto, motivo } }, tx);
  });
  revalidar(id);
  return { ok: true, mensaje: "Precio actualizado." };
}

export async function alternarProducto(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("productos.editar");
  const id = texto(fd.get("id"));
  const campo = texto(fd.get("campo")) === "disponible" ? "disponible" : "activo";
  const actual = await db.producto.findUnique({ where: { id } });
  if (!actual) return { error: "Producto no encontrado" };
  const nuevo = !actual[campo];
  await db.$transaction(async (tx) => {
    await tx.producto.update({ where: { id }, data: { [campo]: nuevo } });
    await registrarAuditoria({ usuarioId: u.id, accion: nuevo ? "ACTIVAR" : "DESACTIVAR", entidad: "Producto", entidadId: id, descripcion: `${actual.nombre}: ${campo}` }, tx);
  });
  revalidar(id);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Ítems de receta
// ---------------------------------------------------------------------

export async function agregarItemReceta(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("recetas.editar");
  const productoId = texto(fd.get("productoId"));
  const producto = await db.producto.findUnique({ where: { id: productoId }, include: { receta: { include: { items: true } } } });
  if (!producto) return { error: "Producto no encontrado" };
  const item = await leerItemForm(fd);
  if ("error" in item) return { error: item.error };
  if (producto.receta?.items.some((i) => i.insumoId === item.insumo.id)) return { error: "Ese insumo ya está en la receta; edítalo en su fila." };

  await db.$transaction(async (tx) => {
    const antes = await snapshotReceta(tx, productoId);
    const receta = producto.receta ?? (await tx.receta.create({ data: { productoId } }));
    await tx.recetaItem.create({ data: { recetaId: receta.id, insumoId: item.insumo.id, cantidad: item.cantidad, unidadMedidaId: item.unidadMedidaId, unidadInsumoId: item.unidadInsumoId, orden: producto.receta?.items.length ?? 0 } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CAMBIO_RECETA", entidad: "Receta", entidadId: productoId, descripcion: `${producto.nombre}: + ${item.insumo.nombre}`, valorAnterior: antes, valorNuevo: await snapshotReceta(tx, productoId) }, tx);
    await recalcularCostos(u.id, `Receta ${producto.nombre}: + ${item.insumo.nombre}`, tx);
  });
  revalidar(productoId);
  return { ok: true };
}

export async function editarItemReceta(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("recetas.editar");
  const itemId = texto(fd.get("itemId"));
  const existente = await db.recetaItem.findUnique({ where: { id: itemId }, include: { receta: { include: { producto: true } } } });
  if (!existente) return { error: "Ítem no encontrado" };
  const item = await leerItemForm(fd);
  if ("error" in item) return { error: item.error };
  const notas = texto(fd.get("notas")) || null;
  const productoId = existente.receta.productoId;

  await db.$transaction(async (tx) => {
    const antes = await snapshotReceta(tx, productoId);
    await tx.recetaItem.update({ where: { id: itemId }, data: { cantidad: item.cantidad, unidadMedidaId: item.unidadMedidaId, unidadInsumoId: item.unidadInsumoId, notas } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CAMBIO_RECETA", entidad: "Receta", entidadId: productoId, descripcion: `${existente.receta.producto.nombre}: ${item.insumo.nombre}`, valorAnterior: antes, valorNuevo: await snapshotReceta(tx, productoId) }, tx);
    await recalcularCostos(u.id, `Receta ${existente.receta.producto.nombre}: ${item.insumo.nombre}`, tx);
  });
  revalidar(productoId);
  return { ok: true, mensaje: "Guardado." };
}

export async function quitarItemReceta(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("recetas.editar");
  const itemId = texto(fd.get("itemId"));
  const existente = await db.recetaItem.findUnique({ where: { id: itemId }, include: { receta: { include: { producto: true } }, insumo: true } });
  if (!existente) return { error: "Ítem no encontrado" };
  const productoId = existente.receta.productoId;
  await db.$transaction(async (tx) => {
    const antes = await snapshotReceta(tx, productoId);
    await tx.recetaItem.delete({ where: { id: itemId } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CAMBIO_RECETA", entidad: "Receta", entidadId: productoId, descripcion: `${existente.receta.producto.nombre}: − ${existente.insumo.nombre}`, valorAnterior: antes, valorNuevo: await snapshotReceta(tx, productoId) }, tx);
    await recalcularCostos(u.id, `Receta ${existente.receta.producto.nombre}: − ${existente.insumo.nombre}`, tx);
  });
  revalidar(productoId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Componentes base por categoría
// ---------------------------------------------------------------------

export async function agregarComponenteBase(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("recetas.editar");
  const categoriaId = texto(fd.get("categoriaId"));
  const cat = await db.categoriaProducto.findUnique({ where: { id: categoriaId } });
  if (!cat) return { error: "Categoría no encontrada" };
  const item = await leerItemForm(fd);
  if ("error" in item) return { error: item.error };
  await db.$transaction(async (tx) => {
    await tx.componenteBase.upsert({
      where: { categoriaId_insumoId: { categoriaId, insumoId: item.insumo.id } },
      create: { categoriaId, insumoId: item.insumo.id, cantidad: item.cantidad, unidadMedidaId: item.unidadMedidaId, unidadInsumoId: item.unidadInsumoId },
      update: { cantidad: item.cantidad, unidadMedidaId: item.unidadMedidaId, unidadInsumoId: item.unidadInsumoId },
    });
    await registrarAuditoria({ usuarioId: u.id, accion: "EDITAR", entidad: "ComponenteBase", entidadId: categoriaId, descripcion: `${cat.nombre}: ${item.insumo.nombre} ${item.cantidad ?? "pendiente"}` }, tx);
  });
  revalidatePath("/productos");
  return { ok: true, mensaje: "Guardado. Aplica a productos nuevos de la categoría; los existentes se editan en su ficha." };
}

export async function quitarComponenteBase(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("recetas.editar");
  const id = texto(fd.get("id"));
  const c = await db.componenteBase.findUnique({ where: { id }, include: { insumo: true, categoria: true } });
  if (!c) return { error: "No encontrado" };
  await db.$transaction(async (tx) => {
    await tx.componenteBase.delete({ where: { id } });
    await registrarAuditoria({ usuarioId: u.id, accion: "ELIMINAR", entidad: "ComponenteBase", entidadId: c.categoriaId, descripcion: `${c.categoria.nombre}: − ${c.insumo.nombre}` }, tx);
  });
  revalidatePath("/productos");
  return { ok: true };
}
