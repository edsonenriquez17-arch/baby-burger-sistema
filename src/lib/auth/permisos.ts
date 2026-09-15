import type { Rol } from "@prisma/client";

/**
 * Catálogo de permisos del sistema. Se carga a la tabla Permiso en el seed.
 * Los permisos por rol (RolPermiso) y las excepciones por usuario (UsuarioPermiso)
 * son editables desde Configuración > Usuarios; esto es solo el punto de partida.
 */
export const PERMISOS = [
  // POS
  { clave: "pedidos.ver", modulo: "Pedidos", descripcion: "Ver pedidos" },
  { clave: "pedidos.crear", modulo: "Pedidos", descripcion: "Crear pedidos" },
  { clave: "pedidos.editar", modulo: "Pedidos", descripcion: "Editar pedidos abiertos" },
  { clave: "pedidos.cobrar", modulo: "Pedidos", descripcion: "Cobrar y cerrar pedidos" },
  { clave: "pedidos.descuento", modulo: "Pedidos", descripcion: "Aplicar descuentos" },
  { clave: "pedidos.anular", modulo: "Pedidos", descripcion: "Anular pedidos" },
  // Cocina
  { clave: "cocina.ver", modulo: "Cocina", descripcion: "Ver pantalla de cocina" },
  { clave: "cocina.actualizar", modulo: "Cocina", descripcion: "Cambiar estado de preparación" },
  // Caja
  { clave: "caja.ver", modulo: "Caja", descripcion: "Ver estado de caja" },
  { clave: "caja.cerrar", modulo: "Caja", descripcion: "Abrir y cerrar caja" },
  { clave: "caja.retiros", modulo: "Caja", descripcion: "Registrar retiros de caja" },
  // Insumos y costeo
  { clave: "insumos.ver", modulo: "Insumos", descripcion: "Ver ingredientes y costos" },
  { clave: "insumos.editar", modulo: "Insumos", descripcion: "Crear y editar ingredientes" },
  { clave: "insumos.precios", modulo: "Insumos", descripcion: "Registrar precios de insumos" },
  { clave: "recetas.ver", modulo: "Recetas", descripcion: "Ver recetas y fichas técnicas" },
  { clave: "recetas.editar", modulo: "Recetas", descripcion: "Editar recetas y preparaciones" },
  { clave: "productos.ver", modulo: "Productos", descripcion: "Ver carta de productos" },
  { clave: "productos.editar", modulo: "Productos", descripcion: "Crear y editar productos" },
  { clave: "productos.precios", modulo: "Productos", descripcion: "Cambiar precios de venta" },
  { clave: "empaques.ver", modulo: "Empaques", descripcion: "Ver empaques y descartables" },
  { clave: "empaques.editar", modulo: "Empaques", descripcion: "Editar empaques y reglas por canal" },
  // Inventario
  { clave: "inventario.ver", modulo: "Inventario", descripcion: "Ver stock y movimientos" },
  { clave: "inventario.ajustar", modulo: "Inventario", descripcion: "Hacer ajustes de inventario" },
  { clave: "inventario.mermas", modulo: "Inventario", descripcion: "Registrar mermas" },
  // Dinero
  { clave: "compras.ver", modulo: "Compras", descripcion: "Ver compras" },
  { clave: "compras.registrar", modulo: "Compras", descripcion: "Registrar compras" },
  { clave: "gastos.ver", modulo: "Gastos", descripcion: "Ver gastos" },
  { clave: "gastos.registrar", modulo: "Gastos", descripcion: "Registrar gastos" },
  { clave: "cortesias.registrar", modulo: "Cortesías", descripcion: "Registrar cortesías" },
  { clave: "incidencias.registrar", modulo: "Incidencias", descripcion: "Registrar devoluciones / rehechos" },
  // Reportes
  { clave: "reportes.ver", modulo: "Reportes", descripcion: "Ver reportes de ventas" },
  { clave: "reportes.financieros", modulo: "Reportes", descripcion: "Ver utilidad, márgenes y análisis financiero" },
  // Configuración
  { clave: "configuracion.ver", modulo: "Configuración", descripcion: "Ver configuración" },
  { clave: "configuracion.editar", modulo: "Configuración", descripcion: "Editar configuración general y catálogos" },
  { clave: "usuarios.administrar", modulo: "Configuración", descripcion: "Crear usuarios y asignar permisos" },
  { clave: "auditoria.ver", modulo: "Configuración", descripcion: "Ver registro de auditoría" },
] as const;

export type ClavePermiso = (typeof PERMISOS)[number]["clave"];

/** Permisos iniciales por rol. Editables luego desde el sistema. */
export const PERMISOS_POR_ROL: Record<Rol, readonly ClavePermiso[]> = {
  ADMIN: PERMISOS.map((p) => p.clave),
  CAJA: [
    "pedidos.ver",
    "pedidos.crear",
    "pedidos.editar",
    "pedidos.cobrar",
    "pedidos.descuento",
    "pedidos.anular",
    "cocina.ver",
    "cocina.actualizar",
    "caja.ver",
    "caja.cerrar",
    "productos.ver",
    "inventario.ver",
    "inventario.mermas",
    "compras.registrar",
    "gastos.registrar",
    "cortesias.registrar",
    "incidencias.registrar",
  ],
  COCINA: [
    "cocina.ver",
    "cocina.actualizar",
    "pedidos.ver",
    "recetas.ver",
    "inventario.ver",
    "inventario.mermas",
  ],
};

export const ROLES: { valor: Rol; etiqueta: string; descripcion: string }[] = [
  { valor: "ADMIN", etiqueta: "Administrador", descripcion: "Acceso completo" },
  { valor: "CAJA", etiqueta: "Caja", descripcion: "Pedidos, cobros y cierre de caja" },
  { valor: "COCINA", etiqueta: "Cocina", descripcion: "Ver pedidos y actualizar preparación" },
];
