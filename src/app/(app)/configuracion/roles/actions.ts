"use server";

import type { Rol } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import type { Resultado } from "@/components/form-accion";

const ROLES: Rol[] = ["ADMIN", "CAJA", "COCINA"];

/** Activa o quita un permiso base de un rol. Aplica a todos los usuarios del rol (salvo excepciones por persona). */
export async function alternarPermisoRol(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("usuarios.administrar");
  const rol = String(fd.get("rol")) as Rol;
  const permisoId = String(fd.get("permisoId"));
  if (!ROLES.includes(rol)) return { error: "Rol inválido" };
  const permiso = await db.permiso.findUnique({ where: { id: permisoId } });
  if (!permiso) return { error: "Permiso no encontrado" };
  if (rol === "ADMIN" && permiso.clave === "usuarios.administrar") return { error: "El administrador siempre puede administrar usuarios." };

  await db.$transaction(async (tx) => {
    const existente = await tx.rolPermiso.findUnique({ where: { rol_permisoId: { rol, permisoId } } });
    if (existente) await tx.rolPermiso.delete({ where: { id: existente.id } });
    else await tx.rolPermiso.create({ data: { rol, permisoId } });
    await registrarAuditoria({ usuarioId: u.id, accion: "EDITAR", entidad: "RolPermiso", entidadId: rol, descripcion: `${rol}: ${existente ? "−" : "+"} ${permiso.clave}` }, tx);
  });
  revalidatePath("/configuracion/roles");
  revalidatePath("/configuracion/usuarios");
  return { ok: true };
}
