import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { D, type Dec } from "@/lib/costeo/costeo";
import { fmtFecha, fmtSoles } from "@/lib/formato";
import { FormAccion } from "@/components/form-accion";
import { FiltroFechas, rangoDesdeParams } from "@/components/filtro-fechas";
import { registrarGasto } from "./actions";

export const metadata: Metadata = { title: "Gastos" };

export default async function GastosPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; q?: string; categoria?: string }> }) {
  const usuario = await requerirPermiso("gastos.ver");
  const sp = await searchParams;
  const { desde, hasta, hoyLima } = rangoDesdeParams(sp, "mes");
  const [gastos, categorias, metodos] = await Promise.all([
    db.gasto.findMany({
      where: { fecha: { gte: desde, lte: hasta }, ...(sp.categoria ? { categoriaId: sp.categoria } : {}), ...(sp.q ? { descripcion: { contains: sp.q, mode: "insensitive" } } : {}) },
      include: { categoria: true, metodoPago: true, usuario: { select: { nombre: true } } },
      orderBy: { fecha: "desc" },
    }),
    db.categoriaGasto.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
    db.metodoPago.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
  ]);
  const total = gastos.reduce((a, g) => a.add(g.monto), new D(0));
  const porCategoria = new Map<string, Dec>();
  for (const g of gastos) porCategoria.set(g.categoria.nombre, (porCategoria.get(g.categoria.nombre) ?? new D(0)).add(g.monto));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Gastos operativos</h1>
        <p className="text-sm text-muted">Todo lo que no es compra de insumos: alquiler, servicios, gasolina, publicidad, reparaciones… Marca los fijos para el punto de equilibrio.</p>
      </div>

      {usuario.permisos.has("gastos.registrar") && (
        <details className="card" open={gastos.length === 0}>
          <summary className="cursor-pointer font-semibold">+ Registrar gasto</summary>
          <FormAccion accion={registrarGasto} className="mt-3 grid gap-3 sm:grid-cols-3" textoBoton="Registrar">
            <div><label className="label">Fecha</label><input type="date" name="fecha" defaultValue={hoyLima} className="input" /></div>
            <div><label className="label">Categoría</label><select name="categoriaId" className="input">{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.esFijo ? " (fijo)" : ""}</option>)}</select></div>
            <div><label className="label">Monto (S/)</label><input name="monto" type="number" step="0.01" min="0" className="input" required /></div>
            <div className="sm:col-span-2"><label className="label">Descripción</label><input name="descripcion" className="input" required /></div>
            <div><label className="label">Pagado con</label><select name="metodoPagoId" className="input">{metodos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
            <div><label className="label">Comprobante (link o número)</label><input name="comprobante" className="input" /></div>
            <div><label className="label">Observaciones</label><input name="observaciones" className="input" /></div>
            <div className="flex flex-col justify-end gap-1 pb-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="pagadoDesdeCaja" defaultChecked className="size-5 accent-brand" /> Salió de la caja del día</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="esFijo" className="size-5 accent-brand" /> Es gasto fijo mensual</label>
            </div>
          </FormAccion>
        </details>
      )}

      <FiltroFechas sp={sp} conBusqueda placeholder="descripción" extra={<div><label className="label">Categoría</label><select name="categoria" defaultValue={sp.categoria ?? ""} className="input py-1.5 text-sm"><option value="">todas</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>} />

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div className="card"><div className="text-xs uppercase text-muted">Total del período</div><div className="font-mono text-2xl font-bold">{fmtSoles(total)}</div></div>
        <div className="card text-sm"><div className="text-xs uppercase text-muted">Por categoría</div>{[...porCategoria.entries()].sort((a, b) => b[1].cmp(a[1])).map(([n, m]) => <div key={n} className="flex justify-between"><span>{n}</span><span className="font-mono">{fmtSoles(m)}</span></div>)}</div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Categoría</th><th className="px-4 py-2">Descripción</th><th className="px-4 py-2 text-right">Monto</th><th className="px-4 py-2">Pago</th><th className="px-4 py-2">Por</th></tr></thead>
          <tbody>
            {gastos.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Sin gastos en el período.</td></tr>}
            {gastos.map((g) => (
              <tr key={g.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-1">{fmtFecha(g.fecha)}</td>
                <td className="px-4 py-1">{g.categoria.nombre}{g.esFijo && <span className="badge ml-1 bg-background text-muted">fijo</span>}</td>
                <td className="px-4 py-1">{g.descripcion}{g.observaciones && <div className="text-xs text-muted">{g.observaciones}</div>}</td>
                <td className="px-4 py-1 text-right font-mono">{fmtSoles(g.monto)}</td>
                <td className="px-4 py-1 text-muted">{g.metodoPago?.nombre ?? "—"}{g.pagadoDesdeCaja && " · caja"}</td>
                <td className="px-4 py-1 text-muted">{g.usuario.nombre}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
