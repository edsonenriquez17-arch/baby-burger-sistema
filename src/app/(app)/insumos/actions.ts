"use server";

import { Prisma, type TipoInsumo } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requerirPermiso, requerirUsuario } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { registrarAuditoria } from "@/lib/auditoria";
import { registrarPrecioInsumo } from "@/lib/costeo/costeo";
import { recalcularCostos } from "@/lib/costeo/recalculo";
import type { Resultado } from "@/components/form-accion";

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const decimalOpcional = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .refine((s) => s === null || (Number.isFinite(Number(s)) && Number(s) >= 0), "Número inválido");

/** Ingredientes y empaques comparten acciones: basta uno de los dos permisos de edición. */
async function requerirEditar() {
  const u = await requerirUsuario();
  if (!u.permisos.has("insumos.editar") && !u.permisos.has("empaques.editar")) redirect("/sin-permiso");
  return u;
}

function rutaBase(tipo: TipoInsumo) {
  return tipo === "EMPAQUE" ? "/empaques" : "/insumos";
}

function revalidarTodo(tipo: TipoInsumo, id?: string) {
  revalidatePath(rutaBase(tipo));
  if (id) revalidatePath(`${rutaBase(tipo)}/${id}`);
  revalidatePath("/recetas");
  revalidatePath("/preparaciones");
  revalidatePath("/productos");
}

// ---------------------------------------------------------------------
// Insumo
// ---------------------------------------------------------------------

const esquemaInsumo = z.object({
  nombre: z.string().trim().min(2, "Nombre muy corto").max(80),
  tipo: z.enum(["INGREDIENTE", "EMPAQUE"]),
  categoriaId: z.string().optional().transform((v) => (v ? v : null)),
  unidadBaseId: z.string().min(1, "Elige la unidad base"),
  stockMinimo: decimalOpcional,
  observaciones: z.string().trim().max(500).optional().transform((v) => v || null),
  esCostoCompartido: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function crearInsumo(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirEditar();
  const parsed = esquemaInsumo.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  if (await db.insumo.findUnique({ where: { nombre: d.nombre } })) return { error: `Ya existe "${d.nombre}"` };

  const nuevo = await db.$transaction(async (tx) => {
    const i = await tx.insumo.create({ data: { ...d, tipo: d.tipo } });
    await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "Insumo", entidadId: i.id, valorNuevo: d }, tx);
    return i;
  });
  revalidarTodo(d.tipo);
  redirect(`${rutaBase(d.tipo)}/${nuevo.id}`);
}

export async function editarInsumo(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirEditar();
  const id = texto(fd.get("id"));
  const actual = await db.insumo.findUnique({ where: { id } });
  if (!actual) return { error: "Insumo no encontrado" };

  const parsed = esquemaInsumo.omit({ tipo: true }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  const duplicado = await db.insumo.findFirst({ where: { nombre: d.nombre, id: { not: id } } });
  if (duplicado) return { error: `Ya existe "${d.nombre}"` };

  const cambioUnidad = d.unidadBaseId !== actual.unidadBaseId;
  if (cambioUnidad) {
    const usos = await db.recetaItem.count({ where: { insumoId: id } }) + (await db.preparacionItem.count({ where: { insumoId: id } })) + (await db.precioInsumo.count({ where: { insumoId: id } }));
    if (usos > 0) return { error: "No se puede cambiar la unidad base: el insumo ya tiene precios o está en recetas. Crea otro insumo." };
  }

  await db.$transaction(async (tx) => {
    await tx.insumo.update({ where: { id }, data: d });
    await registrarAuditoria(
      {
        usuarioId: u.id,
        accion: "EDITAR",
        entidad: "Insumo",
        entidadId: id,
        valorAnterior: { nombre: actual.nombre, categoriaId: actual.categoriaId, stockMinimo: actual.stockMinimo, observaciones: actual.observaciones, esCostoCompartido: actual.esCostoCompartido },
        valorNuevo: d,
      },
      tx,
    );
  });
  revalidarTodo(actual.tipo, id);
  return { ok: true, mensaje: "Guardado." };
}

export async function alternarActivoInsumo(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirEditar();
  const id = texto(fd.get("id"));
  const actual = await db.insumo.findUnique({ where: { id } });
  if (!actual) return { error: "No encontrado" };
  await db.$transaction(async (tx) => {
    await tx.insumo.update({ where: { id }, data: { activo: !actual.activo } });
    await registrarAuditoria({ usuarioId: u.id, accion: actual.activo ? "DESACTIVAR" : "ACTIVAR", entidad: "Insumo", entidadId: id }, tx);
  });
  revalidarTodo(actual.tipo, id);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Unidades propias (slice, bola…)
// ---------------------------------------------------------------------

export async function guardarUnidadPropia(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirEditar();
  const insumoId = texto(fd.get("insumoId"));
  const unidadId = texto(fd.get("unidadId"));
  const nombre = texto(fd.get("nombre")).toLowerCase();
  const factor = decimalOpcional.safeParse(String(fd.get("factorABase") ?? ""));
  if (!nombre) return { error: "Nombre de la unidad requerido" };
  if (!factor.success) return { error: "Factor inválido" };

  const insumo = await db.insumo.findUnique({ where: { id: insumoId }, include: { unidadBase: true } });
  if (!insumo) return { error: "Insumo no encontrado" };

  await db.$transaction(async (tx) => {
    if (unidadId) {
      const previa = await tx.unidadInsumo.findUniqueOrThrow({ where: { id: unidadId } });
      await tx.unidadInsumo.update({ where: { id: unidadId }, data: { nombre, factorABase: factor.data } });
      await registrarAuditoria({ usuarioId: u.id, accion: "EDITAR", entidad: "UnidadInsumo", entidadId: unidadId, descripcion: `${insumo.nombre}: ${nombre}`, valorAnterior: { nombre: previa.nombre, factorABase: previa.factorABase }, valorNuevo: { nombre, factorABase: factor.data } }, tx);
    } else {
      const creada = await tx.unidadInsumo.create({ data: { insumoId, nombre, factorABase: factor.data } });
      await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "UnidadInsumo", entidadId: creada.id, descripcion: `${insumo.nombre}: ${nombre}`, valorNuevo: { nombre, factorABase: factor.data } }, tx);
    }
    await recalcularCostos(u.id, `Unidad "${nombre}" de ${insumo.nombre} = ${factor.data ?? "pendiente"} ${insumo.unidadBase.codigo}`, tx);
  });
  revalidarTodo(insumo.tipo, insumoId);
  return { ok: true, mensaje: "Unidad guardada." };
}

export async function desactivarUnidadPropia(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirEditar();
  const unidadId = texto(fd.get("unidadId"));
  const unidad = await db.unidadInsumo.findUnique({ where: { id: unidadId }, include: { insumo: true } });
  if (!unidad) return { error: "No encontrada" };
  const enUso = (await db.recetaItem.count({ where: { unidadInsumoId: unidadId } })) + (await db.preparacionItem.count({ where: { unidadInsumoId: unidadId } }));
  if (enUso > 0) return { error: `Está en uso en ${enUso} receta(s); cámbialas primero.` };
  await db.$transaction(async (tx) => {
    await tx.unidadInsumo.update({ where: { id: unidadId }, data: { activa: false } });
    await registrarAuditoria({ usuarioId: u.id, accion: "DESACTIVAR", entidad: "UnidadInsumo", entidadId: unidadId, descripcion: `${unidad.insumo.nombre}: ${unidad.nombre}` }, tx);
  });
  revalidarTodo(unidad.insumo.tipo, unidad.insumoId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Presentaciones
// ---------------------------------------------------------------------

async function idPorNombre(tx: Prisma.TransactionClient, tabla: "marca" | "proveedor", nombre: string) {
  if (!nombre) return null;
  if (tabla === "marca") return (await tx.marca.upsert({ where: { nombre }, update: {}, create: { nombre } })).id;
  return (await tx.proveedor.upsert({ where: { nombre }, update: {}, create: { nombre } })).id;
}

export async function crearPresentacion(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirEditar();
  const insumoId = texto(fd.get("insumoId"));
  const nombre = texto(fd.get("nombre"));
  const marca = texto(fd.get("marca"));
  const proveedor = texto(fd.get("proveedor"));
  const contenido = decimalOpcional.safeParse(String(fd.get("contenido") ?? ""));
  const unidadContenidoId = texto(fd.get("unidadContenidoId"));
  const unidadesPorPaquete = texto(fd.get("unidadesPorPaquete"));
  const precio = decimalOpcional.safeParse(String(fd.get("precio") ?? ""));
  const observaciones = texto(fd.get("observaciones")) || null;

  if (!nombre) return { error: "Nombre de la presentación requerido (ej. Bolsa 400 g)" };
  if (!contenido.success || !precio.success) return { error: "Contenido o precio inválido" };
  const insumo = await db.insumo.findUnique({ where: { id: insumoId }, include: { unidadBase: true } });
  if (!insumo) return { error: "Insumo no encontrado" };
  const um = await db.unidadMedida.findUnique({ where: { id: unidadContenidoId } });
  if (!um || um.tipo !== insumo.unidadBase.tipo) return { error: "La unidad del contenido no es compatible con la unidad base del insumo" };

  const hayPredeterminada = await db.presentacion.count({ where: { insumoId, esPredeterminada: true, activa: true } });

  await db.$transaction(async (tx) => {
    const pres = await tx.presentacion.create({
      data: {
        insumoId,
        nombre,
        marcaId: await idPorNombre(tx, "marca", marca),
        proveedorId: await idPorNombre(tx, "proveedor", proveedor),
        contenido: contenido.data,
        unidadContenidoId,
        unidadesPorPaquete: unidadesPorPaquete ? Number(unidadesPorPaquete) : null,
        esPredeterminada: hayPredeterminada === 0,
        observaciones,
      },
    });
    await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "Presentacion", entidadId: pres.id, descripcion: `${insumo.nombre}: ${nombre}`, valorNuevo: { nombre, marca, proveedor, contenido: contenido.data, unidad: um.codigo, precio: precio.data } }, tx);

    if (precio.data !== null && contenido.data !== null && Number(contenido.data) > 0) {
      const contenidoBase = new Prisma.Decimal(contenido.data).mul(um.factorABase);
      await registrarPrecioInsumo(tx, {
        insumoId,
        presentacionId: pres.id,
        precioPresentacion: new Prisma.Decimal(precio.data),
        costoUnitarioBase: new Prisma.Decimal(precio.data).div(contenidoBase),
        origen: "MANUAL",
        usuarioId: u.id,
        nota: "Precio ingresado al crear la presentación",
      });
      await recalcularCostos(u.id, `Nuevo precio ${insumo.nombre} (${nombre})`, tx);
    }
  });
  revalidarTodo(insumo.tipo, insumoId);
  return { ok: true, mensaje: "Presentación creada." };
}

export async function marcarPredeterminada(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirEditar();
  const presentacionId = texto(fd.get("presentacionId"));
  const pres = await db.presentacion.findUnique({ where: { id: presentacionId }, include: { insumo: true } });
  if (!pres) return { error: "No encontrada" };
  await db.$transaction(async (tx) => {
    await tx.presentacion.updateMany({ where: { insumoId: pres.insumoId }, data: { esPredeterminada: false } });
    await tx.presentacion.update({ where: { id: presentacionId }, data: { esPredeterminada: true } });
    await registrarAuditoria({ usuarioId: u.id, accion: "EDITAR", entidad: "Presentacion", entidadId: presentacionId, descripcion: `${pres.insumo.nombre}: predeterminada → ${pres.nombre}` }, tx);
    await recalcularCostos(u.id, `${pres.insumo.nombre}: presentación predeterminada cambiada a ${pres.nombre}`, tx);
  });
  revalidarTodo(pres.insumo.tipo, pres.insumoId);
  return { ok: true };
}

export async function desactivarPresentacion(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirEditar();
  const presentacionId = texto(fd.get("presentacionId"));
  const pres = await db.presentacion.findUnique({ where: { id: presentacionId }, include: { insumo: true } });
  if (!pres) return { error: "No encontrada" };
  await db.$transaction(async (tx) => {
    await tx.presentacion.update({ where: { id: presentacionId }, data: { activa: false, esPredeterminada: false } });
    await registrarAuditoria({ usuarioId: u.id, accion: "DESACTIVAR", entidad: "Presentacion", entidadId: presentacionId, descripcion: `${pres.insumo.nombre}: ${pres.nombre}` }, tx);
    await recalcularCostos(u.id, `${pres.insumo.nombre}: presentación ${pres.nombre} desactivada`, tx);
  });
  revalidarTodo(pres.insumo.tipo, pres.insumoId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Precio manual (sin compra)
// ---------------------------------------------------------------------

export async function registrarPrecioManual(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("insumos.precios");
  const presentacionId = texto(fd.get("presentacionId"));
  const precioTexto = texto(fd.get("precio"));
  const nota = texto(fd.get("nota")) || undefined;
  const precio = Number(precioTexto);
  if (!Number.isFinite(precio) || precio <= 0) return { error: "Precio inválido" };

  const pres = await db.presentacion.findUnique({ where: { id: presentacionId }, include: { insumo: true, unidadContenido: true } });
  if (!pres) return { error: "Presentación no encontrada" };
  if (pres.contenido === null || pres.contenido.lte(0)) return { error: "Primero define el contenido de la presentación (cuánto trae)." };

  const contenidoBase = pres.contenido.mul(pres.unidadContenido.factorABase);
  const costoBase = new Prisma.Decimal(precioTexto).div(contenidoBase);

  await db.$transaction(async (tx) => {
    const anterior = await tx.precioInsumo.findFirst({ where: { presentacionId, vigenteHasta: null } });
    const nuevo = await registrarPrecioInsumo(tx, { insumoId: pres.insumoId, presentacionId, precioPresentacion: new Prisma.Decimal(precioTexto), costoUnitarioBase: costoBase, origen: "MANUAL", usuarioId: u.id, nota });
    await registrarAuditoria(
      { usuarioId: u.id, accion: "CAMBIO_PRECIO", entidad: "Insumo", entidadId: pres.insumoId, descripcion: `${pres.insumo.nombre} — ${pres.nombre}`, valorAnterior: anterior ? { precio: anterior.precioPresentacion, costoBase: anterior.costoUnitarioBase } : null, valorNuevo: { precio: precioTexto, costoBase: nuevo.costoUnitarioBase } },
      tx,
    );
    await recalcularCostos(u.id, `${pres.insumo.nombre}: ${anterior?.precioPresentacion ? `S/${anterior.precioPresentacion} → ` : ""}S/${precioTexto} (${pres.nombre})`, tx);
  });
  revalidarTodo(pres.insumo.tipo, pres.insumoId);
  return { ok: true, mensaje: "Precio registrado. Recetas actualizadas hacia adelante." };
}
