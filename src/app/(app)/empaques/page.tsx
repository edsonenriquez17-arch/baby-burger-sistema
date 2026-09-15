import type { Metadata } from "next";
import Link from "next/link";
import { requerirPermiso } from "@/lib/auth/session";
import { BarraInsumos, ListaInsumos } from "../insumos/lista-insumos";

export const metadata: Metadata = { title: "Empaques y servicio" };

export default async function EmpaquesPage({ searchParams }: { searchParams: Promise<{ q?: string; inactivos?: string }> }) {
  await requerirPermiso("empaques.ver");
  const { q, inactivos } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Empaques y servicio</h1>
          <p className="text-sm text-muted">Cajas, tapers, envases de salsa, servilletas, tenedores, vasos Domo, stickers… Registra una compra (ej. 500 cajas = S/ X) y el costo por unidad se calcula solo.</p>
        </div>
        <Link href="/empaques/reglas" className="btn btn-secondary min-h-10 text-sm">Reglas por tipo de servicio →</Link>
      </div>
      <BarraInsumos rutaBase="/empaques" buscar={q} mostrarInactivos={inactivos === "1"} textoNuevo="+ Nuevo empaque" />
      <ListaInsumos tipo="EMPAQUE" rutaBase="/empaques" buscar={q} mostrarInactivos={inactivos === "1"} />
    </div>
  );
}
