"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registrarCompra, type LineaCompra } from "../actions";

export type InsumoCompra = {
  id: string; nombre: string; tipo: string; unidadBase: string;
  presentaciones: { id: string; nombre: string; contenido: string | null; unidad: string; ultimoPrecio: string | null; predeterminada: boolean }[];
};

type Props = { insumos: InsumoCompra[]; metodos: { id: string; nombre: string; esEfectivo: boolean }[]; proveedores: string[]; hoy: string };

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

export function FormularioCompra({ insumos, metodos, proveedores, hoy }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string>();
  const [fecha, setFecha] = useState(hoy);
  const [proveedor, setProveedor] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [metodoPagoId, setMetodoPagoId] = useState(metodos.find((m) => m.esEfectivo)?.id ?? metodos[0]?.id ?? "");
  const [pagadoDesdeCaja, setPagadoDesdeCaja] = useState(true);
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<LineaCompra[]>([nuevaLinea(insumos[0])]);

  function nuevaLinea(ins?: InsumoCompra): LineaCompra {
    const pred = ins?.presentaciones.find((p) => p.predeterminada) ?? ins?.presentaciones[0];
    return { insumoId: ins?.id ?? "", presentacionId: pred?.id ?? null, cantidad: "1", precioUnitario: pred?.ultimoPrecio ?? "" };
  }

  const set = (i: number, patch: Partial<LineaCompra>) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lineas.reduce((a, l) => a + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0), 0);

  const enviar = () =>
    iniciar(async () => {
      const r = await registrarCompra({ fecha, proveedor, numeroComprobante: comprobante, metodoPagoId, pagadoDesdeCaja, observaciones, lineas });
      setError(r.error);
      if (r.ok) router.push("/compras");
    });

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 sm:grid-cols-3">
        <div><label className="label">Fecha</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" /></div>
        <div><label className="label">Proveedor</label><input list="proveedores" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="input" placeholder="Makro, mercado…" /><datalist id="proveedores">{proveedores.map((p) => <option key={p} value={p} />)}</datalist></div>
        <div><label className="label">N° boleta / factura</label><input value={comprobante} onChange={(e) => setComprobante(e.target.value)} className="input" /></div>
        <div><label className="label">Pagado con</label><select value={metodoPagoId} onChange={(e) => setMetodoPagoId(e.target.value)} className="input">{metodos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
        <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={pagadoDesdeCaja} onChange={(e) => setPagadoDesdeCaja(e.target.checked)} className="size-5 accent-brand" /> Salió de la caja del día</label>
        <div><label className="label">Observaciones</label><input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="input" /></div>
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold">Insumos comprados</h2>
        {lineas.map((l, i) => {
          const ins = insumos.find((x) => x.id === l.insumoId);
          const pres = ins?.presentaciones.find((p) => p.id === l.presentacionId);
          const sub = (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0);
          const contenidoBase = pres?.contenido ? Number(pres.contenido) : null;
          return (
            <div key={i} className="grid gap-2 rounded-xl border border-border p-2 sm:grid-cols-[1fr_1fr_90px_110px_auto_auto]">
              <select value={l.insumoId} onChange={(e) => { const nuevo = insumos.find((x) => x.id === e.target.value); setLineas((ls) => ls.map((x, j) => (j === i ? nuevaLinea(nuevo) : x))); }} className="input py-1.5 text-sm">
                {["INGREDIENTE", "EMPAQUE"].map((t) => (
                  <optgroup key={t} label={t === "INGREDIENTE" ? "Ingredientes" : "Empaques"}>{insumos.filter((x) => x.tipo === t).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</optgroup>
                ))}
              </select>
              <select value={l.presentacionId ?? ""} onChange={(e) => { const p = ins?.presentaciones.find((x) => x.id === e.target.value); set(i, { presentacionId: p?.id ?? null, precioUnitario: p?.ultimoPrecio ?? l.precioUnitario }); }} className="input py-1.5 text-sm">
                <option value="">por {ins?.unidadBase ?? "unidad"} (sin presentación)</option>
                {ins?.presentaciones.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.contenido ? ` (${p.contenido} ${p.unidad})` : " (contenido pendiente)"}</option>)}
              </select>
              <input type="number" step="any" min="0" value={l.cantidad} onChange={(e) => set(i, { cantidad: e.target.value })} className="input py-1.5 text-sm" placeholder="cant." aria-label="Cantidad" />
              <input type="number" step="0.01" min="0" value={l.precioUnitario} onChange={(e) => set(i, { precioUnitario: e.target.value })} className="input py-1.5 text-sm" placeholder="S/ c/u" aria-label="Precio unitario" />
              <div className="self-center text-right font-mono text-sm">{soles(sub)}<div className="text-xs text-muted">{contenidoBase && sub > 0 ? `${soles(sub / (contenidoBase * (Number(l.cantidad) || 1)))}/${ins?.unidadBase}` : ""}</div></div>
              <button type="button" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} className="self-center text-danger" aria-label="Quitar línea">✕</button>
            </div>
          );
        })}
        <button type="button" onClick={() => setLineas((ls) => [...ls, nuevaLinea(insumos[0])])} className="btn btn-secondary min-h-9 text-sm">+ Agregar línea</button>
      </div>

      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-xs uppercase text-muted">Total de la compra</div><div className="font-mono text-2xl font-bold">{soles(total)}</div><div className="text-xs text-muted">Entra al inventario y actualiza el costo vigente. No es costo de venta.</div></div>
        <button type="button" disabled={pendiente || lineas.length === 0} onClick={enviar} className="btn btn-primary">{pendiente ? "Registrando…" : "Registrar compra"}</button>
      </div>
    </div>
  );
}
