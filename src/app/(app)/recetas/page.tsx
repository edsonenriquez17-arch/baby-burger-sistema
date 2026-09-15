import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { calcularMetricas, costearItems, obtenerCostosVigentes, obtenerParametrosMargen, INCLUDE_ITEM_COSTEABLE } from "@/lib/costeo/costeo";
import { fmtPct, fmtSoles } from "@/lib/formato";
import { canalPredeterminado, costearReglas, empaquesPorItem, obtenerReglasEmpaque } from "@/lib/costeo/empaques";

export const metadata: Metadata = { title: "Recetas y rentabilidad" };

export default async function RecetasPage() {
  const usuario = await requerirPermiso("recetas.ver");
  const [productos, costos, margen, reglas, canal] = await Promise.all([
    db.producto.findMany({
      where: { activo: true },
      include: { categoria: true, receta: { include: { items: { include: INCLUDE_ITEM_COSTEABLE } } } },
      orderBy: [{ categoria: { orden: "asc" } }, { orden: "asc" }, { nombre: "asc" }],
    }),
    obtenerCostosVigentes(),
    obtenerParametrosMargen(),
    obtenerReglasEmpaque(),
    canalPredeterminado(),
  ]);
  const verFinanzas = usuario.permisos.has("reportes.financieros") || usuario.rol === "ADMIN";

  const filas = productos.map((p) => {
    const { total, completo, lineas } = costearItems(p.receta?.items ?? [], costos);
    const empaque = costearReglas(empaquesPorItem(reglas, canal, { id: p.id, categoriaId: p.categoriaId }), costos);
    const costo = p.receta?.items.length ? total.add(empaque.total) : null;
    const m = calcularMetricas(p.precioVenta, costo, margen.objetivo, margen.alerta);
    return { p, costo, comida: total, empaque: empaque.total, completo: completo && empaque.completo, pendientes: lineas.filter((l) => l.pendiente).length, m };
  });

  const grupos = new Map<string, typeof filas>();
  for (const f of filas) (grupos.get(f.p.categoria.nombre) ?? grupos.set(f.p.categoria.nombre, []).get(f.p.categoria.nombre)!).push(f);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Recetas y rentabilidad</h1>
        <p className="text-sm text-muted">
          Costo real = comida + empaque por unidad del canal predeterminado ({canal.toLowerCase()}), con precios vigentes. Margen objetivo {margen.objetivo} %, alerta bajo {margen.alerta} % (Configuración → General).
        </p>
      </div>

      {[...grupos.entries()].map(([categoria, lista]) => (
        <div key={categoria} className="card overflow-x-auto p-0">
          <div className="border-b border-border px-4 py-2 font-semibold">{categoria}</div>
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2 text-right">Precio</th>
                <th className="px-4 py-2 text-right">Comida</th>
                <th className="px-4 py-2 text-right">Empaque</th>
                <th className="px-4 py-2 text-right">Costo real</th>
                {verFinanzas && (
                  <>
                    <th className="px-4 py-2 text-right">Ganancia</th>
                    <th className="px-4 py-2 text-right">Margen</th>
                    <th className="px-4 py-2 text-right">Markup</th>
                    <th className="px-4 py-2 text-right">P. recomendado</th>
                  </>
                )}
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ p, costo, comida, empaque, completo, pendientes, m }) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/recetas/${p.id}`} className="font-medium text-brand hover:underline">{p.nombre}</Link>
                    {p.esExtra && <span className="badge ml-2 bg-background text-muted">extra</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{fmtSoles(p.precioVenta)}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted">{costo === null ? "—" : fmtSoles(comida)}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted">{costo === null ? "—" : fmtSoles(empaque)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtSoles(costo)}{costo !== null && !completo && <span className="text-warning"> *</span>}</td>
                  {verFinanzas && (
                    <>
                      <td className="px-4 py-2 text-right font-mono">{fmtSoles(m.ganancia)}</td>
                      <td className={`px-4 py-2 text-right font-mono ${m.alerta ? "font-semibold text-danger" : ""}`}>{fmtPct(m.margenPct)}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtPct(m.markupPct)}</td>
                      <td className="px-4 py-2 text-right font-mono text-muted">{fmtSoles(m.precioRecomendado)}</td>
                    </>
                  )}
                  <td className="px-4 py-2">
                    {costo === null ? (
                      <span className="badge bg-border text-muted">sin receta</span>
                    ) : completo ? (
                      m.alerta ? <span className="badge bg-danger/10 text-danger">margen bajo</span> : <span className="badge bg-success/15 text-success">ok</span>
                    ) : (
                      <span className="badge bg-warning/15 text-warning">{pendientes} pendiente{pendientes === 1 ? "" : "s"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-xs text-muted">* costo parcial: solo suma los ingredientes con cantidad y precio conocidos.</p>
    </div>
  );
}
