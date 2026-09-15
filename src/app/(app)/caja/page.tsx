import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { cajaAbierta, resumenCaja } from "@/lib/pos/caja";
import { fmtFechaHora, fmtSoles } from "@/lib/formato";
import { FormAccion } from "@/components/form-accion";
import { abrirCaja, cerrarCaja } from "./actions";

export const metadata: Metadata = { title: "Caja" };

export default async function CajaPage() {
  const usuario = await requerirPermiso("caja.ver");
  const caja = await cajaAbierta();
  const [fondoConfig, historial] = await Promise.all([
    db.configuracion.findUnique({ where: { clave: "caja.fondo_inicial" } }),
    db.cierreCaja.findMany({ where: { estado: "CERRADA" }, orderBy: { fechaCierre: "desc" }, take: 15, include: { lineas: { include: { metodoPago: true } }, cerradoPor: { select: { nombre: true } } } }),
  ]);
  const puedeCerrar = usuario.permisos.has("caja.cerrar");
  const r = caja ? await resumenCaja(caja.id) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Caja</h1>

      {!caja && (
        <div className="card">
          <h2 className="font-semibold">No hay caja abierta</h2>
          <p className="text-sm text-muted">Abre la caja al iniciar el día con el fondo (sencillo) con el que empiezas.</p>
          {puedeCerrar && (
            <FormAccion accion={abrirCaja} className="mt-3 flex flex-wrap items-end gap-3" textoBoton="Abrir caja">
              <div><label className="label">Fondo inicial (S/)</label><input name="fondoInicial" type="number" step="0.5" min="0" className="input w-40" defaultValue={fondoConfig?.valor ?? "0"} /></div>
            </FormAccion>
          )}
        </div>
      )}

      {caja && r && (
        <>
          <div className="card">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Caja abierta desde {fmtFechaHora(caja.fechaApertura)}</h2>
              <span className="text-sm text-muted">fondo inicial {fmtSoles(caja.fondoInicial)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div><div className="text-xs uppercase text-muted">Ventas</div><div className="font-mono text-2xl font-bold">{fmtSoles(r.ventasTotal)}</div><div className="text-xs text-muted">{r.numeroPedidos} pedidos · {r.numeroAnulados} anulados</div></div>
              <div><div className="text-xs uppercase text-muted">Ticket promedio</div><div className="font-mono text-2xl font-bold">{fmtSoles(r.numeroPedidos ? r.ventasTotal.div(r.numeroPedidos) : 0)}</div><div className="text-xs text-muted">descuentos {fmtSoles(r.descuentosTotal)}</div></div>
              <div><div className="text-xs uppercase text-muted">Salidas de caja</div><div className="font-mono text-2xl font-bold">{fmtSoles(r.retirosTotal.add(r.gastosEfectivo).add(r.comprasEfectivo))}</div><div className="text-xs text-muted">retiros {fmtSoles(r.retirosTotal)} · gastos {fmtSoles(r.gastosEfectivo)} · compras {fmtSoles(r.comprasEfectivo)}</div></div>
              <div><div className="text-xs uppercase text-muted">Efectivo esperado</div><div className="font-mono text-2xl font-bold text-brand">{fmtSoles(r.efectivoEsperado)}</div><div className="text-xs text-muted">fondo + efectivo − salidas</div></div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card">
              <h3 className="font-semibold">Ventas por método de pago</h3>
              <ul className="mt-2 divide-y divide-border text-sm">
                {r.porMetodo.map((m) => (
                  <li key={m.metodoPagoId} className="flex justify-between py-1"><span>{m.nombre}{m.esEfectivo && " (efectivo)"}</span><span className="font-mono">{fmtSoles(m.monto)}</span></li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3 className="font-semibold">Productos vendidos</h3>
              <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto text-sm">
                {r.productos.length === 0 && <li className="py-1 text-muted">Todavía nada.</li>}
                {r.productos.map((p) => (
                  <li key={p.nombre} className="flex justify-between py-1"><span>{p.cantidad}× {p.nombre}</span><span className="font-mono">{fmtSoles(p.monto)}</span></li>
                ))}
              </ul>
            </div>
          </div>

          {puedeCerrar && (
            <div className="card">
              <h2 className="font-semibold">Cerrar caja</h2>
              <p className="text-sm text-muted">Cuenta el efectivo físico y regístralo. El sistema calcula sobrante o faltante contra {fmtSoles(r.efectivoEsperado)}.</p>
              <FormAccion accion={cerrarCaja} className="mt-3 grid gap-3 sm:grid-cols-2" textoBoton="Cerrar caja" claseBoton="btn btn-danger">
                <div><label className="label">Efectivo real en caja (S/)</label><input name="efectivoReal" type="number" step="0.1" min="0" inputMode="decimal" className="input text-lg" required /></div>
                <div><label className="label">Observaciones</label><input name="observaciones" className="input" /></div>
              </FormAccion>
            </div>
          )}
        </>
      )}

      <div className="card">
        <h2 className="font-semibold">Cierres anteriores</h2>
        {historial.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sin cierres todavía.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-1 pr-3">Cierre</th><th className="py-1 pr-3 text-right">Ventas</th><th className="py-1 pr-3 text-right">Pedidos</th><th className="py-1 pr-3 text-right">Esperado</th><th className="py-1 pr-3 text-right">Real</th><th className="py-1 pr-3 text-right">Diferencia</th><th className="py-1">Por</th></tr></thead>
              <tbody>
                {historial.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-1 pr-3 whitespace-nowrap">{fmtFechaHora(c.fechaCierre)}<div className="text-xs text-muted">{c.lineas.map((l) => `${l.metodoPago.nombre} ${fmtSoles(l.monto)}`).join(" · ")}</div></td>
                    <td className="py-1 pr-3 text-right font-mono">{fmtSoles(c.ventasTotal)}</td>
                    <td className="py-1 pr-3 text-right">{c.numeroPedidos}</td>
                    <td className="py-1 pr-3 text-right font-mono">{fmtSoles(c.efectivoEsperado)}</td>
                    <td className="py-1 pr-3 text-right font-mono">{fmtSoles(c.efectivoReal)}</td>
                    <td className={`py-1 pr-3 text-right font-mono font-semibold ${c.diferencia?.lt(0) ? "text-danger" : c.diferencia?.gt(0) ? "text-success" : ""}`}>{c.diferencia?.lt(0) ? "faltante " : c.diferencia?.gt(0) ? "sobrante " : ""}{fmtSoles(c.diferencia?.abs())}</td>
                    <td className="py-1">{c.cerradoPor?.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-muted">Retiros, gastos y compras pagadas desde caja se registran en sus módulos y descuentan del efectivo esperado. <Link href="/retiros" className="text-brand hover:underline">Ir a retiros</Link></p>
    </div>
  );
}
