import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { fmtFechaHora, fmtNum, fmtSoles } from "@/lib/formato";
import { FormAccion } from "@/components/form-accion";
import { ajustarStock, producirLote } from "../actions";

const TIPO: Record<string, string> = {
  STOCK_INICIAL: "stock inicial", ENTRADA_COMPRA: "compra", ENTRADA_PREPARACION: "lote producido", SALIDA_PREPARACION: "usado en lote", SALIDA_VENTA: "venta",
  SALIDA_CORTESIA: "cortesía", SALIDA_MERMA: "merma", SALIDA_INCIDENCIA: "incidencia", AJUSTE_POSITIVO: "ajuste +", AJUSTE_NEGATIVO: "ajuste −", REVERSION: "anulación",
};

export default async function MovimientosPage({ params, searchParams }: { params: Promise<{ insumoId: string }>; searchParams: Promise<{ desde?: string; hasta?: string; tipo?: string }> }) {
  const usuario = await requerirPermiso("inventario.ver");
  const { insumoId } = await params;
  const { desde, hasta, tipo } = await searchParams;
  const insumo = await db.insumo.findUnique({ where: { id: insumoId }, include: { unidadBase: true, preparacion: { include: { rendimientoUnidad: true } } } });
  if (!insumo) notFound();

  const movimientos = await db.movimientoInventario.findMany({
    where: {
      insumoId,
      ...(desde ? { fecha: { gte: new Date(desde) } } : {}),
      ...(hasta ? { fecha: { lte: new Date(`${hasta}T23:59:59`) } } : {}),
      ...(tipo ? { tipo: tipo as never } : {}),
    },
    include: { usuario: { select: { nombre: true } } },
    orderBy: { fecha: "desc" },
    take: 300,
  });
  const puedeAjustar = usuario.permisos.has("inventario.ajustar");
  const base = insumo.unidadBase.codigo;
  const rutaDetalle = insumo.tipo === "EMPAQUE" ? `/empaques/${insumoId}` : insumo.tipo === "PREPARACION" && insumo.preparacion ? `/preparaciones/${insumo.preparacion.id}` : `/insumos/${insumoId}`;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/inventario" className="text-sm text-muted hover:underline">← inventario</Link>
        <h1 className="text-2xl font-bold">{insumo.nombre}</h1>
        <p className="text-sm text-muted">Stock actual: <span className="font-mono font-semibold text-foreground">{fmtNum(insumo.stockActual)} {base}</span>{insumo.stockMinimo !== null && ` · mínimo ${fmtNum(insumo.stockMinimo)} ${base}`} · <Link href={rutaDetalle} className="text-brand hover:underline">ver ficha</Link></p>
      </div>

      {puedeAjustar && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <h2 className="font-semibold">Ajustar stock</h2>
            <p className="text-xs text-muted">Conteo físico, corrección de error, etc. Queda registrado con motivo y usuario.</p>
            <FormAccion accion={ajustarStock} className="mt-2 grid gap-2" textoBoton="Registrar ajuste" claseBoton="btn btn-secondary min-h-10 text-sm">
              <input type="hidden" name="insumoId" value={insumoId} />
              <div className="flex gap-2">
                <select name="modo" className="input w-36 py-1.5 text-sm"><option value="fijar">Fijar en</option><option value="sumar">Sumar</option><option value="restar">Restar</option></select>
                <input name="cantidad" type="number" step="any" min="0" className="input py-1.5 text-sm" placeholder={base} required />
              </div>
              <input name="motivo" className="input py-1.5 text-sm" placeholder="Motivo (obligatorio)" required />
            </FormAccion>
          </div>
          {insumo.preparacion && (
            <div className="card">
              <h2 className="font-semibold">Producir lote</h2>
              <p className="text-xs text-muted">Entra la preparación y salen sus ingredientes en proporción a la receta.</p>
              <FormAccion accion={producirLote} className="mt-2 grid gap-2" textoBoton="Registrar lote" claseBoton="btn btn-primary min-h-10 text-sm">
                <input type="hidden" name="preparacionId" value={insumo.preparacion.id} />
                <div className="flex items-center gap-2">
                  <input name="cantidad" type="number" step="any" min="0" className="input py-1.5 text-sm" defaultValue={insumo.preparacion.rendimientoCantidad?.toString() ?? ""} required />
                  <span className="text-sm text-muted">{insumo.preparacion.rendimientoUnidad.codigo}</span>
                </div>
              </FormAccion>
            </div>
          )}
        </div>
      )}

      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <div><label className="label">Desde</label><input type="date" name="desde" defaultValue={desde} className="input py-1.5 text-sm" /></div>
        <div><label className="label">Hasta</label><input type="date" name="hasta" defaultValue={hasta} className="input py-1.5 text-sm" /></div>
        <div><label className="label">Tipo</label><select name="tipo" defaultValue={tipo ?? ""} className="input py-1.5 text-sm"><option value="">todos</option>{Object.entries(TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <button className="btn btn-secondary min-h-9 px-3 text-xs">Filtrar</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2 text-right">Cantidad</th><th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2 text-right">Costo unit.</th><th className="px-4 py-2">Motivo</th><th className="px-4 py-2">Usuario</th></tr></thead>
          <tbody>
            {movimientos.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">Sin movimientos.</td></tr>}
            {movimientos.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-1">{fmtFechaHora(m.fecha)}</td>
                <td className="px-4 py-1"><span className="badge bg-background">{TIPO[m.tipo] ?? m.tipo}</span></td>
                <td className={`px-4 py-1 text-right font-mono ${m.cantidad.lt(0) ? "text-danger" : "text-success"}`}>{m.cantidad.gt(0) ? "+" : ""}{fmtNum(m.cantidad)} {base}</td>
                <td className="px-4 py-1 text-right font-mono text-muted">{fmtNum(m.stockResultante)}</td>
                <td className="px-4 py-1 text-right font-mono text-muted">{fmtSoles(m.costoUnitario, true)}</td>
                <td className="px-4 py-1 text-muted">{m.motivo}{m.referenciaTipo === "Pedido" && m.referenciaId && <Link href={`/pedidos/${m.referenciaId}`} className="ml-1 text-brand hover:underline">ver</Link>}</td>
                <td className="px-4 py-1 text-muted">{m.usuario?.nombre ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
