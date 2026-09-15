import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { D, type Dec } from "@/lib/costeo/costeo";
import { fmtFechaHora, fmtSoles } from "@/lib/formato";
import { FormAccion } from "@/components/form-accion";
import { FiltroFechas, rangoDesdeParams } from "@/components/filtro-fechas";
import { registrarRetiro } from "../gastos/actions";

export const metadata: Metadata = { title: "Retiros de caja" };

export default async function RetirosPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; q?: string }> }) {
  const usuario = await requerirPermiso("caja.retiros");
  const sp = await searchParams;
  const { desde, hasta, hoyLima } = rangoDesdeParams(sp, "mes");
  const retiros = await db.retiroCaja.findMany({
    where: { fecha: { gte: desde, lte: hasta }, ...(sp.q ? { OR: [{ persona: { contains: sp.q, mode: "insensitive" } }, { motivo: { contains: sp.q, mode: "insensitive" } }] } : {}) },
    include: { usuario: { select: { nombre: true } } },
    orderBy: { fecha: "desc" },
  });
  const total = retiros.reduce((a, r) => a.add(r.monto), new D(0));
  const porPersona = new Map<string, Dec>();
  for (const r of retiros) porPersona.set(r.persona, (porPersona.get(r.persona) ?? new D(0)).add(r.monto));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Retiros de caja</h1>
        <p className="text-sm text-muted">Dinero que sale del negocio (dueños, préstamos, uso personal). No es un gasto operativo: se muestra aparte para saber dónde terminó la plata.</p>
      </div>
      {usuario.permisos.has("caja.retiros") && (
        <details className="card" open={retiros.length === 0}>
          <summary className="cursor-pointer font-semibold">+ Registrar retiro</summary>
          <FormAccion accion={registrarRetiro} className="mt-3 grid gap-3 sm:grid-cols-2" textoBoton="Registrar retiro">
            <div><label className="label">Fecha</label><input type="date" name="fecha" defaultValue={hoyLima} className="input" /></div>
            <div><label className="label">Monto (S/)</label><input name="monto" type="number" step="0.01" min="0" className="input" required /></div>
            <div><label className="label">Quién retira</label><input name="persona" className="input" required /></div>
            <div><label className="label">Motivo</label><input name="motivo" className="input" required /></div>
            <div className="sm:col-span-2"><label className="label">Observaciones</label><input name="observaciones" className="input" /></div>
          </FormAccion>
        </details>
      )}
      <FiltroFechas sp={sp} conBusqueda placeholder="persona o motivo" />
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div className="card"><div className="text-xs uppercase text-muted">Total retirado</div><div className="font-mono text-2xl font-bold text-danger">{fmtSoles(total)}</div></div>
        <div className="card text-sm"><div className="text-xs uppercase text-muted">Por persona</div>{[...porPersona.entries()].map(([n, m]) => <div key={n} className="flex justify-between"><span>{n}</span><span className="font-mono">{fmtSoles(m)}</span></div>)}</div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Persona</th><th className="px-4 py-2">Motivo</th><th className="px-4 py-2 text-right">Monto</th><th className="px-4 py-2">Registró</th></tr></thead>
          <tbody>
            {retiros.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Sin retiros en el período.</td></tr>}
            {retiros.map((r) => (
              <tr key={r.id} className="border-t border-border"><td className="whitespace-nowrap px-4 py-1">{fmtFechaHora(r.fecha)}</td><td className="px-4 py-1">{r.persona}</td><td className="px-4 py-1">{r.motivo}{r.observaciones && <div className="text-xs text-muted">{r.observaciones}</div>}</td><td className="px-4 py-1 text-right font-mono">{fmtSoles(r.monto)}</td><td className="px-4 py-1 text-muted">{r.usuario.nombre}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
