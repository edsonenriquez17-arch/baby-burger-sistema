"use client";

import { useActionState, useState, useTransition } from "react";
import { ROLES } from "@/lib/auth/permisos";
import { alternarPermiso, cambiarActivo, cambiarPin, cambiarRol, crearUsuario, type Resultado } from "./actions";

const inicial: Resultado = {};

export function FormularioNuevoUsuario() {
  const [estado, accion, pendiente] = useActionState(crearUsuario, inicial);

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="nombre">Nombre</label>
        <input id="nombre" name="nombre" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="usuario">Usuario (para ingresar)</label>
        <input id="usuario" name="usuario" className="input" autoCapitalize="none" required />
      </div>
      <div>
        <label className="label" htmlFor="pin">PIN (4 a 8 dígitos)</label>
        <input id="pin" name="pin" type="password" inputMode="numeric" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="rol">Rol</label>
        <select id="rol" name="rol" className="input" defaultValue="CAJA">
          {ROLES.map((r) => (
            <option key={r.valor} value={r.valor}>{r.etiqueta} — {r.descripcion}</option>
          ))}
        </select>
      </div>
      {estado.error && <p className="text-sm font-medium text-danger sm:col-span-2">{estado.error}</p>}
      {estado.ok && !estado.error && <p className="text-sm font-medium text-success sm:col-span-2">Usuario creado.</p>}
      <div className="sm:col-span-2">
        <button className="btn btn-primary" disabled={pendiente}>{pendiente ? "Creando…" : "Crear usuario"}</button>
      </div>
    </form>
  );
}

type Permiso = { clave: string; modulo: string; descripcion: string };
type Usuario = {
  id: string;
  nombre: string;
  usuario: string;
  rol: "ADMIN" | "CAJA" | "COCINA";
  activo: boolean;
  excepciones: { clave: string; concedido: boolean }[];
};

export function FilaUsuario({ usuario, esActual, permisos, permisosDeRol }: { usuario: Usuario; esActual: boolean; permisos: Permiso[]; permisosDeRol: string[] }) {
  const [abierto, setAbierto] = useState(false);
  const [mostrarPin, setMostrarPin] = useState(false);
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();
  const [estadoPin, accionPin, pendientePin] = useActionState(cambiarPin, inicial);

  const ejecutar = (fn: () => Promise<Resultado>) =>
    iniciar(async () => {
      const r = await fn();
      setError(r.error);
    });

  const rolEtiqueta = ROLES.find((r) => r.valor === usuario.rol)?.etiqueta ?? usuario.rol;

  return (
    <div className={`card space-y-3 ${usuario.activo ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {usuario.nombre} {esActual && <span className="badge bg-brand-light text-brand">tú</span>}
            {!usuario.activo && <span className="badge ml-1 bg-border text-muted">inactivo</span>}
          </div>
          <div className="text-sm text-muted">@{usuario.usuario} · {rolEtiqueta}</div>
        </div>

        <select
          className="input w-auto min-w-40"
          value={usuario.rol}
          disabled={pendiente}
          onChange={(e) => ejecutar(() => cambiarRol(usuario.id, e.target.value as Usuario["rol"]))}
          aria-label="Rol"
        >
          {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
        </select>

        <button type="button" className="btn btn-secondary min-h-10 text-sm" onClick={() => setMostrarPin((v) => !v)}>
          Cambiar PIN
        </button>
        <button type="button" className="btn btn-secondary min-h-10 text-sm" onClick={() => setAbierto((v) => !v)}>
          Permisos
        </button>
        {!esActual && (
          <button
            type="button"
            className={`min-h-10 text-sm ${usuario.activo ? "btn btn-danger" : "btn btn-primary"}`}
            disabled={pendiente}
            onClick={() => ejecutar(() => cambiarActivo(usuario.id, !usuario.activo))}
          >
            {usuario.activo ? "Desactivar" : "Activar"}
          </button>
        )}
      </div>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      {mostrarPin && (
        <form action={accionPin} className="flex flex-wrap items-end gap-3 rounded-xl bg-background p-3">
          <input type="hidden" name="usuarioId" value={usuario.id} />
          <div>
            <label className="label" htmlFor={`pin-${usuario.id}`}>Nuevo PIN</label>
            <input id={`pin-${usuario.id}`} name="pin" type="password" inputMode="numeric" className="input w-40" required />
          </div>
          <button className="btn btn-primary min-h-10 text-sm" disabled={pendientePin}>Guardar PIN</button>
          {estadoPin.error && <span className="text-sm text-danger">{estadoPin.error}</span>}
          {estadoPin.ok && <span className="text-sm text-success">PIN actualizado.</span>}
        </form>
      )}

      {abierto && (
        <div className="rounded-xl bg-background p-3">
          <p className="mb-2 text-xs text-muted">
            ✓ viene del rol · puedes conceder o quitar cada permiso solo para esta persona.
          </p>
          <div className="grid gap-1 sm:grid-cols-2">
            {permisos.map((p) => {
              const delRol = permisosDeRol.includes(p.clave);
              const excepcion = usuario.excepciones.find((e) => e.clave === p.clave);
              const efectivo = excepcion ? excepcion.concedido : delRol;
              return (
                <label key={p.clave} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
                  <input
                    type="checkbox"
                    className="size-5 accent-brand"
                    checked={efectivo}
                    disabled={pendiente}
                    onChange={(e) => {
                      const nuevo = e.target.checked;
                      // Si vuelve al valor del rol, se elimina la excepción.
                      ejecutar(() => alternarPermiso(usuario.id, p.clave, nuevo === delRol ? null : nuevo));
                    }}
                  />
                  <span className="flex-1">
                    <span className="text-xs text-muted">{p.modulo} · </span>
                    {p.descripcion}
                  </span>
                  {excepcion && <span className="badge bg-warning/15 text-warning">excepción</span>}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
