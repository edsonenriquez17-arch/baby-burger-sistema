"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { TipoServicio } from "@prisma/client";
import { actualizarPedido, agregarExtra, agregarItem, anularPedido, cambiarCantidadItem, cambiarEstadoPedido, cobrarPedido, editarObservacionItem, quitarExtra, type PagoEntrada } from "../actions";
import type { Resultado } from "@/components/form-accion";

export type ProductoPOS = { id: string; nombre: string; precio: number; categoria: string; color: string | null; disponible: boolean; esExtra: boolean };
export type ItemPOS = { id: string; nombre: string; cantidad: number; precio: number; observacion: string | null; estado: string; extras: { id: string; nombre: string; cantidad: number; precio: number }[] };
export type PedidoPOS = {
  id: string; numero: number; estado: string; tipoServicio: TipoServicio; mesaNombre: string | null; mesaId: string | null;
  clienteNombre: string | null; clienteTelefono: string | null; observaciones: string | null;
  subtotal: number; descuento: number; descuentoMotivo: string | null; total: number; costoTotal: number;
  pagos: { metodo: string; monto: number }[]; motivoAnulacion: string | null;
};

type Props = {
  pedido: PedidoPOS;
  items: ItemPOS[];
  productos: ProductoPOS[];
  metodos: { id: string; nombre: string; esEfectivo: boolean }[];
  mesas: { id: string; nombre: string; tipo: string }[];
  permisos: { editar: boolean; cobrar: boolean; anular: boolean; descuento: boolean; verCosto: boolean };
};

const soles = (n: number) => `S/ ${n.toFixed(2)}`;
const ETIQUETA_CANAL: Record<TipoServicio, string> = { MESA: "Mesa", BARRA: "Barra", LLEVAR: "Para llevar", DELIVERY: "Delivery" };

export function PantallaPedido({ pedido, items, productos, metodos, mesas, permisos }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string>();
  const [categoria, setCategoria] = useState<string>("todas");
  const [itemExtras, setItemExtras] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState(false);
  const [anulando, setAnulando] = useState(false);

  const cerrado = pedido.estado === "PAGADO" || pedido.estado === "ANULADO";
  const editable = permisos.editar && !cerrado;

  const ejecutar = (fn: () => Promise<Resultado>) =>
    iniciar(async () => {
      const r = await fn();
      setError(r.error);
      if (!r.error) router.refresh();
    });

  const categorias = [...new Set(productos.filter((p) => !p.esExtra).map((p) => p.categoria))];
  const visibles = productos.filter((p) => !p.esExtra && (categoria === "todas" || p.categoria === categoria));
  const extras = productos.filter((p) => p.esExtra);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Productos */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/pedidos" className="btn btn-secondary min-h-10 px-3 text-sm">← Pedidos</Link>
          <h1 className="text-xl font-bold">#{pedido.numero} · {pedido.mesaNombre ?? ETIQUETA_CANAL[pedido.tipoServicio]}</h1>
          <EstadoBadge estado={pedido.estado} />
        </div>

        {editable && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button type="button" onClick={() => setCategoria("todas")} className={`btn min-h-10 shrink-0 px-4 text-sm ${categoria === "todas" ? "btn-primary" : "btn-secondary"}`}>Todo</button>
              {categorias.map((c) => (
                <button key={c} type="button" onClick={() => setCategoria(c)} className={`btn min-h-10 shrink-0 px-4 text-sm ${categoria === c ? "btn-primary" : "btn-secondary"}`}>{c}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {visibles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={pendiente || !p.disponible}
                  onClick={() => ejecutar(() => agregarItem(pedido.id, p.id))}
                  className="flex min-h-20 flex-col items-start justify-between rounded-2xl border-2 bg-surface p-3 text-left shadow-sm transition active:scale-[0.97] disabled:opacity-40"
                  style={{ borderColor: p.color ?? "var(--border)" }}
                >
                  <span className="font-semibold leading-tight">{p.nombre}</span>
                  <span className="font-mono text-sm text-muted">{soles(p.precio)}{!p.disponible && " · agotado"}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {cerrado && (
          <div className="card space-y-1 text-sm">
            {pedido.estado === "ANULADO" && <p className="text-danger">Anulado: {pedido.motivoAnulacion}</p>}
            {pedido.pagos.length > 0 && <p>Pagos: {pedido.pagos.map((p) => `${p.metodo} ${soles(p.monto)}`).join(" · ")}</p>}
            {permisos.verCosto && pedido.estado === "PAGADO" && (
              <p className="text-muted">Costo real congelado: <span className="font-mono">{soles(pedido.costoTotal)}</span> · ganancia <span className="font-mono">{soles(pedido.total - pedido.costoTotal)}</span></p>
            )}
          </div>
        )}
      </div>

      {/* Carrito */}
      <div className="card flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {items.length === 0 && <p className="text-sm text-muted">Toca un producto para agregarlo.</p>}
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="space-y-1 py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{it.nombre}</div>
                  <div className="text-xs text-muted">{soles(it.precio)} c/u{it.estado !== "PENDIENTE" && ` · ${it.estado.toLowerCase().replace("_", " ")}`}</div>
                </div>
                {editable ? (
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={pendiente} onClick={() => ejecutar(() => cambiarCantidadItem(it.id, -1))} className="btn btn-secondary size-10 min-h-0 p-0 text-lg">−</button>
                    <span className="w-8 text-center font-semibold">{it.cantidad}</span>
                    <button type="button" disabled={pendiente} onClick={() => ejecutar(() => cambiarCantidadItem(it.id, 1))} className="btn btn-secondary size-10 min-h-0 p-0 text-lg">+</button>
                  </div>
                ) : (
                  <span className="font-semibold">×{it.cantidad}</span>
                )}
                <span className="w-20 text-right font-mono">{soles((it.precio + it.extras.reduce((a, e) => a + e.precio * e.cantidad, 0)) * it.cantidad)}</span>
              </div>
              {it.extras.map((e) => (
                <div key={e.id} className="flex items-center gap-2 pl-3 text-sm text-muted">
                  <span className="flex-1">+ {e.nombre} ×{e.cantidad}</span>
                  <span className="font-mono">{soles(e.precio * e.cantidad)}</span>
                  {editable && <button type="button" onClick={() => ejecutar(() => quitarExtra(e.id))} className="text-danger">✕</button>}
                </div>
              ))}
              {editable && (
                <div className="flex gap-2 pl-3">
                  <input
                    defaultValue={it.observacion ?? ""}
                    placeholder="obs: sin tomate, bien cocida…"
                    className="input flex-1 py-1 text-sm"
                    onBlur={(e) => e.target.value !== (it.observacion ?? "") && ejecutar(() => editarObservacionItem(it.id, e.target.value))}
                  />
                  {extras.length > 0 && (
                    <button type="button" onClick={() => setItemExtras(itemExtras === it.id ? null : it.id)} className="btn btn-secondary min-h-8 px-2 text-xs">+ extra</button>
                  )}
                </div>
              )}
              {!editable && it.observacion && <div className="pl-3 text-xs text-muted">obs: {it.observacion}</div>}
              {itemExtras === it.id && (
                <div className="flex flex-wrap gap-1 pl-3">
                  {extras.map((ex) => (
                    <button key={ex.id} type="button" disabled={pendiente} onClick={() => ejecutar(() => agregarExtra(it.id, ex.id))} className="badge border border-border bg-surface px-2 py-1 hover:bg-brand-light">{ex.nombre} {soles(ex.precio)}</button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>

        <DatosPedido pedido={pedido} mesas={mesas} editable={editable} puedeDescuento={permisos.descuento} ejecutar={ejecutar} />

        <div className="space-y-1 border-t border-border pt-2 text-sm">
          <div className="flex justify-between text-muted"><span>Subtotal</span><span className="font-mono">{soles(pedido.subtotal)}</span></div>
          {pedido.descuento > 0 && <div className="flex justify-between text-muted"><span>Descuento{pedido.descuentoMotivo && ` (${pedido.descuentoMotivo})`}</span><span className="font-mono">− {soles(pedido.descuento)}</span></div>}
          <div className="flex justify-between text-xl font-bold"><span>Total</span><span className="font-mono">{soles(pedido.total)}</span></div>
        </div>

        {!cerrado && (
          <div className="grid grid-cols-2 gap-2">
            {permisos.editar && pedido.estado === "ABIERTO" && items.length > 0 && (
              <button type="button" disabled={pendiente} onClick={() => ejecutar(() => cambiarEstadoPedido(pedido.id, "EN_PREPARACION"))} className="btn btn-secondary">🔥 A cocina</button>
            )}
            {permisos.editar && (pedido.estado === "EN_PREPARACION" || pedido.estado === "LISTO") && (
              <button type="button" disabled={pendiente} onClick={() => ejecutar(() => cambiarEstadoPedido(pedido.id, "ESPERANDO_PAGO"))} className="btn btn-secondary">Esperando pago</button>
            )}
            {permisos.cobrar && items.length > 0 && (
              <button type="button" disabled={pendiente} onClick={() => setCobrando(true)} className="btn btn-primary col-span-2 text-lg">💵 Cobrar {soles(pedido.total)}</button>
            )}
            {permisos.anular && <button type="button" onClick={() => setAnulando(true)} className="btn btn-danger col-span-2 min-h-10 text-sm">Anular pedido</button>}
          </div>
        )}
        {pedido.estado === "PAGADO" && permisos.anular && (
          <button type="button" onClick={() => setAnulando(true)} className="btn btn-danger min-h-10 text-sm">Anular venta (devuelve inventario)</button>
        )}
      </div>

      {cobrando && <ModalCobro total={pedido.total} metodos={metodos} pendiente={pendiente} onCerrar={() => setCobrando(false)} onCobrar={(pagos) => ejecutar(async () => { const r = await cobrarPedido(pedido.id, pagos); if (!r.error) setCobrando(false); return r; })} />}
      {anulando && <ModalAnular pendiente={pendiente} onCerrar={() => setAnulando(false)} onAnular={(motivo) => ejecutar(async () => { const r = await anularPedido(pedido.id, motivo); if (!r.error) setAnulando(false); return r; })} />}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const m: Record<string, string> = { ABIERTO: "bg-brand-light text-brand", EN_PREPARACION: "bg-warning/15 text-warning", LISTO: "bg-success/15 text-success", ESPERANDO_PAGO: "bg-danger/10 text-danger", PAGADO: "bg-success text-white", ANULADO: "bg-border text-muted" };
  return <span className={`badge ${m[estado] ?? ""}`}>{estado.toLowerCase().replace("_", " ")}</span>;
}

function DatosPedido({ pedido, mesas, editable, puedeDescuento, ejecutar }: { pedido: PedidoPOS; mesas: Props["mesas"]; editable: boolean; puedeDescuento: boolean; ejecutar: (fn: () => Promise<Resultado>) => void }) {
  const [abierto, setAbierto] = useState(false);
  if (!editable) {
    return (
      <div className="text-xs text-muted">
        {ETIQUETA_CANAL[pedido.tipoServicio]}{pedido.mesaNombre && ` · ${pedido.mesaNombre}`}{pedido.clienteNombre && ` · ${pedido.clienteNombre}`}{pedido.observaciones && ` · ${pedido.observaciones}`}
      </div>
    );
  }
  return (
    <details open={abierto} onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)} className="rounded-xl bg-background p-2 text-sm">
      <summary className="cursor-pointer font-medium">Canal, cliente, descuento</summary>
      <div className="mt-2 grid gap-2">
        <select
          className="input py-1.5 text-sm"
          value={pedido.mesaId ? `mesa:${pedido.mesaId}` : pedido.tipoServicio}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("mesa:")) {
              const m = mesas.find((x) => x.id === v.slice(5))!;
              ejecutar(() => actualizarPedido(pedido.id, { tipoServicio: m.tipo as TipoServicio, mesaId: m.id }));
            } else ejecutar(() => actualizarPedido(pedido.id, { tipoServicio: v as TipoServicio, mesaId: null }));
          }}
        >
          <option value="LLEVAR">Para llevar</option>
          <option value="DELIVERY">Delivery</option>
          {mesas.map((m) => <option key={m.id} value={`mesa:${m.id}`}>{m.nombre}</option>)}
        </select>
        <input defaultValue={pedido.clienteNombre ?? ""} placeholder="Nombre del cliente (opcional)" className="input py-1.5 text-sm" onBlur={(e) => e.target.value !== (pedido.clienteNombre ?? "") && ejecutar(() => actualizarPedido(pedido.id, { clienteNombre: e.target.value }))} />
        {pedido.tipoServicio === "DELIVERY" && (
          <input defaultValue={pedido.clienteTelefono ?? ""} placeholder="Teléfono / dirección" className="input py-1.5 text-sm" onBlur={(e) => e.target.value !== (pedido.clienteTelefono ?? "") && ejecutar(() => actualizarPedido(pedido.id, { clienteTelefono: e.target.value }))} />
        )}
        <input defaultValue={pedido.observaciones ?? ""} placeholder="Observación general del pedido" className="input py-1.5 text-sm" onBlur={(e) => e.target.value !== (pedido.observaciones ?? "") && ejecutar(() => actualizarPedido(pedido.id, { observaciones: e.target.value }))} />
        {puedeDescuento && (
          <div className="flex gap-2">
            <input type="number" step="0.5" min="0" defaultValue={pedido.descuento || ""} placeholder="Descuento S/" className="input w-32 py-1.5 text-sm" id="descuento" />
            <input defaultValue={pedido.descuentoMotivo ?? ""} placeholder="motivo" className="input flex-1 py-1.5 text-sm" id="descuentoMotivo" />
            <button
              type="button"
              className="btn btn-secondary min-h-8 px-2 text-xs"
              onClick={() => {
                const monto = (document.getElementById("descuento") as HTMLInputElement).value;
                const motivo = (document.getElementById("descuentoMotivo") as HTMLInputElement).value;
                ejecutar(() => actualizarPedido(pedido.id, { descuentoMonto: monto, descuentoMotivo: motivo }));
              }}
            >
              Aplicar
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

function ModalCobro({ total, metodos, pendiente, onCerrar, onCobrar }: { total: number; metodos: Props["metodos"]; pendiente: boolean; onCerrar: () => void; onCobrar: (pagos: PagoEntrada[]) => void }) {
  const efectivo = metodos.find((m) => m.esEfectivo) ?? metodos[0];
  const [lineas, setLineas] = useState<PagoEntrada[]>([{ metodoPagoId: efectivo?.id ?? "", monto: total.toFixed(2) }]);
  const [recibido, setRecibido] = useState("");
  const suma = lineas.reduce((a, l) => a + (Number(l.monto) || 0), 0);
  const falta = total - suma;
  const vuelto = recibido ? Number(recibido) - total : 0;

  const set = (i: number, patch: Partial<PagoEntrada>) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onCerrar}>
      <div className="card w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">Cobrar</h2><span className="font-mono text-2xl font-bold">{soles(total)}</span></div>
        <div className="flex flex-wrap gap-2">
          {metodos.map((m) => (
            <button key={m.id} type="button" onClick={() => { setLineas([{ metodoPagoId: m.id, monto: total.toFixed(2) }]); }} className="btn btn-secondary min-h-10 px-3 text-sm">Todo {m.nombre}</button>
          ))}
        </div>
        {lineas.map((l, i) => (
          <div key={i} className="flex gap-2">
            <select className="input py-1.5 text-sm" value={l.metodoPagoId} onChange={(e) => set(i, { metodoPagoId: e.target.value })}>{metodos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
            <input type="number" step="0.01" min="0" inputMode="decimal" className="input w-28 py-1.5 text-sm" value={l.monto} onChange={(e) => set(i, { monto: e.target.value })} />
            {!metodos.find((m) => m.id === l.metodoPagoId)?.esEfectivo && <input placeholder="ref." className="input w-24 py-1.5 text-sm" value={l.referencia ?? ""} onChange={(e) => set(i, { referencia: e.target.value })} />}
            {lineas.length > 1 && <button type="button" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} className="text-danger">✕</button>}
          </div>
        ))}
        <button type="button" onClick={() => setLineas((ls) => [...ls, { metodoPagoId: metodos[0]?.id ?? "", monto: Math.max(falta, 0).toFixed(2) }])} className="text-sm text-brand">+ dividir pago</button>
        {Math.abs(falta) >= 0.01 && <p className="text-sm text-danger">{falta > 0 ? `Falta ${soles(falta)}` : `Sobra ${soles(-falta)}`}</p>}
        {lineas.some((l) => metodos.find((m) => m.id === l.metodoPagoId)?.esEfectivo) && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Recibe en efectivo</span>
            <input type="number" step="0.5" inputMode="decimal" className="input w-28 py-1.5 text-sm" value={recibido} onChange={(e) => setRecibido(e.target.value)} />
            {recibido && <span className={`font-mono font-semibold ${vuelto < 0 ? "text-danger" : ""}`}>vuelto {soles(Math.max(vuelto, 0))}</span>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCerrar} className="btn btn-secondary">Cancelar</button>
          <button type="button" disabled={pendiente || Math.abs(falta) >= 0.01} onClick={() => onCobrar(lineas)} className="btn btn-primary">{pendiente ? "Cobrando…" : "Confirmar cobro"}</button>
        </div>
      </div>
    </div>
  );
}

function ModalAnular({ pendiente, onCerrar, onAnular }: { pendiente: boolean; onCerrar: () => void; onAnular: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onCerrar}>
      <div className="card w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Anular pedido</h2>
        <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obligatorio)" className="input" />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCerrar} className="btn btn-secondary">Volver</button>
          <button type="button" disabled={pendiente || !motivo.trim()} onClick={() => onAnular(motivo)} className="btn btn-danger">Anular</button>
        </div>
      </div>
    </div>
  );
}
