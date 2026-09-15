import { requerirPermiso } from "@/lib/auth/session";
import { DetalleInsumo } from "../detalle-insumo";

export default async function InsumoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("insumos.ver");
  const { id } = await params;
  return <DetalleInsumo id={id} rutaBase="/insumos" usuario={usuario} />;
}
