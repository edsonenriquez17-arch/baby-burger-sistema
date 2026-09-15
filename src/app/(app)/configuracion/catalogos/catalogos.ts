/** Catálogos simples: nombre + activo + un campo extra opcional. */
export const CATALOGOS = {
  categoriaInsumo: { titulo: "Categorías de insumos", extra: { campo: "tipo", etiqueta: "Tipo", tipo: "select", opciones: ["INGREDIENTE", "PREPARACION", "EMPAQUE"] }, activo: "activa" },
  categoriaProducto: { titulo: "Categorías de la carta", extra: { campo: "color", etiqueta: "Color (botón POS)", tipo: "color" }, activo: "activa" },
  categoriaGasto: { titulo: "Categorías de gasto", extra: { campo: "esFijo", etiqueta: "Es gasto fijo", tipo: "checkbox" }, activo: "activa" },
  marca: { titulo: "Marcas", extra: null, activo: "activa" },
  proveedor: { titulo: "Proveedores", extra: { campo: "telefono", etiqueta: "Teléfono", tipo: "text" }, activo: "activo" },
  motivoMerma: { titulo: "Motivos de merma", extra: null, activo: "activo" },
  motivoCortesia: { titulo: "Motivos de cortesía", extra: null, activo: "activo" },
  metodoPago: { titulo: "Métodos de pago", extra: { campo: "esEfectivo", etiqueta: "Cuenta como efectivo en caja", tipo: "checkbox" }, activo: "activo" },
  mesa: { titulo: "Mesas y barra", extra: { campo: "tipo", etiqueta: "Tipo", tipo: "select", opciones: ["MESA", "BARRA"] }, activo: "activa" },
} as const;

export type ClaveCatalogo = keyof typeof CATALOGOS;
