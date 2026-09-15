import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { costearItems, obtenerCostosVigentes, INCLUDE_ITEM_COSTEABLE, D } from "@/lib/costeo/costeo";
import { opcionesSelector, valorSelector } from "@/lib/costeo/items";
import { fmtNum, fmtSoles } from "@/lib/formato";
import { BotonAccion, FormAccion } from "@/components/form-accion";
import { EditorItems } from "@/components/editor-items";
import { agregarItemPreparacion, alternarActivaPreparacion, editarItemPreparacion, editarPreparacion, quitarItemPreparacion } from "../actions";

export default async function PreparacionPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("recetas.ver");
  const { id } = await params;
  const prep = await db.preparacion.findUnique({
    where: { id },
    include: {
      insumoResultado: { include: { unidadBase: true, recetaItems: { include: { receta: { include: { producto: { select: { id: true, nombre: true } } } } } }, prepItems: { include: { preparacion: { select: { id: true, nombre: true } } } } } },
      rendimientoUnidad: true,
      items: { include: INCLUDE_ITEM_COSTEABLE, orderBy: { orden: "asc" } },
    },
  });
  if (!prep) notFound();

  const [costos, opciones, unidades] = await Promise.all([
    obtenerCostosVigentes(),
    opcionesSelector({ tipos: ["INGREDIENTE", "PREPARACION"], excluirInsumoId: prep.insumoResultadoId }),
    db.unidadMedida.findMany({ where: { tipo: prep.insumoResultado.unidadBase.tipo, activa: true }, orderBy: { factorABase: "asc" } }),
  ]);
  const { lineas, total, completo } = costearItems(prep.items, costos);
  const base = prep.insumoResultado.unidadBase.codigo;
  const rendBase = prep.rendimientoCantidad ? prep.rendimientoCantidad.mul(prep.rendimientoUnidad.factorABase) : null;
  const costoUnit = completo && rendBase && rendBase.gt(0) ? total.div(rendBase) : null;
  const puedeEditar = usuario.permisos.has("recetas.editar");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/preparaciones" className="text-sm text-muted hover:underline">← preparaciones</Link>
          <h1 className="text-2xl font-bold">{prep.nombre} {!prep.activa && <span className="badge bg-border text-muted">inactiva</span>}</h1>
          <p className="text-sm text-muted">Se mide en {base}. <Link href={`/insumos/${prep.insumoResultadoId}`} className="text-brand hover:underline">Ver como insumo (historial de costo)</Link></p>
        </div>
        {puedeEditar && (
          <BotonAccion accion={alternarActivaPreparacion} campos={{ id }} className={prep.activa ? "btn btn-danger min-h-10 text-sm" : "btn btn-primary min-h-10 text-sm"}>
            {prep.activa ? "Desactivar" : "Activar"}
          </BotonAccion>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card"><div className="text-xs uppercase text-muted">Costo del lote</div><div className="font-mono text-2xl font-bold">{fmtSoles(total)}</div>{!completo && <div className="text-xs text-warning">incompleto</div>}</div>
        <div className="card"><div className="text-xs uppercase text-muted">Rinde</div><div className="text-2xl font-bold">{prep.rendimientoCantidad ? `${fmtNum(prep.rendimientoCantidad)} ${prep.rendimientoUnidad.codigo}` : "pendiente"}</div></div>
        <div className="card">
          <div className="text-xs uppercase text-muted">Costo por {base}</div>
          <div className="font-mono text-2xl font-bold text-brand">{costoUnit ? fmtSoles(costoUnit, true) : "—"}</div>
          {costoUnit && base !== "unidad" && <div className="text-xs text-muted">{fmtSoles(costoUnit.mul(new D(100)))} / 100 {base} · {fmtSoles(costoUnit.mul(new D(1000)))} / {base === "g" ? "kg" : "L"}</div>}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Ingredientes del lote</h2>
        <EditorItems
          items={prep.items.map((i) => ({ id: i.id, insumoId: i.insumoId, notas: i.notas, selector: valorSelector(i) }))}
          lineas={lineas}
          total={total}
          completo={completo}
          opciones={opciones}
          padre={{ campo: "preparacionId", valor: id }}
          acciones={{ editar: editarItemPreparacion, quitar: quitarItemPreparacion, agregar: agregarItemPreparacion }}
          puedeEditar={puedeEditar}
          tituloTotal="Costo del lote"
        />
      </div>

      {(prep.insumoResultado.recetaItems.length > 0 || prep.insumoResultado.prepItems.length > 0) && (
        <div className="card">
          <h2 className="font-semibold">Se usa en</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {prep.insumoResultado.recetaItems.map((ri) => <Link key={ri.id} href={`/recetas/${ri.receta.producto.id}`} className="badge bg-brand-light text-brand">{ri.receta.producto.nombre}</Link>)}
            {prep.insumoResultado.prepItems.map((pi) => <Link key={pi.id} href={`/preparaciones/${pi.preparacion.id}`} className="badge bg-background text-foreground">prep: {pi.preparacion.nombre}</Link>)}
          </div>
        </div>
      )}

      {puedeEditar && (
        <details className="card" open={prep.rendimientoCantidad === null}>
          <summary className="cursor-pointer font-semibold">Datos de la preparación (nombre, rendimiento, instrucciones)</summary>
          <FormAccion accion={editarPreparacion} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={id} />
            <div className="sm:col-span-2"><label className="label">Nombre</label><input name="nombre" className="input" defaultValue={prep.nombre} required /></div>
            <div><label className="label">Cuánto produce el lote</label><input name="rendimientoCantidad" type="number" step="any" min="0" className="input" defaultValue={prep.rendimientoCantidad?.toString() ?? ""} placeholder="pendiente" /></div>
            <div><label className="label">Unidad</label><select name="rendimientoUnidadId" className="input" defaultValue={prep.rendimientoUnidadId}>{unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.codigo})</option>)}</select></div>
            <div className="sm:col-span-2"><label className="label">Instrucciones</label><textarea name="instrucciones" className="input" rows={3} defaultValue={prep.instrucciones ?? ""} /></div>
          </FormAccion>
        </details>
      )}
    </div>
  );
}
