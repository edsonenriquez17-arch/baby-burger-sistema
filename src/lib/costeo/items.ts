import "server-only";
import { Prisma, type TipoInsumo } from "@prisma/client";
import { db } from "@/lib/db";
import type { InsumoOpcion, UnidadOpcion } from "@/components/selector-item";

/** Opciones para <SelectorItem>. `excluirInsumoId` evita que una preparación se use a sí misma. */
export async function opcionesSelector(opts: { tipos?: TipoInsumo[]; excluirInsumoId?: string } = {}) {
  const [insumos, unidades] = await Promise.all([
    db.insumo.findMany({
      where: { activo: true, ...(opts.tipos ? { tipo: { in: opts.tipos } } : {}), ...(opts.excluirInsumoId ? { id: { not: opts.excluirInsumoId } } : {}) },
      include: { unidadBase: true, unidadesPropias: { where: { activa: true } } },
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
    }),
    db.unidadMedida.findMany({ where: { activa: true }, orderBy: { factorABase: "asc" } }),
  ]);
  const insumosOpc: InsumoOpcion[] = insumos.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    tipo: i.tipo,
    tipoUnidad: i.unidadBase.tipo,
    unidadBase: i.unidadBase.codigo,
    unidadesPropias: i.unidadesPropias.map((u) => ({ id: u.id, nombre: u.nombre, pendiente: u.factorABase === null })),
  }));
  const unidadesOpc: UnidadOpcion[] = unidades.map((u) => ({ id: u.id, codigo: u.codigo, tipo: u.tipo }));
  return { insumos: insumosOpc, unidades: unidadesOpc };
}

/** Valor inicial del selector para un ítem existente. */
export function valorSelector(item: { insumoId: string; cantidad: Prisma.Decimal | null; unidadMedidaId: string | null; unidadInsumoId: string | null }) {
  return {
    insumoId: item.insumoId,
    cantidad: item.cantidad?.toString() ?? "",
    unidad: item.unidadInsumoId ? `ui:${item.unidadInsumoId}` : `um:${item.unidadMedidaId ?? ""}`,
  };
}

/** Lee insumoId / cantidad / unidad del FormData y valida contra la BD. */
export async function leerItemForm(formData: FormData) {
  const insumoId = String(formData.get("insumoId") ?? "");
  const cantidadTexto = String(formData.get("cantidad") ?? "").trim();
  const unidad = String(formData.get("unidad") ?? "");

  const insumo = await db.insumo.findUnique({ where: { id: insumoId }, include: { unidadBase: true } });
  if (!insumo) return { error: "Insumo no encontrado" } as const;

  let cantidad: Prisma.Decimal | null = null;
  if (cantidadTexto !== "") {
    const n = Number(cantidadTexto);
    if (!Number.isFinite(n) || n < 0) return { error: "Cantidad inválida" } as const;
    cantidad = new Prisma.Decimal(cantidadTexto);
  }

  let unidadMedidaId: string | null = null;
  let unidadInsumoId: string | null = null;
  if (unidad.startsWith("ui:")) {
    const ui = await db.unidadInsumo.findUnique({ where: { id: unidad.slice(3) } });
    if (!ui || ui.insumoId !== insumo.id) return { error: "Unidad propia inválida" } as const;
    unidadInsumoId = ui.id;
  } else {
    const um = await db.unidadMedida.findUnique({ where: { id: unidad.slice(3) } });
    if (!um || um.tipo !== insumo.unidadBase.tipo) return { error: "Unidad incompatible con el insumo" } as const;
    unidadMedidaId = um.id;
  }
  return { insumo, cantidad, unidadMedidaId, unidadInsumoId } as const;
}
