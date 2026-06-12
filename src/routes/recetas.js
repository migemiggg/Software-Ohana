const express = require('express');
const db      = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

router.use(requireLogin);

function parseIngredientes(ingredientes, productoTerminadoId) {
    // Aqui se limpian y validan los ingredientes antes de guardar la receta.
    // La regla importante es que una receta solo puede usar insumos, no productos terminados.
    if (!Array.isArray(ingredientes) || !ingredientes.length) {
        const err = new Error('Agrega al menos un ingrediente a la receta.');
        err.status = 400;
        throw err;
    }

    const getProducto = db.prepare(`
        SELECT p.id, p.nombre, c.nombre AS categoria
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.id = ?
    `);
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

        const producto = getProducto.get(producto_id);
        if (!producto) {
            const err = new Error('Uno de los ingredientes no existe en inventario.');
            err.status = 400;
            throw err;
        }
        if (producto.categoria === 'Productos') {
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

function handleError(res, error) {
    res.status(error.status || 500).json({ error: error.message || 'Error inesperado.' });
}

function getCategoriaId(nombre) {
    let categoria = db.prepare('SELECT id FROM categorias WHERE lower(nombre) = lower(?)').get(nombre);
    if (!categoria) {
        const info = db.prepare('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)')
            .run(nombre, nombre === 'Productos' ? 'Productos terminados para venta' : null);
        categoria = { id: info.lastInsertRowid };
    }
    return categoria.id;
}

function calcularCostoUnitario(ingredientes, porcionesBase) {
    // Este calculo arma el costo del producto terminado usando el precio de cada insumo.
    // Se divide entre la produccion base para obtener el costo por unidad vendible.
    const getProducto = db.prepare('SELECT precio_unitario FROM productos WHERE id = ?');
    const costoTotal = ingredientes.reduce((total, ing) => {
        const producto = getProducto.get(ing.producto_id);
        return total + (Number(producto?.precio_unitario || 0) * Number(ing.cantidad));
    }, 0);
    return Number((costoTotal / porcionesBase).toFixed(2));
}

function upsertProductoTerminado({ producto_id, nombre, descripcion, unidad, porcionesBase, ingredientes }) {
    // Esta funcion es el puente entre Registro de productos e Inventario.
    // Si la receta se crea o edita, aqui se crea/actualiza su producto terminado ligado.
    const categoriaId = getCategoriaId('Productos');
    const costoUnitario = calcularCostoUnitario(ingredientes, porcionesBase);
    const unidadVenta = unidad || 'pza';

    let producto = producto_id
        ? db.prepare('SELECT * FROM productos WHERE id = ?').get(producto_id)
        : db.prepare(`
            SELECT p.*
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE lower(p.nombre) = lower(?)
              AND lower(COALESCE(c.nombre, '')) = lower('Productos')
            LIMIT 1
        `).get(nombre);

    if (producto) {
        db.prepare(`
            UPDATE productos
            SET nombre = ?, descripcion = ?, categoria_id = ?, unidad = ?,
                stock_minimo = 0,
                precio_unitario = ?, actualizado_en = datetime('now')
            WHERE id = ?
        `).run(nombre, descripcion || null, categoriaId, unidadVenta, costoUnitario, producto.id);
        return { id: producto.id, costo_unitario: costoUnitario };
    }

    const info = db.prepare(`
        INSERT INTO productos (nombre, descripcion, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario)
        VALUES (?, ?, ?, ?, 0, 0, ?)
    `).run(nombre, descripcion || null, categoriaId, unidadVenta, costoUnitario);
    return { id: info.lastInsertRowid, costo_unitario: costoUnitario };
}

function eliminarProductoTerminado(productoId) {
    if (!productoId) return;
    db.prepare('DELETE FROM pedido_detalles WHERE producto_id = ?').run(productoId);
    db.prepare('DELETE FROM location_inventory WHERE producto_id = ?').run(productoId);
    db.prepare('DELETE FROM productos WHERE id = ?').run(productoId);
}

// Listar recetas
router.get('/api/recetas', (req, res) => {
    const rows = db.prepare(`
        SELECT r.*, p.nombre AS producto_nombre, p.unidad AS producto_unidad
        FROM recetas r
        LEFT JOIN productos p ON p.id = r.producto_id
        ORDER BY r.nombre
    `).all();
    res.json(rows);
});

// Obtener receta con ingredientes
router.get('/api/recetas/:id', (req, res) => {
    const receta = db.prepare(`
        SELECT r.*, p.nombre AS producto_nombre, p.unidad AS producto_unidad
        FROM recetas r
        LEFT JOIN productos p ON p.id = r.producto_id
        WHERE r.id = ?
    `).get(req.params.id);
    if (!receta) return res.status(404).json({ error: 'Receta no encontrada.' });

    const ingredientes = db.prepare(`
        SELECT ri.*, p.nombre AS producto, p.unidad, p.stock_actual
        FROM receta_ingredientes ri
        JOIN productos p ON p.id = ri.producto_id
        WHERE ri.receta_id = ?
    `).all(req.params.id);

    res.json({ ...receta, ingredientes });
});

// Crear receta
router.post('/api/recetas', (req, res) => {
    try {
        const { nombre, descripcion, unidad, porciones, ingredientes } = req.body;
        if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
        const porcionesBase = Number(porciones);
        if (!Number.isFinite(porcionesBase) || porcionesBase <= 0) {
            return res.status(400).json({ error: 'La produccion base debe ser mayor a 0.' });
        }

        const ingredientesNormalizados = parseIngredientes(ingredientes, null);

        // Validar que no exista una receta con el mismo nombre
        const existente = db.prepare('SELECT id FROM recetas WHERE LOWER(nombre) = LOWER(?)').get(nombre);
        if (existente) return res.status(400).json({ error: 'Ya existe una receta con este nombre.' });

        const result = db.transaction(() => {
            // Logica principal para agregar receta:
            // primero se asegura el producto terminado en inventario y despues se guardan sus ingredientes.
            const producto = upsertProductoTerminado({
                nombre: nombre.trim(),
                descripcion,
                unidad,
                porcionesBase,
                ingredientes: ingredientesNormalizados
            });

            const recetaLigada = db.prepare('SELECT id FROM recetas WHERE producto_id = ?').get(producto.id);
            if (recetaLigada) {
                const err = new Error('Este producto terminado ya tiene un registro ligado.');
                err.status = 400;
                throw err;
            }

            const info = db.prepare(`
                INSERT INTO recetas (nombre, descripcion, producto_id, porciones) VALUES (?, ?, ?, ?)
            `).run(nombre.trim(), descripcion || null, producto.id, porcionesBase);

            const recetaId = info.lastInsertRowid;

            const ins = db.prepare(`
                INSERT INTO receta_ingredientes (receta_id, producto_id, cantidad) VALUES (?, ?, ?)
            `);
            for (const ing of ingredientesNormalizados) {
                ins.run(recetaId, ing.producto_id, ing.cantidad);
            }

            return { recetaId, producto_id: producto.id, costo_unitario: producto.costo_unitario };
        })();

        res.json({ ok: true, id: result.recetaId, producto_id: result.producto_id, costo_unitario: result.costo_unitario });
    } catch (error) {
        handleError(res, error);
    }
});

// Editar receta
router.put('/api/recetas/:id', (req, res) => {
    try {
        const { nombre, descripcion, unidad, porciones, ingredientes } = req.body;
        if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
        const porcionesBase = Number(porciones);
        if (!Number.isFinite(porcionesBase) || porcionesBase <= 0) {
            return res.status(400).json({ error: 'La produccion base debe ser mayor a 0.' });
        }

        const recetaActual = db.prepare('SELECT * FROM recetas WHERE id = ?').get(req.params.id);
        if (!recetaActual) return res.status(404).json({ error: 'Receta no encontrada.' });

        const ingredientesNormalizados = parseIngredientes(ingredientes, recetaActual.producto_id);

        // Validar que no exista otra receta con el mismo nombre
        const existente = db.prepare('SELECT id FROM recetas WHERE LOWER(nombre) = LOWER(?) AND id != ?')
            .get(nombre, req.params.id);
        if (existente) return res.status(400).json({ error: 'Ya existe una receta con este nombre.' });

        const result = db.transaction(() => {
            const producto = upsertProductoTerminado({
                producto_id: recetaActual.producto_id,
                nombre: nombre.trim(),
                descripcion,
                unidad,
                porcionesBase,
                ingredientes: ingredientesNormalizados
            });

            db.prepare(`
                UPDATE recetas SET nombre = ?, descripcion = ?, producto_id = ?, porciones = ? WHERE id = ?
            `).run(nombre.trim(), descripcion || null, producto.id, porcionesBase, req.params.id);

            // Eliminar ingredientes anteriores
            db.prepare('DELETE FROM receta_ingredientes WHERE receta_id = ?').run(req.params.id);

            // Agregar nuevos ingredientes
            const ins = db.prepare(`
                INSERT INTO receta_ingredientes (receta_id, producto_id, cantidad) VALUES (?, ?, ?)
            `);
            for (const ing of ingredientesNormalizados) {
                ins.run(req.params.id, ing.producto_id, ing.cantidad);
            }

            return { recetaId: req.params.id, producto_id: producto.id, costo_unitario: producto.costo_unitario };
        })();

        res.json({ ok: true, id: result.recetaId, producto_id: result.producto_id, costo_unitario: result.costo_unitario });
    } catch (error) {
        handleError(res, error);
    }
});

// Calcular insumos necesarios para N porciones
router.get('/api/recetas/:id/calcular', (req, res) => {
    const porciones = parseFloat(req.query.porciones) || 1;
    const receta = db.prepare('SELECT * FROM recetas WHERE id = ?').get(req.params.id);
    if (!receta) return res.status(404).json({ error: 'Receta no encontrada.' });

    const ingredientes = db.prepare(`
        SELECT ri.*, p.nombre AS producto, p.unidad, p.stock_actual, p.precio_unitario
        FROM receta_ingredientes ri
        JOIN productos p ON p.id = ri.producto_id
        WHERE ri.receta_id = ?
    `).all(req.params.id);

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

    res.json({ receta: receta.nombre, porciones, ingredientes: resultado, costo_total: +costo_total.toFixed(2) });
});

// Registrar produccion: descuenta insumos y suma producto terminado
router.post('/api/recetas/:id/registrar', (req, res) => {
    const cantidad = parseFloat(req.body.cantidad) || 0;
    if (cantidad <= 0) return res.status(400).json({ error: 'La cantidad producida debe ser mayor a 0.' });

    const receta = db.prepare(`
        SELECT r.*, p.nombre AS producto_nombre, p.unidad AS producto_unidad
        FROM recetas r
        LEFT JOIN productos p ON p.id = r.producto_id
        WHERE r.id = ?
    `).get(req.params.id);
    if (!receta) return res.status(404).json({ error: 'Receta no encontrada.' });
    if (!receta.producto_id) return res.status(400).json({ error: 'Esta receta no tiene producto terminado asignado.' });

    const ingredientes = db.prepare(`
        SELECT ri.*, p.nombre AS producto, p.unidad, p.stock_actual
        FROM receta_ingredientes ri
        JOIN productos p ON p.id = ri.producto_id
        WHERE ri.receta_id = ?
    `).all(req.params.id);
    if (!ingredientes.length) {
        return res.status(400).json({ error: 'Esta receta no tiene ingredientes para descontar.' });
    }

    const factor = cantidad / receta.porciones;
    // El factor convierte la receta base a la cantidad real que se va a producir.
    // Ejemplo: si la base es 1 litro y produces 10, cada ingrediente se multiplica por 10.
    const calculados = ingredientes.map(ing => ({
        ...ing,
        cantidad_necesaria: +(ing.cantidad * factor).toFixed(3)
    }));

    const faltantes = calculados.filter(ing => Number(ing.stock_actual) < ing.cantidad_necesaria);
    if (faltantes.length) {
        return res.status(400).json({
            error: 'Inventario insuficiente para registrar la produccion.',
            faltantes: faltantes.map(f => ({
                producto: f.producto,
                necesario: f.cantidad_necesaria,
                stock_actual: f.stock_actual,
                unidad: f.unidad
            }))
        });
    }

    db.transaction(() => {
        // Produccion real: se descuentan insumos y se agrega el producto terminado.
        // Tambien se registra cada movimiento para que el historial explique de donde salio el stock.
        for (const ing of calculados) {
            db.prepare(`
                UPDATE productos
                SET stock_actual = stock_actual - ?, actualizado_en = datetime('now')
                WHERE id = ?
            `).run(ing.cantidad_necesaria, ing.producto_id);

            db.prepare(`
                INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
                VALUES (?, 'salida', ?, ?, ?)
            `).run(ing.producto_id, ing.cantidad_necesaria, `Produccion: ${receta.nombre}`, req.session.usuario.id);
        }

        db.prepare(`
            UPDATE productos
            SET stock_actual = stock_actual + ?, actualizado_en = datetime('now')
            WHERE id = ?
        `).run(cantidad, receta.producto_id);

        db.prepare(`
            INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
            VALUES (?, 'entrada', ?, ?, ?)
        `).run(receta.producto_id, cantidad, `Producto terminado desde receta: ${receta.nombre}`, req.session.usuario.id);
    })();

    res.json({ ok: true, producto_id: receta.producto_id, cantidad });
});

// Eliminar receta
router.delete('/api/recetas/:id', (req, res) => {
    const receta = db.prepare('SELECT * FROM recetas WHERE id = ?').get(req.params.id);
    if (!receta) return res.status(404).json({ error: 'Receta no encontrada.' });

    db.transaction(() => {
        db.prepare('DELETE FROM receta_ingredientes WHERE receta_id = ?').run(receta.id);
        db.prepare('DELETE FROM recetas WHERE id = ?').run(receta.id);
        eliminarProductoTerminado(receta.producto_id);
    })();

    res.json({ ok: true, producto_id: receta.producto_id });
});

module.exports = router;
