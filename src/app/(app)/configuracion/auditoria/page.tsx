import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Auditoría" };

const fmt = new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Lima" });

export default async function AuditoriaPage() {
  await requerirPermiso("auditoria.ver");
  const logs = await db.logAuditoria.findMany({
    orderBy: { fecha: "desc" },
    take: 200,
    include: { usuario: { select: { nombre: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Auditoría</h1>
        <p className="text-sm text-muted">Últimas 200 acciones. Filtros y búsqueda llegan en la Fase 7.</p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Usuario</th>
              <th className="px-4 py-2">Acción</th>
              <th className="px-4 py-2">Entidad</th>
              <th className="px-4 py-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Sin registros todavía.</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-4 py-2">{fmt.format(l.fecha)}</td>
                <td className="px-4 py-2">{l.usuario?.nombre ?? "—"}</td>
                <td className="px-4 py-2"><span className="badge bg-brand-light text-brand">{l.accion}</span></td>
                <td className="px-4 py-2">{l.entidad}</td>
                <td className="px-4 py-2">
                  {l.descripcion && <div>{l.descripcion}</div>}
                  {(l.valorAnterior !== null || l.valorNuevo !== null) && (
                    <details className="text-xs text-muted">
                      <summary className="cursor-pointer">ver valores</summary>
                      <pre className="mt-1 whitespace-pre-wrap font-mono">
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
