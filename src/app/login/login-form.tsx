"use client";

import { useActionState } from "react";
import { iniciarSesion, type EstadoLogin } from "@/lib/auth/actions";

const inicial: EstadoLogin = {};

export function LoginForm() {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, inicial);

  return (
    <form action={accion} className="space-y-5">
      <div>
        <label htmlFor="usuario" className="label">
          Usuario
        </label>
        <input
          id="usuario"
          name="usuario"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
      </div>
      <div>
        <label htmlFor="pin" className="label">
          PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          className="input text-center text-2xl tracking-[0.5em]"
          autoComplete="current-password"
          minLength={4}
          required
        />
      </div>

      {estado.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {estado.error}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={pendiente}>
        {pendiente ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
