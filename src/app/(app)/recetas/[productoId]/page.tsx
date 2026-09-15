import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { calcularMetricas, costearItems, obtenerCostosVigentes, obtenerParametrosMargen, INCLUDE_ITEM_COSTEABLE } from "@/lib/costeo/costeo";
import { opcionesSelector, valorSelector } from "@/lib/costeo/items";
import { fmtFechaHora, fmtPct, fmtSoles } from "@/lib/formato";
import { BotonAccion, FormAccion } from "@/components/form-accion";
import { EditorItems } from "@/components/editor-items";
import { agregarItemReceta, alternarProducto, cambiarPrecioProducto, editarItemReceta, editarProducto, quitarItemReceta } from "../actions";

export default async function FichaTecnicaPage({ params }: { params: Promise<{ productoId: string }> }) {
  const usuario = await requerirPermiso("recetas.ver");
  const { productoId } = await params;
  const producto = await db.producto.findUnique({
    where: { id: productoId },
    include: {
      categoria: true,
      receta: { include: { items: { include: INCLUDE_ITEM_COSTEABLE, orderBy: { orden: "asc" } } } },
      preciosHist: { orderBy: { vigenteDesde: "desc" }, include: { usuario: { select: { nombre: true } } } },
      costosHist: { orderBy: { fecha: "desc" }, take: 30 },
    },
  });
  if (!producto) notFound();

  const [costos, opciones, margen, categorias] = await Promise.all([
    obtenerCostosVigentes(),
    opcionesSelector({ tipos: ["INGREDIENTE", "PREPARACION", "EMPAQUE"] }),
    obtenerParametrosMargen(),
    db.categoriaProducto.findMany({ where: { activa: true }, orderBy: { orden: "asc" } }),
  ]);
  const items = producto.receta?.items ?? [];
  const { lineas, total, completo } = costearItems(items, costos);
  const costo = items.length ? total : null;
  const m = calcularMetricas(producto.precioVenta, costo, margen.objetivo, margen.alerta);
  const puedeEditar = usuario.permisos.has("recetas.editar");
  const puedePrecio = usuario.permisos.has("productos.precios");
  const puedeProducto = usuario.permisos.has("productos.editar");
  const verFinanzas = usuario.permisos.has("reportes.financieros") || usuario.rol === "ADMIN";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/recetas" className="text-sm text-muted hover:underline">← recetas</Link>
          <h1 className="text-2xl font-bold">
            {producto.nombre}
            {!producto.activo && <span className="badge ml-2 bg-border text-muted">inactivo</span>}
            {!producto.disponible && <span className="badge ml-2 bg-warning/15 text-warning">agotado</span>}
          </h1>
          <p className="text-sm text-muted">{producto.categoria.nombre}{producto.esExtra && " · extra"}{producto.descripcion && ` · ${producto.descripcion}`}</p>
        </div>
        {puedeProducto && (
          <div className="flex gap-2">
            <BotonAccion accion={alternarProducto} campos={{ id: productoId, campo: "disponible" }} className="btn btn-secondary min-h-10 text-sm">{producto.disponible ? "Marcar agotado" : "Marcar disponible"}</BotonAccion>
            <BotonAccion accion={alternarProducto} campos={{ id: productoId, campo: "activo" }} className={producto.activo ? "btn btn-danger min-h-10 text-sm" : "btn btn-primary min-h-10 text-sm"} confirmar={producto.activo ? "¿Retirar de la carta? El historial se conserva." : undefined}>{producto.activo ? "Retirar de la carta" : "Volver a la carta"}</BotonAccion>
          </div>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card"><div className="text-xs uppercase text-muted">Precio de venta</div><div className="font-mono text-2xl font-bold">{fmtSoles(producto.precioVenta)}</div></div>
        <div className="card"><div className="text-xs uppercase text-muted">Costo comida</div><div className="font-mono text-2xl font-bold">{fmtSoles(costo)}</div>{costo !== null && !completo && <div className="text-xs text-warning">parcial: hay pendientes</div>}</div>
        {verFinanzas && (
          <>
            <div className="card"><div className="text-xs uppercase text-muted">Ganancia</div><div className="font-mono text-2xl font-bold text-brand">{fmtSoles(m.ganancia)}</div><div className="text-xs text-muted">markup {fmtPct(m.markupPct)}</div></div>
            <div className={`card ${m.alerta ? "border-danger" : ""}`}><div className="text-xs uppercase text-muted">Margen</div><div className={`font-mono text-2xl font-bold ${m.alerta ? "text-danger" : ""}`}>{fmtPct(m.margenPct)}</div><div className="text-xs text-muted">objetivo {margen.objetivo} % → precio sugerido {fmtSoles(m.precioRecomendado)}</div></div>
          </>
        )}
      </div>
      {m.alerta && <p className="rounded-xl bg-danger/10 px-4 py-2 text-sm text-danger">Margen por debajo del mínimo ({margen.alerta} %). Opciones: subir precio, cambiar proveedor/marca, ajustar receta o revisar porciones.</p>}

      {/* Receta */}
      <div className="card">
        <h2 className="mb-1 font-semibold">Ficha técnica</h2>
        <p className="mb-3 text-xs text-muted">Un ítem por ingrediente, preparación o empaque propio del producto (ej. vaso Domo de la chicha). Los empaques por canal (caja, salsas, bolsa) se configuran en Empaques.</p>
        <EditorItems
          items={items.map((i) => ({ id: i.id, insumoId: i.insumoId, notas: i.notas, selector: valorSelector(i), esComponenteBase: i.esComponenteBase }))}
          lineas={lineas}
          total={total}
          completo={completo}
          opciones={opciones}
          padre={{ campo: "productoId", valor: productoId }}
          acciones={{ editar: editarItemReceta, quitar: quitarItemReceta, agregar: agregarItemReceta }}
          puedeEditar={puedeEditar}
          tituloTotal="Costo de comida por unidad"
        />
      </div>

      {/* Precio */}
      {puedePrecio && (
        <div className="card">
          <h2 className="font-semibold">Cambiar precio de venta</h2>
          <FormAccion accion={cambiarPrecioProducto} className="mt-2 flex flex-wrap items-end gap-3" sinBoton>
            <input type="hidden" name="id" value={productoId} />
            <div><label className="label">Nuevo precio (S/)</label><input name="precioVenta" type="number" step="0.5" min="0" className="input w-36" defaultValue={producto.precioVenta.toString()} required /></div>
            <div className="flex-1"><label className="label">Motivo (opcional)</label><input name="motivo" className="input" placeholder="ej. subió la carne" /></div>
            <button className="btn btn-primary">Actualizar precio</button>
          </FormAccion>
          {producto.preciosHist.length > 1 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted">Historial de precios ({producto.preciosHist.length})</summary>
              <ul className="mt-2 space-y-1">
                {producto.preciosHist.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-2 text-muted">
                    <span className="font-mono text-foreground">{fmtSoles(h.precio)}</span>
                    <span>desde {fmtFechaHora(h.vigenteDesde)}</span>
                    {h.vigenteHasta && <span>hasta {fmtFechaHora(h.vigenteHasta)}</span>}
                    {h.motivo && <span>· {h.motivo}</span>}
                    {h.usuario && <span>· {h.usuario.nombre}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Historial de costos */}
      <details className="card">
        <summary className="cursor-pointer font-semibold">Historial de costo ({producto.costosHist.length})</summary>
        <p className="mt-1 text-xs text-muted">Cada vez que cambia un precio de insumo o la receta se guarda una foto del costo. Las ventas ya hechas conservan su costo original.</p>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-1 pr-3">Fecha</th><th className="py-1 pr-3 text-right">Costo</th><th className="py-1 pr-3">Qué cambió</th><th className="py-1">Detalle</th></tr></thead>
          <tbody>
            {producto.costosHist.map((h) => (
              <tr key={h.id} className="border-t border-border align-top">
                <td className="py-1 pr-3 whitespace-nowrap">{fmtFechaHora(h.fecha)}</td>
                <td className="py-1 pr-3 text-right font-mono">{fmtSoles(h.costoTotal)}{!h.completo && <span className="text-warning"> *</span>}</td>
                <td className="py-1 pr-3 text-muted">{h.motivo}</td>
                <td className="py-1">
                  <details className="text-xs text-muted"><summary className="cursor-pointer">ver</summary>
                    <ul className="mt-1">
                      {(h.detalle as { nombre: string; cantidad: string; costoTotal: string | null; pendiente: string | null }[]).map((l, i) => (
                        <li key={i}>{l.nombre}: {l.cantidad} → {l.costoTotal ? fmtSoles(l.costoTotal, true) : l.pendiente}</li>
                      ))}
                    </ul>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {puedeProducto && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Datos del producto</summary>
          <FormAccion accion={editarProducto} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={productoId} />
            <div><label className="label">Nombre</label><input name="nombre" className="input" defaultValue={producto.nombre} required /></div>
            <div><label className="label">Categoría</label><select name="categoriaId" className="input" defaultValue={producto.categoriaId}>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="label">Descripción (aparece en la carta)</label><input name="descripcion" className="input" defaultValue={producto.descripcion ?? ""} /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="esExtra" className="size-5 accent-brand" defaultChecked={producto.esExtra} /> Es un extra (se agrega sobre otros productos en el pedido)</label>
          </FormAccion>
        </details>
      )}
    </div>
  );
}
