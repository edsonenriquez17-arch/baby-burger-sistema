import Link from "next/link";

export default function SinPermisoPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div className="text-5xl">🔒</div>
      <h1 className="text-xl font-bold">No tienes permiso para esta sección</h1>
      <p className="text-muted">Pídele al administrador que te habilite el acceso desde Configuración → Usuarios.</p>
      <Link href="/" className="btn btn-secondary">
        Volver al inicio
      </Link>
    </div>
  );
}
