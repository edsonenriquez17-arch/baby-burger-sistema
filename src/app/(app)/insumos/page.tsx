import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/session";
import { BarraInsumos, ListaInsumos } from "./lista-insumos";

export const metadata: Metadata = { title: "Ingredientes" };

export default async function InsumosPage({ searchParams }: { searchParams: Promise<{ q?: string; inactivos?: string }> }) {
  await requerirPermiso("insumos.ver");
  const { q, inactivos } = await searchParams;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Ingredientes</h1>
        <p className="text-sm text-muted">Costo por gramo / ml / unidad calculado desde la presentación predeterminada (★) y su último precio.</p>
      </div>
      <BarraInsumos rutaBase="/insumos" buscar={q} mostrarInactivos={inactivos === "1"} textoNuevo="+ Nuevo ingrediente" />
      <ListaInsumos tipo="INGREDIENTE" rutaBase="/insumos" buscar={q} mostrarInactivos={inactivos === "1"} />
    </div>
  );
}
