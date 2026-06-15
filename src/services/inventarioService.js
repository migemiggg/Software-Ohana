const db = require('../db/database');
const categoriaRepository = require('../repositories/categoriaRepository');
const productoRepository = require('../repositories/productoRepository');
const movimientoRepository = require('../repositories/movimientoRepository');
const recetasRepository = require('../repositories/recetaRepository'); // Wait, we will create recetaRepository soon, but let's query db or use a generic query here. Let's make sure we query recetas.

class InventarioService {
    async getCategorias() {
        return categoriaRepository.getAll();
    }

    async getProductos(categoria) {
        return productoRepository.getAll(categoria);
    }

    async getProductoById(id) {
        const row = productoRepository.getById(id);
        if (!row) throw new Error('Producto no encontrado.');
        return row;
    }

    normalizarProductoInventario(data) {
        const categoria = data.categoria_id
            ? categoriaRepository.getById(data.categoria_id)
            : null;
        const normalized = {
            ...data,
            unidad: data.unidad || 'pza',
            stock_actual: Number(data.stock_actual || 0),
            stock_minimo: Number(data.stock_minimo || 0),
            precio_unitario: Number(data.precio_unitario || 0)
        };

        if (categoria?.nombre === 'Insumos' && normalized.unidad === 'kg') {
            normalized.unidad = 'g';
            normalized.stock_actual = Number((normalized.stock_actual * 1000).toFixed(6));
            normalized.stock_minimo = Number((normalized.stock_minimo * 1000).toFixed(6));
            normalized.precio_unitario = Number((normalized.precio_unitario / 1000).toFixed(6));
        }

        if (categoria?.nombre === 'Insumos' && normalized.unidad === 'lt') {
            normalized.unidad = 'ml';
            normalized.stock_actual = Number((normalized.stock_actual * 1000).toFixed(6));
            normalized.stock_minimo = Number((normalized.stock_minimo * 1000).toFixed(6));
            normalized.precio_unitario = Number((normalized.precio_unitario / 1000).toFixed(6));
        }

        return normalized;
    }

    async createProducto(data) {
        if (!data.nombre) throw new Error('El nombre es requerido.');
        const normalized = this.normalizarProductoInventario(data);
        const result = productoRepository.create({
            nombre: data.nombre,
            descripcion: data.descripcion,
            categoria_id: data.categoria_id,
            unidad: normalized.unidad,
            stock_actual: normalized.stock_actual,
            stock_minimo: normalized.stock_minimo,
            precio_unitario: normalized.precio_unitario
        });
        return result.lastInsertRowid;
    }

    async updateProducto(id, data) {
        if (!data.nombre) throw new Error('El nombre es requerido.');
        const normalized = this.normalizarProductoInventario(data);
        productoRepository.update(id, {
            nombre: data.nombre,
            descripcion: data.descripcion,
            categoria_id: data.categoria_id,
            unidad: normalized.unidad,
            stock_actual: normalized.stock_actual,
            stock_minimo: normalized.stock_minimo,
            precio_unitario: normalized.precio_unitario
        });
        return true;
    }

    async deleteProducto(id) {
        const producto = productoRepository.getByIdRaw(id);
        if (!producto) throw new Error('Producto no encontrado.');

        // Obtener recetas asociadas para eliminar en cascada
        const recetas = db.prepare('SELECT id FROM recetas WHERE producto_id = ?').all(id);
        productoRepository.deleteCascade(id, recetas);
        return recetas.length;
    }

    parseMovimiento(raw) {
        const producto_id = Number(raw.producto_id);
        const cantidad = Number(raw.cantidad);
        const tipo = raw.tipo;

        if (!producto_id || !['entrada', 'salida'].includes(tipo) || !Number.isFinite(cantidad) || cantidad <= 0) {
            const err = new Error('Producto, tipo y cantidad mayor a 0 son requeridos.');
            err.status = 400;
            throw err;
        }

        return {
            producto_id,
            tipo,
            cantidad,
            motivo: raw.motivo || null
        };
    }

    deltaMovimiento(tipo, cantidad) {
        return tipo === 'entrada' ? Number(cantidad) : -Number(cantidad);
    }

    validarStockDisponible(productoId, delta) {
        const producto = productoRepository.getByIdRaw(productoId);
        if (!producto) {
            const err = new Error('Producto no encontrado.');
            err.status = 404;
            throw err;
        }

        const stockNuevo = Number(producto.stock_actual) + Number(delta);
        if (stockNuevo < 0) {
            const err = new Error(`Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock_actual} ${producto.unidad}.`);
            err.status = 400;
            throw err;
        }

        return { producto, stockNuevo };
    }

    aplicarDeltaStock(productoId, delta) {
        const { stockNuevo } = this.validarStockDisponible(productoId, delta);
        productoRepository.updateStock(productoId, Number(stockNuevo.toFixed(6)));
        return Number(stockNuevo.toFixed(6));
    }

    async registrarMovimientos(rawMovimientos, rawBody, usuarioId) {
        const entradas = Array.isArray(rawMovimientos) ? rawMovimientos : [rawBody];
        const movimientos = entradas.map(this.parseMovimiento);
        if (!movimientos.length) {
            const err = new Error('Agrega al menos un movimiento.');
            err.status = 400;
            throw err;
        }

        const stockPorProducto = new Map();
        for (const movimiento of movimientos) {
            const producto = productoRepository.getByIdRaw(movimiento.producto_id);
            if (!producto) {
                const err = new Error('Producto no encontrado.');
                err.status = 404;
                throw err;
            }

            const stockActual = stockPorProducto.has(movimiento.producto_id)
                ? stockPorProducto.get(movimiento.producto_id)
                : Number(producto.stock_actual);
            const nuevoStock = movimiento.tipo === 'entrada'
                ? stockActual + movimiento.cantidad
                : stockActual - movimiento.cantidad;

            if (nuevoStock < 0) {
                const err = new Error(`Stock insuficiente para ${producto.nombre}. Disponible: ${stockActual} ${producto.unidad}.`);
                err.status = 400;
                throw err;
            }

            stockPorProducto.set(movimiento.producto_id, nuevoStock);
            movimiento.stock_nuevo = nuevoStock;
        }

        db.transaction(() => {
            for (const movimiento of movimientos) {
                movimientoRepository.create({
                    producto_id: movimiento.producto_id,
                    tipo: movimiento.tipo,
                    cantidad: movimiento.cantidad,
                    motivo: movimiento.motivo,
                    usuario_id: usuarioId
                });
            }
            for (const [productoId, stockNuevo] of stockPorProducto.entries()) {
                productoRepository.updateStock(productoId, stockNuevo);
            }
        })();

        return {
            stock_nuevo: movimientos[movimientos.length - 1].stock_nuevo,
            movimientos: movimientos.map(m => ({
                producto_id: m.producto_id,
                tipo: m.tipo,
                cantidad: m.cantidad,
                stock_nuevo: m.stock_nuevo
            }))
        };
    }

    async getMovimientos(filters) {
        return movimientoRepository.getAll(filters);
    }

    async getMovimientosByProductoId(productoId) {
        return movimientoRepository.getByProductoId(productoId);
    }

    async updateMovimiento(id, data) {
        const nuevo = this.parseMovimiento(data);
        const actual = movimientoRepository.getById(id);
        if (!actual) {
            const err = new Error('Movimiento no encontrado.');
            err.status = 404;
            throw err;
        }

        let stockNuevo = null;
        db.transaction(() => {
            this.aplicarDeltaStock(actual.producto_id, -this.deltaMovimiento(actual.tipo, actual.cantidad));
            stockNuevo = this.aplicarDeltaStock(nuevo.producto_id, this.deltaMovimiento(nuevo.tipo, nuevo.cantidad));
            movimientoRepository.update(id, {
                producto_id: nuevo.producto_id,
                tipo: nuevo.tipo,
                cantidad: nuevo.cantidad,
                motivo: nuevo.motivo
            });
        })();

        return stockNuevo;
    }

    async deleteMovimiento(id) {
        const actual = movimientoRepository.getById(id);
        if (!actual) {
            const err = new Error('Movimiento no encontrado.');
            err.status = 404;
            throw err;
        }

        let stockNuevo = null;
        db.transaction(() => {
            stockNuevo = this.aplicarDeltaStock(actual.producto_id, -this.deltaMovimiento(actual.tipo, actual.cantidad));
            movimientoRepository.delete(id);
        })();

        return {
            producto_id: actual.producto_id,
            tipo: actual.tipo,
            cantidad: actual.cantidad,
            stock_nuevo: stockNuevo
        };
    }

    async getAlertasStock() {
        return productoRepository.getLowStock();
    }
}

module.exports = new InventarioService();
