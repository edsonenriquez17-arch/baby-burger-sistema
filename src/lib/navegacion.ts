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
  { href: "/pedidos", etiqueta: "Pedidos", icono: "🧾", permiso: "pedidos.ver", enMovil: true },
  { href: "/cocina", etiqueta: "Cocina", icono: "🔥", permiso: "cocina.ver" },
  { href: "/caja", etiqueta: "Caja", icono: "💵", permiso: "caja.ver", enMovil: true },
  { href: "/insumos", etiqueta: "Ingredientes", icono: "🥩", permiso: "insumos.ver" },
  { href: "/recetas", etiqueta: "Recetas y costos", icono: "📋", permiso: "recetas.ver" },
  { href: "/preparaciones", etiqueta: "Preparaciones", icono: "🥣", permiso: "recetas.ver" },
  { href: "/productos", etiqueta: "Carta", icono: "🍔", permiso: "productos.ver" },
  { href: "/empaques", etiqueta: "Empaques y servicio", icono: "📦", permiso: "empaques.ver" },
  { href: "/inventario", etiqueta: "Inventario", icono: "📊", permiso: "inventario.ver" },
  { href: "/compras", etiqueta: "Compras", icono: "🛒", permiso: "compras.ver" },
  { href: "/gastos", etiqueta: "Gastos", icono: "🧮", permiso: "gastos.ver" },
  { href: "/perdidas", etiqueta: "Mermas y cortesías", icono: "⚠️", permiso: "inventario.mermas" },
  { href: "/retiros", etiqueta: "Retiros", icono: "🏧", permiso: "caja.retiros" },
  { href: "/reportes", etiqueta: "Reportes", icono: "📈", permiso: "reportes.ver" },
  { href: "/configuracion", etiqueta: "Configuración", icono: "⚙️", permiso: "configuracion.ver", enMovil: true },
];
