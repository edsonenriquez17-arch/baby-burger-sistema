import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { BotonEnForm, FormAccion } from "@/components/form-accion";
import { CATALOGOS, type ClaveCatalogo } from "./catalogos";
import { alternarEnCatalogo, crearEnCatalogo, editarEnCatalogo } from "./actions";

export const metadata: Metadata = { title: "Catálogos" };

type Fila = { id: string; nombre: string; [k: string]: unknown };

export default async function CatalogosPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await requerirPermiso("configuracion.editar");
  const { t } = await searchParams;
  const clave: ClaveCatalogo = t && t in CATALOGOS ? (t as ClaveCatalogo) : "categoriaInsumo";
  const def = CATALOGOS[clave];
  const filas = (await (db[clave] as unknown as { findMany(a: { orderBy: { nombre: "asc" } }): Promise<Fila[]> }).findMany({ orderBy: { nombre: "asc" } }));

  const campoExtra = (valor?: unknown) => {
    if (!def.extra) return null;
    const e = def.extra;
    if (e.tipo === "checkbox") return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={e.campo} className="size-5 accent-brand" defaultChecked={Boolean(valor)} /> {e.etiqueta}</label>;
    if (e.tipo === "select") return <select name={e.campo} className="input w-44 py-1.5 text-sm" defaultValue={String(valor ?? e.opciones[0])} aria-label={e.etiqueta}>{e.opciones.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
    if (e.tipo === "color") return <input type="color" name={e.campo} defaultValue={String(valor ?? "#1f3fd8")} className="h-10 w-14 rounded-lg border border-border" aria-label={e.etiqueta} />;
    return <input name={e.campo} defaultValue={String(valor ?? "")} placeholder={e.etiqueta} className="input w-44 py-1.5 text-sm" />;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/configuracion" className="text-sm text-muted hover:underline">← configuración</Link>
        <h1 className="text-2xl font-bold">Catálogos</h1>
        <p className="text-sm text-muted">Nada se borra: los elementos se desactivan y dejan de aparecer en las listas.</p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {(Object.keys(CATALOGOS) as ClaveCatalogo[]).map((k) => (
          <Link key={k} href={`/configuracion/catalogos?t=${k}`} className={`badge px-3 py-1.5 ${k === clave ? "bg-brand text-brand-contrast" : "bg-surface text-foreground border border-border"}`}>
            {CATALOGOS[k].titulo}
          </Link>
        ))}
      </nav>

      <div className="card space-y-2">
        <h2 className="font-semibold">{def.titulo}</h2>
        {filas.map((f) => {
          const activo = Boolean(f[def.activo]);
          return (
            <FormAccion key={f.id} accion={editarEnCatalogo} sinBoton className={`flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 ${activo ? "" : "opacity-50"}`}>
              <input type="hidden" name="catalogo" value={clave} />
              <input type="hidden" name="id" value={f.id} />
              <input name="nombre" defaultValue={f.nombre} className="input w-56 py-1.5 text-sm" required />
              {campoExtra(def.extra ? f[def.extra.campo] : undefined)}
              <button className="btn btn-secondary min-h-9 px-3 text-xs">Guardar</button>
              <BotonEnForm accion={alternarEnCatalogo} className={activo ? "btn btn-danger min-h-9 px-3 text-xs" : "btn btn-primary min-h-9 px-3 text-xs"}>
                {activo ? "Desactivar" : "Activar"}
              </BotonEnForm>
            </FormAccion>
          );
        })}
        <FormAccion accion={crearEnCatalogo} sinBoton className="flex flex-wrap items-center gap-2 rounded-lg bg-background p-2">
          <input type="hidden" name="catalogo" value={clave} />
          <input name="nombre" placeholder="nuevo…" className="input w-56 py-1.5 text-sm" required />
          {campoExtra()}
          <button className="btn btn-primary min-h-9 px-3 text-xs">Agregar</button>
        </FormAccion>
      </div>
    </div>
  );
}
