import Link from "next/link";
import { requerirPermiso } from "@/lib/auth/session";

const SECCIONES = [
  { href: "/configuracion/usuarios", titulo: "Usuarios y permisos", desc: "Crear usuarios, roles y PIN", permiso: "usuarios.administrar" as const },
  { href: "/configuracion/general", titulo: "General", desc: "Margen objetivo, nombre del negocio, fondo de caja", permiso: "configuracion.editar" as const },
  { href: "/configuracion/roles", titulo: "Permisos por rol", desc: "Qué puede hacer cada rol por defecto", permiso: "usuarios.administrar" as const },
  { href: "/configuracion/catalogos", titulo: "Catálogos", desc: "Categorías, marcas, proveedores, motivos, métodos de pago, mesas", permiso: "configuracion.editar" as const },
  { href: "/configuracion/auditoria", titulo: "Auditoría", desc: "Historial de acciones sensibles", permiso: "auditoria.ver" as const },
];

export default async function ConfiguracionPage() {
  const usuario = await requerirPermiso("configuracion.ver");
  const visibles = SECCIONES.filter((s) => usuario.permisos.has(s.permiso));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Configuración</h1>
      <p className="text-sm text-muted">
        Ingredientes, recetas y carta se editan en sus módulos; aquí van usuarios, parámetros y catálogos.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {visibles.map((s) => (
          <Link key={s.href} href={s.href} className="card hover:border-brand">
            <div className="font-semibold">{s.titulo}</div>
            <div className="text-sm text-muted">{s.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
