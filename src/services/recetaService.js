const db = require('../db/database');
const recetaRepository = require('../repositories/recetaRepository');

class RecetaService {
    async getAll() {
        return recetaRepository.getAll();
    }

    async getById(id) {
        const receta = recetaRepository.getById(id);
        if (!receta) throw new Error('Receta no encontrada.');
        const ingredientes = recetaRepository.getIngredientes(id);
        return { ...receta, ingredientes };
    }

    parseIngredientes(ingredientes, productoTerminadoId) {
        if (!Array.isArray(ingredientes) || !ingredientes.length) {
            const err = new Error('Agrega al menos un ingrediente a la receta.');
            err.status = 400;
            throw err;
        }

        const agrupados = new Map();

        for (const ing of ingredientes) {
            const producto_id = Number(ing.producto_id);
            const cantidad = Number(ing.cantidad);
            if (!producto_id || !Number.isFinite(cantidad) || cantidad <= 0) {
                const err = new Error('Cada ingrediente necesita producto y cantidad mayor a 0.');
                err.status = 400;
                throw err;
            }
            if (String(producto_id) === String(productoTerminadoId)) {
                const err = new Error('El producto terminado no puede usarse como ingrediente de su propia receta.');
                err.status = 400;
                throw err;
            }

            const producto = recetaRepository.getProductoById(producto_id);
            if (!producto) {
                const err = new Error('Uno de los ingredientes no existe en inventario.');
                err.status = 400;
                throw err;
            }

            // Validar categoria
            const categoria = producto.categoria_id ? db.prepare('SELECT nombre FROM categorias WHERE id = ?').get(producto.categoria_id) : null;
            if (categoria?.nombre === 'Productos') {
                const err = new Error('Los ingredientes deben ser insumos, no productos terminados.');
                err.status = 400;
                throw err;
            }

            agrupados.set(producto_id, (agrupados.get(producto_id) || 0) + cantidad);
        }

        return [...agrupados.entries()].map(([producto_id, cantidad]) => ({
            producto_id,
            cantidad: Number(cantidad.toFixed(3))
        }));
    }

    getCategoriaId(nombre) {
        let categoria = recetaRepository.getCategoriaByName(nombre);
        if (!categoria) {
            const info = recetaRepository.createCategoria(nombre, nombre === 'Productos' ? 'Productos terminados para venta' : null);
            categoria = { id: info.lastInsertRowid };
        }
        return categoria.id;
    }

    calcularCostoUnitario(ingredientes, porcionesBase) {
        const costoTotal = ingredientes.reduce((total, ing) => {
            const producto = recetaRepository.getProductoById(ing.producto_id);
            return total + (Number(producto?.precio_unitario || 0) * Number(ing.cantidad));
        }, 0);
        return Number((costoTotal / porcionesBase).toFixed(2));
    }

    upsertProductoTerminado({ producto_id, nombre, descripcion, unidad, porcionesBase, ingredientes }) {
        const categoriaId = this.getCategoriaId('Productos');
        const costoUnitario = this.calcularCostoUnitario(ingredientes, porcionesBase);
        const unidadVenta = unidad || 'pza';

        let producto = producto_id
            ? recetaRepository.getProductoById(producto_id)
            : recetaRepository.getProductoTerminadoByName(nombre);

        if (producto) {
            recetaRepository.updateProductoTerminado(producto.id, {
                nombre,
                descripcion,
                categoriaId,
                unidad: unidadVenta,
                precioUnitario: costoUnitario
            });
            return { id: producto.id, costo_unitario: costoUnitario };
        }

        const info = recetaRepository.createProductoTerminado({
            nombre,
            descripcion,
            categoriaId,
            unidad: unidadVenta,
            precioUnitario: costoUnitario
        });
        return { id: info.lastInsertRowid, costo_unitario: costoUnitario };
    }

    async create({ nombre, descripcion, unidad, porciones, ingredientes }) {
        if (!nombre) throw new Error('El nombre es requerido.');
        const porcionesBase = Number(porciones);
        if (!Number.isFinite(porcionesBase) || porcionesBase <= 0) {
            throw new Error('La produccion base debe ser mayor a 0.');
        }

        const ingredientesNormalizados = this.parseIngredientes(ingredientes, null);

        const existente = recetaRepository.getByName(nombre);
        if (existente) throw new Error('Ya existe una receta con este nombre.');

        return recetaRepository.executeTransaction(() => {
            const producto = this.upsertProductoTerminado({
                nombre: nombre.trim(),
                descripcion,
                unidad,
                porcionesBase,
                ingredientes: ingredientesNormalizados
            });

            const recetaLigada = recetaRepository.getByProductoId(producto.id);
            if (recetaLigada) {
                const err = new Error('Este producto terminado ya tiene un registro ligado.');
                err.status = 400;
                throw err;
            }

            const info = recetaRepository.create({
                nombre: nombre.trim(),
                descripcion: descripcion || null,
                producto_id: producto.id,
                porciones: porcionesBase
            });

            const recetaId = info.lastInsertRowid;

            for (const ing of ingredientesNormalizados) {
                recetaRepository.insertIngrediente({
                    receta_id: recetaId,
                    producto_id: ing.producto_id,
                    cantidad: ing.cantidad
                });
            }

            return { recetaId, producto_id: producto.id, costo_unitario: producto.costo_unitario };
        });
    }

    async update(id, { nombre, descripcion, unidad, porciones, ingredientes }) {
        if (!nombre) throw new Error('El nombre es requerido.');
        const porcionesBase = Number(porciones);
        if (!Number.isFinite(porcionesBase) || porcionesBase <= 0) {
            throw new Error('La produccion base debe ser mayor a 0.');
        }

        const recetaActual = recetaRepository.getById(id);
        if (!recetaActual) throw new Error('Receta no encontrada.');

        const ingredientesNormalizados = this.parseIngredientes(ingredientes, recetaActual.producto_id);

        const existente = recetaRepository.getByNameExcludeId(nombre, id);
        if (existente) throw new Error('Ya existe una receta con este nombre.');

        return recetaRepository.executeTransaction(() => {
            const producto = this.upsertProductoTerminado({
                producto_id: recetaActual.producto_id,
                nombre: nombre.trim(),
                descripcion,
                unidad,
                porcionesBase,
                ingredientes: ingredientesNormalizados
            });

            recetaRepository.update(id, {
                nombre: nombre.trim(),
                descripcion: descripcion || null,
                producto_id: producto.id,
                porciones: porcionesBase
            });

            recetaRepository.deleteIngredientes(id);

            for (const ing of ingredientesNormalizados) {
                recetaRepository.insertIngrediente({
                    receta_id: id,
                    producto_id: ing.producto_id,
                    cantidad: ing.cantidad
                });
            }

            return { recetaId: id, producto_id: producto.id, costo_unitario: producto.costo_unitario };
        });
    }

    async calcular(id, porcionesRaw) {
        const porciones = parseFloat(porcionesRaw) || 1;
        const receta = recetaRepository.getById(id);
        if (!receta) throw new Error('Receta no encontrada.');

        const ingredientes = recetaRepository.getIngredientesWithPrice(id);
        const factor = porciones / receta.porciones;

        const resultado = ingredientes.map(ing => ({
            producto:      ing.producto,
            unidad:        ing.unidad,
            cantidad_base: ing.cantidad,
            cantidad_necesaria: +(ing.cantidad * factor).toFixed(3),
            stock_actual:  ing.stock_actual,
            suficiente:    ing.stock_actual >= ing.cantidad * factor,
            costo:         +(ing.precio_unitario * ing.cantidad * factor).toFixed(2)
        }));

        const costo_total = resultado.reduce((s, r) => s + r.costo, 0);

        return { receta: receta.nombre, porciones, ingredientes: resultado, costo_total: +costo_total.toFixed(2) };
    }

    async registrarProduccion(id, cantidad) {
        if (cantidad <= 0) throw new Error('La cantidad producida debe ser mayor a 0.');

        const receta = recetaRepository.getById(id);
        if (!receta) throw new Error('Receta no encontrada.');
        if (!receta.producto_id) throw new Error('Esta receta no tiene producto terminado asignado.');

        const ingredientes = recetaRepository.getIngredientes(id);
        if (!ingredientes.length) {
            throw new Error('Esta receta no tiene ingredientes para descontar.');
        }

        const factor = cantidad / receta.porciones;
        const calculados = ingredientes.map(ing => ({
            ...ing,
            cantidad_necesaria: +(ing.cantidad * factor).toFixed(3)
        }));

        const faltantes = calculados.filter(ing => Number(ing.stock_actual) < ing.cantidad_necesaria);
        if (faltantes.length) {
            const err = new Error('Inventario insuficiente para registrar la produccion.');
            err.faltantes = faltantes.map(f => ({
                producto: f.producto,
                necesario: f.cantidad_necesaria,
                stock_actual: f.stock_actual,
                unidad: f.unidad
            }));
            throw err;
        }

        recetaRepository.executeTransaction(() => {
            for (const ing of calculados) {
                db.prepare(`
                    UPDATE productos
                    SET stock_actual = stock_actual - ?, actualizado_en = datetime('now')
                    WHERE id = ?
                `).run(ing.cantidad_necesaria, ing.producto_id);

                db.prepare(`
                    INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
                    VALUES (?, 'salida', ?, ?, ?)
                `).run(ing.producto_id, ing.cantidad_necesaria, `Produccion: ${receta.nombre}`, 1); // fallback to system or req user
            }

            db.prepare(`
                UPDATE productos
                SET stock_actual = stock_actual + ?, actualizado_en = datetime('now')
                WHERE id = ?
            `).run(cantidad, receta.producto_id);

            db.prepare(`
                INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
                VALUES (?, 'entrada', ?, ?, ?)
            `).run(receta.producto_id, cantidad, `Producto terminado desde receta: ${receta.nombre}`, 1);
        })();

        return { producto_id: receta.producto_id, cantidad };
    }

    async delete(id) {
        const receta = recetaRepository.getById(id);
        if (!receta) throw new Error('Receta no encontrada.');

        recetaRepository.executeTransaction(() => {
            recetaRepository.deleteIngredientes(id);
            recetaRepository.delete(id);
            if (receta.producto_id) {
                recetaRepository.deleteProductoTerminado(receta.producto_id);
            }
        });

        return receta.producto_id;
    }
}

module.exports = new RecetaService();
