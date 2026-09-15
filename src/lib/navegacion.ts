import type { ClavePermiso } from "@/lib/auth/permisos";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: string; // emoji simple; se reemplaza por iconos de marca en Fase 8
  permiso?: ClavePermiso;
  /** Fase en la que se habilita. Sin valor = disponible ahora. */
  fase?: number;
  enMovil?: boolean; // aparece en la barra inferior del celular
};

export const NAVEGACION: ItemNav[] = [
  { href: "/", etiqueta: "Inicio", icono: "🏠", enMovil: true },
  { href: "/pedidos", etiqueta: "Pedidos", icono: "🧾", permiso: "pedidos.ver", fase: 4, enMovil: true },
  { href: "/cocina", etiqueta: "Cocina", icono: "🔥", permiso: "cocina.ver", fase: 4 },
  { href: "/caja", etiqueta: "Caja", icono: "💵", permiso: "caja.ver", fase: 4, enMovil: true },
  { href: "/insumos", etiqueta: "Ingredientes", icono: "🥩", permiso: "insumos.ver", fase: 2 },
  { href: "/recetas", etiqueta: "Recetas", icono: "📋", permiso: "recetas.ver", fase: 2 },
  { href: "/productos", etiqueta: "Carta", icono: "🍔", permiso: "productos.ver", fase: 2 },
  { href: "/empaques", etiqueta: "Empaques y servicio", icono: "📦", permiso: "empaques.ver", fase: 3 },
  { href: "/inventario", etiqueta: "Inventario", icono: "📊", permiso: "inventario.ver", fase: 5 },
  { href: "/compras", etiqueta: "Compras", icono: "🛒", permiso: "compras.ver", fase: 6 },
  { href: "/gastos", etiqueta: "Gastos", icono: "🧮", permiso: "gastos.ver", fase: 6 },
  { href: "/perdidas", etiqueta: "Mermas y cortesías", icono: "⚠️", permiso: "inventario.mermas", fase: 6 },
  { href: "/retiros", etiqueta: "Retiros", icono: "🏧", permiso: "caja.retiros", fase: 6 },
  { href: "/reportes", etiqueta: "Reportes", icono: "📈", permiso: "reportes.ver", fase: 7 },
  { href: "/configuracion", etiqueta: "Configuración", icono: "⚙️", permiso: "configuracion.ver", enMovil: true },
];
