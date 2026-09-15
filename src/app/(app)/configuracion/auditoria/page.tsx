import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { fmtFechaHora } from "@/lib/formato";
import { FiltroFechas, rangoDesdeParams } from "@/components/filtro-fechas";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; q?: string; entidad?: string; usuario?: string; accion?: string }> }) {
  await requerirPermiso("auditoria.ver");
  const sp = await searchParams;
  const { desde, hasta } = rangoDesdeParams(sp, "semana");
  const [logs, entidades, usuarios, acciones] = await Promise.all([
    db.logAuditoria.findMany({
      where: {
        fecha: { gte: desde, lte: hasta },
        ...(sp.entidad ? { entidad: sp.entidad } : {}),
        ...(sp.usuario ? { usuarioId: sp.usuario } : {}),
        ...(sp.accion ? { accion: sp.accion } : {}),
        ...(sp.q ? { OR: [{ descripcion: { contains: sp.q, mode: "insensitive" } }, { entidadId: sp.q }] } : {}),
      },
      orderBy: { fecha: "desc" },
      take: 500,
      include: { usuario: { select: { nombre: true } } },
    }),
    db.logAuditoria.findMany({ distinct: ["entidad"], select: { entidad: true }, orderBy: { entidad: "asc" } }),
    db.usuario.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    db.logAuditoria.findMany({ distinct: ["accion"], select: { accion: true }, orderBy: { accion: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <Link href="/configuracion" className="text-sm text-muted hover:underline">← configuración</Link>
        <h1 className="text-2xl font-bold">Auditoría</h1>
        <p className="text-sm text-muted">Quién hizo qué, cuándo, con valor anterior y nuevo. Máximo 500 registros por consulta.</p>
      </div>
      <FiltroFechas
        sp={sp}
        conBusqueda
        placeholder="descripción o id"
        extra={
          <>
            <div><label className="label">Entidad</label><select name="entidad" defaultValue={sp.entidad ?? ""} className="input py-1.5 text-sm"><option value="">todas</option>{entidades.map((e) => <option key={e.entidad} value={e.entidad}>{e.entidad}</option>)}</select></div>
            <div><label className="label">Usuario</label><select name="usuario" defaultValue={sp.usuario ?? ""} className="input py-1.5 text-sm"><option value="">todos</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
            <div><label className="label">Acción</label><select name="accion" defaultValue={sp.accion ?? ""} className="input py-1.5 text-sm"><option value="">todas</option>{acciones.map((a) => <option key={a.accion} value={a.accion}>{a.accion}</option>)}</select></div>
          </>
        }
      />
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Usuario</th><th className="px-4 py-2">Acción</th><th className="px-4 py-2">Entidad</th><th className="px-4 py-2">Detalle</th></tr></thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Sin registros para estos filtros.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-4 py-2">{fmtFechaHora(l.fecha)}</td>
                <td className="px-4 py-2">{l.usuario?.nombre ?? "—"}</td>
                <td className="px-4 py-2"><span className="badge bg-brand-light text-brand">{l.accion}</span></td>
                <td className="px-4 py-2">{l.entidad}</td>
                <td className="px-4 py-2">
                  {l.descripcion && <div>{l.descripcion}</div>}
                  {(l.valorAnterior !== null || l.valorNuevo !== null) && (
                    <details className="text-xs text-muted">
                      <summary className="cursor-pointer">ver valores</summary>
                      <pre className="mt-1 max-w-xl whitespace-pre-wrap font-mono">
                        {l.valorAnterior !== null && `antes: ${JSON.stringify(l.valorAnterior)}\n`}
                        {l.valorNuevo !== null && `ahora: ${JSON.stringify(l.valorNuevo)}`}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
