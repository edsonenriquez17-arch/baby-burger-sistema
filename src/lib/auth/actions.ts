"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { crearSesion, destruirSesion, obtenerUsuarioActual } from "./session";

const esquemaLogin = z.object({
  usuario: z.string().trim().min(1, "Ingresa tu usuario").toLowerCase(),
  pin: z.string().min(4, "El PIN tiene mínimo 4 dígitos").max(32),
});

export type EstadoLogin = { error?: string };

export async function iniciarSesion(_prev: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const parsed = esquemaLogin.safeParse({
    usuario: formData.get("usuario"),
    pin: formData.get("pin"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { usuario, pin } = parsed.data;

  const u = await db.usuario.findUnique({ where: { usuario } });
  const ok = u ? await bcrypt.compare(pin, u.pinHash) : false;

  if (!u || !ok || !u.activo) {
    await registrarAuditoria({
      usuarioId: u?.id,
      accion: "LOGIN_FALLIDO",
      entidad: "Usuario",
      entidadId: u?.id,
      descripcion: `Intento de ingreso fallido para "${usuario}"`,
    });
    return { error: "Usuario o PIN incorrecto" };
  }

  await crearSesion({ sub: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol });
  await registrarAuditoria({ usuarioId: u.id, accion: "LOGIN", entidad: "Usuario", entidadId: u.id });
  redirect("/");
}

export async function cerrarSesion() {
  const u = await obtenerUsuarioActual();
  await destruirSesion();
  if (u) {
    await registrarAuditoria({ usuarioId: u.id, accion: "LOGIN", entidad: "Usuario", entidadId: u.id, descripcion: "Cierre de sesión" });
  }
  redirect("/login");
}
