import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { ESTADOS_ABIERTOS } from "@/lib/pos/venta";
import { fmtFechaHora, fmtSoles } from "@/lib/formato";
import { BotonAccion } from "@/components/form-accion";
import { crearPedido } from "./actions";

export const metadata: Metadata = { title: "Pedidos" };

const ESTADO: Record<string, { texto: string; clase: string }> = {
  ABIERTO: { texto: "Pedido abierto", clase: "bg-brand text-brand-contrast" },
  EN_PREPARACION: { texto: "En cocina", clase: "bg-warning text-white" },
  LISTO: { texto: "Listo", clase: "bg-success text-white" },
  ESPERANDO_PAGO: { texto: "Esperando pago", clase: "bg-danger text-white" },
};

export default async function PedidosPage() {
  const usuario = await requerirPermiso("pedidos.ver");
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const [mesas, abiertos, cerradosHoy] = await Promise.all([
    db.mesa.findMany({ where: { activa: true }, orderBy: [{ tipo: "asc" }, { orden: "asc" }] }),
    db.pedido.findMany({ where: { estado: { in: [...ESTADOS_ABIERTOS] } }, include: { mesa: true, _count: { select: { items: true } } }, orderBy: { fecha: "asc" } }),
    db.pedido.findMany({ where: { estado: { in: ["PAGADO", "ANULADO"] }, fecha: { gte: inicioDia } }, include: { mesa: true }, orderBy: { fecha: "desc" }, take: 30 }),
  ]);
  const porMesa = new Map(abiertos.filter((p) => p.mesaId).map((p) => [p.mesaId!, p]));
  const sinMesa = abiertos.filter((p) => !p.mesaId);
  const puedeCrear = usuario.permisos.has("pedidos.crear");

  const Tarjeta = ({ mesa }: { mesa: (typeof mesas)[number] }) => {
    const p = porMesa.get(mesa.id);
    if (p) {
      const e = ESTADO[p.estado];
      return (
        <Link href={`/pedidos/${p.id}`} className={`flex min-h-28 flex-col justify-between rounded-2xl p-4 shadow-sm ${e.clase}`}>
          <div className="text-lg font-bold">{mesa.nombre}</div>
          <div className="text-sm opacity-90">{e.texto} · #{p.numero}</div>
          <div className="text-sm">{p._count.items} ítem(s) · {fmtSoles(p.total)}</div>
        </Link>
      );
    }
    if (!puedeCrear) return <div className="card flex min-h-28 flex-col justify-between opacity-70"><div className="text-lg font-bold">{mesa.nombre}</div><div className="text-sm text-muted">Libre</div></div>;
    return (
      <BotonAccion accion={crearPedido} campos={{ tipoServicio: mesa.tipo, mesaId: mesa.id }} className="card flex min-h-28 w-full flex-col items-start justify-between border-dashed text-left hover:border-brand">
        <span className="text-lg font-bold">{mesa.nombre}</span>
        <span className="text-sm text-success">Libre · tocar para abrir</span>
      </BotonAccion>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        {puedeCrear && (
          <div className="flex gap-2">
            <BotonAccion accion={crearPedido} campos={{ tipoServicio: "LLEVAR" }} className="btn btn-primary">🛍️ Para llevar</BotonAccion>
            <BotonAccion accion={crearPedido} campos={{ tipoServicio: "DELIVERY" }} className="btn btn-primary">🛵 Delivery</BotonAccion>
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted">Mesas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{mesas.filter((m) => m.tipo === "MESA").map((m) => <Tarjeta key={m.id} mesa={m} />)}</div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted">Barra</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{mesas.filter((m) => m.tipo === "BARRA").map((m) => <Tarjeta key={m.id} mesa={m} />)}</div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted">Para llevar y delivery en curso</h2>
        {sinMesa.length === 0 ? (
          <p className="text-sm text-muted">Ninguno.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sinMesa.map((p) => {
              const e = ESTADO[p.estado];
              return (
                <Link key={p.id} href={`/pedidos/${p.id}`} className={`flex min-h-28 flex-col justify-between rounded-2xl p-4 shadow-sm ${e.clase}`}>
                  <div className="text-lg font-bold">{p.tipoServicio === "LLEVAR" ? "🛍️ Llevar" : "🛵 Delivery"} #{p.numero}</div>
                  <div className="text-sm opacity-90">{e.texto}{p.clienteNombre && ` · ${p.clienteNombre}`}</div>
                  <div className="text-sm">{p._count.items} ítem(s) · {fmtSoles(p.total)}</div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <details className="card">
        <summary className="cursor-pointer font-semibold">Cerrados hoy ({cerradosHoy.length})</summary>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {cerradosHoy.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-1 pr-3"><Link href={`/pedidos/${p.id}`} className="text-brand hover:underline">#{p.numero}</Link></td>
                <td className="py-1 pr-3 text-muted">{fmtFechaHora(p.pagadoEn ?? p.fecha)}</td>
                <td className="py-1 pr-3">{p.mesa?.nombre ?? p.tipoServicio}</td>
                <td className="py-1 pr-3 text-right font-mono">{fmtSoles(p.total)}</td>
                <td className="py-1">{p.estado === "ANULADO" ? <span className="badge bg-danger/10 text-danger">anulado</span> : <span className="badge bg-success/15 text-success">pagado</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
