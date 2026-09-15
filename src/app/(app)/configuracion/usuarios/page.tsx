import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { FormularioNuevoUsuario, FilaUsuario } from "./ui";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const admin = await requerirPermiso("usuarios.administrar");

  const [usuarios, permisos, porRol] = await Promise.all([
    db.usuario.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: { permisos: { include: { permiso: true } } },
    }),
    db.permiso.findMany({ orderBy: [{ modulo: "asc" }, { clave: "asc" }] }),
    db.rolPermiso.findMany({ include: { permiso: true } }),
  ]);

  const permisosDeRol: Record<string, string[]> = {};
  for (const rp of porRol) (permisosDeRol[rp.rol] ??= []).push(rp.permiso.clave);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios y permisos</h1>
        <p className="text-sm text-muted">Cada usuario entra con su usuario y PIN. Los permisos vienen del rol; puedes ajustar excepciones por persona.</p>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Nuevo usuario</h2>
        <FormularioNuevoUsuario />
      </div>

      <div className="space-y-3">
        {usuarios.map((u) => (
          <FilaUsuario
            key={u.id}
            usuario={{
              id: u.id,
              nombre: u.nombre,
              usuario: u.usuario,
              rol: u.rol,
              activo: u.activo,
              excepciones: u.permisos.map((p) => ({ clave: p.permiso.clave, concedido: p.concedido })),
            }}
            esActual={u.id === admin.id}
            permisos={permisos.map((p) => ({ clave: p.clave, modulo: p.modulo, descripcion: p.descripcion }))}
            permisosDeRol={permisosDeRol[u.rol] ?? []}
          />
        ))}
      </div>
    </div>
  );
}
