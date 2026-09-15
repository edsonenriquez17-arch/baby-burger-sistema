import type { Resultado } from "./form-accion";
import { BotonEnForm, FormAccion } from "./form-accion";
import { SelectorItem, type InsumoOpcion, type UnidadOpcion } from "./selector-item";
import { fmtSoles } from "@/lib/formato";
import type { LineaCosto } from "@/lib/costeo/costeo";

type Accion = (prev: Resultado, fd: FormData) => Promise<Resultado>;

export type ItemEditor = {
  id: string;
  insumoId: string;
  notas: string | null;
  selector: { insumoId: string; cantidad: string; unidad: string };
  esComponenteBase?: boolean;
};

const PENDIENTE_TEXTO: Record<string, string> = {
  cantidad: "cantidad pendiente",
  factor: "peso de la unidad pendiente",
  precio: "sin precio",
};

/**
 * Tabla editable de ítems (receta o preparación) con costo por línea.
 * Cada fila es su propio formulario: guardar / quitar. Abajo, agregar.
 */
export function EditorItems({
  items,
  lineas,
  total,
  completo,
  opciones,
  padre,
  acciones,
  puedeEditar,
  tituloTotal = "Costo total",
}: {
  items: ItemEditor[];
  lineas: LineaCosto[];
  total: LineaCosto["costoTotal"];
  completo: boolean;
  opciones: { insumos: InsumoOpcion[]; unidades: UnidadOpcion[] };
  padre: { campo: string; valor: string };
  acciones: { editar: Accion; quitar: Accion; agregar: Accion };
  puedeEditar: boolean;
  tituloTotal?: string;
}) {
  const porInsumo = new Map(lineas.map((l) => [l.insumoId, l]));

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-muted">Sin ingredientes todavía.</p>}

      {items.map((it) => {
        const l = porInsumo.get(it.insumoId);
        return (
          <FormAccion key={it.id} accion={acciones.editar} sinBoton className="rounded-xl border border-border p-3">
            <input type="hidden" name="itemId" value={it.id} />
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium">
                  {l?.nombre}
                  {l?.tipo === "PREPARACION" && <span className="badge bg-background text-muted">preparación</span>}
                  {it.esComponenteBase && <span className="badge bg-brand-light text-brand">base de la categoría</span>}
                  {l?.pendiente && <span className="badge bg-warning/15 text-warning">{PENDIENTE_TEXTO[l.pendiente]}</span>}
                </div>
                {puedeEditar ? (
                  <SelectorItem insumos={opciones.insumos} unidades={opciones.unidades} inicial={it.selector} fijarInsumo />
                ) : (
                  <div className="text-sm text-muted">{l?.cantidadTexto}</div>
                )}
                <input name="notas" defaultValue={it.notas ?? ""} placeholder="nota (ej. crocante, sin sal)" className="input mt-2 py-1.5 text-sm" readOnly={!puedeEditar} />
              </div>
              <div className="flex flex-col items-end justify-between gap-2">
                <div className="text-right">
                  <div className="font-mono text-base font-semibold">{fmtSoles(l?.costoTotal, true)}</div>
                  {l?.costoUnitario && <div className="text-xs text-muted">{fmtSoles(l.costoUnitario, true)} / {l.unidadBase}</div>}
                </div>
                {puedeEditar && (
                  <div className="flex gap-2">
                    <button className="btn btn-secondary min-h-9 px-3 text-xs">Guardar</button>
                    <BotonEnForm accion={acciones.quitar} className="btn btn-danger min-h-9 px-3 text-xs" confirmar="¿Quitar este ingrediente de la receta?">
                      Quitar
                    </BotonEnForm>
                  </div>
                )}
              </div>
            </div>
          </FormAccion>
        );
      })}

      <div className="flex items-center justify-between rounded-xl bg-background px-4 py-3">
        <span className="font-semibold">{tituloTotal}</span>
        <span className="text-right">
          <span className="font-mono text-lg font-bold">{fmtSoles(total, true)}</span>
          {!completo && <div className="text-xs text-warning">incompleto: hay datos pendientes; el total solo suma lo conocido</div>}
        </span>
      </div>

      {puedeEditar && (
        <details className="rounded-xl bg-background p-3">
          <summary className="cursor-pointer text-sm font-semibold">+ Agregar ingrediente</summary>
          <FormAccion accion={acciones.agregar} className="mt-3" textoBoton="Agregar" claseBoton="btn btn-primary min-h-10 text-sm">
            <input type="hidden" name={padre.campo} value={padre.valor} />
            <SelectorItem insumos={opciones.insumos} unidades={opciones.unidades} />
            <p className="mt-1 text-xs text-muted">Deja la cantidad vacía si aún no la conoces: quedará pendiente y no se inventa.</p>
          </FormAccion>
        </details>
      )}
    </div>
  );
}
