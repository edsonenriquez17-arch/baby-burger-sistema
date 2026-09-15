import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { PantallaPedido, type ItemPOS, type PedidoPOS, type ProductoPOS } from "./pantalla-pedido";

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("pedidos.ver");
  const { id } = await params;
  const pedido = await db.pedido.findUnique({
    where: { id },
    include: {
      mesa: true,
      items: { orderBy: { creadoEn: "asc" }, include: { extras: true } },
      pagos: { include: { metodoPago: true } },
    },
  });
  if (!pedido) notFound();

  const [productos, metodos, mesas] = await Promise.all([
    db.producto.findMany({ where: { activo: true }, include: { categoria: true }, orderBy: [{ categoria: { orden: "asc" } }, { orden: "asc" }, { nombre: "asc" }] }),
    db.metodoPago.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    db.mesa.findMany({ where: { activa: true }, orderBy: [{ tipo: "asc" }, { orden: "asc" }] }),
  ]);

  const p: PedidoPOS = {
    id: pedido.id, numero: pedido.numero, estado: pedido.estado, tipoServicio: pedido.tipoServicio, mesaNombre: pedido.mesa?.nombre ?? null, mesaId: pedido.mesaId,
    clienteNombre: pedido.clienteNombre, clienteTelefono: pedido.clienteTelefono, observaciones: pedido.observaciones,
    subtotal: pedido.subtotal.toNumber(), descuento: pedido.descuentoMonto.toNumber(), descuentoMotivo: pedido.descuentoMotivo, total: pedido.total.toNumber(), costoTotal: pedido.costoTotal.toNumber(),
    pagos: pedido.pagos.map((x) => ({ metodo: x.metodoPago.nombre, monto: x.monto.toNumber() })), motivoAnulacion: pedido.motivoAnulacion,
  };
  const items: ItemPOS[] = pedido.items.map((i) => ({
    id: i.id, nombre: i.nombreProducto, cantidad: i.cantidad, precio: i.precioUnitario.toNumber(), observacion: i.observacion, estado: i.estadoPreparacion,
    extras: i.extras.map((e) => ({ id: e.id, nombre: e.nombre, cantidad: e.cantidad, precio: e.precioUnitario.toNumber() })),
  }));
  const prods: ProductoPOS[] = productos.map((x) => ({ id: x.id, nombre: x.nombre, precio: x.precioVenta.toNumber(), categoria: x.categoria.nombre, color: x.categoria.color, disponible: x.disponible, esExtra: x.esExtra }));

  return (
    <PantallaPedido
      pedido={p}
      items={items}
      productos={prods}
      metodos={metodos.map((m) => ({ id: m.id, nombre: m.nombre, esEfectivo: m.esEfectivo }))}
      mesas={mesas.map((m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo }))}
      permisos={{
        editar: usuario.permisos.has("pedidos.editar"),
        cobrar: usuario.permisos.has("pedidos.cobrar"),
        anular: usuario.permisos.has("pedidos.anular"),
        descuento: usuario.permisos.has("pedidos.descuento"),
        verCosto: usuario.permisos.has("reportes.financieros"),
      }}
    />
  );
}
