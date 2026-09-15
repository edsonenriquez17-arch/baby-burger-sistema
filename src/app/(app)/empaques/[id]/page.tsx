import { requerirPermiso } from "@/lib/auth/session";
import { DetalleInsumo } from "../../insumos/detalle-insumo";

export default async function EmpaquePage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("empaques.ver");
  const { id } = await params;
  return <DetalleInsumo id={id} rutaBase="/empaques" usuario={usuario} />;
}
