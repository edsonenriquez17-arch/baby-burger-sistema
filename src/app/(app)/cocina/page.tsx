import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { TableroCocina } from "./tablero";

export const metadata: Metadata = { title: "Cocina" };

export default async function CocinaPage() {
  const usuario = await requerirPermiso("cocina.ver");
  const pedidos = await db.pedido.findMany({
    where: { estado: { in: ["EN_PREPARACION", "LISTO", "ESPERANDO_PAGO"] } },
    include: { mesa: true, items: { orderBy: { creadoEn: "asc" }, include: { extras: true } } },
    orderBy: { fecha: "asc" },
  });
  return (
    <TableroCocina
      puedeActualizar={usuario.permisos.has("cocina.actualizar")}
      pedidos={pedidos.map((p) => ({
        id: p.id, numero: p.numero, estado: p.estado, canal: p.mesa?.nombre ?? (p.tipoServicio === "LLEVAR" ? "Para llevar" : p.tipoServicio === "DELIVERY" ? "Delivery" : p.tipoServicio),
        cliente: p.clienteNombre, observaciones: p.observaciones, creadoEn: p.fecha.toISOString(),
        items: p.items.map((i) => ({ id: i.id, nombre: i.nombreProducto, cantidad: i.cantidad, observacion: i.observacion, estado: i.estadoPreparacion, extras: i.extras.map((e) => `${e.nombre}${e.cantidad > 1 ? ` ×${e.cantidad}` : ""}`) })),
      }))}
    />
  );
}
