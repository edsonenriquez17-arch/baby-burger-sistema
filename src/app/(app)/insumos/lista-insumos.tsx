import Link from "next/link";
import type { TipoInsumo } from "@prisma/client";
import { db } from "@/lib/db";
import { obtenerCostosVigentes, D } from "@/lib/costeo/costeo";
import { fmtSoles, fmtNum } from "@/lib/formato";

const MULTIPLO: Record<string, { etiqueta: string; factor: number }> = {
  g: { etiqueta: "por kg", factor: 1000 },
  ml: { etiqueta: "por L", factor: 1000 },
  unidad: { etiqueta: "por unidad", factor: 1 },
};

export async function ListaInsumos({ tipo, rutaBase, buscar, mostrarInactivos }: { tipo: TipoInsumo; rutaBase: string; buscar?: string; mostrarInactivos?: boolean }) {
  const insumos = await db.insumo.findMany({
    where: {
      tipo,
      ...(mostrarInactivos ? {} : { activo: true }),
      ...(buscar ? { nombre: { contains: buscar, mode: "insensitive" } } : {}),
    },
    include: {
      categoria: true,
      unidadBase: true,
      presentaciones: { where: { activa: true }, include: { marca: true } },
    },
    orderBy: [{ categoria: { orden: "asc" } }, { nombre: "asc" }],
  });
  const costos = await obtenerCostosVigentes(db, insumos.map((i) => i.id));

  if (insumos.length === 0) {
    return <div className="card text-center text-muted">No hay resultados.</div>;
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="bg-background text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-2">Nombre</th>
            <th className="px-4 py-2">Categoría</th>
            <th className="px-4 py-2 text-right">Costo unitario</th>
            <th className="px-4 py-2 text-right">Equivalente</th>
            <th className="px-4 py-2 text-right">Stock</th>
            <th className="px-4 py-2">Presentaciones</th>
          </tr>
        </thead>
        <tbody>
          {insumos.map((i) => {
            const c = costos.get(i.id)?.costo ?? null;
            const mult = MULTIPLO[i.unidadBase.codigo] ?? MULTIPLO.unidad;
            const bajoMinimo = i.stockMinimo !== null && i.stockActual.lt(i.stockMinimo);
            return (
              <tr key={i.id} className={`border-t border-border ${i.activo ? "" : "opacity-50"}`}>
                <td className="px-4 py-2">
                  <Link href={`${rutaBase}/${i.id}`} className="font-medium text-brand hover:underline">
                    {i.nombre}
                  </Link>
                  {!i.activo && <span className="badge ml-2 bg-border text-muted">inactivo</span>}
                  {i.esCostoCompartido && <span className="badge ml-2 bg-brand-light text-brand">costo compartido</span>}
                </td>
                <td className="px-4 py-2 text-muted">{i.categoria?.nombre ?? "—"}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {c === null ? <span className="badge bg-warning/15 text-warning">sin precio</span> : `${fmtSoles(c, true)} / ${i.unidadBase.codigo}`}
                </td>
                <td className="px-4 py-2 text-right text-muted">{c === null ? "—" : `${fmtSoles(c.mul(new D(mult.factor)))} ${mult.etiqueta}`}</td>
                <td className={`px-4 py-2 text-right ${bajoMinimo ? "font-semibold text-danger" : ""}`}>
                  {fmtNum(i.stockActual)} {i.unidadBase.codigo}
                  {bajoMinimo && " ⚠"}
                </td>
                <td className="px-4 py-2 text-xs text-muted">
                  {i.presentaciones.length === 0
                    ? "—"
                    : i.presentaciones.map((p) => (p.esPredeterminada ? "★ " : "") + (p.marca ? `${p.marca.nombre} · ` : "") + p.nombre).join(" | ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Barra de búsqueda + botón nuevo, compartida por ingredientes y empaques. */
export function BarraInsumos({ rutaBase, buscar, mostrarInactivos, textoNuevo }: { rutaBase: string; buscar?: string; mostrarInactivos?: boolean; textoNuevo: string }) {
  return (
    <form className="flex flex-wrap items-center gap-2" method="get">
      <input name="q" defaultValue={buscar} placeholder="Buscar…" className="input w-56" aria-label="Buscar" />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="inactivos" value="1" defaultChecked={mostrarInactivos} className="size-4 accent-brand" /> ver inactivos
      </label>
      <button className="btn btn-secondary min-h-10 text-sm">Filtrar</button>
      <Link href={`${rutaBase}/nuevo`} className="btn btn-primary ml-auto min-h-10 text-sm">
        {textoNuevo}
      </Link>
    </form>
  );
}
