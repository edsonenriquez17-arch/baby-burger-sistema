import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { opcionesSelector } from "@/lib/costeo/items";
import { fmtSoles } from "@/lib/formato";
import { BotonAccion, FormAccion } from "@/components/form-accion";
import { SelectorItem } from "@/components/selector-item";
import { agregarComponenteBase, alternarProducto, crearProducto, quitarComponenteBase } from "../recetas/actions";

export const metadata: Metadata = { title: "Carta" };

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ inactivos?: string }> }) {
  const usuario = await requerirPermiso("productos.ver");
  const { inactivos } = await searchParams;
  const [categorias, opciones] = await Promise.all([
    db.categoriaProducto.findMany({
      where: { activa: true },
      include: {
        productos: { where: inactivos === "1" ? {} : { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] },
        componentes: { include: { insumo: true, unidadMedida: true, unidadInsumo: true }, orderBy: { orden: "asc" } },
      },
      orderBy: { orden: "asc" },
    }),
    opcionesSelector({ tipos: ["INGREDIENTE", "PREPARACION"] }),
  ]);
  const puedeEditar = usuario.permisos.has("productos.editar");
  const puedeRecetas = usuario.permisos.has("recetas.editar");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Carta</h1>
          <p className="text-sm text-muted">Productos por categoría. El costo y margen de cada uno está en su ficha técnica.</p>
        </div>
        <Link href={inactivos === "1" ? "/productos" : "/productos?inactivos=1"} className="text-sm text-muted hover:underline">{inactivos === "1" ? "ocultar retirados" : "ver retirados"}</Link>
      </div>

      {puedeEditar && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">+ Nuevo producto</summary>
          <FormAccion accion={crearProducto} className="mt-3 grid gap-3 sm:grid-cols-2" textoBoton="Crear y armar receta">
            <div><label className="label">Nombre</label><input name="nombre" className="input" required /></div>
            <div><label className="label">Categoría</label><select name="categoriaId" className="input">{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><label className="label">Precio de venta (S/)</label><input name="precioVenta" type="number" step="0.5" min="0" className="input" required /></div>
            <div><label className="label">Descripción</label><input name="descripcion" className="input" /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="esExtra" className="size-5 accent-brand" /> Es un extra (BBQ, tocino, carne adicional…)</label>
            <p className="text-xs text-muted sm:col-span-2">La receta arranca con los componentes base de la categoría (si los tiene) y luego la completas en la ficha.</p>
          </FormAccion>
        </details>
      )}

      {categorias.map((cat) => (
        <div key={cat.id} className="card space-y-3">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: cat.color ?? "#5d6280" }} />
            <h2 className="font-semibold">{cat.nombre}</h2>
            <span className="text-xs text-muted">{cat.productos.length} producto(s)</span>
          </div>

          {cat.productos.length > 0 && (
            <ul className="divide-y divide-border">
              {cat.productos.map((p) => (
                <li key={p.id} className={`flex flex-wrap items-center gap-3 py-2 ${p.activo ? "" : "opacity-50"}`}>
                  <div className="min-w-0 flex-1">
                    <Link href={`/recetas/${p.id}`} className="font-medium text-brand hover:underline">{p.nombre}</Link>
                    {p.esExtra && <span className="badge ml-2 bg-background text-muted">extra</span>}
                    {!p.disponible && <span className="badge ml-2 bg-warning/15 text-warning">agotado</span>}
                    {!p.activo && <span className="badge ml-2 bg-border text-muted">retirado</span>}
                    {p.descripcion && <div className="text-xs text-muted">{p.descripcion}</div>}
                  </div>
                  <div className="font-mono font-semibold">{fmtSoles(p.precioVenta)}</div>
                  {puedeEditar && (
                    <BotonAccion accion={alternarProducto} campos={{ id: p.id, campo: "disponible" }} className="btn btn-secondary min-h-9 px-3 text-xs">
                      {p.disponible ? "Agotado" : "Disponible"}
                    </BotonAccion>
                  )}
                </li>
              ))}
            </ul>
          )}

          <details className="rounded-xl bg-background p-3 text-sm">
            <summary className="cursor-pointer font-medium">Componentes base de la categoría ({cat.componentes.length})</summary>
            <p className="mt-1 text-xs text-muted">Lo que todo producto nuevo de esta categoría lleva por defecto (ej. lechuga, tomate, papas). Editable luego producto por producto.</p>
            <ul className="mt-2 space-y-1">
              {cat.componentes.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span className="flex-1">{c.insumo.nombre}: {c.cantidad ? `${c.cantidad} ${c.unidadInsumo?.nombre ?? c.unidadMedida?.codigo ?? ""}` : <span className="text-warning">pendiente</span>}</span>
                  {puedeRecetas && <BotonAccion accion={quitarComponenteBase} campos={{ id: c.id }} className="btn btn-danger min-h-8 px-2 text-xs">Quitar</BotonAccion>}
                </li>
              ))}
            </ul>
            {puedeRecetas && (
              <FormAccion accion={agregarComponenteBase} className="mt-3" textoBoton="Agregar / actualizar" claseBoton="btn btn-secondary min-h-9 text-xs">
                <input type="hidden" name="categoriaId" value={cat.id} />
                <SelectorItem insumos={opciones.insumos} unidades={opciones.unidades} />
              </FormAccion>
            )}
          </details>
        </div>
      ))}
    </div>
  );
}
