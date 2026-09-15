import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { FormAccion } from "@/components/form-accion";
import { crearPreparacion } from "../actions";

export const metadata: Metadata = { title: "Nueva preparación" };

export default async function NuevaPreparacionPage() {
  await requerirPermiso("recetas.editar");
  const unidades = await db.unidadMedida.findMany({ where: { activa: true }, orderBy: [{ tipo: "asc" }, { factorABase: "asc" }] });
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Nueva preparación</h1>
      <div className="card">
        <FormAccion accion={crearPreparacion} className="grid gap-3 sm:grid-cols-2" textoBoton="Crear y agregar ingredientes">
          <div className="sm:col-span-2"><label className="label" htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" className="input" required placeholder="ej. Mayonesa casera" /></div>
          <div><label className="label" htmlFor="rendimientoCantidad">Cuánto produce el lote</label><input id="rendimientoCantidad" name="rendimientoCantidad" type="number" step="any" min="0" className="input" placeholder="pendiente" /></div>
          <div><label className="label" htmlFor="rendimientoUnidadId">Unidad</label><select id="rendimientoUnidadId" name="rendimientoUnidadId" className="input" required>{unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.codigo})</option>)}</select></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="instrucciones">Instrucciones (opcional)</label><textarea id="instrucciones" name="instrucciones" className="input" rows={3} /></div>
          <p className="text-xs text-muted sm:col-span-2">La unidad define si la preparación se mide en gramos (kg), mililitros (L) o unidades. No se puede cambiar de tipo después.</p>
        </FormAccion>
      </div>
    </div>
  );
}
