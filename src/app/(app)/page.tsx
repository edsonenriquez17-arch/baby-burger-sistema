import Link from "next/link";
import { db } from "@/lib/db";
import { requerirUsuario } from "@/lib/auth/session";
import { obtenerParametrosMargen } from "@/lib/costeo/costeo";
import { fmtNum, fmtPct, fmtSoles } from "@/lib/formato";
import { alertas, resumenPeriodo } from "@/lib/reportes";
import { rangoDesdeParams } from "@/components/filtro-fechas";
import { ESTADOS_ABIERTOS } from "@/lib/pos/venta";

export default async function InicioPage() {
  const usuario = await requerirUsuario();
  const verFinanzas = usuario.permisos.has("reportes.financieros");
  const { desde, hasta, hoyLima } = rangoDesdeParams({}, "dia");
  const [r, margen, abiertos, itemsPendientes] = await Promise.all([
    resumenPeriodo(desde, hasta),
    obtenerParametrosMargen(),
    db.pedido.count({ where: { estado: { in: [...ESTADOS_ABIERTOS] } } }),
    db.recetaItem.count({ where: { cantidad: null } }),
  ]);
  const al = await alertas(margen.alerta);

  const tarjeta = (titulo: string, valor: string, nota?: string, clase = "") => (
    <div className="card"><div className="text-xs uppercase text-muted">{titulo}</div><div className={`font-mono text-2xl font-bold ${clase}`}>{valor}</div>{nota && <div className="text-xs text-muted">{nota}</div>}</div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hola, {usuario.nombre.split(" ")[0]}</h1>
          <p className="text-muted">Hoy {hoyLima} · {abiertos} pedido(s) abiertos</p>
        </div>
        <div className="flex gap-2">
          {usuario.permisos.has("pedidos.crear") && <Link href="/pedidos" className="btn btn-primary">🧾 Pedidos</Link>}
          {usuario.permisos.has("caja.ver") && <Link href="/caja" className="btn btn-secondary">💵 Caja</Link>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tarjeta("Ventas de hoy", fmtSoles(r.ventas), `${r.numeroPedidos} pedidos · ticket ${fmtSoles(r.ticketPromedio)}`)}
        {verFinanzas && tarjeta("Costo de ventas", fmtSoles(r.costoVentas), `margen bruto ${fmtPct(r.margenBruto)}`)}
        {verFinanzas && tarjeta("Compras · gastos · retiros", `${fmtSoles(r.comprasTotal)} · ${fmtSoles(r.gastosTotal)} · ${fmtSoles(r.retirosTotal)}`, `mermas y cortesías ${fmtSoles(r.perdidasTotal)}`)}
        {verFinanzas && tarjeta("Utilidad estimada", fmtSoles(r.utilidadEstimada), `margen ${fmtPct(r.margenNeto)}`, r.utilidadEstimada.lt(0) ? "text-danger" : "text-success")}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold">⚠ Stock bajo mínimo ({al.stockBajo.length})</h2>
          {al.stockBajo.length === 0 ? <p className="mt-1 text-sm text-muted">Todo por encima del mínimo (o sin mínimo configurado).</p> : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {al.stockBajo.slice(0, 10).map((i) => <li key={i.id} className="flex justify-between py-1"><Link href={`/inventario/${i.id}`} className="text-brand hover:underline">{i.nombre}</Link><span className="font-mono text-danger">{fmtNum(i.stockActual)} / {fmtNum(i.stockMinimo)} {i.unidadBase.codigo}</span></li>)}
            </ul>
          )}
          {al.stockBajo.length > 10 && <Link href="/inventario?alerta=1" className="mt-2 block text-sm text-brand hover:underline">ver todos →</Link>}
        </div>

        {verFinanzas && (
          <div className="card">
            <h2 className="font-semibold">📉 Productos con margen bajo ({al.margenBajo.length})</h2>
            {al.margenBajo.length === 0 ? <p className="mt-1 text-sm text-muted">Ningún producto por debajo de {margen.alerta} %.</p> : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {al.margenBajo.map((p) => <li key={p.id} className="flex justify-between py-1"><Link href={`/recetas/${p.id}`} className="text-brand hover:underline">{p.nombre}</Link><span className="font-mono text-danger">{fmtPct(p.margen)} · costo {fmtSoles(p.costo)} / {fmtSoles(p.precio)}</span></li>)}
              </ul>
            )}
          </div>
        )}

        {verFinanzas && (
          <div className="card">
            <h2 className="font-semibold">📈 Insumos que subieron de precio (30 días)</h2>
            {al.subidas.length === 0 ? <p className="mt-1 text-sm text-muted">Sin subidas registradas.</p> : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {al.subidas.map((s) => <li key={s.id} className="flex justify-between py-1"><Link href={`/insumos/${s.id}`} className="text-brand hover:underline">{s.nombre}</Link><span className="font-mono">{fmtSoles(s.antes, true)} → {fmtSoles(s.ahora, true)} <span className="text-danger">+{fmtPct(s.pct)}</span></span></li>)}
              </ul>
            )}
          </div>
        )}

        {verFinanzas && (
          <div className="card">
            <h2 className="font-semibold">🍔 Productos cuyo costo subió más de 10 % (30 días)</h2>
            {al.costosSubieron.length === 0 ? <p className="mt-1 text-sm text-muted">Sin subidas importantes.</p> : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {al.costosSubieron.map((p) => <li key={p.id} className="flex justify-between py-1"><Link href={`/recetas/${p.id}`} className="text-brand hover:underline">{p.nombre}</Link><span className="font-mono">{fmtSoles(p.antes)} → {fmtSoles(p.ahora)} <span className="text-danger">+{fmtPct(p.pct)}</span></span></li>)}
              </ul>
            )}
            <Link href="/reportes/costos" className="mt-2 block text-sm text-brand hover:underline">ver evolución de costos →</Link>
          </div>
        )}
      </div>

      {itemsPendientes > 0 && usuario.permisos.has("recetas.editar") && (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          Hay <b>{itemsPendientes}</b> cantidades de receta sin definir. Mientras falten, el costo de esos productos es parcial. <Link href="/recetas" className="underline">Completar en Recetas →</Link>
        </p>
      )}
    </div>
  );
}
