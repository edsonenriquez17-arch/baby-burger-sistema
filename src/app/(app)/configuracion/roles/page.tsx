import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/permisos";
import { BotonAccion } from "@/components/form-accion";
import { alternarPermisoRol } from "./actions";

export const metadata: Metadata = { title: "Permisos por rol" };

export default async function RolesPage() {
  await requerirPermiso("usuarios.administrar");
  const [permisos, rolPermisos] = await Promise.all([
    db.permiso.findMany({ orderBy: [{ modulo: "asc" }, { clave: "asc" }] }),
    db.rolPermiso.findMany(),
  ]);
  const tiene = (rol: string, permisoId: string) => rolPermisos.some((rp) => rp.rol === rol && rp.permisoId === permisoId);
  const modulos = [...new Set(permisos.map((p) => p.modulo))];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/configuracion" className="text-sm text-muted hover:underline">← configuración</Link>
        <h1 className="text-2xl font-bold">Permisos por rol</h1>
        <p className="text-sm text-muted">Lo que cada rol puede hacer por defecto. Las excepciones por persona se ajustan en Usuarios.</p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Permiso</th>{ROLES.map((r) => <th key={r.valor} className="px-4 py-2 text-center">{r.etiqueta}</th>)}</tr></thead>
          <tbody>
            {modulos.map((m) => (
              <Fragment key={m}>
                <tr className="border-t border-border bg-background/60"><td colSpan={4} className="px-4 py-1 text-xs font-semibold uppercase text-muted">{m}</td></tr>
                {permisos.filter((p) => p.modulo === m).map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-1">{p.descripcion}<div className="font-mono text-xs text-muted">{p.clave}</div></td>
                    {ROLES.map((r) => (
                      <td key={r.valor} className="px-4 py-1 text-center">
                        <BotonAccion accion={alternarPermisoRol} campos={{ rol: r.valor, permisoId: p.id }} className={`size-9 rounded-lg text-lg ${tiene(r.valor, p.id) ? "bg-success/15 text-success" : "bg-background text-muted"}`}>
                          {tiene(r.valor, p.id) ? "✓" : "·"}
                        </BotonAccion>
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
