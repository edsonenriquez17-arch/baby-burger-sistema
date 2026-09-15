import { requerirUsuario } from "@/lib/auth/session";
import { cerrarSesion } from "@/lib/auth/actions";
import { NAVEGACION } from "@/lib/navegacion";
import { ROLES } from "@/lib/auth/permisos";
import { NavLinks } from "@/components/nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuario();

  const visibles = NAVEGACION.filter((i) => !i.permiso || usuario.permisos.has(i.permiso));
  const enMovil = visibles.filter((i) => i.enMovil && i.fase === undefined);
  const rol = ROLES.find((r) => r.valor === usuario.rol)?.etiqueta ?? usuario.rol;

  return (
    <div className="flex min-h-full flex-1">
      {/* Barra lateral (tablet / escritorio) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="damero px-5 py-5 text-brand-contrast">
          <div className="text-xl font-black tracking-tight">BABY BURGER</div>
          <div className="text-xs opacity-90">Sistema de gestión</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks items={visibles} variante="lateral" />
        </div>
        <div className="border-t border-border p-4">
          <div className="truncate text-sm font-semibold">{usuario.nombre}</div>
          <div className="text-xs text-muted">{rol}</div>
          <form action={cerrarSesion} className="mt-3">
            <button type="submit" className="btn btn-secondary min-h-10 w-full text-sm">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="damero flex items-center justify-between px-4 py-3 text-brand-contrast md:hidden">
          <div className="text-lg font-black tracking-tight">BABY BURGER</div>
          <form action={cerrarSesion}>
            <button type="submit" className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold">
              {usuario.nombre.split(" ")[0]} · salir
            </button>
          </form>
        </header>
        <main className="flex-1 px-4 py-5 pb-24 md:px-8 md:py-8 md:pb-8">{children}</main>
      </div>

      <NavLinks items={enMovil} variante="inferior" />
    </div>
  );
}
