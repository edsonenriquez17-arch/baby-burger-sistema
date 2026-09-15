import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { obtenerCostosVigentes } from "@/lib/costeo/costeo";
import { TIPOS_SERVICIO, costearReglas, obtenerReglasEmpaque } from "@/lib/costeo/empaques";
import { fmtNum, fmtSoles } from "@/lib/formato";
import { BotonAccion, FormAccion } from "@/components/form-accion";
import { crearRegla, editarCantidadRegla, quitarRegla } from "./actions";

export const metadata: Metadata = { title: "Reglas de empaque" };

export default async function ReglasEmpaquePage() {
  const usuario = await requerirPermiso("empaques.ver");
  const [reglas, costos, empaques, categorias, productos] = await Promise.all([
    obtenerReglasEmpaque(),
    obtenerCostosVigentes(),
    db.insumo.findMany({ where: { tipo: "EMPAQUE", activo: true }, orderBy: { nombre: "asc" } }),
    db.categoriaProducto.findMany({ where: { activa: true }, orderBy: { orden: "asc" } }),
    db.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  const puedeEditar = usuario.permisos.has("empaques.editar");
  const nombreCat = new Map(categorias.map((c) => [c.id, c.nombre]));
  const nombreProd = new Map(productos.map((p) => [p.id, p.nombre]));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link href="/empaques" className="text-sm text-muted hover:underline">← empaques</Link>
        <h1 className="text-2xl font-bold">Empaques por tipo de servicio</h1>
        <p className="text-sm text-muted">
          Qué se entrega según el canal. <b>Por pedido</b>: una vez por pedido (envases de salsa, bolsa, servilletas). <b>Por ítem</b>: por cada unidad vendida; puede limitarse a una categoría o producto (1 caja por hamburguesa).
          Al cobrar, esto se descuenta del inventario y se suma al costo real de la venta.
        </p>
      </div>

      {TIPOS_SERVICIO.map((canal) => {
        const propias = reglas.filter((r) => r.tipoServicio === canal.valor);
        const porPedido = costearReglas(propias.filter((r) => r.alcance === "POR_PEDIDO"), costos);
        return (
          <div key={canal.valor} className="card space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{canal.etiqueta}</h2>
              <span className="text-sm text-muted">Costo fijo por pedido: <span className="font-mono font-semibold text-foreground">{fmtSoles(porPedido.total)}</span>{!porPedido.completo && <span className="text-warning"> (faltan precios)</span>}</span>
            </div>
            {propias.length === 0 && <p className="text-sm text-muted">Sin reglas: en este canal no se descuenta empaque.</p>}
            <ul className="divide-y divide-border">
              {propias.map((r) => {
                const cu = costos.get(r.insumoId)?.costo ?? null;
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="min-w-40 font-medium">{r.insumo.nombre}</span>
                    <span className="badge bg-background text-muted">{r.alcance === "POR_PEDIDO" ? "por pedido" : "por ítem"}</span>
                    {r.alcance === "POR_ITEM" && (
                      <span className="text-xs text-muted">{r.productoId ? `solo ${nombreProd.get(r.productoId) ?? "?"}` : r.categoriaId ? `categoría ${nombreCat.get(r.categoriaId) ?? "?"}` : "todos los productos"}</span>
                    )}
                    <span className="ml-auto font-mono text-xs text-muted">{cu ? `${fmtSoles(cu, true)} c/u` : "sin precio"}</span>
                    {puedeEditar ? (
                      <FormAccion accion={editarCantidadRegla} sinBoton className="flex items-center gap-1">
                        <input type="hidden" name="id" value={r.id} />
                        <input name="cantidad" type="number" step="any" min="0" defaultValue={r.cantidad.toString()} className="input w-20 py-1 text-sm" />
                        <button className="btn btn-secondary min-h-8 px-2 text-xs">Guardar</button>
                      </FormAccion>
                    ) : (
                      <span>{fmtNum(r.cantidad)}</span>
                    )}
                    {puedeEditar && <BotonAccion accion={quitarRegla} campos={{ id: r.id }} className="btn btn-danger min-h-8 px-2 text-xs">Quitar</BotonAccion>}
                  </li>
                );
              })}
            </ul>
            {puedeEditar && (
              <details className="rounded-xl bg-background p-3">
                <summary className="cursor-pointer text-sm font-semibold">+ Agregar regla en {canal.etiqueta.toLowerCase()}</summary>
                <FormAccion accion={crearRegla} className="mt-2 grid gap-2 sm:grid-cols-4" textoBoton="Agregar" claseBoton="btn btn-primary min-h-9 text-xs">
                  <input type="hidden" name="tipoServicio" value={canal.valor} />
                  <select name="insumoId" className="input py-1.5 text-sm" aria-label="Empaque">{empaques.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
                  <input name="cantidad" type="number" step="any" min="0" defaultValue="1" className="input py-1.5 text-sm" aria-label="Cantidad" />
                  <select name="alcance" className="input py-1.5 text-sm" aria-label="Alcance"><option value="POR_PEDIDO">por pedido</option><option value="POR_ITEM">por ítem</option></select>
                  <select name="aplica" className="input py-1.5 text-sm" aria-label="Aplica a (solo por ítem)">
                    <option value="">todos los productos</option>
                    <optgroup label="Categoría">{categorias.map((c) => <option key={c.id} value={`cat:${c.id}`}>{c.nombre}</option>)}</optgroup>
                    <optgroup label="Producto">{productos.map((p) => <option key={p.id} value={`prod:${p.id}`}>{p.nombre}</option>)}</optgroup>
                  </select>
                </FormAccion>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
