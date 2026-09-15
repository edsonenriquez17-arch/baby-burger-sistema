import type { Metadata } from "next";
import Link from "next/link";
import type { TipoInsumo } from "@prisma/client";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { D, obtenerCostosVigentes } from "@/lib/costeo/costeo";
import { fmtNum, fmtSoles } from "@/lib/formato";

export const metadata: Metadata = { title: "Inventario" };

const TABS: { valor: TipoInsumo; etiqueta: string }[] = [
  { valor: "INGREDIENTE", etiqueta: "Ingredientes" },
  { valor: "EMPAQUE", etiqueta: "Empaques" },
  { valor: "PREPARACION", etiqueta: "Preparaciones" },
];

export default async function InventarioPage({ searchParams }: { searchParams: Promise<{ t?: string; q?: string; alerta?: string }> }) {
  const usuario = await requerirPermiso("inventario.ver");
  const { t, q, alerta } = await searchParams;
  const tipo = (TABS.find((x) => x.valor === t)?.valor ?? "INGREDIENTE") as TipoInsumo;
  const insumos = await db.insumo.findMany({
    where: { tipo, activo: true, ...(q ? { nombre: { contains: q, mode: "insensitive" } } : {}) },
    include: { unidadBase: true, categoria: true },
    orderBy: [{ categoria: { orden: "asc" } }, { nombre: "asc" }],
  });
  const costos = await obtenerCostosVigentes(db, insumos.map((i) => i.id));
  const filas = insumos
    .map((i) => {
      const costo = costos.get(i.id)?.costo ?? null;
      const bajo = i.stockMinimo !== null && i.stockActual.lt(i.stockMinimo);
      return { i, costo, valor: costo ? costo.mul(i.stockActual) : null, bajo };
    })
    .filter((f) => alerta !== "1" || f.bajo);
  const valorTotal = filas.reduce((a, f) => a.add(f.valor ?? new D(0)), new D(0));
  const verFinanzas = usuario.permisos.has("reportes.financieros");

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Inventario</h1>
        <p className="text-sm text-muted">Se actualiza solo con cada venta (según recetas y empaques), compra, lote producido, merma, cortesía o ajuste.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <Link key={tab.valor} href={`/inventario?t=${tab.valor}`} className={`badge px-3 py-1.5 ${tab.valor === tipo ? "bg-brand text-brand-contrast" : "border border-border bg-surface"}`}>{tab.etiqueta}</Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          <input type="hidden" name="t" value={tipo} />
          <input name="q" defaultValue={q} placeholder="Buscar…" className="input w-44 py-1.5 text-sm" />
          <label className="flex items-center gap-1 text-sm text-muted"><input type="checkbox" name="alerta" value="1" defaultChecked={alerta === "1"} className="size-4 accent-brand" /> solo bajo mínimo</label>
          <button className="btn btn-secondary min-h-9 px-3 text-xs">Filtrar</button>
        </form>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs uppercase text-muted">
            <tr><th className="px-4 py-2">Insumo</th><th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2 text-right">Mínimo</th>{verFinanzas && <th className="px-4 py-2 text-right">Valor</th>}<th className="px-4 py-2">Estado</th></tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Sin resultados.</td></tr>}
            {filas.map(({ i, valor, bajo }) => (
              <tr key={i.id} className="border-t border-border">
                <td className="px-4 py-2"><Link href={`/inventario/${i.id}`} className="font-medium text-brand hover:underline">{i.nombre}</Link><div className="text-xs text-muted">{i.categoria?.nombre}</div></td>
                <td className={`px-4 py-2 text-right font-mono ${i.stockActual.lt(0) ? "text-danger" : ""}`}>{fmtNum(i.stockActual)} {i.unidadBase.codigo}</td>
                <td className="px-4 py-2 text-right font-mono text-muted">{i.stockMinimo === null ? "—" : `${fmtNum(i.stockMinimo)} ${i.unidadBase.codigo}`}</td>
                {verFinanzas && <td className="px-4 py-2 text-right font-mono text-muted">{fmtSoles(valor)}</td>}
                <td className="px-4 py-2">
                  {i.stockActual.lt(0) ? <span className="badge bg-danger/10 text-danger">negativo: registra compra o ajusta</span> : bajo ? <span className="badge bg-warning/15 text-warning">comprar</span> : i.stockMinimo === null ? <span className="badge bg-border text-muted">sin mínimo</span> : <span className="badge bg-success/15 text-success">ok</span>}
                </td>
              </tr>
            ))}
          </tbody>
          {verFinanzas && (
            <tfoot><tr className="border-t border-border bg-background font-semibold"><td className="px-4 py-2" colSpan={3}>Valor del inventario ({TABS.find((x) => x.valor === tipo)?.etiqueta.toLowerCase()})</td><td className="px-4 py-2 text-right font-mono">{fmtSoles(valorTotal)}</td><td /></tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
