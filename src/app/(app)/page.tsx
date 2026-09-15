import Link from "next/link";
import { db } from "@/lib/db";
import { requerirUsuario } from "@/lib/auth/session";

export default async function InicioPage() {
  const usuario = await requerirUsuario();

  const [productos, ingredientes, preparaciones, empaques, usuarios, itemsPendientes, sinPrecio] =
    await Promise.all([
      db.producto.count({ where: { activo: true } }),
      db.insumo.count({ where: { tipo: "INGREDIENTE", activo: true } }),
      db.insumo.count({ where: { tipo: "PREPARACION", activo: true } }),
      db.insumo.count({ where: { tipo: "EMPAQUE", activo: true } }),
      db.usuario.count({ where: { activo: true } }),
      db.recetaItem.count({ where: { cantidad: null } }),
      db.insumo.count({
        where: { tipo: "INGREDIENTE", activo: true, precios: { none: { vigenteHasta: null } } },
      }),
    ]);

  const tarjetas = [
    { titulo: "Productos en carta", valor: productos },
    { titulo: "Ingredientes", valor: ingredientes },
    { titulo: "Preparaciones", valor: preparaciones },
    { titulo: "Empaques y descartables", valor: empaques },
    { titulo: "Usuarios activos", valor: usuarios },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {usuario.nombre.split(" ")[0]}</h1>
        <p className="text-muted">Fase 1 — Fundación. El panel del día llegará en la Fase 7.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="card">
            <div className="text-3xl font-bold text-brand">{t.valor}</div>
            <div className="text-sm text-muted">{t.titulo}</div>
          </div>
        ))}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Datos pendientes de completar</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted">
          <li>
            <span className="font-semibold text-foreground">{itemsPendientes}</span> cantidades de receta sin definir
            (lechuga, tomate, salsas, papas, etc.). Se completan en la Fase 2.
          </li>
          <li>
            <span className="font-semibold text-foreground">{sinPrecio}</span> ingredientes sin precio registrado. Se
            registran al cargar la primera compra (Fase 2).
          </li>
        </ul>
      </div>

      {usuario.permisos.has("usuarios.administrar") && (
        <div className="card">
          <h2 className="font-semibold">Siguiente paso</h2>
          <p className="mt-1 text-sm text-muted">
            Crea los usuarios de caja y cocina, y cambia el PIN del administrador.
          </p>
          <Link href="/configuracion/usuarios" className="btn btn-primary mt-4">
            Ir a usuarios
          </Link>
        </div>
      )}
    </div>
  );
}
