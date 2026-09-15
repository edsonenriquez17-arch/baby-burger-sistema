import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { FormularioCompra, type InsumoCompra } from "./formulario-compra";

export const metadata: Metadata = { title: "Nueva compra" };

export default async function NuevaCompraPage() {
  await requerirPermiso("compras.registrar");
  const [insumos, metodos, proveedores] = await Promise.all([
    db.insumo.findMany({
      where: { activo: true, tipo: { in: ["INGREDIENTE", "EMPAQUE"] } },
      include: { unidadBase: true, presentaciones: { where: { activa: true }, include: { unidadContenido: true, marca: true, precios: { where: { vigenteHasta: null }, take: 1 } } } },
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
    }),
    db.metodoPago.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    db.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  const lista: InsumoCompra[] = insumos.map((i) => ({
    id: i.id, nombre: i.nombre, tipo: i.tipo, unidadBase: i.unidadBase.codigo,
    presentaciones: i.presentaciones.map((p) => ({ id: p.id, nombre: `${p.marca ? p.marca.nombre + " · " : ""}${p.nombre}`, contenido: p.contenido?.toString() ?? null, unidad: p.unidadContenido.codigo, ultimoPrecio: p.precios[0]?.precioPresentacion?.toString() ?? null, predeterminada: p.esPredeterminada })),
  }));
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link href="/compras" className="text-sm text-muted hover:underline">← compras</Link>
        <h1 className="text-2xl font-bold">Nueva compra</h1>
      </div>
      <FormularioCompra insumos={lista} metodos={metodos.map((m) => ({ id: m.id, nombre: m.nombre, esEfectivo: m.esEfectivo }))} proveedores={proveedores.map((p) => p.nombre)} hoy={hoy} />
    </div>
  );
}
