import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { D } from "@/lib/costeo/costeo";
import { fmtFecha, fmtNum, fmtSoles } from "@/lib/formato";
import { rangoDesdeParams, FiltroFechas } from "@/components/filtro-fechas";

export const metadata: Metadata = { title: "Compras" };

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; q?: string }> }) {
  const usuario = await requerirPermiso("compras.ver");
  const sp = await searchParams;
  const { desde, hasta } = rangoDesdeParams(sp, "mes");
  const compras = await db.compra.findMany({
    where: { fecha: { gte: desde, lte: hasta }, ...(sp.q ? { OR: [{ proveedor: { nombre: { contains: sp.q, mode: "insensitive" } } }, { items: { some: { insumo: { nombre: { contains: sp.q, mode: "insensitive" } } } } }] } : {}) },
    include: { proveedor: true, metodoPago: true, usuario: { select: { nombre: true } }, items: { include: { insumo: { include: { unidadBase: true } }, presentacion: true } } },
    orderBy: { fecha: "desc" },
  });
  const total = compras.reduce((a, c) => a.add(c.total), new D(0));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Compras de inventario</h1>
          <p className="text-sm text-muted">Dinero que salió para comprar insumos. No es lo mismo que el costo de lo vendido (eso está en Reportes).</p>
        </div>
        {usuario.permisos.has("compras.registrar") && <Link href="/compras/nueva" className="btn btn-primary min-h-10 text-sm">+ Nueva compra</Link>}
      </div>
      <FiltroFechas sp={sp} conBusqueda placeholder="proveedor o insumo" />
      <div className="card flex items-baseline justify-between"><span className="text-muted">Total del período</span><span className="font-mono text-2xl font-bold">{fmtSoles(total)}</span></div>
      {compras.length === 0 && <p className="card text-center text-muted">Sin compras en el período.</p>}
      {compras.map((c) => (
        <details key={c.id} className="card">
          <summary className="flex cursor-pointer flex-wrap items-center gap-3">
            <span className="font-semibold">{fmtFecha(c.fecha)}</span>
            <span className="text-muted">{c.proveedor?.nombre ?? "sin proveedor"}{c.numeroComprobante && ` · ${c.numeroComprobante}`}</span>
            <span className="text-xs text-muted">{c.items.length} línea(s) · {c.metodoPago?.nombre ?? "—"}{c.pagadoDesdeCaja && " · desde caja"}</span>
            <span className="ml-auto font-mono font-semibold">{fmtSoles(c.total)}</span>
          </summary>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {c.items.map((it) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="py-1 pr-3">{it.insumo.nombre}</td>
                  <td className="py-1 pr-3 text-muted">{fmtNum(it.cantidad)} × {it.presentacion?.nombre ?? it.insumo.unidadBase.codigo} @ {fmtSoles(it.precioUnitario)}</td>
                  <td className="py-1 pr-3 text-right text-muted">= {fmtNum(it.cantidadBase)} {it.insumo.unidadBase.codigo}</td>
                  <td className="py-1 pr-3 text-right font-mono text-muted">{fmtSoles(it.costoUnitarioBase, true)}/{it.insumo.unidadBase.codigo}</td>
                  <td className="py-1 text-right font-mono">{fmtSoles(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.observaciones && <p className="mt-2 text-xs text-muted">{c.observaciones}</p>}
          <p className="mt-1 text-xs text-muted">Registrado por {c.usuario.nombre}</p>
        </details>
      ))}
    </div>
  );
}
