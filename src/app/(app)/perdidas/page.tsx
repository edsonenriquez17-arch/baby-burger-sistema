import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { D } from "@/lib/costeo/costeo";
import { fmtFecha, fmtNum, fmtSoles } from "@/lib/formato";
import { FormAccion } from "@/components/form-accion";
import { FiltroFechas, rangoDesdeParams } from "@/components/filtro-fechas";
import { registrarCortesia, registrarIncidencia, registrarMerma } from "./actions";

export const metadata: Metadata = { title: "Mermas, cortesías e incidencias" };

const TABS = [
  { v: "mermas", t: "Mermas y pérdidas" },
  { v: "cortesias", t: "Cortesías" },
  { v: "incidencias", t: "Devoluciones y rehechos" },
];
const TIPO_INC: Record<string, string> = { DEVOLUCION: "Devolución", PRODUCTO_EQUIVOCADO: "Producto equivocado", REHECHO: "Producto rehecho", PEDIDO_PERDIDO: "Pedido perdido", ERROR_PREPARACION: "Error de preparación", OTRO: "Otro" };

export default async function PerdidasPage({ searchParams }: { searchParams: Promise<{ t?: string; desde?: string; hasta?: string; q?: string }> }) {
  const usuario = await requerirPermiso("inventario.mermas");
  const sp = await searchParams;
  const tab = TABS.find((x) => x.v === sp.t)?.v ?? "mermas";
  const { desde, hasta, hoyLima } = rangoDesdeParams(sp, "mes");
  const rango = { fecha: { gte: desde, lte: hasta } };

  const [mermas, cortesias, incidencias, insumos, productos, unidades, motivosMerma, motivosCortesia] = await Promise.all([
    tab === "mermas" ? db.merma.findMany({ where: rango, include: { insumo: { include: { unidadBase: true } }, producto: true, motivo: true, usuario: { select: { nombre: true } } }, orderBy: { fecha: "desc" } }) : [],
    tab === "cortesias" ? db.cortesia.findMany({ where: rango, include: { producto: true, motivo: true, usuario: { select: { nombre: true } } }, orderBy: { fecha: "desc" } }) : [],
    tab === "incidencias" ? db.incidencia.findMany({ where: rango, include: { producto: true, pedido: { select: { numero: true, id: true } }, usuario: { select: { nombre: true } } }, orderBy: { fecha: "desc" } }) : [],
    db.insumo.findMany({ where: { activo: true }, include: { unidadBase: true }, orderBy: [{ tipo: "asc" }, { nombre: "asc" }] }),
    db.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    db.unidadMedida.findMany({ where: { activa: true }, orderBy: [{ tipo: "asc" }, { factorABase: "asc" }] }),
    db.motivoMerma.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    db.motivoCortesia.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  const totalMermas = mermas.reduce((a, m) => a.add(m.costo), new D(0));
  const totalCortesias = cortesias.reduce((a, c) => a.add(c.costoTotal), new D(0));
  const totalIncidencias = incidencias.reduce((a, i) => a.add(i.costoGenerado), new D(0));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Mermas, cortesías e incidencias</h1>
        <p className="text-sm text-muted">Nada de esto es venta, pero todo descuenta inventario y le cuesta al negocio. Aparece separado en los reportes.</p>
      </div>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((x) => <Link key={x.v} href={`/perdidas?t=${x.v}`} className={`badge px-3 py-1.5 ${x.v === tab ? "bg-brand text-brand-contrast" : "border border-border bg-surface"}`}>{x.t}</Link>)}
      </nav>

      {tab === "mermas" && (
        <>
          <details className="card">
            <summary className="cursor-pointer font-semibold">+ Registrar merma</summary>
            <FormAccion accion={registrarMerma} className="mt-3 grid gap-3 sm:grid-cols-3" textoBoton="Registrar merma">
              <div><label className="label">Fecha</label><input type="date" name="fecha" defaultValue={hoyLima} className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Qué se perdió</label>
                <select name="objetivo" className="input">
                  <optgroup label="Ingredientes / empaques / preparaciones">{insumos.map((i) => <option key={i.id} value={`insumo:${i.id}`}>{i.nombre} ({i.unidadBase.codigo})</option>)}</optgroup>
                  <optgroup label="Producto terminado (descuenta su receta)">{productos.map((p) => <option key={p.id} value={`producto:${p.id}`}>{p.nombre}</option>)}</optgroup>
                </select>
              </div>
              <div><label className="label">Cantidad</label><input name="cantidad" type="number" step="any" min="0" className="input" required /></div>
              <div><label className="label">Unidad (solo para insumos)</label><select name="unidadId" className="input"><option value="">unidad base del insumo</option>{unidades.map((u) => <option key={u.id} value={u.id}>{u.codigo}</option>)}</select></div>
              <div><label className="label">Motivo</label><select name="motivoId" className="input">{motivosMerma.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
              <div className="sm:col-span-3"><label className="label">Observación</label><input name="observaciones" className="input" /></div>
            </FormAccion>
          </details>
          <FiltroFechas sp={sp} />
          <div className="card flex justify-between"><span className="text-muted">Costo de mermas del período</span><span className="font-mono text-2xl font-bold text-danger">{fmtSoles(totalMermas)}</span></div>
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Qué</th><th className="px-4 py-2 text-right">Cantidad</th><th className="px-4 py-2">Motivo</th><th className="px-4 py-2 text-right">Costo</th><th className="px-4 py-2">Por</th></tr></thead><tbody>
            {mermas.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Sin mermas en el período.</td></tr>}
            {mermas.map((m) => <tr key={m.id} className="border-t border-border"><td className="px-4 py-1">{fmtFecha(m.fecha)}</td><td className="px-4 py-1">{m.insumo?.nombre ?? m.producto?.nombre}{m.observaciones && <div className="text-xs text-muted">{m.observaciones}</div>}</td><td className="px-4 py-1 text-right font-mono">{fmtNum(m.cantidad)} {m.insumo?.unidadBase.codigo ?? "u."}</td><td className="px-4 py-1">{m.motivo.nombre}</td><td className="px-4 py-1 text-right font-mono">{fmtSoles(m.costo)}</td><td className="px-4 py-1 text-muted">{m.usuario.nombre}</td></tr>)}
          </tbody></table></div>
        </>
      )}

      {tab === "cortesias" && (
        <>
          {usuario.permisos.has("cortesias.registrar") && (
            <details className="card">
              <summary className="cursor-pointer font-semibold">+ Registrar cortesía</summary>
              <FormAccion accion={registrarCortesia} className="mt-3 grid gap-3 sm:grid-cols-3" textoBoton="Registrar cortesía">
                <div><label className="label">Fecha</label><input type="date" name="fecha" defaultValue={hoyLima} className="input" /></div>
                <div><label className="label">Producto</label><select name="productoId" className="input">{productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
                <div><label className="label">Cantidad</label><input name="cantidad" type="number" min="1" step="1" defaultValue="1" className="input" required /></div>
                <div><label className="label">Motivo</label><select name="motivoId" className="input">{motivosCortesia.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
                <div className="sm:col-span-2"><label className="label">Observación</label><input name="observaciones" className="input" /></div>
              </FormAccion>
            </details>
          )}
          <FiltroFechas sp={sp} />
          <div className="card flex justify-between"><span className="text-muted">Costo de cortesías del período</span><span className="font-mono text-2xl font-bold text-warning">{fmtSoles(totalCortesias)}</span></div>
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Cant.</th><th className="px-4 py-2">Motivo</th><th className="px-4 py-2 text-right">Costo</th><th className="px-4 py-2">Por</th></tr></thead><tbody>
            {cortesias.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Sin cortesías en el período.</td></tr>}
            {cortesias.map((c) => <tr key={c.id} className="border-t border-border"><td className="px-4 py-1">{fmtFecha(c.fecha)}</td><td className="px-4 py-1">{c.producto.nombre}{c.observaciones && <div className="text-xs text-muted">{c.observaciones}</div>}</td><td className="px-4 py-1 text-right">{c.cantidad}</td><td className="px-4 py-1">{c.motivo.nombre}</td><td className="px-4 py-1 text-right font-mono">{fmtSoles(c.costoTotal)}</td><td className="px-4 py-1 text-muted">{c.usuario.nombre}</td></tr>)}
          </tbody></table></div>
        </>
      )}

      {tab === "incidencias" && (
        <>
          {usuario.permisos.has("incidencias.registrar") && (
            <details className="card">
              <summary className="cursor-pointer font-semibold">+ Registrar devolución / rehecho / error</summary>
              <FormAccion accion={registrarIncidencia} className="mt-3 grid gap-3 sm:grid-cols-3" textoBoton="Registrar">
                <div><label className="label">Fecha</label><input type="date" name="fecha" defaultValue={hoyLima} className="input" /></div>
                <div><label className="label">Tipo</label><select name="tipo" className="input">{Object.entries(TIPO_INC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label">N° de pedido (opcional)</label><input name="pedidoNumero" type="number" className="input" /></div>
                <div><label className="label">Producto (opcional)</label><select name="productoId" className="input"><option value="">—</option>{productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
                <div><label className="label">Cantidad</label><input name="cantidad" type="number" min="1" step="1" defaultValue="1" className="input" /></div>
                <div><label className="label">Costo manual (S/, opcional)</label><input name="costoManual" type="number" step="0.01" min="0" className="input" placeholder="si no, receta" /></div>
                <div className="sm:col-span-2"><label className="label">Motivo</label><input name="motivo" className="input" required /></div>
                <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="ajustaInventario" defaultChecked className="size-5 accent-brand" /> Descontar inventario (se volvió a preparar)</label>
                <div className="sm:col-span-3"><label className="label">Observación</label><input name="observaciones" className="input" /></div>
              </FormAccion>
            </details>
          )}
          <FiltroFechas sp={sp} />
          <div className="card flex justify-between"><span className="text-muted">Costo de incidencias del período</span><span className="font-mono text-2xl font-bold text-danger">{fmtSoles(totalIncidencias)}</span></div>
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Producto / pedido</th><th className="px-4 py-2">Motivo</th><th className="px-4 py-2 text-right">Costo</th><th className="px-4 py-2">Por</th></tr></thead><tbody>
            {incidencias.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Sin incidencias en el período.</td></tr>}
            {incidencias.map((i) => <tr key={i.id} className="border-t border-border"><td className="px-4 py-1">{fmtFecha(i.fecha)}</td><td className="px-4 py-1">{TIPO_INC[i.tipo]}</td><td className="px-4 py-1">{i.producto ? `${i.cantidad}× ${i.producto.nombre}` : "—"}{i.pedido && <Link href={`/pedidos/${i.pedido.id}`} className="ml-1 text-brand hover:underline">#{i.pedido.numero}</Link>}{!i.ajustaInventario && <span className="badge ml-1 bg-background text-muted">sin inventario</span>}</td><td className="px-4 py-1">{i.motivo}{i.observaciones && <div className="text-xs text-muted">{i.observaciones}</div>}</td><td className="px-4 py-1 text-right font-mono">{fmtSoles(i.costoGenerado)}</td><td className="px-4 py-1 text-muted">{i.usuario.nombre}</td></tr>)}
          </tbody></table></div>
        </>
      )}
    </div>
  );
}
