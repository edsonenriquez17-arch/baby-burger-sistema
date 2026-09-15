import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { D, type Dec } from "@/lib/costeo/costeo";

type Cliente = Prisma.TransactionClient | typeof db;

export type ResumenCaja = {
  ventasTotal: Dec;
  costoVentas: Dec;
  porMetodo: { metodoPagoId: string; nombre: string; esEfectivo: boolean; monto: Dec }[];
  ventasEfectivo: Dec;
  numeroPedidos: number;
  numeroAnulados: number;
  descuentosTotal: Dec;
  retirosTotal: Dec;
  gastosEfectivo: Dec;
  comprasEfectivo: Dec;
  efectivoEsperado: Dec;
  productos: { nombre: string; cantidad: number; monto: Dec }[];
};

/** Resumen de una caja (abierta o cerrada) a partir de los movimientos del período. */
export async function resumenCaja(cierreId: string, tx: Cliente = db): Promise<ResumenCaja> {
  const caja = await tx.cierreCaja.findUniqueOrThrow({ where: { id: cierreId } });
  const desde = caja.fechaApertura;
  const hasta = caja.fechaCierre ?? new Date();

  const [pedidos, anulados, metodos, retiros, gastos, compras] = await Promise.all([
    tx.pedido.findMany({ where: { cierreCajaId: cierreId, estado: "PAGADO" }, include: { pagos: true, items: { include: { extras: true } } } }),
    tx.pedido.count({ where: { estado: "ANULADO", anuladoEn: { gte: desde, lte: hasta } } }),
    tx.metodoPago.findMany({ orderBy: { orden: "asc" } }),
    tx.retiroCaja.aggregate({ _sum: { monto: true }, where: { OR: [{ cierreCajaId: cierreId }, { cierreCajaId: null, fecha: { gte: desde, lte: hasta } }] } }),
    tx.gasto.aggregate({ _sum: { monto: true }, where: { pagadoDesdeCaja: true, fecha: { gte: desde, lte: hasta } } }),
    tx.compra.aggregate({ _sum: { total: true }, where: { pagadoDesdeCaja: true, fecha: { gte: desde, lte: hasta } } }),
  ]);

  const porMetodoMap = new Map<string, Dec>();
  let ventasTotal = new D(0);
  let costoVentas = new D(0);
  let descuentosTotal = new D(0);
  const productosMap = new Map<string, { cantidad: number; monto: Dec }>();
  for (const p of pedidos) {
    ventasTotal = ventasTotal.add(p.total);
    costoVentas = costoVentas.add(p.costoTotal);
    descuentosTotal = descuentosTotal.add(p.descuentoMonto);
    for (const pg of p.pagos) porMetodoMap.set(pg.metodoPagoId, (porMetodoMap.get(pg.metodoPagoId) ?? new D(0)).add(pg.monto));
    for (const it of p.items) {
      const prev = productosMap.get(it.nombreProducto) ?? { cantidad: 0, monto: new D(0) };
      productosMap.set(it.nombreProducto, { cantidad: prev.cantidad + it.cantidad, monto: prev.monto.add(it.precioUnitario.mul(it.cantidad)) });
      for (const ex of it.extras) {
        const pe = productosMap.get(ex.nombre) ?? { cantidad: 0, monto: new D(0) };
        productosMap.set(ex.nombre, { cantidad: pe.cantidad + ex.cantidad * it.cantidad, monto: pe.monto.add(ex.precioUnitario.mul(ex.cantidad).mul(it.cantidad)) });
      }
    }
  }
  const porMetodo = metodos.map((m) => ({ metodoPagoId: m.id, nombre: m.nombre, esEfectivo: m.esEfectivo, monto: porMetodoMap.get(m.id) ?? new D(0) })).filter((m) => m.monto.gt(0) || m.esEfectivo);
  const ventasEfectivo = porMetodo.filter((m) => m.esEfectivo).reduce((a, m) => a.add(m.monto), new D(0));
  const retirosTotal = retiros._sum.monto ?? new D(0);
  const gastosEfectivo = gastos._sum.monto ?? new D(0);
  const comprasEfectivo = compras._sum.total ?? new D(0);
  const efectivoEsperado = caja.fondoInicial.add(ventasEfectivo).sub(retirosTotal).sub(gastosEfectivo).sub(comprasEfectivo);

  return {
    ventasTotal, costoVentas, porMetodo, ventasEfectivo, numeroPedidos: pedidos.length, numeroAnulados: anulados, descuentosTotal, retirosTotal, gastosEfectivo, comprasEfectivo, efectivoEsperado,
    productos: [...productosMap.entries()].map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.cantidad - a.cantidad),
  };
}

export async function cajaAbierta(tx: Cliente = db) {
  return tx.cierreCaja.findFirst({ where: { estado: "ABIERTA" }, orderBy: { fechaApertura: "desc" } });
}
