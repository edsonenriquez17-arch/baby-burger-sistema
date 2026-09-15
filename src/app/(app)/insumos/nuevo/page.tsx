import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/session";
import { FormularioInsumo } from "../formulario-insumo";

export const metadata: Metadata = { title: "Nuevo ingrediente" };

export default async function NuevoInsumoPage() {
  await requerirPermiso("insumos.editar");
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Nuevo ingrediente</h1>
      <div className="card">
        <FormularioInsumo tipo="INGREDIENTE" />
      </div>
    </div>
  );
}
