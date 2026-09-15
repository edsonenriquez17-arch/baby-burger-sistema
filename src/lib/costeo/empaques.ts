import "server-only";
import type { Prisma, TipoServicio } from "@prisma/client";
import { db } from "@/lib/db";
import { D, type CostoVigente, type Dec } from "./costeo";

type Cliente = Prisma.TransactionClient | typeof db;

export type Regla = {
  id: string;
  tipoServicio: TipoServicio;
  insumoId: string;
  cantidad: Dec;
  alcance: "POR_PEDIDO" | "POR_ITEM";
  categoriaId: string | null;
  productoId: string | null;
  insumo: { nombre: string; unidadBase: { codigo: string } };
};

export const TIPOS_SERVICIO: { valor: TipoServicio; etiqueta: string }[] = [
  { valor: "MESA", etiqueta: "Mesa" },
  { valor: "BARRA", etiqueta: "Barra" },
  { valor: "LLEVAR", etiqueta: "Para llevar" },
  { valor: "DELIVERY", etiqueta: "Delivery" },
];

export async function obtenerReglasEmpaque(tx: Cliente = db): Promise<Regla[]> {
  return tx.reglaEmpaque.findMany({
    where: { activa: true, insumo: { activo: true } },
    include: { insumo: { select: { nombre: true, unidadBase: { select: { codigo: true } } } } },
    orderBy: [{ tipoServicio: "asc" }, { alcance: "asc" }],
  });
}

/** Empaques que van por cada unidad de un producto en un canal (caja por hamburguesa, etc.). */
export function empaquesPorItem(reglas: Regla[], tipoServicio: TipoServicio, producto: { id: string; categoriaId: string }) {
  return reglas.filter(
    (r) =>
      r.tipoServicio === tipoServicio &&
      r.alcance === "POR_ITEM" &&
      (r.productoId ? r.productoId === producto.id : r.categoriaId ? r.categoriaId === producto.categoriaId : true),
  );
}

/** Empaques que van una vez por pedido en un canal (envases de salsa, bolsa, servilletas…). */
export function empaquesPorPedido(reglas: Regla[], tipoServicio: TipoServicio) {
  return reglas.filter((r) => r.tipoServicio === tipoServicio && r.alcance === "POR_PEDIDO");
}

export type LineaEmpaque = { insumoId: string; nombre: string; cantidad: Dec; costoUnitario: Dec | null; costoTotal: Dec | null };

export function costearReglas(reglas: Regla[], costos: Map<string, CostoVigente>): { lineas: LineaEmpaque[]; total: Dec; completo: boolean } {
  let total = new D(0);
  let completo = true;
  const lineas = reglas.map((r) => {
    const cu = costos.get(r.insumoId)?.costo ?? null;
    const ct = cu ? cu.mul(r.cantidad) : null;
    if (ct) total = total.add(ct);
    else completo = false;
    return { insumoId: r.insumoId, nombre: r.insumo.nombre, cantidad: r.cantidad, costoUnitario: cu, costoTotal: ct };
  });
  return { lineas, total, completo };
}

export async function canalPredeterminado(tx: Cliente = db): Promise<TipoServicio> {
  const c = await tx.configuracion.findUnique({ where: { clave: "pos.canal_predeterminado" } });
  const v = c?.valor as TipoServicio | undefined;
  return v && TIPOS_SERVICIO.some((t) => t.valor === v) ? v : "LLEVAR";
}
