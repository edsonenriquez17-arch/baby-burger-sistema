import "server-only";
import { db } from "@/lib/db";
import { D, type Dec } from "@/lib/costeo/costeo";

const cero = () => new D(0);

export type ResumenPeriodo = Awaited<ReturnType<typeof resumenPeriodo>>;

/** Todos los números del período, calculados desde los registros reales (nunca recalculados con precios actuales). */
export async function resumenPeriodo(desde: Date, hasta: Date) {
  const rango = { gte: desde, lte: hasta };
  const [pedidos, anulados, compras, gastos, retiros, mermas, cortesias, incidencias] = await Promise.all([
    db.pedido.findMany({
      where: { estado: "PAGADO", pagadoEn: rango },
      include: { pagos: { include: { metodoPago: true } }, items: { include: { extras: true, consumos: true, producto: { select: { categoriaId: true, categoria: { select: { nombre: true } } } } } }, usuario: { select: { nombre: true } }, mesa: true },
      orderBy: { pagadoEn: "asc" },
    }),
    db.pedido.count({ where: { estado: "ANULADO", anuladoEn: rango } }),
    db.compra.findMany({ where: { fecha: rango }, include: { items: { include: { insumo: { select: { nombre: true, tipo: true } } } } } }),
    db.gasto.findMany({ where: { fecha: rango }, include: { categoria: true } }),
    db.retiroCaja.findMany({ where: { fecha: rango } }),
    db.merma.findMany({ where: { fecha: rango }, include: { insumo: true, producto: true, motivo: true } }),
    db.cortesia.findMany({ where: { fecha: rango }, include: { producto: true, motivo: true } }),
    db.incidencia.findMany({ where: { fecha: rango }, include: { producto: true } }),
  ]);

  let ventas = cero(), costoVentas = cero(), costoComida = cero(), costoEmpaque = cero(), descuentos = cero();
  const porMetodo = new Map<string, Dec>();
  const porServicio = new Map<string, { ventas: Dec; pedidos: number }>();
  const porDia = new Map<string, { ventas: Dec; costo: Dec; pedidos: number }>();
  const porProducto = new Map<string, { nombre: string; categoria: string; unidades: number; ventas: Dec; costo: Dec }>();
  const porUsuario = new Map<string, { ventas: Dec; pedidos: number }>();
  let consumosPendientes = 0;

  for (const p of pedidos) {
    ventas = ventas.add(p.total);
    costoVentas = costoVentas.add(p.costoTotal);
    descuentos = descuentos.add(p.descuentoMonto);
    for (const pg of p.pagos) porMetodo.set(pg.metodoPago.nombre, (porMetodo.get(pg.metodoPago.nombre) ?? cero()).add(pg.monto));
    const s = porServicio.get(p.tipoServicio) ?? { ventas: cero(), pedidos: 0 };
    porServicio.set(p.tipoServicio, { ventas: s.ventas.add(p.total), pedidos: s.pedidos + 1 });
    const dia = (p.pagadoEn ?? p.fecha).toLocaleDateString("en-CA", { timeZone: "America/Lima" });
    const d = porDia.get(dia) ?? { ventas: cero(), costo: cero(), pedidos: 0 };
    porDia.set(dia, { ventas: d.ventas.add(p.total), costo: d.costo.add(p.costoTotal), pedidos: d.pedidos + 1 });
    const u = porUsuario.get(p.usuario.nombre) ?? { ventas: cero(), pedidos: 0 };
    porUsuario.set(p.usuario.nombre, { ventas: u.ventas.add(p.total), pedidos: u.pedidos + 1 });
    for (const it of p.items) {
      const key = it.productoId;
      const prev = porProducto.get(key) ?? { nombre: it.nombreProducto, categoria: it.producto.categoria.nombre, unidades: 0, ventas: cero(), costo: cero() };
      const ventaItem = it.precioUnitario.mul(it.cantidad).add(it.extras.reduce((a, e) => a.add(e.precioUnitario.mul(e.cantidad).mul(it.cantidad)), cero()));
      porProducto.set(key, { ...prev, unidades: prev.unidades + it.cantidad, ventas: prev.ventas.add(ventaItem), costo: prev.costo.add(it.costoUnitario.mul(it.cantidad)) });
      for (const c of it.consumos) {
        if (c.origen === "REGLA_EMPAQUE") costoEmpaque = costoEmpaque.add(c.costoTotal);
        else costoComida = costoComida.add(c.costoTotal);
        if (c.pendiente) consumosPendientes++;
      }
    }
  }

  const comprasTotal = compras.reduce((a, c) => a.add(c.total), cero());
  const comprasEmpaque = compras.reduce((a, c) => a.add(c.items.filter((i) => i.insumo.tipo === "EMPAQUE").reduce((b, i) => b.add(i.total), cero())), cero());
  const gastosTotal = gastos.reduce((a, g) => a.add(g.monto), cero());
  const gastosFijos = gastos.filter((g) => g.esFijo).reduce((a, g) => a.add(g.monto), cero());
  const retirosTotal = retiros.reduce((a, r) => a.add(r.monto), cero());
  const mermasTotal = mermas.reduce((a, m) => a.add(m.costo), cero());
  const cortesiasTotal = cortesias.reduce((a, c) => a.add(c.costoTotal), cero());
  const incidenciasTotal = incidencias.reduce((a, i) => a.add(i.costoGenerado), cero());
  const perdidasTotal = mermasTotal.add(cortesiasTotal).add(incidenciasTotal);
  const utilidadBruta = ventas.sub(costoVentas);
  const utilidadEstimada = utilidadBruta.sub(gastosTotal).sub(perdidasTotal);
  const resultadoCaja = utilidadEstimada.sub(retirosTotal);
  const margenBruto = ventas.gt(0) ? utilidadBruta.div(ventas).mul(100) : null;
  const margenNeto = ventas.gt(0) ? utilidadEstimada.div(ventas).mul(100) : null;
  const salidasDinero = comprasTotal.add(gastosTotal).add(retirosTotal);

  const productos = [...porProducto.values()].map((p) => ({ ...p, ganancia: p.ventas.sub(p.costo), margen: p.ventas.gt(0) ? p.ventas.sub(p.costo).div(p.ventas).mul(100) : null }));
  const porCategoriaGasto = new Map<string, Dec>();
  for (const g of gastos) porCategoriaGasto.set(g.categoria.nombre, (porCategoriaGasto.get(g.categoria.nombre) ?? cero()).add(g.monto));

  return {
    pedidos, anulados, numeroPedidos: pedidos.length, ticketPromedio: pedidos.length ? ventas.div(pedidos.length) : cero(),
    ventas, descuentos, costoVentas, costoComida, costoEmpaque, consumosPendientes,
    utilidadBruta, margenBruto, gastosTotal, gastosFijos, porCategoriaGasto, perdidasTotal, mermasTotal, cortesiasTotal, incidenciasTotal, utilidadEstimada, margenNeto,
    retirosTotal, resultadoCaja, comprasTotal, comprasEmpaque, salidasDinero,
    porMetodo, porServicio, porDia, porUsuario, productos,
    mermas, cortesias, incidencias, compras, gastos, retiros,
  };
}

/** Punto de equilibrio con datos reales del período (extrapolados a mes de 30 días). */
export function puntoEquilibrio(r: ResumenPeriodo, dias: number, gastosFijosConfig: number | null) {
  const factorMes = dias > 0 ? 30 / dias : 1;
  const fijosMes = gastosFijosConfig !== null && gastosFijosConfig > 0 ? new D(gastosFijosConfig) : r.gastosFijos.mul(factorMes);
  const variablesMes = r.gastosTotal.sub(r.gastosFijos).add(r.perdidasTotal).mul(factorMes);
  const ventasMes = r.ventas.mul(factorMes);
  // Margen de contribución: lo que queda de cada sol vendido después del costo de venta y gastos variables.
  const mc = ventasMes.gt(0) ? ventasMes.sub(r.costoVentas.mul(factorMes)).sub(variablesMes).div(ventasMes) : null;
  const ventasNecesariasMes = mc && mc.gt(0) ? fijosMes.div(mc) : null;
  const ventasNecesariasDia = ventasNecesariasMes ? ventasNecesariasMes.div(30) : null;
  const pedidosNecesariosDia = ventasNecesariasDia && r.ticketPromedio.gt(0) ? ventasNecesariasDia.div(r.ticketPromedio) : null;
  const unidades = r.productos.reduce((a, p) => a + p.unidades, 0);
  const precioPromedioProducto = unidades > 0 ? r.ventas.div(unidades) : null;
  const productosNecesariosDia = ventasNecesariasDia && precioPromedioProducto && precioPromedioProducto.gt(0) ? ventasNecesariasDia.div(precioPromedioProducto) : null;
  return { fijosMes, variablesMes, ventasMes, mc: mc ? mc.mul(100) : null, ventasNecesariasMes, ventasNecesariasDia, pedidosNecesariosDia, productosNecesariosDia, usaConfig: gastosFijosConfig !== null && gastosFijosConfig > 0 };
}

/** Alertas del dashboard. */
export async function alertas(margenAlerta: number) {
  const hace30 = new Date(Date.now() - 30 * 86400000);
  const [stockBajo, subidas, costosProductos] = await Promise.all([
    db.insumo.findMany({ where: { activo: true, stockMinimo: { not: null } }, include: { unidadBase: true } }),
    db.precioInsumo.findMany({ where: { vigenteDesde: { gte: hace30 }, origen: { in: ["COMPRA", "MANUAL"] } }, include: { insumo: { select: { id: true, nombre: true, unidadBase: { select: { codigo: true } } } } }, orderBy: { vigenteDesde: "desc" } }),
    db.costoProductoHistorial.findMany({ where: { fecha: { gte: hace30 } }, include: { producto: { select: { id: true, nombre: true, precioVenta: true, activo: true } } }, orderBy: { fecha: "desc" } }),
  ]);

  const bajo = stockBajo.filter((i) => i.stockActual.lt(i.stockMinimo!));

  // Subidas de precio: comparar el más reciente con el anterior del mismo insumo/presentación.
  const subidasMap = new Map<string, { nombre: string; id: string; antes: Dec; ahora: Dec; pct: Dec; unidad: string }>();
  for (const p of subidas) {
    if (subidasMap.has(p.insumoId)) continue;
    const anterior = await db.precioInsumo.findFirst({ where: { insumoId: p.insumoId, presentacionId: p.presentacionId, vigenteDesde: { lt: p.vigenteDesde } }, orderBy: { vigenteDesde: "desc" } });
    if (anterior && p.costoUnitarioBase.gt(anterior.costoUnitarioBase)) {
      subidasMap.set(p.insumoId, { id: p.insumo.id, nombre: p.insumo.nombre, antes: anterior.costoUnitarioBase, ahora: p.costoUnitarioBase, pct: p.costoUnitarioBase.sub(anterior.costoUnitarioBase).div(anterior.costoUnitarioBase).mul(100), unidad: p.insumo.unidadBase.codigo });
    }
  }

  // Productos: último costo vs primero del período, y margen bajo.
  const porProducto = new Map<string, typeof costosProductos>();
  for (const c of costosProductos) (porProducto.get(c.productoId) ?? porProducto.set(c.productoId, []).get(c.productoId)!).push(c);
  const costosSubieron: { id: string; nombre: string; antes: Dec; ahora: Dec; pct: Dec }[] = [];
  const margenBajo: { id: string; nombre: string; margen: Dec; costo: Dec; precio: Dec }[] = [];
  for (const [, lista] of porProducto) {
    const ahora = lista[0];
    const antes = lista[lista.length - 1];
    if (!ahora.producto.activo) continue;
    if (lista.length > 1 && antes.costoTotal.gt(0) && ahora.costoTotal.sub(antes.costoTotal).div(antes.costoTotal).gt(0.1)) {
      costosSubieron.push({ id: ahora.productoId, nombre: ahora.producto.nombre, antes: antes.costoTotal, ahora: ahora.costoTotal, pct: ahora.costoTotal.sub(antes.costoTotal).div(antes.costoTotal).mul(100) });
    }
    if (ahora.completo && ahora.producto.precioVenta.gt(0)) {
      const margen = ahora.producto.precioVenta.sub(ahora.costoTotal).div(ahora.producto.precioVenta).mul(100);
      if (margen.lt(margenAlerta)) margenBajo.push({ id: ahora.productoId, nombre: ahora.producto.nombre, margen, costo: ahora.costoTotal, precio: ahora.producto.precioVenta });
    }
  }
  return { stockBajo: bajo, subidas: [...subidasMap.values()], costosSubieron, margenBajo };
}
