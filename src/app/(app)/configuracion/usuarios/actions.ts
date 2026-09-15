"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";

export type Resultado = { ok?: boolean; error?: string };

const RUTA = "/configuracion/usuarios";
const pin = z.string().regex(/^\d{4,8}$/, "El PIN debe tener entre 4 y 8 dígitos");

const esquemaCrear = z.object({
  nombre: z.string().trim().min(2, "Nombre muy corto").max(60),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,20}$/, "Usuario: 3-20 letras minúsculas, números, punto o guión"),
  pin,
  rol: z.enum(["ADMIN", "CAJA", "COCINA"]),
});

export async function crearUsuario(_prev: Resultado, formData: FormData): Promise<Resultado> {
  const admin = await requerirPermiso("usuarios.administrar");
  const parsed = esquemaCrear.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { nombre, usuario, pin, rol } = parsed.data;

  if (await db.usuario.findUnique({ where: { usuario } })) {
    return { error: `Ya existe un usuario "${usuario}"` };
  }

  await db.$transaction(async (tx) => {
    const nuevo = await tx.usuario.create({
      data: { nombre, usuario, rol, pinHash: await bcrypt.hash(pin, 10) },
    });
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "CREAR",
        entidad: "Usuario",
        entidadId: nuevo.id,
        valorNuevo: { nombre, usuario, rol },
      },
      tx,
    );
  });

  revalidatePath(RUTA);
  return { ok: true };
}

export async function cambiarRol(usuarioId: string, rol: "ADMIN" | "CAJA" | "COCINA"): Promise<Resultado> {
  const admin = await requerirPermiso("usuarios.administrar");
  const actual = await db.usuario.findUnique({ where: { id: usuarioId } });
  if (!actual) return { error: "Usuario no encontrado" };
  if (actual.id === admin.id && rol !== "ADMIN") return { error: "No puedes quitarte el rol de administrador a ti mismo" };
  if (actual.rol === rol) return { ok: true };

  await db.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: usuarioId }, data: { rol } });
    await registrarAuditoria(
      { usuarioId: admin.id, accion: "EDITAR", entidad: "Usuario", entidadId: usuarioId, descripcion: "Cambio de rol", valorAnterior: { rol: actual.rol }, valorNuevo: { rol } },
      tx,
    );
  });
  revalidatePath(RUTA);
  return { ok: true };
}

export async function cambiarActivo(usuarioId: string, activo: boolean): Promise<Resultado> {
  const admin = await requerirPermiso("usuarios.administrar");
  if (usuarioId === admin.id && !activo) return { error: "No puedes desactivar tu propio usuario" };
  const actual = await db.usuario.findUnique({ where: { id: usuarioId } });
  if (!actual) return { error: "Usuario no encontrado" };

  await db.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: usuarioId }, data: { activo } });
    await registrarAuditoria(
      { usuarioId: admin.id, accion: activo ? "ACTIVAR" : "DESACTIVAR", entidad: "Usuario", entidadId: usuarioId, valorAnterior: { activo: actual.activo }, valorNuevo: { activo } },
      tx,
    );
  });
  revalidatePath(RUTA);
  return { ok: true };
}

export async function cambiarPin(_prev: Resultado, formData: FormData): Promise<Resultado> {
  const admin = await requerirPermiso("usuarios.administrar");
  const parsed = z.object({ usuarioId: z.string().min(1), pin }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { usuarioId, pin: nuevoPin } = parsed.data;

  await db.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: usuarioId }, data: { pinHash: await bcrypt.hash(nuevoPin, 10) } });
    await registrarAuditoria(
      { usuarioId: admin.id, accion: "CAMBIO_PIN", entidad: "Usuario", entidadId: usuarioId, descripcion: "PIN restablecido por administrador" },
      tx,
    );
  });
  revalidatePath(RUTA);
  return { ok: true };
}

/** Concede o quita un permiso puntual a un usuario (excepción sobre su rol). */
export async function alternarPermiso(usuarioId: string, permisoClave: string, concedido: boolean | null): Promise<Resultado> {
  const admin = await requerirPermiso("usuarios.administrar");
  const permiso = await db.permiso.findUnique({ where: { clave: permisoClave } });
  if (!permiso) return { error: "Permiso no encontrado" };

  await db.$transaction(async (tx) => {
    const previo = await tx.usuarioPermiso.findUnique({ where: { usuarioId_permisoId: { usuarioId, permisoId: permiso.id } } });
    if (concedido === null) {
      if (previo) await tx.usuarioPermiso.delete({ where: { id: previo.id } });
    } else {
      await tx.usuarioPermiso.upsert({
        where: { usuarioId_permisoId: { usuarioId, permisoId: permiso.id } },
        create: { usuarioId, permisoId: permiso.id, concedido },
        update: { concedido },
      });
    }
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "EDITAR",
        entidad: "UsuarioPermiso",
        entidadId: usuarioId,
        descripcion: `Permiso ${permisoClave}`,
        valorAnterior: { excepcion: previo?.concedido ?? null },
        valorNuevo: { excepcion: concedido },
      },
      tx,
    );
  });
  revalidatePath(RUTA);
  return { ok: true };
}
