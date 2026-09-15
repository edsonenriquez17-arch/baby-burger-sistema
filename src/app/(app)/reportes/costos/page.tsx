import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { fmtFecha, fmtFechaHora, fmtPct, fmtSoles } from "@/lib/formato";
import { FiltroFechas, rangoDesdeParams } from "@/components/filtro-fechas";

export const metadata: Metadata = { title: "Evolución de costos" };

export default async function CostosPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; q?: string }> }) {
  await requerirPermiso("reportes.financieros");
  const sp = await searchParams;
  const { desde, hasta } = rangoDesdeParams(sp, "mes");
  const [precios, costos] = await Promise.all([
    db.precioInsumo.findMany({
      where: { vigenteDesde: { gte: desde, lte: hasta }, ...(sp.q ? { insumo: { nombre: { contains: sp.q, mode: "insensitive" } } } : {}) },
      include: { insumo: { include: { unidadBase: true } }, presentacion: true },
      orderBy: { vigenteDesde: "desc" },
    }),
    db.costoProductoHistorial.findMany({
      where: { fecha: { gte: desde, lte: hasta }, ...(sp.q ? { producto: { nombre: { contains: sp.q, mode: "insensitive" } } } : {}) },
      include: { producto: { select: { id: true, nombre: true, precioVenta: true } } },
      orderBy: { fecha: "desc" },
    }),
  ]);

  // Variación por insumo dentro del período: primero vs último.
  const porInsumo = new Map<string, typeof precios>();
  for (const p of precios) (porInsumo.get(p.insumoId) ?? porInsumo.set(p.insumoId, []).get(p.insumoId)!).push(p);
  const variaciones = [...porInsumo.values()].map((lista) => {
    const ultimo = lista[0], primero = lista[lista.length - 1];
    const pct = primero.costoUnitarioBase.gt(0) ? ultimo.costoUnitarioBase.sub(primero.costoUnitarioBase).div(primero.costoUnitarioBase).mul(100) : null;
    return { insumo: ultimo.insumo, primero, ultimo, pct, cambios: lista.length };
  }).sort((a, b) => (b.pct?.abs().toNumber() ?? 0) - (a.pct?.abs().toNumber() ?? 0));

  const porProducto = new Map<string, typeof costos>();
  for (const c of costos) (porProducto.get(c.productoId) ?? porProducto.set(c.productoId, []).get(c.productoId)!).push(c);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <Link href="/reportes" className="text-sm text-muted hover:underline">← reportes</Link>
        <h1 className="text-2xl font-bold">Evolución de costos</h1>
        <p className="text-sm text-muted">Qué insumos cambiaron de precio en el período y cómo movieron el costo de cada producto. Del {fmtFecha(desde)} al {fmtFecha(hasta)}.</p>
      </div>
      <FiltroFechas sp={sp} conBusqueda placeholder="insumo o producto" />

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-border px-4 py-2 font-semibold">Insumos con cambios de precio ({variaciones.length})</div>
        <table className="w-full text-sm"><thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Insumo</th><th className="px-4 py-2 text-right">Al inicio</th><th className="px-4 py-2 text-right">Ahora</th><th className="px-4 py-2 text-right">Variación</th><th className="px-4 py-2 text-right">Cambios</th></tr></thead>
          <tbody>
            {variaciones.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Sin cambios de precio en el período.</td></tr>}
            {variaciones.map((v) => (
              <tr key={v.insumo.id} className="border-t border-border">
                <td className="px-4 py-1"><Link href={`/insumos/${v.insumo.id}`} className="text-brand hover:underline">{v.insumo.nombre}</Link><span className="text-xs text-muted"> / {v.insumo.unidadBase.codigo}</span></td>
                <td className="px-4 py-1 text-right font-mono text-muted">{fmtSoles(v.primero.costoUnitarioBase, true)}</td>
                <td className="px-4 py-1 text-right font-mono">{fmtSoles(v.ultimo.costoUnitarioBase, true)}</td>
                <td className={`px-4 py-1 text-right font-mono font-semibold ${v.pct?.gt(0) ? "text-danger" : v.pct?.lt(0) ? "text-success" : ""}`}>{v.pct?.gt(0) ? "+" : ""}{fmtPct(v.pct)}</td>
                <td className="px-4 py-1 text-right">{v.cambios}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Costo de productos a lo largo del período</h2>
        {porProducto.size === 0 && <p className="card text-center text-muted">Sin cambios de costo en el período.</p>}
        {[...porProducto.entries()].map(([id, lista]) => {
          const ultimo = lista[0], primero = lista[lista.length - 1];
          const min = lista.reduce((a, c) => (c.costoTotal.lt(a.costoTotal) ? c : a));
          const max = lista.reduce((a, c) => (c.costoTotal.gt(a.costoTotal) ? c : a));
          return (
            <details key={id} className="card">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <Link href={`/recetas/${id}`} className="font-semibold text-brand hover:underline">{ultimo.producto.nombre}</Link>
                <span className="text-sm text-muted">{fmtSoles(primero.costoTotal)} → <span className="font-mono text-foreground">{fmtSoles(ultimo.costoTotal)}</span></span>
                <span className="text-xs text-muted">mín {fmtSoles(min.costoTotal)} ({fmtFecha(min.fecha)}) · máx {fmtSoles(max.costoTotal)} ({fmtFecha(max.fecha)}) · precio {fmtSoles(ultimo.producto.precioVenta)}</span>
              </summary>
              <table className="mt-3 w-full text-sm"><tbody>
                {lista.map((c) => <tr key={c.id} className="border-t border-border"><td className="py-1 pr-3 whitespace-nowrap text-muted">{fmtFechaHora(c.fecha)}</td><td className="py-1 pr-3 text-right font-mono">{fmtSoles(c.costoTotal)}{!c.completo && <span className="text-warning"> *</span>}</td><td className="py-1 text-muted">{c.motivo}</td></tr>)}
              </tbody></table>
            </details>
          );
        })}
      </div>
    </div>
  );
}
