"use client";

import { useActionState, useState, useTransition } from "react";

export type Resultado = { ok?: boolean; error?: string; mensaje?: string };

type Props = {
  accion: (prev: Resultado, formData: FormData) => Promise<Resultado>;
  children: React.ReactNode;
  className?: string;
  textoBoton?: string;
  claseBoton?: string;
  /** Si es true, no muestra botón (los hijos ponen el suyo). */
  sinBoton?: boolean;
  confirmar?: string;
};

/**
 * Formulario con server action que devuelve {ok|error}. Muestra el error debajo
 * y deshabilita el botón mientras se envía. Sirve para crear, editar y eliminar.
 */
export function FormAccion({ accion, children, className, textoBoton = "Guardar", claseBoton = "btn btn-primary", sinBoton, confirmar }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {} as Resultado);

  return (
    <form
      action={enviar}
      className={className}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {children}
      {estado.error && <p className="mt-2 text-sm font-medium text-danger">{estado.error}</p>}
      {estado.ok && estado.mensaje && <p className="mt-2 text-sm font-medium text-success">{estado.mensaje}</p>}
      {!sinBoton && (
        <button type="submit" className={`${claseBoton} mt-3`} disabled={pendiente}>
          {pendiente ? "Guardando…" : textoBoton}
        </button>
      )}
    </form>
  );
}

/** Botón que ejecuta una acción sin campos (activar/desactivar, quitar fila…). */
export function BotonAccion({ accion, children, className = "btn btn-secondary min-h-10 text-sm", confirmar, campos = {} }: { accion: (prev: Resultado, formData: FormData) => Promise<Resultado>; children: React.ReactNode; className?: string; confirmar?: string; campos?: Record<string, string> }) {
  const [estado, enviar, pendiente] = useActionState(accion, {} as Resultado);
  return (
    <form
      action={enviar}
      className="inline"
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={className} disabled={pendiente} title={estado.error}>
        {children}
      </button>
      {estado.error && <span className="ml-2 text-xs text-danger">{estado.error}</span>}
    </form>
  );
}

/**
 * Botón secundario DENTRO de un <FormAccion>: usa formAction para ejecutar otra acción
 * con los mismos campos del formulario (no se pueden anidar <form>).
 */
export function BotonEnForm({ accion, children, className = "btn btn-secondary min-h-10 text-sm", confirmar }: { accion: (prev: Resultado, formData: FormData) => Promise<Resultado>; children: React.ReactNode; className?: string; confirmar?: string }) {
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();
  return (
    <>
      <button
        type="submit"
        className={className}
        disabled={pendiente}
        formAction={(fd: FormData) => {
          if (confirmar && !window.confirm(confirmar)) return;
          iniciar(async () => {
            const r = await accion({}, fd);
            setError(r.error);
          });
        }}
      >
        {children}
      </button>
      {error && <span className="ml-2 text-xs text-danger">{error}</span>}
    </>
  );
}
