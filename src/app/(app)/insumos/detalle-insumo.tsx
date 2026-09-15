import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { D, estadisticasPrecios, obtenerCostosVigentes } from "@/lib/costeo/costeo";
import { fmtFecha, fmtFechaHora, fmtNum, fmtSoles } from "@/lib/formato";
import { BotonAccion, BotonEnForm, FormAccion } from "@/components/form-accion";
import { FormularioInsumo } from "./formulario-insumo";
import { alternarActivoInsumo, crearPresentacion, desactivarPresentacion, desactivarUnidadPropia, guardarUnidadPropia, marcarPredeterminada, registrarPrecioManual } from "./actions";
import type { UsuarioActual } from "@/lib/auth/session";

const CANTIDADES_EJEMPLO: Record<string, number[]> = { g: [1, 20, 80, 100, 1000], ml: [1, 100, 250, 1000], unidad: [1, 6, 12] };
const ORIGEN: Record<string, string> = { COMPRA: "compra", MANUAL: "manual", PREPARACION: "preparación", INICIAL: "inicial" };

export async function DetalleInsumo({ id, rutaBase, usuario }: { id: string; rutaBase: string; usuario: UsuarioActual }) {
  const insumo = await db.insumo.findUnique({
    where: { id },
    include: {
      categoria: true,
      unidadBase: true,
      unidadesPropias: { where: { activa: true }, orderBy: { nombre: "asc" } },
      presentaciones: { where: { activa: true }, include: { marca: true, proveedor: true, unidadContenido: true, precios: { where: { vigenteHasta: null }, take: 1 } }, orderBy: { creadoEn: "asc" } },
      precios: { include: { presentacion: true, usuario: { select: { nombre: true } } }, orderBy: { vigenteDesde: "desc" } },
      recetaItems: { include: { receta: { include: { producto: { select: { id: true, nombre: true } } } } } },
      prepItems: { include: { preparacion: { select: { id: true, nombre: true } } } },
      preparacion: { select: { id: true } },
    },
  });
  if (!insumo) notFound();

  const [unidades, marcas, proveedores] = await Promise.all([
    db.unidadMedida.findMany({ where: { tipo: insumo.unidadBase.tipo, activa: true }, orderBy: { factorABase: "asc" } }),
    db.marca.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
    db.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  const vigente = (await obtenerCostosVigentes(db, [id])).get(id) ?? null;
  const stats = estadisticasPrecios(insumo.precios);
  const puedeEditar = usuario.permisos.has("insumos.editar");
  const puedePrecios = usuario.permisos.has("insumos.precios");
  const base = insumo.unidadBase.codigo;
  const presVigente = vigente?.presentacionId ? insumo.presentaciones.find((p) => p.id === vigente.presentacionId) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={rutaBase} className="text-sm text-muted hover:underline">← volver</Link>
          <h1 className="text-2xl font-bold">
            {insumo.nombre} {!insumo.activo && <span className="badge bg-border text-muted">inactivo</span>}
          </h1>
          <p className="text-sm text-muted">
            {insumo.categoria?.nombre ?? "Sin categoría"} · unidad base: {base}
            {insumo.preparacion && (
              <> · <Link href={`/preparaciones/${insumo.preparacion.id}`} className="text-brand hover:underline">ver preparación</Link></>
            )}
          </p>
        </div>
        {puedeEditar && (
          <BotonAccion accion={alternarActivoInsumo} campos={{ id }} className={insumo.activo ? "btn btn-danger min-h-10 text-sm" : "btn btn-primary min-h-10 text-sm"} confirmar={insumo.activo ? "¿Desactivar este insumo? No se borra, deja de aparecer en listas." : undefined}>
            {insumo.activo ? "Desactivar" : "Activar"}
          </BotonAccion>
        )}
      </div>

      {/* Costo vigente */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold">Costo vigente</h2>
          {vigente ? (
            <>
              <div className="mt-1 text-3xl font-bold text-brand">{fmtSoles(vigente.costo, true)} <span className="text-base font-normal text-muted">/ {base}</span></div>
              <p className="text-xs text-muted">
                desde {fmtFecha(vigente.vigenteDesde)}
                {presVigente && ` · ${presVigente.marca ? presVigente.marca.nombre + " · " : ""}${presVigente.nombre}`}
              </p>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {(CANTIDADES_EJEMPLO[base] ?? [1]).map((q) => (
                    <tr key={q} className="border-t border-border">
                      <td className="py-1 text-muted">{fmtNum(q)} {base}</td>
                      <td className="py-1 text-right font-mono">{fmtSoles(vigente.costo.mul(new D(q)), true)}</td>
                    </tr>
                  ))}
                  {insumo.unidadesPropias.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="py-1 text-muted">1 {u.nombre}{u.factorABase ? ` (${fmtNum(u.factorABase)} ${base})` : ""}</td>
                      <td className="py-1 text-right font-mono">{u.factorABase ? fmtSoles(vigente.costo.mul(u.factorABase), true) : <span className="badge bg-warning/15 text-warning">factor pendiente</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="mt-2 text-sm text-warning">Sin precio registrado. Agrega una presentación con precio o registra una compra.</p>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold">Historial de precios (por {base})</h2>
          {stats ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Actual</dt><dd className="text-right font-mono">{fmtSoles(stats.actual, true)}</dd>
              <dt className="text-muted">Anterior</dt><dd className="text-right font-mono">{fmtSoles(stats.anterior, true)}</dd>
              <dt className="text-muted">Mínimo</dt><dd className="text-right font-mono">{fmtSoles(stats.minimo, true)}</dd>
              <dt className="text-muted">Máximo</dt><dd className="text-right font-mono">{fmtSoles(stats.maximo, true)}</dd>
              <dt className="text-muted">Promedio</dt><dd className="text-right font-mono">{fmtSoles(stats.promedio, true)}</dd>
              <dt className="text-muted">Registros</dt><dd className="text-right">{stats.cambios}</dd>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted">Todavía no hay precios.</p>
          )}
        </div>
      </div>

      {/* Presentaciones */}
      <div className="card space-y-4">
        <h2 className="font-semibold">Presentaciones de compra</h2>
        <p className="text-xs text-muted">★ = predeterminada: fija el costo vigente. Registra aquí un precio nuevo sin compra (por ejemplo, un cambio de precio del proveedor).</p>
        {insumo.presentaciones.length === 0 ? (
          <p className="text-sm text-muted">Sin presentaciones.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-1 pr-3">Presentación</th>
                  <th className="py-1 pr-3">Marca / proveedor</th>
                  <th className="py-1 pr-3">Contenido</th>
                  <th className="py-1 pr-3 text-right">Precio vigente</th>
                  <th className="py-1 pr-3 text-right">Costo / {base}</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {insumo.presentaciones.map((p) => {
                  const precio = p.precios[0];
                  return (
                    <tr key={p.id} className="border-t border-border align-top">
                      <td className="py-2 pr-3 font-medium">{p.esPredeterminada && "★ "}{p.nombre}{p.observaciones && <div className="text-xs font-normal text-muted">{p.observaciones}</div>}</td>
                      <td className="py-2 pr-3 text-muted">{[p.marca?.nombre, p.proveedor?.nombre].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="py-2 pr-3">{p.contenido === null ? <span className="badge bg-warning/15 text-warning">pendiente</span> : `${fmtNum(p.contenido)} ${p.unidadContenido.codigo}`}{p.unidadesPorPaquete ? ` (x${p.unidadesPorPaquete})` : ""}</td>
                      <td className="py-2 pr-3 text-right font-mono">{precio ? fmtSoles(precio.precioPresentacion) : "—"}</td>
                      <td className="py-2 pr-3 text-right font-mono">{precio ? fmtSoles(precio.costoUnitarioBase, true) : "—"}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {puedePrecios && (
                            <FormAccion accion={registrarPrecioManual} sinBoton className="flex items-center gap-1">
                              <input type="hidden" name="presentacionId" value={p.id} />
                              <input name="precio" type="number" step="0.01" min="0.01" placeholder="S/ nuevo" className="input w-28 py-1.5 text-sm" required disabled={p.contenido === null} title={p.contenido === null ? "Define primero el contenido" : ""} />
                              <button className="btn btn-primary min-h-9 px-3 text-xs" disabled={p.contenido === null}>Registrar</button>
                            </FormAccion>
                          )}
                          {puedeEditar && !p.esPredeterminada && (
                            <BotonAccion accion={marcarPredeterminada} campos={{ presentacionId: p.id }} className="btn btn-secondary min-h-9 px-3 text-xs">★ Predeterminada</BotonAccion>
                          )}
                          {puedeEditar && (
                            <BotonAccion accion={desactivarPresentacion} campos={{ presentacionId: p.id }} className="btn btn-danger min-h-9 px-3 text-xs" confirmar="¿Quitar esta presentación? El historial de precios se conserva.">Quitar</BotonAccion>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {puedeEditar && (
          <details className="rounded-xl bg-background p-3">
            <summary className="cursor-pointer text-sm font-semibold">+ Nueva presentación</summary>
            <FormAccion accion={crearPresentacion} className="mt-3 grid gap-3 sm:grid-cols-3" textoBoton="Agregar presentación">
              <input type="hidden" name="insumoId" value={id} />
              <div className="sm:col-span-3"><label className="label">Nombre (ej. Bolsa 400 g, Paquete x6, Bloque 1 kg)</label><input name="nombre" className="input" required /></div>
              <div><label className="label">Marca</label><input name="marca" className="input" list={`marcas-${id}`} /><datalist id={`marcas-${id}`}>{marcas.map((m) => <option key={m.id} value={m.nombre} />)}</datalist></div>
              <div><label className="label">Proveedor</label><input name="proveedor" className="input" list={`prov-${id}`} /><datalist id={`prov-${id}`}>{proveedores.map((m) => <option key={m.id} value={m.nombre} />)}</datalist></div>
              <div><label className="label">Unidades por paquete (opcional)</label><input name="unidadesPorPaquete" type="number" min="1" className="input" /></div>
              <div><label className="label">Contenido (cuánto trae)</label><input name="contenido" type="number" step="any" min="0" className="input" placeholder="pendiente" /></div>
              <div><label className="label">Unidad del contenido</label><select name="unidadContenidoId" className="input" defaultValue={insumo.unidadBaseId}>{unidades.map((u) => <option key={u.id} value={u.id}>{u.codigo}</option>)}</select></div>
              <div><label className="label">Precio pagado (S/, opcional)</label><input name="precio" type="number" step="0.01" min="0" className="input" /></div>
              <div className="sm:col-span-3"><label className="label">Observaciones</label><input name="observaciones" className="input" /></div>
            </FormAccion>
          </details>
        )}
      </div>

      {/* Unidades propias */}
      <div className="card space-y-3">
        <h2 className="font-semibold">Unidades propias</h2>
        <p className="text-xs text-muted">Para usar en recetas: «1 slice», «1 bola smash». Si el peso aún no se conoce, deja el factor vacío (queda pendiente y el costo no se inventa).</p>
        {insumo.unidadesPropias.map((u) => (
          <FormAccion key={u.id} accion={guardarUnidadPropia} sinBoton className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="insumoId" value={id} />
            <input type="hidden" name="unidadId" value={u.id} />
            <input name="nombre" defaultValue={u.nombre} className="input w-40 py-1.5 text-sm" required readOnly={!puedeEditar} />
            <span className="text-sm text-muted">=</span>
            <input name="factorABase" type="number" step="any" min="0" defaultValue={u.factorABase?.toString() ?? ""} placeholder="pendiente" className="input w-32 py-1.5 text-sm" readOnly={!puedeEditar} />
            <span className="text-sm text-muted">{base}</span>
            {puedeEditar && <button className="btn btn-secondary min-h-9 px-3 text-xs">Guardar</button>}
            {puedeEditar && <BotonEnForm accion={desactivarUnidadPropia} className="btn btn-danger min-h-9 px-3 text-xs" confirmar="¿Quitar esta unidad?">Quitar</BotonEnForm>}
          </FormAccion>
        ))}
        {puedeEditar && (
          <FormAccion accion={guardarUnidadPropia} sinBoton className="flex flex-wrap items-center gap-2 rounded-xl bg-background p-2">
            <input type="hidden" name="insumoId" value={id} />
            <input name="nombre" placeholder="nueva unidad (ej. slice)" className="input w-44 py-1.5 text-sm" required />
            <span className="text-sm text-muted">=</span>
            <input name="factorABase" type="number" step="any" min="0" placeholder="pendiente" className="input w-32 py-1.5 text-sm" />
            <span className="text-sm text-muted">{base}</span>
            <button className="btn btn-primary min-h-9 px-3 text-xs">Agregar</button>
          </FormAccion>
        )}
      </div>

      {/* Usos */}
      {(insumo.recetaItems.length > 0 || insumo.prepItems.length > 0) && (
        <div className="card">
          <h2 className="font-semibold">Se usa en</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {insumo.recetaItems.map((ri) => (
              <Link key={ri.id} href={`/recetas/${ri.receta.producto.id}`} className="badge bg-brand-light text-brand">{ri.receta.producto.nombre}</Link>
            ))}
            {insumo.prepItems.map((pi) => (
              <Link key={pi.id} href={`/preparaciones/${pi.preparacion.id}`} className="badge bg-background text-foreground">prep: {pi.preparacion.nombre}</Link>
            ))}
          </div>
        </div>
      )}

      {/* Historial completo */}
      <details className="card">
        <summary className="cursor-pointer font-semibold">Historial completo de precios ({insumo.precios.length})</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr><th className="py-1 pr-3">Desde</th><th className="py-1 pr-3">Hasta</th><th className="py-1 pr-3">Presentación</th><th className="py-1 pr-3 text-right">Precio</th><th className="py-1 pr-3 text-right">Costo / {base}</th><th className="py-1 pr-3">Origen</th><th className="py-1 pr-3">Usuario</th><th className="py-1">Nota</th></tr>
            </thead>
            <tbody>
              {insumo.precios.map((p) => (
                <tr key={p.id} className={`border-t border-border ${p.vigenteHasta ? "text-muted" : "font-medium"}`}>
                  <td className="py-1 pr-3 whitespace-nowrap">{fmtFechaHora(p.vigenteDesde)}</td>
                  <td className="py-1 pr-3 whitespace-nowrap">{p.vigenteHasta ? fmtFechaHora(p.vigenteHasta) : "vigente"}</td>
                  <td className="py-1 pr-3">{p.presentacion?.nombre ?? "—"}</td>
                  <td className="py-1 pr-3 text-right font-mono">{fmtSoles(p.precioPresentacion)}</td>
                  <td className="py-1 pr-3 text-right font-mono">{fmtSoles(p.costoUnitarioBase, true)}</td>
                  <td className="py-1 pr-3">{ORIGEN[p.origen] ?? p.origen}</td>
                  <td className="py-1 pr-3">{p.usuario?.nombre ?? "—"}</td>
                  <td className="py-1 text-xs">{p.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {puedeEditar && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Editar datos del insumo</summary>
          <div className="mt-3">
            <FormularioInsumo tipo={insumo.tipo === "EMPAQUE" ? "EMPAQUE" : "INGREDIENTE"} valores={{ id, nombre: insumo.nombre, categoriaId: insumo.categoriaId, unidadBaseId: insumo.unidadBaseId, stockMinimo: insumo.stockMinimo?.toString(), observaciones: insumo.observaciones, esCostoCompartido: insumo.esCostoCompartido }} />
          </div>
        </details>
      )}
    </div>
  );
}
