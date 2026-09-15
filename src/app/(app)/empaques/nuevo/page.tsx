import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/session";
import { FormularioInsumo } from "../../insumos/formulario-insumo";

export const metadata: Metadata = { title: "Nuevo empaque" };

export default async function NuevoEmpaquePage() {
  await requerirPermiso("empaques.editar");
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Nuevo empaque o descartable</h1>
      <div className="card"><FormularioInsumo tipo="EMPAQUE" /></div>
    </div>
  );
}
