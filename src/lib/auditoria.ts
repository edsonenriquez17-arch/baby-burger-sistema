import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Cliente = Prisma.TransactionClient | typeof db;

export type AccionAuditoria =
  | "CREAR"
  | "EDITAR"
  | "DESACTIVAR"
  | "ACTIVAR"
  | "ANULAR"
  | "CAMBIO_PRECIO"
  | "CAMBIO_RECETA"
  | "AJUSTE_INVENTARIO"
  | "LOGIN"
  | "LOGIN_FALLIDO"
  | "CAMBIO_PIN"
  | "CAMBIO_CONFIG";

/**
 * Registra una acción sensible con valor anterior y nuevo.
 * Usar `tx` cuando la acción ocurre dentro de una transacción,
 * para que el log se guarde junto con el cambio (o ninguno de los dos).
 */
export async function registrarAuditoria(
  datos: {
    usuarioId?: string | null;
    accion: AccionAuditoria;
    entidad: string;
    entidadId?: string | null;
    descripcion?: string;
    valorAnterior?: unknown;
    valorNuevo?: unknown;
  },
  tx: Cliente = db,
) {
  await tx.logAuditoria.create({
    data: {
      usuarioId: datos.usuarioId ?? null,
      accion: datos.accion,
      entidad: datos.entidad,
      entidadId: datos.entidadId ?? null,
      descripcion: datos.descripcion,
      valorAnterior: aJson(datos.valorAnterior),
      valorNuevo: aJson(datos.valorNuevo),
    },
  });
}

function aJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  // Decimal, Date, etc. se serializan a string para que el JSON sea estable.
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}
