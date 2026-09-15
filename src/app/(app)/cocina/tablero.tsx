"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoItem, cambiarEstadoPedido } from "../pedidos/actions";

/** Reloj que avanza cada 30 s; en el servidor devuelve 0 (se muestra sin minutos). */
function useAhora() {
  return useSyncExternalStore(
    (cb) => {
      const t = setInterval(cb, 30000);
      return () => clearInterval(t);
    },
    () => Math.floor(Date.now() / 30000) * 30000,
    () => 0,
  );
}

type Pedido = {
  id: string; numero: number; estado: string; canal: string; cliente: string | null; observaciones: string | null; creadoEn: string;
  items: { id: string; nombre: string; cantidad: number; observacion: string | null; estado: string; extras: string[] }[];
};

export function TableroCocina({ pedidos, puedeActualizar }: { pedidos: Pedido[]; puedeActualizar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string>();
  const ahora = useAhora();

  // La pantalla de cocina se refresca sola cada 15 s.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [router]);
  const minutos = (iso: string) => (ahora ? Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60000)) : 0);

  const ejecutar = (fn: () => Promise<{ error?: string }>) =>
    iniciar(async () => {
      const r = await fn();
      setError(r.error);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cocina</h1>
        <span className="text-sm text-muted">{pedidos.length} pedido(s) · se actualiza solo</span>
      </div>
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {pedidos.length === 0 && <p className="card text-center text-muted">Sin pedidos en preparación.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pedidos.map((p) => (
          <div key={p.id} className={`card space-y-2 border-2 ${p.estado === "LISTO" ? "border-success" : minutos(p.creadoEn) > 20 ? "border-danger" : "border-warning"}`}>
            <div className="flex items-baseline justify-between">
              <div className="text-lg font-bold">#{p.numero} · {p.canal}</div>
              <div className={`text-sm font-semibold ${minutos(p.creadoEn) > 20 ? "text-danger" : "text-muted"}`}>{minutos(p.creadoEn)} min</div>
            </div>
            {p.cliente && <div className="text-sm text-muted">{p.cliente}</div>}
            {p.observaciones && <div className="rounded-lg bg-warning/10 px-2 py-1 text-sm font-medium text-warning">{p.observaciones}</div>}
            <ul className="space-y-1">
              {p.items.map((it) => (
                <li key={it.id} className={`flex items-start gap-2 rounded-lg px-2 py-1 ${it.estado === "LISTO" || it.estado === "ENTREGADO" ? "bg-success/10 line-through opacity-70" : "bg-background"}`}>
                  <span className="text-lg font-bold">{it.cantidad}×</span>
                  <div className="flex-1">
                    <div className="font-semibold">{it.nombre}</div>
                    {it.extras.length > 0 && <div className="text-xs text-muted">+ {it.extras.join(", ")}</div>}
                    {it.observacion && <div className="text-sm font-medium text-danger">⚠ {it.observacion}</div>}
                  </div>
                  {puedeActualizar && it.estado !== "LISTO" && it.estado !== "ENTREGADO" && (
                    <button type="button" disabled={pendiente} onClick={() => ejecutar(() => cambiarEstadoItem(it.id, "LISTO"))} className="btn btn-secondary min-h-9 px-2 text-xs">✓</button>
                  )}
                </li>
              ))}
            </ul>
            {puedeActualizar && p.estado !== "LISTO" && p.estado !== "ESPERANDO_PAGO" && (
              <button type="button" disabled={pendiente} onClick={() => ejecutar(() => cambiarEstadoPedido(p.id, "LISTO"))} className="btn btn-primary w-full">Pedido listo</button>
            )}
            {p.estado === "LISTO" && <div className="text-center text-sm font-semibold text-success">✓ Listo para entregar</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
