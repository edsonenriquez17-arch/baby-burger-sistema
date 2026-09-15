"use server";

import { Prisma, type TipoServicio } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { D } from "@/lib/costeo/costeo";
import { ESTADOS_ABIERTOS, congelarCostosYDescontar, recalcularTotales, revertirConsumo } from "@/lib/pos/venta";
import type { Resultado } from "@/components/form-accion";

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const CANALES: TipoServicio[] = ["MESA", "BARRA", "LLEVAR", "DELIVERY"];

function revalidar(pedidoId?: string) {
  revalidatePath("/pedidos");
  revalidatePath("/cocina");
  revalidatePath("/caja");
  if (pedidoId) revalidatePath(`/pedidos/${pedidoId}`);
}

async function pedidoEditable(pedidoId: string) {
  const p = await db.pedido.findUnique({ where: { id: pedidoId } });
  if (!p) return { error: "Pedido no encontrado" } as const;
  if (p.estado === "PAGADO" || p.estado === "ANULADO") return { error: "El pedido ya está cerrado" } as const;
  return { pedido: p } as const;
}

// ---------------------------------------------------------------------
// Crear / datos del pedido
// ---------------------------------------------------------------------

export async function crearPedido(_p: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirPermiso("pedidos.crear");
  const tipoServicio = texto(fd.get("tipoServicio")) as TipoServicio;
  const mesaId = texto(fd.get("mesaId")) || null;
  if (!CANALES.includes(tipoServicio)) return { error: "Canal inválido" };

  if (mesaId) {
    const abierto = await db.pedido.findFirst({ where: { mesaId, estado: { in: [...ESTADOS_ABIERTOS] } } });
    if (abierto) redirect(`/pedidos/${abierto.id}`);
  }

  const pedido = await db.pedido.create({ data: { tipoServicio, mesaId, usuarioId: u.id } });
  await registrarAuditoria({ usuarioId: u.id, accion: "CREAR", entidad: "Pedido", entidadId: pedido.id, descripcion: `Pedido #${pedido.numero} (${tipoServicio})` });
  revalidar();
  redirect(`/pedidos/${pedido.id}`);
}

export async function actualizarPedido(pedidoId: string, datos: { clienteNombre?: string; clienteTelefono?: string; observaciones?: string; descuentoMonto?: string; descuentoMotivo?: string; tipoServicio?: TipoServicio; mesaId?: string | null }): Promise<Resultado> {
  const u = await requerirPermiso("pedidos.editar");
  const r = await pedidoEditable(pedidoId);
  if ("error" in r) return { error: r.error };

  const data: Prisma.PedidoUpdateInput = {};
  if (datos.clienteNombre !== undefined) data.clienteNombre = datos.clienteNombre.trim() || null;
  if (datos.clienteTelefono !== undefined) data.clienteTelefono = datos.clienteTelefono.trim() || null;
  if (datos.observaciones !== undefined) data.observaciones = datos.observaciones.trim() || null;
  if (datos.tipoServicio !== undefined) {
    if (!CANALES.includes(datos.tipoServicio)) return { error: "Canal inválido" };
    data.tipoServicio = datos.tipoServicio;
    data.mesa = datos.mesaId ? { connect: { id: datos.mesaId } } : { disconnect: true };
  }
  if (datos.descuentoMonto !== undefined) {
    if (!u.permisos.has("pedidos.descuento")) return { error: "No tienes permiso para aplicar descuentos" };
    const n = Number(datos.descuentoMonto || 0);
    if (!Number.isFinite(n) || n < 0) return { error: "Descuento inválido" };
    data.descuentoMonto = new D(datos.descuentoMonto || 0);
    data.descuentoMotivo = datos.descuentoMotivo?.trim() || null;
  }

  await db.$transaction(async (tx) => {
    await tx.pedido.update({ where: { id: pedidoId }, data });
    await recalcularTotales(tx, pedidoId);
    if (datos.descuentoMonto !== undefined) {
      await registrarAuditoria({ usuarioId: u.id, accion: "EDITAR", entidad: "Pedido", entidadId: pedidoId, descripcion: `Descuento pedido #${r.pedido.numero}`, valorAnterior: { descuento: r.pedido.descuentoMonto }, valorNuevo: { descuento: datos.descuentoMonto, motivo: datos.descuentoMotivo } }, tx);
    }
  });
  revalidar(pedidoId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Ítems
// ---------------------------------------------------------------------

export async function agregarItem(pedidoId: string, productoId: string): Promise<Resultado> {
  await requerirPermiso("pedidos.editar");
  const r = await pedidoEditable(pedidoId);
  if ("error" in r) return { error: r.error };
  const producto = await db.producto.findUnique({ where: { id: productoId } });
  if (!producto || !producto.activo) return { error: "Producto no disponible" };

  await db.$transaction(async (tx) => {
    const igual = await tx.pedidoItem.findFirst({ where: { pedidoId, productoId, observacion: null, extras: { none: {} } } });
    if (igual) await tx.pedidoItem.update({ where: { id: igual.id }, data: { cantidad: { increment: 1 } } });
    else await tx.pedidoItem.create({ data: { pedidoId, productoId, nombreProducto: producto.nombre, cantidad: 1, precioUnitario: producto.precioVenta } });
    await recalcularTotales(tx, pedidoId);
  });
  revalidar(pedidoId);
  return { ok: true };
}

export async function cambiarCantidadItem(itemId: string, delta: number): Promise<Resultado> {
  await requerirPermiso("pedidos.editar");
  const item = await db.pedidoItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Ítem no encontrado" };
  const r = await pedidoEditable(item.pedidoId);
  if ("error" in r) return { error: r.error };
  const nueva = item.cantidad + delta;
  await db.$transaction(async (tx) => {
    if (nueva <= 0) await tx.pedidoItem.delete({ where: { id: itemId } });
    else await tx.pedidoItem.update({ where: { id: itemId }, data: { cantidad: nueva } });
    await recalcularTotales(tx, item.pedidoId);
  });
  revalidar(item.pedidoId);
  return { ok: true };
}

export async function editarObservacionItem(itemId: string, observacion: string): Promise<Resultado> {
  await requerirPermiso("pedidos.editar");
  const item = await db.pedidoItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Ítem no encontrado" };
  const r = await pedidoEditable(item.pedidoId);
  if ("error" in r) return { error: r.error };
  await db.pedidoItem.update({ where: { id: itemId }, data: { observacion: observacion.trim() || null } });
  revalidar(item.pedidoId);
  return { ok: true };
}

export async function agregarExtra(itemId: string, productoExtraId: string): Promise<Resultado> {
  await requerirPermiso("pedidos.editar");
  const item = await db.pedidoItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Ítem no encontrado" };
  const r = await pedidoEditable(item.pedidoId);
  if ("error" in r) return { error: r.error };
  const extra = await db.producto.findUnique({ where: { id: productoExtraId } });
  if (!extra || !extra.esExtra || !extra.activo) return { error: "Extra no disponible" };
  await db.$transaction(async (tx) => {
    const existente = await tx.pedidoItemExtra.findFirst({ where: { pedidoItemId: itemId, productoId: productoExtraId } });
    if (existente) await tx.pedidoItemExtra.update({ where: { id: existente.id }, data: { cantidad: { increment: 1 } } });
    else await tx.pedidoItemExtra.create({ data: { pedidoItemId: itemId, productoId: productoExtraId, nombre: extra.nombre, cantidad: 1, precioUnitario: extra.precioVenta } });
    await recalcularTotales(tx, item.pedidoId);
  });
  revalidar(item.pedidoId);
  return { ok: true };
}

export async function quitarExtra(extraId: string): Promise<Resultado> {
  await requerirPermiso("pedidos.editar");
  const extra = await db.pedidoItemExtra.findUnique({ where: { id: extraId }, include: { pedidoItem: true } });
  if (!extra) return { error: "Extra no encontrado" };
  const r = await pedidoEditable(extra.pedidoItem.pedidoId);
  if ("error" in r) return { error: r.error };
  await db.$transaction(async (tx) => {
    if (extra.cantidad > 1) await tx.pedidoItemExtra.update({ where: { id: extraId }, data: { cantidad: { decrement: 1 } } });
    else await tx.pedidoItemExtra.delete({ where: { id: extraId } });
    await recalcularTotales(tx, extra.pedidoItem.pedidoId);
  });
  revalidar(extra.pedidoItem.pedidoId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Estados, cobro y anulación
// ---------------------------------------------------------------------

export async function cambiarEstadoPedido(pedidoId: string, estado: "ABIERTO" | "EN_PREPARACION" | "LISTO" | "ESPERANDO_PAGO"): Promise<Resultado> {
  const u = await requerirPermiso(estado === "LISTO" || estado === "EN_PREPARACION" ? "cocina.actualizar" : "pedidos.editar");
  const r = await pedidoEditable(pedidoId);
  if ("error" in r) return { error: r.error };
  const itemsCount = await db.pedidoItem.count({ where: { pedidoId } });
  if (itemsCount === 0 && estado !== "ABIERTO") return { error: "El pedido no tiene productos" };
  await db.$transaction(async (tx) => {
    await tx.pedido.update({ where: { id: pedidoId }, data: { estado } });
    if (estado === "LISTO") await tx.pedidoItem.updateMany({ where: { pedidoId, estadoPreparacion: { in: ["PENDIENTE", "EN_PREPARACION"] } }, data: { estadoPreparacion: "LISTO" } });
    if (estado === "EN_PREPARACION") await tx.pedidoItem.updateMany({ where: { pedidoId, estadoPreparacion: "PENDIENTE" }, data: { estadoPreparacion: "EN_PREPARACION" } });
    await registrarAuditoria({ usuarioId: u.id, accion: "EDITAR", entidad: "Pedido", entidadId: pedidoId, descripcion: `Pedido #${r.pedido.numero}: ${r.pedido.estado} → ${estado}` }, tx);
  });
  revalidar(pedidoId);
  return { ok: true };
}

export async function cambiarEstadoItem(itemId: string, estado: "PENDIENTE" | "EN_PREPARACION" | "LISTO" | "ENTREGADO"): Promise<Resultado> {
  await requerirPermiso("cocina.actualizar");
  const item = await db.pedidoItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Ítem no encontrado" };
  await db.pedidoItem.update({ where: { id: itemId }, data: { estadoPreparacion: estado } });
  revalidar(item.pedidoId);
  return { ok: true };
}

export type PagoEntrada = { metodoPagoId: string; monto: string; referencia?: string };

export async function cobrarPedido(pedidoId: string, pagos: PagoEntrada[]): Promise<Resultado> {
  const u = await requerirPermiso("pedidos.cobrar");
  const r = await pedidoEditable(pedidoId);
  if ("error" in r) return { error: r.error };
  const itemsCount = await db.pedidoItem.count({ where: { pedidoId } });
  if (itemsCount === 0) return { error: "El pedido no tiene productos" };

  const lineas = pagos.filter((p) => p.metodoPagoId && Number(p.monto) > 0).map((p) => ({ ...p, monto: new D(p.monto) }));
  if (lineas.length === 0) return { error: "Ingresa al menos un pago" };
  const suma = lineas.reduce((a, p) => a.add(p.monto), new D(0));

  try {
    await db.$transaction(async (tx) => {
      const { total } = await recalcularTotales(tx, pedidoId);
      if (!suma.sub(total).abs().lt(new D("0.01"))) throw new Error(`Los pagos suman S/ ${suma.toFixed(2)} y el total es S/ ${total.toFixed(2)}`);
      const metodos = await tx.metodoPago.findMany({ where: { id: { in: lineas.map((l) => l.metodoPagoId) }, activo: true } });
      if (metodos.length !== new Set(lineas.map((l) => l.metodoPagoId)).size) throw new Error("Método de pago inválido");

      for (const l of lineas) await tx.pago.create({ data: { pedidoId, metodoPagoId: l.metodoPagoId, monto: l.monto, referencia: l.referencia?.trim() || null } });
      const costo = await congelarCostosYDescontar(tx, pedidoId, u.id);
      const caja = await tx.cierreCaja.findFirst({ where: { estado: "ABIERTA" }, orderBy: { fechaApertura: "desc" } });
      await tx.pedido.update({ where: { id: pedidoId }, data: { estado: "PAGADO", pagadoEn: new Date(), cierreCajaId: caja?.id ?? null } });
      await tx.pedidoItem.updateMany({ where: { pedidoId }, data: { estadoPreparacion: "ENTREGADO" } });
      await registrarAuditoria({ usuarioId: u.id, accion: "EDITAR", entidad: "Pedido", entidadId: pedidoId, descripcion: `Pedido #${r.pedido.numero} cobrado`, valorNuevo: { total: total.toString(), costo: costo.toString(), pagos: lineas.map((l) => ({ metodo: metodos.find((m) => m.id === l.metodoPagoId)?.nombre, monto: l.monto.toString() })) } }, tx);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cobrar" };
  }
  revalidar(pedidoId);
  return { ok: true };
}

export async function anularPedido(pedidoId: string, motivo: string): Promise<Resultado> {
  const u = await requerirPermiso("pedidos.anular");
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) return { error: "Pedido no encontrado" };
  if (pedido.estado === "ANULADO") return { error: "Ya está anulado" };
  if (!motivo.trim()) return { error: "Indica el motivo de la anulación" };

  await db.$transaction(async (tx) => {
    if (pedido.estado === "PAGADO") await revertirConsumo(tx, pedidoId, u.id, pedido.numero);
    await tx.pedido.update({ where: { id: pedidoId }, data: { estado: "ANULADO", motivoAnulacion: motivo.trim(), anuladoEn: new Date(), anuladoPorId: u.id } });
    await registrarAuditoria({ usuarioId: u.id, accion: "ANULAR", entidad: "Pedido", entidadId: pedidoId, descripcion: `Pedido #${pedido.numero} anulado: ${motivo.trim()}`, valorAnterior: { estado: pedido.estado, total: pedido.total } }, tx);
  });
  revalidar(pedidoId);
  return { ok: true };
}
