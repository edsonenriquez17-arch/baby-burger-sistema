import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { obtenerParametrosMargen } from "@/lib/costeo/costeo";
import { fmtFecha, fmtFechaHora, fmtNum, fmtPct, fmtSoles } from "@/lib/formato";
import { puntoEquilibrio, resumenPeriodo } from "@/lib/reportes";
import { FiltroFechas, rangoDesdeParams } from "@/components/filtro-fechas";

export const metadata: Metadata = { title: "Reportes" };

const TABS = [
  { v: "resumen", t: "Resumen" },
  { v: "productos", t: "Productos y rentabilidad" },
  { v: "cero", t: "¿Por qué terminé en S/0?" },
  { v: "equilibrio", t: "Punto de equilibrio" },
  { v: "ventas", t: "Ventas (detalle)" },
];
const SERVICIO: Record<string, string> = { MESA: "Mesa", BARRA: "Barra", LLEVAR: "Para llevar", DELIVERY: "Delivery" };

function Fila({ etiqueta, valor, clase = "", nota }: { etiqueta: string; valor: string; clase?: string; nota?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={clase}>{etiqueta}{nota && <span className="block text-xs font-normal text-muted">{nota}</span>}</span>
      <span className={`font-mono ${clase}`}>{valor}</span>
    </div>
  );
}

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ t?: string; desde?: string; hasta?: string; q?: string; servicio?: string; metodo?: string; usuario?: string }> }) {
  const usuarioActual = await requerirPermiso("reportes.ver");
  const sp = await searchParams;
  const tab = TABS.find((x) => x.v === sp.t)?.v ?? "resumen";
  const { desde, hasta, desdeTexto, hastaTexto } = rangoDesdeParams(sp, "mes");
  const dias = Math.max(1, Math.round((hasta.getTime() - desde.getTime()) / 86400000));
  const verFinanzas = usuarioActual.permisos.has("reportes.financieros");
  const [r, margen, fijosConfig] = await Promise.all([resumenPeriodo(desde, hasta), obtenerParametrosMargen(), db.configuracion.findUnique({ where: { clave: "pe.gastos_fijos_mensuales" } })]);

  const mejor = [...r.productos].sort((a, b) => b.unidades - a.unidades);
  const masUtil = [...r.productos].filter((p) => p.costo.gt(0)).sort((a, b) => b.ganancia.cmp(a.ganancia));
  const menorMargen = [...r.productos].filter((p) => p.margen !== null && p.costo.gt(0)).sort((a, b) => a.margen!.cmp(b.margen!));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-muted">Del {fmtFecha(desde)} al {fmtFecha(hasta)} · {dias} día(s). Todo sale de ventas cobradas, con los costos congelados al momento de vender.</p>
      </div>
      <nav className="flex flex-wrap gap-2">
        {TABS.filter((x) => verFinanzas || x.v === "resumen" || x.v === "ventas").map((x) => (
          <Link key={x.v} href={`/reportes?t=${x.v}&desde=${desdeTexto}&hasta=${hastaTexto}`} className={`badge px-3 py-1.5 ${x.v === tab ? "bg-brand text-brand-contrast" : "border border-border bg-surface"}`}>{x.t}</Link>
        ))}
      </nav>
      <FiltroFechas sp={sp} extra={<input type="hidden" name="t" value={tab} />} />

      {tab === "resumen" && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="card"><div className="text-xs uppercase text-muted">Ventas</div><div className="font-mono text-2xl font-bold">{fmtSoles(r.ventas)}</div><div className="text-xs text-muted">{r.numeroPedidos} pedidos · {r.anulados} anulados</div></div>
            <div className="card"><div className="text-xs uppercase text-muted">Ticket promedio</div><div className="font-mono text-2xl font-bold">{fmtSoles(r.ticketPromedio)}</div><div className="text-xs text-muted">descuentos {fmtSoles(r.descuentos)}</div></div>
            {verFinanzas && (
              <>
                <div className="card"><div className="text-xs uppercase text-muted">Costo de ventas</div><div className="font-mono text-2xl font-bold">{fmtSoles(r.costoVentas)}</div><div className="text-xs text-muted">comida {fmtSoles(r.costoComida)} · empaque {fmtSoles(r.costoEmpaque)}</div></div>
                <div className={`card ${r.utilidadEstimada.lt(0) ? "border-danger" : ""}`}><div className="text-xs uppercase text-muted">Utilidad estimada</div><div className={`font-mono text-2xl font-bold ${r.utilidadEstimada.lt(0) ? "text-danger" : "text-success"}`}>{fmtSoles(r.utilidadEstimada)}</div><div className="text-xs text-muted">margen neto {fmtPct(r.margenNeto)}</div></div>
              </>
            )}
          </div>
          {r.consumosPendientes > 0 && <p className="rounded-xl bg-warning/10 px-4 py-2 text-sm text-warning">{r.consumosPendientes} consumo(s) de ventas quedaron sin costo por cantidades o precios pendientes en recetas. Complétalos en Recetas para que el costo sea real.</p>}

          {verFinanzas && (
            <div className="card">
              <h2 className="font-semibold">Resultado del período</h2>
              <div className="divide-y divide-border text-sm">
                <Fila etiqueta="Ventas" valor={fmtSoles(r.ventas)} />
                <Fila etiqueta="− Costo de productos vendidos" valor={fmtSoles(r.costoVentas)} nota="comida + empaques + descartables, congelado por venta" />
                <Fila etiqueta="= Utilidad bruta" valor={`${fmtSoles(r.utilidadBruta)} (${fmtPct(r.margenBruto)})`} clase="font-semibold" />
                <Fila etiqueta="− Gastos operativos" valor={fmtSoles(r.gastosTotal)} nota={`fijos ${fmtSoles(r.gastosFijos)}`} />
                <Fila etiqueta="− Mermas, cortesías e incidencias" valor={fmtSoles(r.perdidasTotal)} nota={`mermas ${fmtSoles(r.mermasTotal)} · cortesías ${fmtSoles(r.cortesiasTotal)} · incidencias ${fmtSoles(r.incidenciasTotal)}`} />
                <Fila etiqueta="= Utilidad estimada" valor={`${fmtSoles(r.utilidadEstimada)} (${fmtPct(r.margenNeto)})`} clase={`font-bold ${r.utilidadEstimada.lt(0) ? "text-danger" : "text-success"}`} />
              </div>
              <p className="mt-3 rounded-xl bg-background px-3 py-2 text-xs text-muted">Compras de inventario del período: <b className="font-mono text-foreground">{fmtSoles(r.comprasTotal)}</b> (de las cuales empaques {fmtSoles(r.comprasEmpaque)}). Es dinero que salió, pero no es costo de venta: lo que no se vendió sigue en el inventario.</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="card"><h3 className="font-semibold">Por método de pago</h3><div className="mt-1 divide-y divide-border text-sm">{[...r.porMetodo.entries()].map(([n, m]) => <Fila key={n} etiqueta={n} valor={fmtSoles(m)} />)}</div></div>
            <div className="card"><h3 className="font-semibold">Por tipo de servicio</h3><div className="mt-1 divide-y divide-border text-sm">{[...r.porServicio.entries()].map(([n, m]) => <Fila key={n} etiqueta={`${SERVICIO[n] ?? n} (${m.pedidos})`} valor={fmtSoles(m.ventas)} />)}</div></div>
            <div className="card"><h3 className="font-semibold">Por usuario</h3><div className="mt-1 divide-y divide-border text-sm">{[...r.porUsuario.entries()].map(([n, m]) => <Fila key={n} etiqueta={`${n} (${m.pedidos})`} valor={fmtSoles(m.ventas)} />)}</div></div>
          </div>

          <div className="card overflow-x-auto p-0">
            <div className="border-b border-border px-4 py-2 font-semibold">Ventas por día</div>
            <table className="w-full text-sm"><thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Día</th><th className="px-4 py-2 text-right">Pedidos</th><th className="px-4 py-2 text-right">Ventas</th>{verFinanzas && <><th className="px-4 py-2 text-right">Costo</th><th className="px-4 py-2 text-right">Utilidad bruta</th></>}</tr></thead>
              <tbody>{[...r.porDia.entries()].map(([d, v]) => <tr key={d} className="border-t border-border"><td className="px-4 py-1"><Link href={`/reportes?t=ventas&desde=${d}&hasta=${d}`} className="text-brand hover:underline">{d}</Link></td><td className="px-4 py-1 text-right">{v.pedidos}</td><td className="px-4 py-1 text-right font-mono">{fmtSoles(v.ventas)}</td>{verFinanzas && <><td className="px-4 py-1 text-right font-mono text-muted">{fmtSoles(v.costo)}</td><td className="px-4 py-1 text-right font-mono">{fmtSoles(v.ventas.sub(v.costo))}</td></>}</tr>)}</tbody>
            </table>
          </div>
        </>
      )}

      {tab === "productos" && verFinanzas && (
        <>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div className="card"><h3 className="font-semibold">Más vendidos</h3>{mejor.slice(0, 5).map((p) => <Fila key={p.nombre} etiqueta={p.nombre} valor={`${p.unidades} u.`} />)}{mejor.length > 5 && <Fila etiqueta="Menos vendido" valor={`${mejor[mejor.length - 1].nombre} (${mejor[mejor.length - 1].unidades})`} clase="text-muted" />}</div>
            <div className="card"><h3 className="font-semibold">Más utilidad generan</h3>{masUtil.slice(0, 5).map((p) => <Fila key={p.nombre} etiqueta={p.nombre} valor={fmtSoles(p.ganancia)} />)}</div>
            <div className="card"><h3 className="font-semibold">Menor margen</h3>{menorMargen.slice(0, 5).map((p) => <Fila key={p.nombre} etiqueta={p.nombre} valor={fmtPct(p.margen)} clase={p.margen!.lt(margen.alerta) ? "text-danger" : ""} />)}</div>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm"><thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Unidades</th><th className="px-4 py-2 text-right">Ventas</th><th className="px-4 py-2 text-right">Costo real</th><th className="px-4 py-2 text-right">Ganancia</th><th className="px-4 py-2 text-right">Margen</th></tr></thead>
              <tbody>{[...r.productos].sort((a, b) => b.ventas.cmp(a.ventas)).map((p) => <tr key={p.nombre} className="border-t border-border"><td className="px-4 py-1"><span className="text-xs text-muted">{p.categoria} · </span>{p.nombre}</td><td className="px-4 py-1 text-right">{p.unidades}</td><td className="px-4 py-1 text-right font-mono">{fmtSoles(p.ventas)}</td><td className="px-4 py-1 text-right font-mono text-muted">{fmtSoles(p.costo)}</td><td className="px-4 py-1 text-right font-mono">{fmtSoles(p.ganancia)}</td><td className={`px-4 py-1 text-right font-mono ${p.margen?.lt(margen.alerta) ? "text-danger" : ""}`}>{fmtPct(p.margen)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Para el costo teórico con precios de hoy y el precio recomendado, ver <Link href="/recetas" className="text-brand hover:underline">Recetas y rentabilidad</Link>.</p>
        </>
      )}

      {tab === "cero" && verFinanzas && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <h2 className="font-semibold">Vendimos {fmtSoles(r.ventas)}. ¿Dónde terminó?</h2>
            <div className="mt-2 divide-y divide-border text-sm">
              <Fila etiqueta="Ventas del período" valor={fmtSoles(r.ventas)} clase="font-semibold" />
              <Fila etiqueta="− Costo de lo vendido" valor={fmtSoles(r.costoVentas)} nota="ingredientes, empaques y descartables realmente consumidos" />
              <Fila etiqueta="− Gastos operativos" valor={fmtSoles(r.gastosTotal)} />
              <Fila etiqueta="− Mermas y cortesías" valor={fmtSoles(r.perdidasTotal)} />
              <Fila etiqueta="= Utilidad estimada" valor={fmtSoles(r.utilidadEstimada)} clase={`font-semibold ${r.utilidadEstimada.lt(0) ? "text-danger" : "text-success"}`} />
              <Fila etiqueta="− Retiros del negocio" valor={fmtSoles(r.retirosTotal)} />
              <Fila etiqueta="= Lo que debería quedar" valor={fmtSoles(r.resultadoCaja)} clase={`font-bold ${r.resultadoCaja.lt(0) ? "text-danger" : "text-success"}`} />
            </div>
          </div>
          <div className="card">
            <h2 className="font-semibold">Dinero que salió de la caja</h2>
            <div className="mt-2 divide-y divide-border text-sm">
              <Fila etiqueta="Compras de inventario" valor={fmtSoles(r.comprasTotal)} nota="entra como stock; se vuelve costo solo cuando se vende" />
              <Fila etiqueta="Gastos operativos" valor={fmtSoles(r.gastosTotal)} />
              <Fila etiqueta="Retiros" valor={fmtSoles(r.retirosTotal)} />
              <Fila etiqueta="Total que salió" valor={fmtSoles(r.salidasDinero)} clase="font-semibold" />
              <Fila etiqueta="Ventas − salidas (flujo de caja)" valor={fmtSoles(r.ventas.sub(r.salidasDinero))} clase={`font-bold ${r.ventas.sub(r.salidasDinero).lt(0) ? "text-danger" : "text-success"}`} />
            </div>
            <p className="mt-3 text-xs text-muted">
              Si la utilidad estimada es positiva pero el flujo de caja es negativo, la diferencia está en <b>inventario comprado y no vendido</b> ({fmtSoles(r.comprasTotal.sub(r.costoVentas))}) o en <b>retiros</b>. Si la utilidad ya es negativa, el problema es de margen: revisa costos y precios.
            </p>
          </div>
        </div>
      )}

      {tab === "equilibrio" && verFinanzas && (() => {
        const pe = puntoEquilibrio(r, dias, fijosConfig ? Number(fijosConfig.valor) || null : null);
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card">
              <h2 className="font-semibold">Punto de equilibrio mensual</h2>
              <div className="mt-2 divide-y divide-border text-sm">
                <Fila etiqueta="Gastos fijos por mes" valor={fmtSoles(pe.fijosMes)} nota={pe.usaConfig ? "valor configurado (pe.gastos_fijos_mensuales)" : `gastos marcados como fijos en el período, llevados a 30 días`} />
                <Fila etiqueta="Margen de contribución" valor={fmtPct(pe.mc)} nota="de cada sol vendido, lo que queda después del costo de venta y gastos variables" />
                <Fila etiqueta="Ventas necesarias al mes" valor={fmtSoles(pe.ventasNecesariasMes)} clase="font-semibold" />
                <Fila etiqueta="Ventas necesarias por día" valor={fmtSoles(pe.ventasNecesariasDia)} />
                <Fila etiqueta="≈ Pedidos por día" valor={pe.pedidosNecesariosDia ? fmtNum(pe.pedidosNecesariosDia, 1) : "—"} nota={`con ticket promedio ${fmtSoles(r.ticketPromedio)}`} />
                <Fila etiqueta="≈ Productos por día" valor={pe.productosNecesariosDia ? fmtNum(pe.productosNecesariosDia, 0) : "—"} />
              </div>
            </div>
            <div className="card text-sm">
              <h2 className="font-semibold">Cómo va el período</h2>
              <div className="mt-2 divide-y divide-border">
                <Fila etiqueta="Ventas reales (a 30 días)" valor={fmtSoles(pe.ventasMes)} />
                <Fila etiqueta="Necesario" valor={fmtSoles(pe.ventasNecesariasMes)} />
                <Fila etiqueta={pe.ventasNecesariasMes && pe.ventasMes.gte(pe.ventasNecesariasMes) ? "Por encima del equilibrio" : "Falta para el equilibrio"} valor={pe.ventasNecesariasMes ? fmtSoles(pe.ventasMes.sub(pe.ventasNecesariasMes).abs()) : "—"} clase={`font-bold ${pe.ventasNecesariasMes && pe.ventasMes.gte(pe.ventasNecesariasMes) ? "text-success" : "text-danger"}`} />
              </div>
              <p className="mt-3 text-xs text-muted">
                {pe.mc === null ? "Registra ventas en el período para calcular el margen de contribución." : pe.ventasNecesariasMes ? `Baby Burger necesita vender aproximadamente ${fmtSoles(pe.ventasNecesariasMes)} al mes (${fmtSoles(pe.ventasNecesariasDia)} por día) para cubrir sus costos.` : "El margen de contribución es cero o negativo: con los costos actuales no hay punto de equilibrio posible."}
                {" "}Si tus gastos fijos reales difieren, fija <code>pe.gastos_fijos_mensuales</code> en Configuración → General.
              </p>
            </div>
          </div>
        );
      })()}

      {tab === "ventas" && (
        <>
          <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
            <input type="hidden" name="t" value="ventas" /><input type="hidden" name="desde" value={desdeTexto} /><input type="hidden" name="hasta" value={hastaTexto} />
            <div><label className="label">Producto</label><input name="q" defaultValue={sp.q} className="input w-40 py-1.5 text-sm" /></div>
            <div><label className="label">Servicio</label><select name="servicio" defaultValue={sp.servicio ?? ""} className="input py-1.5 text-sm"><option value="">todos</option>{Object.entries(SERVICIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label">Método</label><select name="metodo" defaultValue={sp.metodo ?? ""} className="input py-1.5 text-sm"><option value="">todos</option>{[...r.porMetodo.keys()].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
            <div><label className="label">Usuario</label><select name="usuario" defaultValue={sp.usuario ?? ""} className="input py-1.5 text-sm"><option value="">todos</option>{[...r.porUsuario.keys()].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
            <button className="btn btn-secondary min-h-9 px-3 text-xs">Filtrar</button>
          </form>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm"><thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">#</th><th className="px-4 py-2">Cobrado</th><th className="px-4 py-2">Canal</th><th className="px-4 py-2">Productos</th><th className="px-4 py-2">Pago</th><th className="px-4 py-2 text-right">Total</th>{verFinanzas && <th className="px-4 py-2 text-right">Costo</th>}<th className="px-4 py-2">Usuario</th></tr></thead>
              <tbody>
                {r.pedidos
                  .filter((p) => !sp.servicio || p.tipoServicio === sp.servicio)
                  .filter((p) => !sp.metodo || p.pagos.some((pg) => pg.metodoPago.nombre === sp.metodo))
                  .filter((p) => !sp.usuario || p.usuario.nombre === sp.usuario)
                  .filter((p) => !sp.q || p.items.some((i) => i.nombreProducto.toLowerCase().includes(sp.q!.toLowerCase())))
                  .map((p) => (
                    <tr key={p.id} className="border-t border-border align-top">
                      <td className="px-4 py-1"><Link href={`/pedidos/${p.id}`} className="text-brand hover:underline">#{p.numero}</Link></td>
                      <td className="whitespace-nowrap px-4 py-1">{fmtFechaHora(p.pagadoEn)}</td>
                      <td className="px-4 py-1">{p.mesa?.nombre ?? SERVICIO[p.tipoServicio]}</td>
                      <td className="px-4 py-1 text-muted">{p.items.map((i) => `${i.cantidad}× ${i.nombreProducto}`).join(", ")}</td>
                      <td className="px-4 py-1 text-muted">{p.pagos.map((pg) => pg.metodoPago.nombre).join(" + ")}</td>
                      <td className="px-4 py-1 text-right font-mono">{fmtSoles(p.total)}</td>
                      {verFinanzas && <td className="px-4 py-1 text-right font-mono text-muted">{fmtSoles(p.costoTotal)}</td>}
                      <td className="px-4 py-1 text-muted">{p.usuario.nombre}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
