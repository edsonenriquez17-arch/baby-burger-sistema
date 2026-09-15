/**
 * Seed inicial de BABY BURGER.
 *
 * REGLA 1: aquí solo van datos que el negocio entregó. Toda cantidad que no
 * se conoce queda en `null` (pendiente) para completarla desde el sistema.
 * Es idempotente: se puede correr varias veces sin duplicar (upsert por nombre).
 */
import { PrismaClient, type TipoInsumo, type TipoServicio, type AlcanceReglaEmpaque, type Rol } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISOS, PERMISOS_POR_ROL } from "../src/lib/auth/permisos";

const db = new PrismaClient();

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

async function unidad(codigo: string) {
  const u = await db.unidadMedida.findUnique({ where: { codigo } });
  if (!u) throw new Error(`Unidad ${codigo} no existe`);
  return u;
}

async function insumo(nombre: string) {
  const i = await db.insumo.findUnique({ where: { nombre } });
  if (!i) throw new Error(`Insumo "${nombre}" no existe`);
  return i;
}

async function unidadInsumo(insumoNombre: string, nombre: string) {
  const i = await insumo(insumoNombre);
  const u = await db.unidadInsumo.findUnique({ where: { insumoId_nombre: { insumoId: i.id, nombre } } });
  if (!u) throw new Error(`Unidad propia "${nombre}" de ${insumoNombre} no existe`);
  return u;
}

/** Ítem de receta/preparación. `cantidad: null` = pendiente. */
type Item = { insumo: string; cantidad: number | null; unidad?: string; unidadPropia?: string; notas?: string };

async function resolverItem(it: Item, orden: number) {
  const i = await insumo(it.insumo);
  const unidadMedidaId = it.unidadPropia ? null : (await unidad(it.unidad ?? (await unidadBaseCodigo(i.unidadBaseId)))).id;
  const unidadInsumoId = it.unidadPropia ? (await unidadInsumo(it.insumo, it.unidadPropia)).id : null;
  return { insumoId: i.id, cantidad: it.cantidad, unidadMedidaId, unidadInsumoId, notas: it.notas, orden };
}

async function unidadBaseCodigo(unidadId: string) {
  const u = await db.unidadMedida.findUniqueOrThrow({ where: { id: unidadId } });
  return u.codigo;
}

// ---------------------------------------------------------------------
// 1. Unidades de medida
// ---------------------------------------------------------------------

async function seedUnidades() {
  const unidades = [
    { codigo: "g", nombre: "Gramo", tipo: "MASA", factorABase: 1, esBase: true },
    { codigo: "kg", nombre: "Kilogramo", tipo: "MASA", factorABase: 1000, esBase: false },
    { codigo: "ml", nombre: "Mililitro", tipo: "VOLUMEN", factorABase: 1, esBase: true },
    { codigo: "L", nombre: "Litro", tipo: "VOLUMEN", factorABase: 1000, esBase: false },
    { codigo: "unidad", nombre: "Unidad", tipo: "UNIDAD", factorABase: 1, esBase: true },
  ] as const;
  for (const u of unidades) {
    await db.unidadMedida.upsert({ where: { codigo: u.codigo }, update: {}, create: u });
  }
}

// ---------------------------------------------------------------------
// 2. Catálogos
// ---------------------------------------------------------------------

async function seedCatalogos() {
  const categoriasInsumo: { nombre: string; tipo: TipoInsumo; orden: number }[] = [
    { nombre: "Carnes y proteínas", tipo: "INGREDIENTE", orden: 1 },
    { nombre: "Lácteos", tipo: "INGREDIENTE", orden: 2 },
    { nombre: "Panes", tipo: "INGREDIENTE", orden: 3 },
    { nombre: "Verduras y frutas", tipo: "INGREDIENTE", orden: 4 },
    { nombre: "Salsas y aderezos", tipo: "INGREDIENTE", orden: 5 },
    { nombre: "Especias y condimentos", tipo: "INGREDIENTE", orden: 6 },
    { nombre: "Aceites y otros", tipo: "INGREDIENTE", orden: 7 },
    { nombre: "Congelados", tipo: "INGREDIENTE", orden: 8 },
    { nombre: "Bebidas e insumos de bebida", tipo: "INGREDIENTE", orden: 9 },
    { nombre: "Preparaciones", tipo: "PREPARACION", orden: 10 },
    { nombre: "Envases para comida", tipo: "EMPAQUE", orden: 11 },
    { nombre: "Envases para salsas", tipo: "EMPAQUE", orden: 12 },
    { nombre: "Servicio y descartables", tipo: "EMPAQUE", orden: 13 },
    { nombre: "Insumos de bebida", tipo: "EMPAQUE", orden: 14 },
  ];
  for (const c of categoriasInsumo) {
    await db.categoriaInsumo.upsert({ where: { nombre: c.nombre }, update: {}, create: c });
  }

  const categoriasProducto = [
    { nombre: "Baby Boxes", orden: 1, color: "#1f3fd8" },
    { nombre: "Smash Burgers", orden: 2, color: "#142c9c" },
    { nombre: "Papas", orden: 3, color: "#b45309" },
    { nombre: "Alitas", orden: 4, color: "#b91c1c" },
    { nombre: "Bebidas", orden: 5, color: "#0e7490" },
    { nombre: "Extras", orden: 6, color: "#5d6280" },
  ];
  for (const c of categoriasProducto) {
    await db.categoriaProducto.upsert({ where: { nombre: c.nombre }, update: {}, create: c });
  }

  const categoriasGasto = [
    { nombre: "Alquiler", esFijo: true },
    { nombre: "Servicios (luz, agua, internet)", esFijo: true },
    { nombre: "Sueldos", esFijo: true },
    { nombre: "Gasolina / transporte", esFijo: false },
    { nombre: "Mantenimiento", esFijo: false },
    { nombre: "Reparaciones", esFijo: false },
    { nombre: "Publicidad", esFijo: false },
    { nombre: "Limpieza", esFijo: false },
    { nombre: "Compras administrativas", esFijo: false },
    { nombre: "Otros", esFijo: false },
  ];
  for (const c of categoriasGasto) {
    await db.categoriaGasto.upsert({ where: { nombre: c.nombre }, update: {}, create: c });
  }

  for (const nombre of ["Desperdicio", "Producto vencido", "Producto dañado", "Error de preparación", "Derrame", "Pedido devuelto", "Otro"]) {
    await db.motivoMerma.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  for (const nombre of ["Cortesía a cliente", "Degustación", "Colaboración", "Prueba de producto", "Consumo interno", "Producto regalado", "Otro"]) {
    await db.motivoCortesia.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  const metodos = [
    { nombre: "Efectivo", esEfectivo: true, orden: 1 },
    { nombre: "Yape", esEfectivo: false, orden: 2 },
    { nombre: "Plin", esEfectivo: false, orden: 3 },
    { nombre: "Tarjeta", esEfectivo: false, orden: 4 },
  ];
  for (const m of metodos) {
    await db.metodoPago.upsert({ where: { nombre: m.nombre }, update: {}, create: m });
  }

  const mesas = [
    ...[1, 2, 3].map((n) => ({ nombre: `Mesa ${n}`, tipo: "MESA" as const, orden: n })),
    ...[1, 2, 3, 4].map((n) => ({ nombre: `Barra ${n}`, tipo: "BARRA" as const, orden: 10 + n })),
  ];
  for (const m of mesas) {
    await db.mesa.upsert({ where: { nombre: m.nombre }, update: {}, create: m });
  }

  for (const nombre of ["Makro"]) {
    await db.proveedor.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  for (const nombre of ["Milkuns", "Braedt"]) {
    await db.marca.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // Parámetros generales. Los porcentajes son valores de partida: ajustar en Configuración > General.
  const config = [
    { clave: "negocio.nombre", valor: "Baby Burger", descripcion: "Nombre del negocio" },
    { clave: "negocio.moneda", valor: "S/", descripcion: "Símbolo de moneda" },
    { clave: "margen.objetivo", valor: "60", descripcion: "Margen objetivo (%) para el precio recomendado" },
    { clave: "margen.alerta", valor: "40", descripcion: "Margen mínimo (%): debajo de esto el producto se marca en alerta" },
    { clave: "caja.fondo_inicial", valor: "0", descripcion: "Fondo de caja sugerido al abrir el día (S/)" },
    { clave: "pos.canal_predeterminado", valor: "LLEVAR", descripcion: "Tipo de servicio usado para calcular el costo de empaque de referencia" },
  ];
  for (const c of config) {
    await db.configuracion.upsert({ where: { clave: c.clave }, update: {}, create: c });
  }
}

// ---------------------------------------------------------------------
// 3. Insumos (ingredientes y empaques)
// ---------------------------------------------------------------------

type DefInsumo = { nombre: string; tipo: TipoInsumo; categoria: string; base: "g" | "ml" | "unidad"; obs?: string; compartido?: boolean };

const INGREDIENTES: DefInsumo[] = [
  { nombre: "Carne", tipo: "INGREDIENTE", categoria: "Carnes y proteínas", base: "g", obs: "Se sazona solo con sal rosada de Maras" },
  { nombre: "Queso cheddar", tipo: "INGREDIENTE", categoria: "Lácteos", base: "g", obs: "Varias marcas: Milkuns, Braedt (Makro)" },
  { nombre: "Pan brioche", tipo: "INGREDIENTE", categoria: "Panes", base: "unidad", obs: "Pan regular para smash. Se tuesta en plancha" },
  { nombre: "Petit pan", tipo: "INGREDIENTE", categoria: "Panes", base: "unidad", obs: "Para mini burgers. Unidades por bolsa: pendiente" },
  { nombre: "Tocino", tipo: "INGREDIENTE", categoria: "Carnes y proteínas", base: "g" },
  { nombre: "Chorizo parrillero", tipo: "INGREDIENTE", categoria: "Carnes y proteínas", base: "g" },
  { nombre: "Salchicha", tipo: "INGREDIENTE", categoria: "Carnes y proteínas", base: "g" },
  { nombre: "Alitas", tipo: "INGREDIENTE", categoria: "Carnes y proteínas", base: "unidad" },
  { nombre: "Huevo", tipo: "INGREDIENTE", categoria: "Carnes y proteínas", base: "unidad" },
  { nombre: "Cebolla", tipo: "INGREDIENTE", categoria: "Verduras y frutas", base: "g" },
  { nombre: "Lechuga", tipo: "INGREDIENTE", categoria: "Verduras y frutas", base: "g" },
  { nombre: "Tomate", tipo: "INGREDIENTE", categoria: "Verduras y frutas", base: "g" },
  { nombre: "Jalapeños", tipo: "INGREDIENTE", categoria: "Verduras y frutas", base: "g" },
  { nombre: "Perejil", tipo: "INGREDIENTE", categoria: "Verduras y frutas", base: "g" },
  { nombre: "Culantro", tipo: "INGREDIENTE", categoria: "Verduras y frutas", base: "g" },
  { nombre: "Ajo", tipo: "INGREDIENTE", categoria: "Verduras y frutas", base: "g" },
  { nombre: "Ají amarillo", tipo: "INGREDIENTE", categoria: "Verduras y frutas", base: "g" },
  { nombre: "Piña", tipo: "INGREDIENTE", categoria: "Verduras y frutas", base: "g" },
  { nombre: "Apio", tipo: "INGREDIENTE", categoria: "Verduras y frutas", base: "g" },
  { nombre: "Zanahoria", tipo: "INGREDIENTE", categoria: "Verduras y frutas", base: "g" },
  { nombre: "Mayonesa", tipo: "INGREDIENTE", categoria: "Salsas y aderezos", base: "g" },
  { nombre: "Ketchup", tipo: "INGREDIENTE", categoria: "Salsas y aderezos", base: "g" },
  { nombre: "Mostaza", tipo: "INGREDIENTE", categoria: "Salsas y aderezos", base: "g" },
  { nombre: "Salsa BBQ", tipo: "INGREDIENTE", categoria: "Salsas y aderezos", base: "ml" },
  { nombre: "Salsa Hot Wings", tipo: "INGREDIENTE", categoria: "Salsas y aderezos", base: "ml" },
  { nombre: "Vinagre", tipo: "INGREDIENTE", categoria: "Salsas y aderezos", base: "ml" },
  { nombre: "Sal", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Sal rosada de Maras", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Pimienta", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Comino", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Ajo en polvo", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Cebolla en polvo", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Paprika", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Orégano", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Ajinomoto", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Especias", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Granos de chilli picante", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Azúcar", tipo: "INGREDIENTE", categoria: "Especias y condimentos", base: "g" },
  { nombre: "Aceite", tipo: "INGREDIENTE", categoria: "Aceites y otros", base: "ml", compartido: true, obs: "El aceite de plancha se trata como costo compartido; no se inventa una cantidad por hamburguesa" },
  { nombre: "Papas congeladas", tipo: "INGREDIENTE", categoria: "Congelados", base: "g" },
  { nombre: "Inca Kola", tipo: "INGREDIENTE", categoria: "Bebidas e insumos de bebida", base: "unidad" },
  { nombre: "Coca Cola", tipo: "INGREDIENTE", categoria: "Bebidas e insumos de bebida", base: "unidad" },
  { nombre: "Agua", tipo: "INGREDIENTE", categoria: "Bebidas e insumos de bebida", base: "unidad" },
  { nombre: "Jugo de piña", tipo: "INGREDIENTE", categoria: "Bebidas e insumos de bebida", base: "ml" },
  { nombre: "Jugo de fresa", tipo: "INGREDIENTE", categoria: "Bebidas e insumos de bebida", base: "ml" },
];

const EMPAQUES: DefInsumo[] = [
  { nombre: "Caja para hamburguesa", tipo: "EMPAQUE", categoria: "Envases para comida", base: "unidad" },
  { nombre: "Caja personalizada Baby Burger", tipo: "EMPAQUE", categoria: "Envases para comida", base: "unidad", obs: "Futura. Registrar compra (ej. 500 cajas = S/X) para obtener costo por caja" },
  { nombre: "Taper plástico", tipo: "EMPAQUE", categoria: "Envases para comida", base: "unidad" },
  { nombre: "Envase para Baby Box", tipo: "EMPAQUE", categoria: "Envases para comida", base: "unidad" },
  { nombre: "Bolsa para llevar", tipo: "EMPAQUE", categoria: "Envases para comida", base: "unidad" },
  { nombre: "Envase para mayonesa", tipo: "EMPAQUE", categoria: "Envases para salsas", base: "unidad" },
  { nombre: "Envase para ketchup", tipo: "EMPAQUE", categoria: "Envases para salsas", base: "unidad" },
  { nombre: "Envase para ají", tipo: "EMPAQUE", categoria: "Envases para salsas", base: "unidad" },
  { nombre: "Servilleta", tipo: "EMPAQUE", categoria: "Servicio y descartables", base: "unidad" },
  { nombre: "Tenedor", tipo: "EMPAQUE", categoria: "Servicio y descartables", base: "unidad" },
  { nombre: "Cuchara", tipo: "EMPAQUE", categoria: "Servicio y descartables", base: "unidad" },
  { nombre: "Vaso Domo", tipo: "EMPAQUE", categoria: "Insumos de bebida", base: "unidad" },
  { nombre: "Sticker Baby Burger", tipo: "EMPAQUE", categoria: "Insumos de bebida", base: "unidad" },
  { nombre: "Sorbete", tipo: "EMPAQUE", categoria: "Insumos de bebida", base: "unidad" },
  { nombre: "Tapa de vaso", tipo: "EMPAQUE", categoria: "Insumos de bebida", base: "unidad" },
];

async function seedInsumos() {
  for (const d of [...INGREDIENTES, ...EMPAQUES]) {
    const cat = await db.categoriaInsumo.findUniqueOrThrow({ where: { nombre: d.categoria } });
    const base = await unidad(d.base);
    await db.insumo.upsert({
      where: { nombre: d.nombre },
      update: {},
      create: {
        nombre: d.nombre,
        tipo: d.tipo,
        categoriaId: cat.id,
        unidadBaseId: base.id,
        observaciones: d.obs,
        esCostoCompartido: d.compartido ?? false,
      },
    });
  }

  // Unidades propias. factorABase null = pendiente de definir por el negocio.
  const propias: { insumo: string; nombre: string; factor: number | null }[] = [
    { insumo: "Carne", nombre: "bola smash", factor: 80 }, // 400 g -> ~5 bolas
    { insumo: "Carne", nombre: "mini", factor: 20 }, // 1 bola -> 4 minis
    { insumo: "Queso cheddar", nombre: "slice", factor: null }, // peso del slice: pendiente
    { insumo: "Petit pan", nombre: "bolsa", factor: null }, // unidades por bolsa: pendiente
  ];
  for (const p of propias) {
    const i = await insumo(p.insumo);
    await db.unidadInsumo.upsert({
      where: { insumoId_nombre: { insumoId: i.id, nombre: p.nombre } },
      update: {},
      create: { insumoId: i.id, nombre: p.nombre, factorABase: p.factor },
    });
  }
}

// ---------------------------------------------------------------------
// 4. Presentaciones y precios conocidos
// ---------------------------------------------------------------------

async function seedPresentaciones() {
  type Pres = {
    insumo: string; nombre: string; marca?: string; proveedor?: string;
    contenido: number | null; unidad: "g" | "ml" | "unidad"; predeterminada?: boolean;
    precio: number | null; obs?: string;
  };
  const lista: Pres[] = [
    { insumo: "Carne", nombre: "Bolsa 400 g", contenido: 400, unidad: "g", predeterminada: true, precio: 10.2 },
    { insumo: "Queso cheddar", nombre: "Milkuns Cheddar (por kg)", marca: "Milkuns", contenido: 1000, unidad: "g", precio: 45 },
    { insumo: "Queso cheddar", nombre: "American Style Braedt (por kg)", marca: "Braedt", proveedor: "Makro", contenido: 1000, unidad: "g", precio: 28.5, obs: "Sigma / American Style" },
    { insumo: "Pan brioche", nombre: "Paquete x6", contenido: 6, unidad: "unidad", predeterminada: true, precio: 6 },
    { insumo: "Petit pan", nombre: "Bolsa", contenido: null, unidad: "unidad", predeterminada: true, precio: null, obs: "Referencia S/5.50 – S/6 por bolsa; unidades por bolsa pendiente. Registrar la primera compra real." },
  ];

  for (const p of lista) {
    const i = await insumo(p.insumo);
    const u = await unidad(p.unidad);
    const marca = p.marca ? await db.marca.findUniqueOrThrow({ where: { nombre: p.marca } }) : null;
    const prov = p.proveedor ? await db.proveedor.findUniqueOrThrow({ where: { nombre: p.proveedor } }) : null;

    const existente = await db.presentacion.findFirst({ where: { insumoId: i.id, nombre: p.nombre } });
    const pres =
      existente ??
      (await db.presentacion.create({
        data: {
          insumoId: i.id,
          nombre: p.nombre,
          marcaId: marca?.id,
          proveedorId: prov?.id,
          contenido: p.contenido,
          unidadContenidoId: u.id,
          esPredeterminada: p.predeterminada ?? false,
          observaciones: p.obs,
        },
      }));

    // Precio inicial solo si hay precio y contenido conocidos y aún no hay precio registrado.
    if (p.precio !== null && p.contenido !== null && !existente) {
      const costoBase = p.precio / p.contenido; // contenido ya está en unidad base
      await db.precioInsumo.create({
        data: {
          insumoId: i.id,
          presentacionId: pres.id,
          precioPresentacion: p.precio,
          costoUnitarioBase: costoBase.toFixed(8),
          origen: "INICIAL",
          nota: "Precio de referencia entregado al iniciar el sistema",
        },
      });
    }
  }
}

// ---------------------------------------------------------------------
// 5. Preparaciones (subrecetas)
// ---------------------------------------------------------------------

type DefPrep = { nombre: string; base: "g" | "ml" | "unidad"; rendimiento: number | null; items: Item[]; obs?: string };

const PREPARACIONES: DefPrep[] = [
  { nombre: "Mayonesa casera", base: "g", rendimiento: null, items: [
    { insumo: "Huevo", cantidad: null }, { insumo: "Aceite", cantidad: null }, { insumo: "Sal", cantidad: null }, { insumo: "Mostaza", cantidad: null },
  ] },
  { nombre: "Ají", base: "g", rendimiento: null, items: [
    { insumo: "Ají amarillo", cantidad: null }, { insumo: "Aceite", cantidad: null }, { insumo: "Ajo", cantidad: null }, { insumo: "Sal", cantidad: null },
    { insumo: "Pimienta", cantidad: null }, { insumo: "Ajinomoto", cantidad: null }, { insumo: "Comino", cantidad: null },
  ] },
  { nombre: "Chimichurri", base: "g", rendimiento: null, obs: "Completar con los demás ingredientes", items: [
    { insumo: "Perejil", cantidad: null }, { insumo: "Culantro", cantidad: null }, { insumo: "Ajo", cantidad: null },
  ] },
  { nombre: "Salsa BBQ especial", base: "ml", rendimiento: null, obs: "Completar con los demás ingredientes", items: [
    { insumo: "Mostaza", cantidad: null }, { insumo: "Salsa BBQ", cantidad: null }, { insumo: "Especias", cantidad: null },
    { insumo: "Granos de chilli picante", cantidad: null }, { insumo: "Vinagre", cantidad: null },
  ] },
  { nombre: "Salsa secreta", base: "g", rendimiento: null, obs: "Ingredientes no entregados todavía: definir desde Recetas", items: [] },
  { nombre: "Cebolla caramelizada", base: "g", rendimiento: null, obs: "Solo se registró cebolla; completar el resto", items: [{ insumo: "Cebolla", cantidad: null }] },
  { nombre: "Piña glaseada", base: "g", rendimiento: null, obs: "Solo se registró piña; completar el resto", items: [{ insumo: "Piña", cantidad: null }] },
  { nombre: "Chicha", base: "ml", rendimiento: null, obs: "Definir ingredientes y producción final por litro", items: [] },
  { nombre: "Maracuyá", base: "ml", rendimiento: null, obs: "Definir ingredientes y producción final por litro", items: [] },
  { nombre: "Mini burger", base: "unidad", rendimiento: 1, obs: "Unidad base de los Baby Boxes", items: [
    { insumo: "Carne", cantidad: 1, unidadPropia: "mini" },
    { insumo: "Queso cheddar", cantidad: 1, unidadPropia: "slice" },
    { insumo: "Petit pan", cantidad: 1, unidad: "unidad" },
  ] },
];

async function seedPreparaciones() {
  const cat = await db.categoriaInsumo.findUniqueOrThrow({ where: { nombre: "Preparaciones" } });
  for (const p of PREPARACIONES) {
    const base = await unidad(p.base);
    const ins = await db.insumo.upsert({
      where: { nombre: p.nombre },
      update: {},
      create: { nombre: p.nombre, tipo: "PREPARACION", categoriaId: cat.id, unidadBaseId: base.id, observaciones: p.obs },
    });
    const existente = await db.preparacion.findUnique({ where: { insumoResultadoId: ins.id } });
    if (existente) continue;
    const items = await Promise.all(p.items.map((it, idx) => resolverItem(it, idx)));
    await db.preparacion.create({
      data: {
        insumoResultadoId: ins.id,
        nombre: p.nombre,
        rendimientoCantidad: p.rendimiento,
        rendimientoUnidadId: base.id,
        items: { create: items },
      },
    });
  }
}

// ---------------------------------------------------------------------
// 6. Componentes base por categoría
// ---------------------------------------------------------------------

async function seedComponentesBase() {
  // "Todas las hamburguesas llevan lechuga, tomate y papas fritas" — cantidades pendientes.
  const cat = await db.categoriaProducto.findUniqueOrThrow({ where: { nombre: "Smash Burgers" } });
  const base: Item[] = [
    { insumo: "Lechuga", cantidad: null },
    { insumo: "Tomate", cantidad: null },
    { insumo: "Papas congeladas", cantidad: null },
  ];
  for (const [idx, it] of base.entries()) {
    const r = await resolverItem(it, idx);
    await db.componenteBase.upsert({
      where: { categoriaId_insumoId: { categoriaId: cat.id, insumoId: r.insumoId } },
      update: {},
      create: { categoriaId: cat.id, ...r },
    });
  }
}

// ---------------------------------------------------------------------
// 7. Productos y recetas
// ---------------------------------------------------------------------

type DefProducto = { nombre: string; categoria: string; precio: number; esExtra?: boolean; descripcion?: string; receta: Item[]; conBase?: boolean };

const BASE_SMASH: Item[] = [
  { insumo: "Lechuga", cantidad: null },
  { insumo: "Tomate", cantidad: null },
  { insumo: "Papas congeladas", cantidad: null },
];

const PRODUCTOS: DefProducto[] = [
  // BABY BOXES
  { nombre: "Baby Minibox", categoria: "Baby Boxes", precio: 20, descripcion: "4 mini burgers con lechuga, tomate y salsa secreta", receta: [
    { insumo: "Mini burger", cantidad: 4, unidad: "unidad" }, { insumo: "Lechuga", cantidad: null }, { insumo: "Tomate", cantidad: null },
    { insumo: "Salsa secreta", cantidad: null }, { insumo: "Papas congeladas", cantidad: null },
  ] },
  { nombre: "Baby Box", categoria: "Baby Boxes", precio: 25, descripcion: "6 mini burgers con lechuga, tomate y salsa secreta", receta: [
    { insumo: "Mini burger", cantidad: 6, unidad: "unidad" }, { insumo: "Lechuga", cantidad: null }, { insumo: "Tomate", cantidad: null },
    { insumo: "Salsa secreta", cantidad: null }, { insumo: "Papas congeladas", cantidad: null },
  ] },
  { nombre: "Baby Bacon Box", categoria: "Baby Boxes", precio: 27, descripcion: "6 mini burgers, papas con salsa secreta y tocino crocante", receta: [
    { insumo: "Mini burger", cantidad: 6, unidad: "unidad" }, { insumo: "Lechuga", cantidad: null }, { insumo: "Tomate", cantidad: null },
    { insumo: "Salsa secreta", cantidad: null }, { insumo: "Tocino", cantidad: null, notas: "crocante" }, { insumo: "Papas congeladas", cantidad: null },
  ] },
  { nombre: "Baby Criatura Box", categoria: "Baby Boxes", precio: 30, descripcion: "6 mini burgers, papas con salsa secreta, jalapeños y cebolla caramelizada", receta: [
    { insumo: "Mini burger", cantidad: 6, unidad: "unidad" }, { insumo: "Lechuga", cantidad: null }, { insumo: "Tomate", cantidad: null },
    { insumo: "Salsa secreta", cantidad: null }, { insumo: "Jalapeños", cantidad: null }, { insumo: "Cebolla caramelizada", cantidad: null }, { insumo: "Papas congeladas", cantidad: null },
  ] },
  // SMASH BURGERS (llevan además los componentes base de la categoría)
  { nombre: "Smash Burger", categoria: "Smash Burgers", precio: 18, conBase: true, descripcion: "Carne smash, queso cheddar, lechuga, tomate y salsa secreta", receta: [
    { insumo: "Carne", cantidad: 1, unidadPropia: "bola smash" }, { insumo: "Queso cheddar", cantidad: 1, unidadPropia: "slice" },
    { insumo: "Pan brioche", cantidad: 1, unidad: "unidad" }, { insumo: "Salsa secreta", cantidad: null },
  ] },
  { nombre: "Double Wave Burger", categoria: "Smash Burgers", precio: 25, conBase: true, descripcion: "Doble carne smash, queso cheddar, tocino, cebolla caramelizada y salsa secreta", receta: [
    { insumo: "Carne", cantidad: 2, unidadPropia: "bola smash" }, { insumo: "Queso cheddar", cantidad: 2, unidadPropia: "slice" },
    { insumo: "Pan brioche", cantidad: 1, unidad: "unidad" }, { insumo: "Tocino", cantidad: null }, { insumo: "Cebolla caramelizada", cantidad: null }, { insumo: "Salsa secreta", cantidad: null },
  ] },
  { nombre: "La Criatura", categoria: "Smash Burgers", precio: 27, conBase: true, descripcion: "Doble carne smash, queso cheddar, tocino, jalapeño y cebolla caramelizada", receta: [
    { insumo: "Carne", cantidad: 2, unidadPropia: "bola smash" }, { insumo: "Queso cheddar", cantidad: 2, unidadPropia: "slice" },
    { insumo: "Pan brioche", cantidad: 1, unidad: "unidad" }, { insumo: "Tocino", cantidad: null }, { insumo: "Jalapeños", cantidad: null }, { insumo: "Cebolla caramelizada", cantidad: null },
  ] },
  { nombre: "Waimea", categoria: "Smash Burgers", precio: 27, conBase: true, descripcion: "Doble carne smash, queso cheddar, tocino, piña glaseada", receta: [
    { insumo: "Carne", cantidad: 2, unidadPropia: "bola smash" }, { insumo: "Queso cheddar", cantidad: 2, unidadPropia: "slice" },
    { insumo: "Pan brioche", cantidad: 1, unidad: "unidad" }, { insumo: "Tocino", cantidad: null }, { insumo: "Piña glaseada", cantidad: null },
  ] },
  { nombre: "Choribaby", categoria: "Smash Burgers", precio: 28, conBase: true, descripcion: "Carne smash, chorizo parrillero, chimichurri, queso cheddar", receta: [
    { insumo: "Carne", cantidad: 1, unidadPropia: "bola smash" }, { insumo: "Queso cheddar", cantidad: 1, unidadPropia: "slice" },
    { insumo: "Pan brioche", cantidad: 1, unidad: "unidad" }, { insumo: "Chorizo parrillero", cantidad: null }, { insumo: "Chimichurri", cantidad: null },
  ] },
  // PAPAS
  { nombre: "Choripapas", categoria: "Papas", precio: 18, descripcion: "Salchipapa de chorizo con papas fritas", receta: [
    { insumo: "Chorizo parrillero", cantidad: null }, { insumo: "Papas congeladas", cantidad: null },
  ] },
  { nombre: "Salchipapa", categoria: "Papas", precio: 15, descripcion: "Salchicha ahumada con papas fritas", receta: [
    { insumo: "Salchicha", cantidad: null }, { insumo: "Papas congeladas", cantidad: null },
  ] },
  // ALITAS
  { nombre: "Alitas BBQ", categoria: "Alitas", precio: 18, descripcion: "6 alitas en salsa BBQ con papas fritas, apio y zanahoria", receta: [
    { insumo: "Alitas", cantidad: 6, unidad: "unidad" }, { insumo: "Salsa BBQ especial", cantidad: null, notas: "Cambiar por 'Salsa BBQ' comprada si no se usa la especial" },
    { insumo: "Papas congeladas", cantidad: null }, { insumo: "Apio", cantidad: null }, { insumo: "Zanahoria", cantidad: null },
  ] },
  { nombre: "Hot Wings", categoria: "Alitas", precio: 18, descripcion: "6 alitas en salsa picante con papas fritas, apio y zanahoria", receta: [
    { insumo: "Alitas", cantidad: 6, unidad: "unidad" }, { insumo: "Salsa Hot Wings", cantidad: null },
    { insumo: "Papas congeladas", cantidad: null }, { insumo: "Apio", cantidad: null }, { insumo: "Zanahoria", cantidad: null },
  ] },
  // BEBIDAS
  { nombre: "Inca Kola", categoria: "Bebidas", precio: 5, receta: [{ insumo: "Inca Kola", cantidad: 1, unidad: "unidad" }] },
  { nombre: "Coca Cola", categoria: "Bebidas", precio: 5, receta: [{ insumo: "Coca Cola", cantidad: 1, unidad: "unidad" }] },
  { nombre: "Chicha", categoria: "Bebidas", precio: 4, receta: [
    { insumo: "Chicha", cantidad: null, unidad: "ml" }, { insumo: "Vaso Domo", cantidad: 1, unidad: "unidad" }, { insumo: "Sticker Baby Burger", cantidad: 1, unidad: "unidad" },
  ] },
  { nombre: "Maracuyá", categoria: "Bebidas", precio: 4, receta: [
    { insumo: "Maracuyá", cantidad: null, unidad: "ml" }, { insumo: "Vaso Domo", cantidad: 1, unidad: "unidad" }, { insumo: "Sticker Baby Burger", cantidad: 1, unidad: "unidad" },
  ] },
  { nombre: "Agua", categoria: "Bebidas", precio: 4, receta: [{ insumo: "Agua", cantidad: 1, unidad: "unidad" }] },
  // EXTRAS
  { nombre: "Extra BBQ", categoria: "Extras", precio: 2, esExtra: true, receta: [{ insumo: "Salsa BBQ", cantidad: null }] },
  { nombre: "Extra cebolla caramelizada", categoria: "Extras", precio: 2, esExtra: true, receta: [{ insumo: "Cebolla caramelizada", cantidad: null }] },
  { nombre: "Extra carne smash", categoria: "Extras", precio: 6, esExtra: true, receta: [{ insumo: "Carne", cantidad: 1, unidadPropia: "bola smash" }] },
  { nombre: "Extra tocino", categoria: "Extras", precio: 2, esExtra: true, receta: [{ insumo: "Tocino", cantidad: null }] },
  { nombre: "Extra jalapeños", categoria: "Extras", precio: 2, esExtra: true, receta: [{ insumo: "Jalapeños", cantidad: null }] },
];

async function seedProductos() {
  for (const [orden, p] of PRODUCTOS.entries()) {
    const cat = await db.categoriaProducto.findUniqueOrThrow({ where: { nombre: p.categoria } });
    const existente = await db.producto.findUnique({ where: { nombre: p.nombre } });
    if (existente) continue;

    const items = [...p.receta, ...(p.conBase ? BASE_SMASH : [])];
    const resueltos = await Promise.all(
      items.map(async (it, idx) => ({ ...(await resolverItem(it, idx)), esComponenteBase: idx >= p.receta.length })),
    );

    await db.producto.create({
      data: {
        nombre: p.nombre,
        descripcion: p.descripcion,
        categoriaId: cat.id,
        precioVenta: p.precio,
        esExtra: p.esExtra ?? false,
        orden,
        preciosHist: { create: { precio: p.precio, motivo: "Precio inicial (carta entregada)" } },
        receta: { create: { items: { create: resueltos } } },
      },
    });
  }
}

// ---------------------------------------------------------------------
// 8. Reglas de empaque por tipo de servicio (editables)
// ---------------------------------------------------------------------

async function seedReglasEmpaque() {
  if ((await db.reglaEmpaque.count()) > 0) return;

  type Regla = { canal: TipoServicio; insumo: string; cantidad: number; alcance: AlcanceReglaEmpaque; categoria?: string };
  const salsasPorPedido = (canal: TipoServicio): Regla[] => [
    { canal, insumo: "Envase para mayonesa", cantidad: 1, alcance: "POR_PEDIDO" },
    { canal, insumo: "Envase para ketchup", cantidad: 1, alcance: "POR_PEDIDO" },
    { canal, insumo: "Envase para ají", cantidad: 1, alcance: "POR_PEDIDO" },
  ];
  const paraLlevar = (canal: TipoServicio): Regla[] => [
    ...salsasPorPedido(canal),
    { canal, insumo: "Bolsa para llevar", cantidad: 1, alcance: "POR_PEDIDO" },
    { canal, insumo: "Caja para hamburguesa", cantidad: 1, alcance: "POR_ITEM", categoria: "Smash Burgers" },
    { canal, insumo: "Envase para Baby Box", cantidad: 1, alcance: "POR_ITEM", categoria: "Baby Boxes" },
  ];

  // Salsas se entregan siempre (mesa, barra, llevar y delivery). Servilletas y tenedores:
  // cantidad por pedido no definida todavía → se configura desde Empaques (Fase 3).
  const reglas: Regla[] = [
    ...salsasPorPedido("MESA"),
    ...salsasPorPedido("BARRA"),
    ...paraLlevar("LLEVAR"),
    ...paraLlevar("DELIVERY"),
  ];

  for (const r of reglas) {
    const i = await insumo(r.insumo);
    const cat = r.categoria ? await db.categoriaProducto.findUniqueOrThrow({ where: { nombre: r.categoria } }) : null;
    await db.reglaEmpaque.create({
      data: { tipoServicio: r.canal, insumoId: i.id, cantidad: r.cantidad, alcance: r.alcance, categoriaId: cat?.id },
    });
  }
}

// ---------------------------------------------------------------------
// 9. Permisos, roles y usuario administrador
// ---------------------------------------------------------------------

async function seedPermisosYUsuarios() {
  for (const p of PERMISOS) {
    await db.permiso.upsert({ where: { clave: p.clave }, update: { modulo: p.modulo, descripcion: p.descripcion }, create: p });
  }
  for (const rol of Object.keys(PERMISOS_POR_ROL) as Rol[]) {
    for (const clave of PERMISOS_POR_ROL[rol]) {
      const permiso = await db.permiso.findUniqueOrThrow({ where: { clave } });
      await db.rolPermiso.upsert({
        where: { rol_permisoId: { rol, permisoId: permiso.id } },
        update: {},
        create: { rol, permisoId: permiso.id },
      });
    }
  }

  if ((await db.usuario.count()) === 0) {
    const pin = process.env.ADMIN_PIN_INICIAL ?? "1234";
    await db.usuario.create({
      data: { nombre: "Administrador", usuario: "admin", rol: "ADMIN", pinHash: await bcrypt.hash(pin, 10) },
    });
    console.log(`  Usuario inicial: admin / PIN ${pin}  → cámbialo desde Configuración > Usuarios`);
  }
}

// ---------------------------------------------------------------------

async function main() {
  console.log("Seed Baby Burger");
  await seedUnidades(); console.log("  ✓ unidades");
  await seedCatalogos(); console.log("  ✓ catálogos, mesas, métodos de pago, configuración");
  await seedInsumos(); console.log("  ✓ ingredientes y empaques");
  await seedPresentaciones(); console.log("  ✓ presentaciones y precios conocidos");
  await seedPreparaciones(); console.log("  ✓ preparaciones");
  await seedComponentesBase(); console.log("  ✓ componentes base");
  await seedProductos(); console.log("  ✓ carta y recetas");
  await seedReglasEmpaque(); console.log("  ✓ reglas de empaque por canal");
  await seedPermisosYUsuarios(); console.log("  ✓ permisos, roles y usuario admin");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
