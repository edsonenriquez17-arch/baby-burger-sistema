import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type Dec = Prisma.Decimal;
export const D = Prisma.Decimal;
type Cliente = Prisma.TransactionClient | typeof db;

// ---------------------------------------------------------------------
// Costo vigente por insumo
// ---------------------------------------------------------------------

export type CostoVigente = {
  costo: Dec; // S/ por unidad base
  precioId: string;
  presentacionId: string | null;
  vigenteDesde: Date;
};

/**
 * Regla acordada: el costo vigente de un insumo es el precio vigente de su
 * presentación predeterminada; si no tiene, el precio vigente más reciente.
 */
export async function obtenerCostosVigentes(tx: Cliente = db, insumoIds?: string[]): Promise<Map<string, CostoVigente>> {
  const precios = await tx.precioInsumo.findMany({
    where: { vigenteHasta: null, ...(insumoIds ? { insumoId: { in: insumoIds } } : {}) },
    include: { presentacion: { select: { esPredeterminada: true, activa: true } } },
    orderBy: { vigenteDesde: "desc" },
  });

  const mapa = new Map<string, CostoVigente>();
  const conPredeterminada = new Set<string>();
  for (const p of precios) {
    const esPred = p.presentacion?.esPredeterminada === true && p.presentacion.activa;
    if (esPred && !conPredeterminada.has(p.insumoId)) {
      conPredeterminada.add(p.insumoId);
      mapa.set(p.insumoId, { costo: p.costoUnitarioBase, precioId: p.id, presentacionId: p.presentacionId, vigenteDesde: p.vigenteDesde });
    } else if (!mapa.has(p.insumoId)) {
      mapa.set(p.insumoId, { costo: p.costoUnitarioBase, precioId: p.id, presentacionId: p.presentacionId, vigenteDesde: p.vigenteDesde });
    }
  }
  return mapa;
}

/** Registra un precio nuevo cerrando el vigente de la misma presentación. Nunca borra. */
export async function registrarPrecioInsumo(
  tx: Cliente,
  datos: {
    insumoId: string;
    presentacionId: string | null;
    costoUnitarioBase: Dec;
    precioPresentacion?: Dec | null;
    origen: "COMPRA" | "MANUAL" | "PREPARACION" | "INICIAL";
    compraItemId?: string | null;
    usuarioId?: string | null;
    nota?: string;
  },
) {
  const ahora = new Date();
  await tx.precioInsumo.updateMany({
    where: { insumoId: datos.insumoId, presentacionId: datos.presentacionId, vigenteHasta: null },
    data: { vigenteHasta: ahora },
  });
  return tx.precioInsumo.create({
    data: {
      insumoId: datos.insumoId,
      presentacionId: datos.presentacionId,
      costoUnitarioBase: datos.costoUnitarioBase,
      precioPresentacion: datos.precioPresentacion ?? null,
      origen: datos.origen,
      compraItemId: datos.compraItemId ?? null,
      usuarioId: datos.usuarioId ?? null,
      nota: datos.nota,
      vigenteDesde: ahora,
    },
  });
}

// ---------------------------------------------------------------------
// Conversión de cantidades a unidad base
// ---------------------------------------------------------------------

export type ItemCosteable = {
  insumoId: string;
  cantidad: Dec | null;
  unidadMedida: { codigo: string; factorABase: Dec } | null;
  unidadInsumo: { nombre: string; factorABase: Dec | null } | null;
  insumo: { nombre: string; tipo: string; unidadBase: { codigo: string } };
  notas?: string | null;
};

export type Pendiente = "cantidad" | "factor" | "precio" | null;

export type LineaCosto = {
  insumoId: string;
  nombre: string;
  tipo: string;
  cantidadTexto: string; // "2 slice", "80 g"
  cantidadBase: Dec | null;
  unidadBase: string;
  costoUnitario: Dec | null;
  costoTotal: Dec | null;
  pendiente: Pendiente;
  notas?: string | null;
};

/** Cantidad del ítem en unidad base del insumo, o null si falta cantidad o factor. */
export function cantidadBase(item: ItemCosteable): { valor: Dec | null; pendiente: Pendiente } {
  if (item.cantidad === null) return { valor: null, pendiente: "cantidad" };
  if (item.unidadInsumo) {
    if (item.unidadInsumo.factorABase === null) return { valor: null, pendiente: "factor" };
    return { valor: item.cantidad.mul(item.unidadInsumo.factorABase), pendiente: null };
  }
  const factor = item.unidadMedida?.factorABase ?? new D(1);
  return { valor: item.cantidad.mul(factor), pendiente: null };
}

export function costearItems(items: ItemCosteable[], costos: Map<string, CostoVigente>) {
  let total = new D(0);
  let completo = true;
  const lineas: LineaCosto[] = items.map((it) => {
    const { valor, pendiente } = cantidadBase(it);
    const costoUnit = costos.get(it.insumoId)?.costo ?? null;
    const unidadTexto = it.unidadInsumo?.nombre ?? it.unidadMedida?.codigo ?? it.insumo.unidadBase.codigo;
    let pend: Pendiente = pendiente;
    let costoTotal: Dec | null = null;
    if (!pend && costoUnit === null) pend = "precio";
    if (!pend && valor && costoUnit) {
      costoTotal = valor.mul(costoUnit);
      total = total.add(costoTotal);
    }
    if (pend) completo = false;
    return {
      insumoId: it.insumoId,
      nombre: it.insumo.nombre,
      tipo: it.insumo.tipo,
      cantidadTexto: it.cantidad === null ? "pendiente" : `${it.cantidad.toString()} ${unidadTexto}`,
      cantidadBase: valor,
      unidadBase: it.insumo.unidadBase.codigo,
      costoUnitario: costoUnit,
      costoTotal,
      pendiente: pend,
      notas: it.notas,
    };
  });
  return { lineas, total, completo };
}

export const INCLUDE_ITEM_COSTEABLE = {
  insumo: { select: { nombre: true, tipo: true, unidadBase: { select: { codigo: true } } } },
  unidadMedida: { select: { codigo: true, factorABase: true } },
  unidadInsumo: { select: { nombre: true, factorABase: true } },
} satisfies Prisma.RecetaItemInclude;

// ---------------------------------------------------------------------
// Métricas de rentabilidad
// ---------------------------------------------------------------------

export type Metricas = {
  ganancia: Dec | null;
  margenPct: Dec | null; // ganancia / precio
  markupPct: Dec | null; // ganancia / costo
  precioRecomendado: Dec | null; // costo / (1 - objetivo)
  alerta: boolean; // margen por debajo del mínimo configurado
};

export function calcularMetricas(precio: Dec, costo: Dec | null, objetivoPct: number, alertaPct: number): Metricas {
  if (costo === null) return { ganancia: null, margenPct: null, markupPct: null, precioRecomendado: null, alerta: false };
  const ganancia = precio.sub(costo);
  const margenPct = precio.gt(0) ? ganancia.div(precio).mul(100) : null;
  const markupPct = costo.gt(0) ? ganancia.div(costo).mul(100) : null;
  const objetivo = new D(objetivoPct).div(100);
  const precioRecomendado = objetivo.lt(1) ? costo.div(new D(1).sub(objetivo)) : null;
  const alerta = margenPct !== null && margenPct.lt(alertaPct);
  return { ganancia, margenPct, markupPct, precioRecomendado, alerta };
}

export async function obtenerParametrosMargen(tx: Cliente = db) {
  const filas = await tx.configuracion.findMany({ where: { clave: { in: ["margen.objetivo", "margen.alerta"] } } });
  const leer = (clave: string, porDefecto: number) => {
    const v = Number(filas.find((f) => f.clave === clave)?.valor);
    return Number.isFinite(v) ? v : porDefecto;
  };
  return { objetivo: leer("margen.objetivo", 60), alerta: leer("margen.alerta", 40) };
}

/** Estadísticas del historial de precios de un insumo (por unidad base). */
export function estadisticasPrecios(precios: { costoUnitarioBase: Dec; vigenteDesde: Date; vigenteHasta: Date | null }[]) {
  if (precios.length === 0) return null;
  const orden = [...precios].sort((a, b) => b.vigenteDesde.getTime() - a.vigenteDesde.getTime());
  const valores = orden.map((p) => p.costoUnitarioBase);
  const suma = valores.reduce((a, b) => a.add(b), new D(0));
  return {
    actual: valores[0],
    anterior: valores[1] ?? null,
    minimo: valores.reduce((a, b) => (b.lt(a) ? b : a)),
    maximo: valores.reduce((a, b) => (b.gt(a) ? b : a)),
    promedio: suma.div(valores.length),
    cambios: valores.length,
  };
}
