-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoInsumo" AS ENUM ('INGREDIENTE', 'PREPARACION', 'EMPAQUE');

-- CreateEnum
CREATE TYPE "TipoUnidad" AS ENUM ('MASA', 'VOLUMEN', 'UNIDAD');

-- CreateEnum
CREATE TYPE "OrigenPrecio" AS ENUM ('COMPRA', 'MANUAL', 'PREPARACION', 'INICIAL');

-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('MESA', 'BARRA', 'LLEVAR', 'DELIVERY');

-- CreateEnum
CREATE TYPE "TipoMesa" AS ENUM ('MESA', 'BARRA');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('ABIERTO', 'EN_PREPARACION', 'LISTO', 'ESPERANDO_PAGO', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoPreparacionItem" AS ENUM ('PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO');

-- CreateEnum
CREATE TYPE "OrigenConsumo" AS ENUM ('RECETA', 'EXTRA', 'REGLA_EMPAQUE');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('STOCK_INICIAL', 'ENTRADA_COMPRA', 'ENTRADA_PREPARACION', 'SALIDA_PREPARACION', 'SALIDA_VENTA', 'SALIDA_CORTESIA', 'SALIDA_MERMA', 'SALIDA_INCIDENCIA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'REVERSION');

-- CreateEnum
CREATE TYPE "AlcanceReglaEmpaque" AS ENUM ('POR_PEDIDO', 'POR_ITEM');

-- CreateEnum
CREATE TYPE "TipoIncidencia" AS ENUM ('DEVOLUCION', 'PRODUCTO_EQUIVOCADO', 'REHECHO', 'PEDIDO_PERDIDO', 'ERROR_PREPARACION', 'OTRO');

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'CAJA', 'COCINA');

-- CreateEnum
CREATE TYPE "EstadoCierre" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateTable
CREATE TABLE "UnidadMedida" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoUnidad" NOT NULL,
    "factorABase" DECIMAL(18,6) NOT NULL,
    "esBase" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UnidadMedida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaInsumo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoInsumo" NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategoriaInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaProducto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,

    CONSTRAINT "CategoriaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaGasto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esFijo" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategoriaGasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotivoMerma" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MotivoMerma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotivoCortesia" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MotivoCortesia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marca" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetodoPago" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esEfectivo" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MetodoPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mesa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoMesa" NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "actualizado" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoInsumo" NOT NULL,
    "categoriaId" TEXT,
    "unidadBaseId" TEXT NOT NULL,
    "stockActual" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(18,4),
    "esCostoCompartido" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadInsumo" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "factorABase" DECIMAL(18,6),
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UnidadInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presentacion" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "marcaId" TEXT,
    "proveedorId" TEXT,
    "contenido" DECIMAL(18,4),
    "unidadContenidoId" TEXT NOT NULL,
    "unidadesPorPaquete" INTEGER,
    "esPredeterminada" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Presentacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioInsumo" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "presentacionId" TEXT,
    "precioPresentacion" DECIMAL(14,4),
    "costoUnitarioBase" DECIMAL(18,8) NOT NULL,
    "origen" "OrigenPrecio" NOT NULL,
    "compraItemId" TEXT,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),
    "nota" TEXT,
    "usuarioId" TEXT,

    CONSTRAINT "PrecioInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preparacion" (
    "id" TEXT NOT NULL,
    "insumoResultadoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rendimientoCantidad" DECIMAL(18,4),
    "rendimientoUnidadId" TEXT NOT NULL,
    "instrucciones" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preparacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreparacionItem" (
    "id" TEXT NOT NULL,
    "preparacionId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(18,4),
    "unidadMedidaId" TEXT,
    "unidadInsumoId" TEXT,
    "notas" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PreparacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoriaId" TEXT NOT NULL,
    "precioVenta" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "esExtra" BOOLEAN NOT NULL DEFAULT false,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioProductoHistorial" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" DECIMAL(14,2) NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),
    "motivo" TEXT,
    "usuarioId" TEXT,

    CONSTRAINT "PrecioProductoHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostoProductoHistorial" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "costoComida" DECIMAL(14,4) NOT NULL,
    "costoEmpaque" DECIMAL(14,4) NOT NULL,
    "costoTotal" DECIMAL(14,4) NOT NULL,
    "detalle" JSONB NOT NULL,
    "motivo" TEXT,
    "completo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CostoProductoHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receta" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "notas" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecetaItem" (
    "id" TEXT NOT NULL,
    "recetaId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(18,4),
    "unidadMedidaId" TEXT,
    "unidadInsumoId" TEXT,
    "esComponenteBase" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecetaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponenteBase" (
    "id" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(18,4),
    "unidadMedidaId" TEXT,
    "unidadInsumoId" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComponenteBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaEmpaque" (
    "id" TEXT NOT NULL,
    "tipoServicio" "TipoServicio" NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "alcance" "AlcanceReglaEmpaque" NOT NULL,
    "categoriaId" TEXT,
    "productoId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReglaEmpaque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipoServicio" "TipoServicio" NOT NULL,
    "mesaId" TEXT,
    "clienteNombre" TEXT,
    "clienteTelefono" TEXT,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'ABIERTO',
    "observaciones" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descuentoMonto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descuentoMotivo" TEXT,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costoTotal" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "motivoAnulacion" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "anuladoPorId" TEXT,
    "pagadoEn" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "cierreCajaId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(14,2) NOT NULL,
    "observacion" TEXT,
    "estadoPreparacion" "EstadoPreparacionItem" NOT NULL DEFAULT 'PENDIENTE',
    "costoUnitario" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItemExtra" (
    "id" TEXT NOT NULL,
    "pedidoItemId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precioUnitario" DECIMAL(14,2) NOT NULL,
    "costoUnitario" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "PedidoItemExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItemConsumo" (
    "id" TEXT NOT NULL,
    "pedidoItemId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "origen" "OrigenConsumo" NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "costoUnitario" DECIMAL(18,8) NOT NULL,
    "costoTotal" DECIMAL(14,4) NOT NULL,
    "pendiente" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PedidoItemConsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "metodoPagoId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "referencia" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "stockResultante" DECIMAL(18,4),
    "costoUnitario" DECIMAL(18,8),
    "motivo" TEXT,
    "referenciaTipo" TEXT,
    "referenciaId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proveedorId" TEXT,
    "numeroComprobante" TEXT,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "metodoPagoId" TEXT,
    "pagadoDesdeCaja" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraItem" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "presentacionId" TEXT,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "cantidadBase" DECIMAL(18,4) NOT NULL,
    "costoUnitarioBase" DECIMAL(18,8) NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "CompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoriaId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "comprobanteUrl" TEXT,
    "observaciones" TEXT,
    "esFijo" BOOLEAN NOT NULL DEFAULT false,
    "metodoPagoId" TEXT,
    "pagadoDesdeCaja" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merma" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "insumoId" TEXT,
    "productoId" TEXT,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "unidadMedidaId" TEXT,
    "motivoId" TEXT NOT NULL,
    "costo" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "Merma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cortesia" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivoId" TEXT NOT NULL,
    "costoTotal" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "Cortesia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CortesiaConsumo" (
    "id" TEXT NOT NULL,
    "cortesiaId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "costoUnitario" DECIMAL(18,8) NOT NULL,
    "costoTotal" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "CortesiaConsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incidencia" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoIncidencia" NOT NULL,
    "pedidoId" TEXT,
    "productoId" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "motivo" TEXT NOT NULL,
    "costoGenerado" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "ajustaInventario" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "Incidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetiroCaja" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(14,2) NOT NULL,
    "persona" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "observaciones" TEXT,
    "usuarioId" TEXT NOT NULL,
    "cierreCajaId" TEXT,

    CONSTRAINT "RetiroCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreCaja" (
    "id" TEXT NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "estado" "EstadoCierre" NOT NULL DEFAULT 'ABIERTA',
    "fondoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ventasTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "numeroPedidos" INTEGER NOT NULL DEFAULT 0,
    "numeroAnulados" INTEGER NOT NULL DEFAULT 0,
    "descuentosTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "retirosTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gastosEfectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "comprasEfectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "efectivoEsperado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "efectivoReal" DECIMAL(14,2),
    "diferencia" DECIMAL(14,2),
    "observaciones" TEXT,
    "abiertoPorId" TEXT NOT NULL,
    "cerradoPorId" TEXT,

    CONSTRAINT "CierreCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreCajaMetodo" (
    "id" TEXT NOT NULL,
    "cierreCajaId" TEXT NOT NULL,
    "metodoPagoId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "CierreCajaMetodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permiso" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "Permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolPermiso" (
    "id" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "permisoId" TEXT NOT NULL,

    CONSTRAINT "RolPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioPermiso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "permisoId" TEXT NOT NULL,
    "concedido" BOOLEAN NOT NULL,

    CONSTRAINT "UsuarioPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "descripcion" TEXT,
    "valorAnterior" JSONB,
    "valorNuevo" JSONB,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnidadMedida_codigo_key" ON "UnidadMedida"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaInsumo_nombre_key" ON "CategoriaInsumo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaProducto_nombre_key" ON "CategoriaProducto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaGasto_nombre_key" ON "CategoriaGasto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "MotivoMerma_nombre_key" ON "MotivoMerma"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "MotivoCortesia_nombre_key" ON "MotivoCortesia"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_nombre_key" ON "Proveedor"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Marca_nombre_key" ON "Marca"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "MetodoPago_nombre_key" ON "MetodoPago"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_nombre_key" ON "Mesa"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_clave_key" ON "Configuracion"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "Insumo_nombre_key" ON "Insumo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadInsumo_insumoId_nombre_key" ON "UnidadInsumo"("insumoId", "nombre");

-- CreateIndex
CREATE INDEX "Presentacion_insumoId_idx" ON "Presentacion"("insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "PrecioInsumo_compraItemId_key" ON "PrecioInsumo"("compraItemId");

-- CreateIndex
CREATE INDEX "PrecioInsumo_insumoId_vigenteDesde_idx" ON "PrecioInsumo"("insumoId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "Preparacion_insumoResultadoId_key" ON "Preparacion"("insumoResultadoId");

-- CreateIndex
CREATE INDEX "PreparacionItem_preparacionId_idx" ON "PreparacionItem"("preparacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_nombre_key" ON "Producto"("nombre");

-- CreateIndex
CREATE INDEX "PrecioProductoHistorial_productoId_vigenteDesde_idx" ON "PrecioProductoHistorial"("productoId", "vigenteDesde");

-- CreateIndex
CREATE INDEX "CostoProductoHistorial_productoId_fecha_idx" ON "CostoProductoHistorial"("productoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Receta_productoId_key" ON "Receta"("productoId");

-- CreateIndex
CREATE INDEX "RecetaItem_recetaId_idx" ON "RecetaItem"("recetaId");

-- CreateIndex
CREATE UNIQUE INDEX "ComponenteBase_categoriaId_insumoId_key" ON "ComponenteBase"("categoriaId", "insumoId");

-- CreateIndex
CREATE INDEX "ReglaEmpaque_tipoServicio_idx" ON "ReglaEmpaque"("tipoServicio");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_numero_key" ON "Pedido"("numero");

-- CreateIndex
CREATE INDEX "Pedido_fecha_idx" ON "Pedido"("fecha");

-- CreateIndex
CREATE INDEX "Pedido_estado_idx" ON "Pedido"("estado");

-- CreateIndex
CREATE INDEX "PedidoItem_pedidoId_idx" ON "PedidoItem"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoItemConsumo_pedidoItemId_idx" ON "PedidoItemConsumo"("pedidoItemId");

-- CreateIndex
CREATE INDEX "PedidoItemConsumo_insumoId_idx" ON "PedidoItemConsumo"("insumoId");

-- CreateIndex
CREATE INDEX "Pago_pedidoId_idx" ON "Pago"("pedidoId");

-- CreateIndex
CREATE INDEX "MovimientoInventario_insumoId_fecha_idx" ON "MovimientoInventario"("insumoId", "fecha");

-- CreateIndex
CREATE INDEX "MovimientoInventario_referenciaTipo_referenciaId_idx" ON "MovimientoInventario"("referenciaTipo", "referenciaId");

-- CreateIndex
CREATE INDEX "Compra_fecha_idx" ON "Compra"("fecha");

-- CreateIndex
CREATE INDEX "CompraItem_compraId_idx" ON "CompraItem"("compraId");

-- CreateIndex
CREATE INDEX "CompraItem_insumoId_idx" ON "CompraItem"("insumoId");

-- CreateIndex
CREATE INDEX "Gasto_fecha_idx" ON "Gasto"("fecha");

-- CreateIndex
CREATE INDEX "Merma_fecha_idx" ON "Merma"("fecha");

-- CreateIndex
CREATE INDEX "Cortesia_fecha_idx" ON "Cortesia"("fecha");

-- CreateIndex
CREATE INDEX "Incidencia_fecha_idx" ON "Incidencia"("fecha");

-- CreateIndex
CREATE INDEX "RetiroCaja_fecha_idx" ON "RetiroCaja"("fecha");

-- CreateIndex
CREATE INDEX "CierreCaja_fechaApertura_idx" ON "CierreCaja"("fechaApertura");

-- CreateIndex
CREATE UNIQUE INDEX "CierreCajaMetodo_cierreCajaId_metodoPagoId_key" ON "CierreCajaMetodo"("cierreCajaId", "metodoPagoId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_usuario_key" ON "Usuario"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "Permiso_clave_key" ON "Permiso"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "RolPermiso_rol_permisoId_key" ON "RolPermiso"("rol", "permisoId");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioPermiso_usuarioId_permisoId_key" ON "UsuarioPermiso"("usuarioId", "permisoId");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidad_entidadId_idx" ON "LogAuditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "LogAuditoria_fecha_idx" ON "LogAuditoria"("fecha");

-- AddForeignKey
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaInsumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_unidadBaseId_fkey" FOREIGN KEY ("unidadBaseId") REFERENCES "UnidadMedida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadInsumo" ADD CONSTRAINT "UnidadInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentacion" ADD CONSTRAINT "Presentacion_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentacion" ADD CONSTRAINT "Presentacion_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentacion" ADD CONSTRAINT "Presentacion_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentacion" ADD CONSTRAINT "Presentacion_unidadContenidoId_fkey" FOREIGN KEY ("unidadContenidoId") REFERENCES "UnidadMedida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioInsumo" ADD CONSTRAINT "PrecioInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioInsumo" ADD CONSTRAINT "PrecioInsumo_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "Presentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioInsumo" ADD CONSTRAINT "PrecioInsumo_compraItemId_fkey" FOREIGN KEY ("compraItemId") REFERENCES "CompraItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioInsumo" ADD CONSTRAINT "PrecioInsumo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preparacion" ADD CONSTRAINT "Preparacion_insumoResultadoId_fkey" FOREIGN KEY ("insumoResultadoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preparacion" ADD CONSTRAINT "Preparacion_rendimientoUnidadId_fkey" FOREIGN KEY ("rendimientoUnidadId") REFERENCES "UnidadMedida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparacionItem" ADD CONSTRAINT "PreparacionItem_preparacionId_fkey" FOREIGN KEY ("preparacionId") REFERENCES "Preparacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparacionItem" ADD CONSTRAINT "PreparacionItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparacionItem" ADD CONSTRAINT "PreparacionItem_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "UnidadMedida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparacionItem" ADD CONSTRAINT "PreparacionItem_unidadInsumoId_fkey" FOREIGN KEY ("unidadInsumoId") REFERENCES "UnidadInsumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioProductoHistorial" ADD CONSTRAINT "PrecioProductoHistorial_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioProductoHistorial" ADD CONSTRAINT "PrecioProductoHistorial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostoProductoHistorial" ADD CONSTRAINT "CostoProductoHistorial_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receta" ADD CONSTRAINT "Receta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetaItem" ADD CONSTRAINT "RecetaItem_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetaItem" ADD CONSTRAINT "RecetaItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetaItem" ADD CONSTRAINT "RecetaItem_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "UnidadMedida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetaItem" ADD CONSTRAINT "RecetaItem_unidadInsumoId_fkey" FOREIGN KEY ("unidadInsumoId") REFERENCES "UnidadInsumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponenteBase" ADD CONSTRAINT "ComponenteBase_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaProducto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponenteBase" ADD CONSTRAINT "ComponenteBase_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponenteBase" ADD CONSTRAINT "ComponenteBase_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "UnidadMedida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponenteBase" ADD CONSTRAINT "ComponenteBase_unidadInsumoId_fkey" FOREIGN KEY ("unidadInsumoId") REFERENCES "UnidadInsumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaEmpaque" ADD CONSTRAINT "ReglaEmpaque_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaEmpaque" ADD CONSTRAINT "ReglaEmpaque_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaProducto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaEmpaque" ADD CONSTRAINT "ReglaEmpaque_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_cierreCajaId_fkey" FOREIGN KEY ("cierreCajaId") REFERENCES "CierreCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItemExtra" ADD CONSTRAINT "PedidoItemExtra_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "PedidoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItemExtra" ADD CONSTRAINT "PedidoItemExtra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItemConsumo" ADD CONSTRAINT "PedidoItemConsumo_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "PedidoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItemConsumo" ADD CONSTRAINT "PedidoItemConsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_metodoPagoId_fkey" FOREIGN KEY ("metodoPagoId") REFERENCES "MetodoPago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_metodoPagoId_fkey" FOREIGN KEY ("metodoPagoId") REFERENCES "MetodoPago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "Presentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_metodoPagoId_fkey" FOREIGN KEY ("metodoPagoId") REFERENCES "MetodoPago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "UnidadMedida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "MotivoMerma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cortesia" ADD CONSTRAINT "Cortesia_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cortesia" ADD CONSTRAINT "Cortesia_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "MotivoCortesia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cortesia" ADD CONSTRAINT "Cortesia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CortesiaConsumo" ADD CONSTRAINT "CortesiaConsumo_cortesiaId_fkey" FOREIGN KEY ("cortesiaId") REFERENCES "Cortesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CortesiaConsumo" ADD CONSTRAINT "CortesiaConsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidencia" ADD CONSTRAINT "Incidencia_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidencia" ADD CONSTRAINT "Incidencia_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidencia" ADD CONSTRAINT "Incidencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiroCaja" ADD CONSTRAINT "RetiroCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiroCaja" ADD CONSTRAINT "RetiroCaja_cierreCajaId_fkey" FOREIGN KEY ("cierreCajaId") REFERENCES "CierreCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_abiertoPorId_fkey" FOREIGN KEY ("abiertoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_cerradoPorId_fkey" FOREIGN KEY ("cerradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreCajaMetodo" ADD CONSTRAINT "CierreCajaMetodo_cierreCajaId_fkey" FOREIGN KEY ("cierreCajaId") REFERENCES "CierreCaja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreCajaMetodo" ADD CONSTRAINT "CierreCajaMetodo_metodoPagoId_fkey" FOREIGN KEY ("metodoPagoId") REFERENCES "MetodoPago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolPermiso" ADD CONSTRAINT "RolPermiso_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "Permiso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPermiso" ADD CONSTRAINT "UsuarioPermiso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPermiso" ADD CONSTRAINT "UsuarioPermiso_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "Permiso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

