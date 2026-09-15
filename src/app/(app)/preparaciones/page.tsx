import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { costearItems, obtenerCostosVigentes, INCLUDE_ITEM_COSTEABLE, D } from "@/lib/costeo/costeo";
import { fmtNum, fmtSoles } from "@/lib/formato";

export const metadata: Metadata = { title: "Preparaciones" };

export default async function PreparacionesPage({ searchParams }: { searchParams: Promise<{ inactivas?: string }> }) {
  const usuario = await requerirPermiso("recetas.ver");
  const { inactivas } = await searchParams;
  const preparaciones = await db.preparacion.findMany({
    where: inactivas === "1" ? {} : { activa: true },
    include: { insumoResultado: { include: { unidadBase: true } }, rendimientoUnidad: true, items: { include: INCLUDE_ITEM_COSTEABLE } },
    orderBy: { nombre: "asc" },
  });
  const costos = await obtenerCostosVigentes();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Preparaciones</h1>
          <p className="text-sm text-muted">Mayonesa, ají, chimichurri, chicha… Se usan como ingrediente en otras recetas; su costo por g/ml/unidad se calcula solo.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={inactivas === "1" ? "/preparaciones" : "/preparaciones?inactivas=1"} className="text-sm text-muted hover:underline">{inactivas === "1" ? "ocultar inactivas" : "ver inactivas"}</Link>
          {usuario.permisos.has("recetas.editar") && <Link href="/preparaciones/nueva" className="btn btn-primary min-h-10 text-sm">+ Nueva preparación</Link>}
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs uppercase text-muted">
            <tr><th className="px-4 py-2">Preparación</th><th className="px-4 py-2 text-right">Ingredientes</th><th className="px-4 py-2 text-right">Costo del lote</th><th className="px-4 py-2 text-right">Rinde</th><th className="px-4 py-2 text-right">Costo unitario</th><th className="px-4 py-2">Estado</th></tr>
          </thead>
          <tbody>
            {preparaciones.map((p) => {
              const { total, completo } = costearItems(p.items, costos);
              const base = p.insumoResultado.unidadBase.codigo;
              const vigente = costos.get(p.insumoResultadoId)?.costo ?? null;
              const pendientes = p.items.filter((i) => i.cantidad === null).length;
              return (
                <tr key={p.id} className={`border-t border-border ${p.activa ? "" : "opacity-50"}`}>
                  <td className="px-4 py-2"><Link href={`/preparaciones/${p.id}`} className="font-medium text-brand hover:underline">{p.nombre}</Link></td>
                  <td className="px-4 py-2 text-right">{p.items.length}{pendientes > 0 && <span className="ml-1 text-xs text-warning">({pendientes} pendientes)</span>}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.items.length ? fmtSoles(total) : "—"}</td>
                  <td className="px-4 py-2 text-right">{p.rendimientoCantidad ? `${fmtNum(p.rendimientoCantidad)} ${p.rendimientoUnidad.codigo}` : <span className="badge bg-warning/15 text-warning">pendiente</span>}</td>
                  <td className="px-4 py-2 text-right font-mono">{vigente ? `${fmtSoles(vigente, true)} / ${base}` : "—"}{vigente && base !== "unidad" && <div className="text-xs text-muted">{fmtSoles(vigente.mul(new D(1000)))} / {base === "g" ? "kg" : "L"}</div>}</td>
                  <td className="px-4 py-2">{p.items.length === 0 ? <span className="badge bg-border text-muted">sin receta</span> : completo && p.rendimientoCantidad ? <span className="badge bg-success/15 text-success">completa</span> : <span className="badge bg-warning/15 text-warning">incompleta</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
