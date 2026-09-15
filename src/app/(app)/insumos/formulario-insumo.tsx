import type { TipoInsumo } from "@prisma/client";
import { db } from "@/lib/db";
import { FormAccion } from "@/components/form-accion";
import { crearInsumo, editarInsumo } from "./actions";

type Valores = {
  id?: string;
  nombre?: string;
  categoriaId?: string | null;
  unidadBaseId?: string;
  stockMinimo?: string;
  observaciones?: string | null;
  esCostoCompartido?: boolean;
};

export async function FormularioInsumo({ tipo, valores = {} }: { tipo: TipoInsumo; valores?: Valores }) {
  const [categorias, unidades] = await Promise.all([
    db.categoriaInsumo.findMany({ where: { tipo, activa: true }, orderBy: { orden: "asc" } }),
    db.unidadMedida.findMany({ where: { esBase: true }, orderBy: { codigo: "asc" } }),
  ]);
  const editando = Boolean(valores.id);

  return (
    <FormAccion accion={editando ? editarInsumo : crearInsumo} className="grid gap-3 sm:grid-cols-2" textoBoton={editando ? "Guardar cambios" : "Crear"}>
      {editando && <input type="hidden" name="id" value={valores.id} />}
      <input type="hidden" name="tipo" value={tipo} />
      <div className="sm:col-span-2">
        <label className="label" htmlFor="nombre">Nombre</label>
        <input id="nombre" name="nombre" className="input" defaultValue={valores.nombre} required />
      </div>
      <div>
        <label className="label" htmlFor="categoriaId">Categoría</label>
        <select id="categoriaId" name="categoriaId" className="input" defaultValue={valores.categoriaId ?? ""}>
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="unidadBaseId">Unidad base {editando && <span className="text-xs">(no editable si ya tiene precios o recetas)</span>}</label>
        <select id="unidadBaseId" name="unidadBaseId" className="input" defaultValue={valores.unidadBaseId ?? unidades[0]?.id} required>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>{u.nombre} ({u.codigo})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="stockMinimo">Stock mínimo (alerta) — opcional</label>
        <input id="stockMinimo" name="stockMinimo" type="number" step="any" min="0" className="input" defaultValue={valores.stockMinimo ?? ""} placeholder="sin alerta" />
      </div>
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" name="esCostoCompartido" className="size-5 accent-brand" defaultChecked={valores.esCostoCompartido ?? false} />
        Costo compartido (ej. aceite de plancha): no se reparte por receta
      </label>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="observaciones">Observaciones</label>
        <textarea id="observaciones" name="observaciones" className="input" rows={2} defaultValue={valores.observaciones ?? ""} />
      </div>
    </FormAccion>
  );
}
