"use client";

import { useMemo, useState } from "react";

export type InsumoOpcion = {
  id: string;
  nombre: string;
  tipo: string;
  tipoUnidad: "MASA" | "VOLUMEN" | "UNIDAD";
  unidadBase: string;
  unidadesPropias: { id: string; nombre: string; pendiente: boolean }[];
};

export type UnidadOpcion = { id: string; codigo: string; tipo: "MASA" | "VOLUMEN" | "UNIDAD" };

type Props = {
  insumos: InsumoOpcion[];
  unidades: UnidadOpcion[];
  /** Valores iniciales (modo edición). */
  inicial?: { insumoId: string; cantidad: string; unidad: string };
  fijarInsumo?: boolean;
};

/**
 * Campos insumo / cantidad / unidad. La unidad se codifica en un solo campo:
 *   um:<id>  unidad de medida estándar (g, kg, ml, L, unidad)
 *   ui:<id>  unidad propia del insumo (slice, bola smash…)
 * La cantidad vacía se guarda como null = pendiente (regla 1).
 */
export function SelectorItem({ insumos, unidades, inicial, fijarInsumo }: Props) {
  const [insumoId, setInsumoId] = useState(inicial?.insumoId ?? insumos[0]?.id ?? "");
  const insumo = useMemo(() => insumos.find((i) => i.id === insumoId), [insumos, insumoId]);

  const opcionesUnidad = useMemo(() => {
    if (!insumo) return [];
    const estandar = unidades.filter((u) => u.tipo === insumo.tipoUnidad).map((u) => ({ valor: `um:${u.id}`, texto: u.codigo }));
    const propias = insumo.unidadesPropias.map((u) => ({ valor: `ui:${u.id}`, texto: `${u.nombre}${u.pendiente ? " (peso pendiente)" : ""}` }));
    return [...estandar, ...propias];
  }, [insumo, unidades]);

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_120px_160px]">
      {fijarInsumo ? (
        <input type="hidden" name="insumoId" value={insumoId} />
      ) : (
        <select name="insumoId" className="input" value={insumoId} onChange={(e) => setInsumoId(e.target.value)} aria-label="Insumo">
          {agrupar(insumos).map(([tipo, lista]) => (
            <optgroup key={tipo} label={tipo}>
              {lista.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
      <input
        name="cantidad"
        type="number"
        step="any"
        min="0"
        inputMode="decimal"
        className="input"
        placeholder="pendiente"
        defaultValue={inicial?.cantidad ?? ""}
        aria-label="Cantidad"
      />
      <select name="unidad" className="input" defaultValue={inicial?.unidad} key={insumoId} aria-label="Unidad">
        {opcionesUnidad.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}

const ETIQUETA: Record<string, string> = { INGREDIENTE: "Ingredientes", PREPARACION: "Preparaciones", EMPAQUE: "Empaques" };

function agrupar(insumos: InsumoOpcion[]): [string, InsumoOpcion[]][] {
  const m = new Map<string, InsumoOpcion[]>();
  for (const i of insumos) {
    const k = ETIQUETA[i.tipo] ?? i.tipo;
    (m.get(k) ?? m.set(k, []).get(k)!).push(i);
  }
  return [...m.entries()];
}
