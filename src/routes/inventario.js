const express = require('express');
const db      = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

// Todos los endpoints requieren login
router.use(requireLogin);

function parseMovimiento(raw) {
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

function handleError(res, error) {
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Error inesperado.' });
}

function deltaMovimiento(tipo, cantidad) {
    return tipo === 'entrada' ? Number(cantidad) : -Number(cantidad);
}

function validarStockDisponible(productoId, delta) {
    const producto = db.prepare('SELECT id, nombre, unidad, stock_actual FROM productos WHERE id = ?').get(productoId);
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

function aplicarDeltaStock(productoId, delta) {
    const { stockNuevo } = validarStockDisponible(productoId, delta);
    db.prepare(`
        UPDATE productos
        SET stock_actual = ?, actualizado_en = datetime('now')
        WHERE id = ?
    `).run(Number(stockNuevo.toFixed(6)), productoId);
    return Number(stockNuevo.toFixed(6));
}

function normalizarProductoInventario(data) {
    const categoria = data.categoria_id
        ? db.prepare('SELECT nombre FROM categorias WHERE id = ?').get(data.categoria_id)
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

/* ─── CATEGORÍAS ─── */
router.get('/api/categorias', (req, res) => {
    const rows = db.prepare('SELECT * FROM categorias ORDER BY nombre').all();
    res.json(rows);
});

/* ─── PRODUCTOS ─── */
// Listar todos los productos
router.get('/api/productos', (req, res) => {
    const { categoria } = req.query;
    const params = [];
    let where = '';

    if (categoria) {
        where = 'WHERE lower(c.nombre) = lower(?)';
        params.push(categoria);
    }

    const rows = db.prepare(`
        SELECT p.*, c.nombre AS categoria,
               r.id AS receta_id,
               CASE WHEN r.id IS NULL THEN 0 ELSE 1 END AS ligado_registro
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN recetas r ON r.producto_id = p.id
        ${where}
        GROUP BY p.id
        ORDER BY p.nombre
    `).all(params);
    res.json(rows);
});

// Obtener un producto
router.get('/api/productos/:id', (req, res) => {
    const row = db.prepare(`
        SELECT p.*, c.nombre AS categoria,
               r.id AS receta_id,
               CASE WHEN r.id IS NULL THEN 0 ELSE 1 END AS ligado_registro
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN recetas r ON r.producto_id = p.id
        WHERE p.id = ?
        GROUP BY p.id
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(row);
});

// Crear producto
router.post('/api/productos', (req, res) => {
    const { nombre, descripcion, categoria_id } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
    const producto = normalizarProductoInventario(req.body);

    const info = db.prepare(`
        INSERT INTO productos (nombre, descripcion, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nombre, descripcion || null, categoria_id || null,
           producto.unidad, producto.stock_actual, producto.stock_minimo, producto.precio_unitario);

    res.json({ ok: true, id: info.lastInsertRowid });
});

// Editar producto
router.put('/api/productos/:id', (req, res) => {
    const { nombre, descripcion, categoria_id } = req.body;
    const producto = normalizarProductoInventario(req.body);
    db.prepare(`
        UPDATE productos SET
            nombre = ?, descripcion = ?, categoria_id = ?, unidad = ?,
            stock_actual = ?, stock_minimo = ?, precio_unitario = ?,
            actualizado_en = datetime('now')
        WHERE id = ?
    `).run(nombre, descripcion || null, categoria_id || null, producto.unidad,
           producto.stock_actual, producto.stock_minimo, producto.precio_unitario, req.params.id);
    res.json({ ok: true });
});

// Eliminar producto
router.delete('/api/productos/:id', (req, res) => {
    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
    if (!producto) return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });

    const recetas = db.prepare('SELECT id FROM recetas WHERE producto_id = ?').all(req.params.id);
    db.transaction(() => {
        for (const receta of recetas) {
            db.prepare('DELETE FROM receta_ingredientes WHERE receta_id = ?').run(receta.id);
        }
        db.prepare('DELETE FROM recetas WHERE producto_id = ?').run(req.params.id);
        db.prepare('DELETE FROM receta_ingredientes WHERE producto_id = ?').run(req.params.id);
        db.prepare('DELETE FROM pedido_detalles WHERE producto_id = ?').run(req.params.id);
        db.prepare('DELETE FROM location_inventory WHERE producto_id = ?').run(req.params.id);
        db.prepare('DELETE FROM productos WHERE id = ?').run(req.params.id);
    })();
    res.json({ ok: true, recetas_eliminadas: recetas.length });
});

/* ─── MOVIMIENTOS ─── */
// Registrar entrada o salida
router.post('/api/movimientos', (req, res) => {
    try {
        const entradas = Array.isArray(req.body.movimientos) ? req.body.movimientos : [req.body];
        const movimientos = entradas.map(parseMovimiento);
        if (!movimientos.length) {
            return res.status(400).json({ ok: false, error: 'Agrega al menos un movimiento.' });
        }

        const stockPorProducto = new Map();
        for (const movimiento of movimientos) {
            const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(movimiento.producto_id);
            if (!producto) throw Object.assign(new Error('Producto no encontrado.'), { status: 404 });

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
            const insertMovimiento = db.prepare(`
                INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
                VALUES (?, ?, ?, ?, ?)
            `);
            const updateStock = db.prepare(`
                UPDATE productos SET stock_actual = ?, actualizado_en = datetime('now') WHERE id = ?
            `);

            // Aqui se registra la evidencia del movimiento y hasta despues se deja el stock final.
            // Asi el profesor puede ver que el historial y el inventario se actualizan juntos.
            for (const movimiento of movimientos) {
                insertMovimiento.run(
                    movimiento.producto_id,
                    movimiento.tipo,
                    movimiento.cantidad,
                    movimiento.motivo,
                    req.session.usuario.id
                );
            }
            for (const [productoId, stockNuevo] of stockPorProducto.entries()) {
                updateStock.run(stockNuevo, productoId);
            }
        })();

        res.json({
            ok: true,
            stock_nuevo: movimientos[movimientos.length - 1].stock_nuevo,
            movimientos: movimientos.map(m => ({
                producto_id: m.producto_id,
                tipo: m.tipo,
                cantidad: m.cantidad,
                stock_nuevo: m.stock_nuevo
            }))
        });
    } catch (error) {
        handleError(res, error);
    }
});

// Historial general de movimientos
router.get('/api/movimientos', (req, res) => {
    const { producto_id = '', q = '', limit = 150 } = req.query;
    const params = [];
    let where = 'WHERE 1 = 1';

    if (producto_id) {
        where += ' AND m.producto_id = ?';
        params.push(producto_id);
    }
    if (q.trim()) {
        where += ' AND (lower(p.nombre) LIKE ? OR lower(COALESCE(m.motivo, "")) LIKE ?)';
        params.push(`%${q.trim().toLowerCase()}%`, `%${q.trim().toLowerCase()}%`);
    }

    const rows = db.prepare(`
        SELECT m.*, p.nombre AS producto_nombre, p.unidad, c.nombre AS categoria, u.nombre AS usuario
        FROM movimientos_inventario m
        JOIN productos p ON p.id = m.producto_id
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN usuarios u ON u.id = m.usuario_id
        ${where}
        ORDER BY m.fecha DESC, m.id DESC
        LIMIT ?
    `).all([...params, Math.min(Number(limit) || 150, 500)]);
    res.json(rows);
});

// Editar movimiento y recalcular el stock que provocaba ese movimiento
router.put('/api/movimientos/:id', (req, res) => {
    try {
        const nuevo = parseMovimiento(req.body);
        const actual = db.prepare('SELECT * FROM movimientos_inventario WHERE id = ?').get(req.params.id);
        if (!actual) return res.status(404).json({ ok: false, error: 'Movimiento no encontrado.' });

        db.transaction(() => {
            // Primero se cancela el efecto anterior. Despues se aplica el nuevo dato editado.
            // Esta es la parte clave para que editar historial no deje el stock mentiroso.
            aplicarDeltaStock(actual.producto_id, -deltaMovimiento(actual.tipo, actual.cantidad));
            const stockNuevo = aplicarDeltaStock(nuevo.producto_id, deltaMovimiento(nuevo.tipo, nuevo.cantidad));

            db.prepare(`
                UPDATE movimientos_inventario
                SET producto_id = ?, tipo = ?, cantidad = ?, motivo = ?
                WHERE id = ?
            `).run(nuevo.producto_id, nuevo.tipo, nuevo.cantidad, nuevo.motivo, req.params.id);

            nuevo.stock_nuevo = stockNuevo;
        })();

        res.json({ ok: true, stock_nuevo: nuevo.stock_nuevo });
    } catch (error) {
        handleError(res, error);
    }
});

// Eliminar movimiento revirtiendo su efecto del inventario
router.delete('/api/movimientos/:id', (req, res) => {
    try {
        const actual = db.prepare('SELECT * FROM movimientos_inventario WHERE id = ?').get(req.params.id);
        if (!actual) return res.status(404).json({ ok: false, error: 'Movimiento no encontrado.' });

        db.transaction(() => {
            // Borrar un movimiento tambien regresa el stock a como estaba antes de ese registro.
            aplicarDeltaStock(actual.producto_id, -deltaMovimiento(actual.tipo, actual.cantidad));
            db.prepare('DELETE FROM movimientos_inventario WHERE id = ?').run(req.params.id);
        })();

        res.json({ ok: true });
    } catch (error) {
        handleError(res, error);
    }
});

// Historial de movimientos de un producto
router.get('/api/movimientos/:producto_id', (req, res) => {
    const rows = db.prepare(`
        SELECT m.*, u.nombre AS usuario
        FROM movimientos_inventario m
        LEFT JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.producto_id = ?
        ORDER BY m.fecha DESC
        LIMIT 50
    `).all(req.params.producto_id);
    res.json(rows);
});

/* ─── ALERTAS DE STOCK BAJO ─── */
router.get('/api/alertas/stock', (req, res) => {
    const rows = db.prepare(`
        SELECT * FROM productos
        WHERE stock_actual <= stock_minimo
        ORDER BY nombre
    `).all();
    res.json(rows);
});

module.exports = router;
