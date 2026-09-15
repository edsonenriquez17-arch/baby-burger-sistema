import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Rol } from "@prisma/client";
import { db } from "@/lib/db";
import type { ClavePermiso } from "./permisos";

export const COOKIE_SESION = "bb_sesion";
const DURACION_SESION_HORAS = 12;

function secreto() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("Falta SESSION_SECRET en .env (mínimo 16 caracteres)");
  }
  return new TextEncoder().encode(s);
}

export type SesionPayload = { sub: string; usuario: string; nombre: string; rol: Rol };

export async function crearSesion(payload: SesionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_HORAS}h`)
    .sign(secreto());

  const store = await cookies();
  store.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_SESION_HORAS * 60 * 60,
  });
}

export async function destruirSesion() {
  const store = await cookies();
  store.delete(COOKIE_SESION);
}

export async function verificarToken(token: string): Promise<SesionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secreto());
    return payload as unknown as SesionPayload;
  } catch {
    return null;
  }
}

export type UsuarioActual = {
  id: string;
  nombre: string;
  usuario: string;
  rol: Rol;
  permisos: Set<ClavePermiso>;
};

/**
 * Usuario de la sesión actual con sus permisos efectivos
 * (permisos del rol + excepciones del usuario). Cacheado por request.
 */
export const obtenerUsuarioActual = cache(async (): Promise<UsuarioActual | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_SESION)?.value;
  if (!token) return null;
  const payload = await verificarToken(token);
  if (!payload) return null;

  const usuario = await db.usuario.findUnique({
    where: { id: payload.sub },
    include: { permisos: { include: { permiso: true } } },
  });
  if (!usuario || !usuario.activo) return null;

  const delRol = await db.rolPermiso.findMany({
    where: { rol: usuario.rol },
    include: { permiso: true },
  });

  const permisos = new Set<ClavePermiso>(delRol.map((r) => r.permiso.clave as ClavePermiso));
  for (const up of usuario.permisos) {
    const clave = up.permiso.clave as ClavePermiso;
    if (up.concedido) permisos.add(clave);
    else permisos.delete(clave);
  }

  return { id: usuario.id, nombre: usuario.nombre, usuario: usuario.usuario, rol: usuario.rol, permisos };
});

/** Exige sesión activa; redirige a /login si no la hay. */
export async function requerirUsuario(): Promise<UsuarioActual> {
  const u = await obtenerUsuarioActual();
  if (!u) redirect("/login");
  return u;
}

/** Exige un permiso; redirige a /sin-permiso si el usuario no lo tiene. */
export async function requerirPermiso(clave: ClavePermiso): Promise<UsuarioActual> {
  const u = await requerirUsuario();
  if (!u.permisos.has(clave)) redirect("/sin-permiso");
  return u;
}
