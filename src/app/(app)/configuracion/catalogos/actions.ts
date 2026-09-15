"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import type { Resultado } from "@/components/form-accion";
import { CATALOGOS, type ClaveCatalogo } from "./catalogos";

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const RUTA = "/configuracion/catalogos";



function leerExtra(clave: ClaveCatalogo, fd: FormData): Record<string, unknown> {
  const def = CATALOGOS[clave].extra;
  if (!def) return {};
  const v = fd.get(def.campo);
  if (def.tipo === "checkbox") return { [def.campo]: v === "on" || v === "true" };
  const t = texto(v);
  return { [def.campo]: t === "" ? null : t };
}

// Prisma no permite indexar el cliente dinámicamente con tipos estrictos; se hace un cast controlado.
function modelo(clave: ClaveCatalogo) {
  return db[clave] as unknown as {
    findUnique(a: { where: { id?: string; nombre?: string } }): Promise<Record<string, unknown> | null>;
    create(a: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(a: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
}

export async function crearEnCatalogo(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("configuracion.editar");
  const clave = texto(fd.get("catalogo")) as ClaveCatalogo;
  if (!(clave in CATALOGOS)) return { error: "Catálogo inválido" };
  const nombre = texto(fd.get("nombre"));
  if (nombre.length < 2) return { error: "Nombre muy corto" };
  if (await modelo(clave).findUnique({ where: { nombre } })) return { error: `Ya existe "${nombre}"` };
  const data = { nombre, ...leerExtra(clave, fd) };
  const creado = await modelo(clave).create({ data });
  await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: clave, entidadId: creado.id, valorNuevo: data });
  revalidatePath(RUTA);
  return { ok: true };
}

export async function editarEnCatalogo(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("configuracion.editar");
  const clave = texto(fd.get("catalogo")) as ClaveCatalogo;
  const id = texto(fd.get("id"));
  if (!(clave in CATALOGOS)) return { error: "Catálogo inválido" };
  const actual = await modelo(clave).findUnique({ where: { id } });
  if (!actual) return { error: "No encontrado" };
  const nombre = texto(fd.get("nombre"));
  if (nombre.length < 2) return { error: "Nombre muy corto" };
  const data = { nombre, ...leerExtra(clave, fd) };
  await modelo(clave).update({ where: { id }, data });
  await registrarAuditoria({ usuarioId: u.id, accion: "EDITAR", entidad: clave, entidadId: id, valorAnterior: actual, valorNuevo: data });
  revalidatePath(RUTA);
  return { ok: true, mensaje: "Guardado." };
}

export async function alternarEnCatalogo(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("configuracion.editar");
  const clave = texto(fd.get("catalogo")) as ClaveCatalogo;
  const id = texto(fd.get("id"));
  if (!(clave in CATALOGOS)) return { error: "Catálogo inválido" };
  const campo = CATALOGOS[clave].activo;
  const actual = await modelo(clave).findUnique({ where: { id } });
  if (!actual) return { error: "No encontrado" };
  const nuevo = !actual[campo];
  await modelo(clave).update({ where: { id }, data: { [campo]: nuevo } });
  await registrarAuditoria({ usuarioId: u.id, accion: nuevo ? "ACTIVAR" : "DESACTIVAR", entidad: clave, entidadId: id, descripcion: String(actual.nombre) });
  revalidatePath(RUTA);
  return { ok: true };
}
