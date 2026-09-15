import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";

export const metadata: Metadata = { title: "Configuración general" };

async function guardar(formData: FormData) {
  "use server";
  const admin = await requerirPermiso("configuracion.editar");
  const actuales = await db.configuracion.findMany();

  await db.$transaction(async (tx) => {
    for (const c of actuales) {
      const nuevo = formData.get(c.clave);
      if (typeof nuevo !== "string" || nuevo.trim() === c.valor) continue;
      await tx.configuracion.update({ where: { id: c.id }, data: { valor: nuevo.trim() } });
      await registrarAuditoria(
        { usuarioId: admin.id, accion: "CAMBIO_CONFIG", entidad: "Configuracion", entidadId: c.clave, valorAnterior: { valor: c.valor }, valorNuevo: { valor: nuevo.trim() } },
        tx,
      );
    }
  });
  revalidatePath("/configuracion/general");
}

export default async function ConfiguracionGeneralPage() {
  await requerirPermiso("configuracion.editar");
  const config = await db.configuracion.findMany({ orderBy: { clave: "asc" } });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Configuración general</h1>
        <p className="text-sm text-muted">Cada cambio queda registrado en auditoría con el valor anterior.</p>
      </div>
      <form action={guardar} className="card space-y-4">
        {config.map((c) => (
          <div key={c.id}>
            <label className="label" htmlFor={c.clave}>{c.descripcion ?? c.clave}</label>
            <input id={c.clave} name={c.clave} className="input" defaultValue={c.valor} />
            <div className="mt-1 font-mono text-xs text-muted">{c.clave}</div>
          </div>
        ))}
        <button className="btn btn-primary">Guardar cambios</button>
      </form>
    </div>
  );
}
