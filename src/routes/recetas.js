const express = require('express');
const db      = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

router.use(requireLogin);

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
    const { nombre, descripcion, producto_id, porciones, ingredientes } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
    if (!producto_id) return res.status(400).json({ error: 'Selecciona el producto terminado que produce la receta.' });

    const productoTerminado = db.prepare(`
        SELECT p.id, c.nombre AS categoria
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.id = ?
    `).get(producto_id);
    if (!productoTerminado || productoTerminado.categoria !== 'Productos') {
        return res.status(400).json({ error: 'La receta debe producir un producto de categoria Productos.' });
    }

    // Validar que no exista una receta con el mismo nombre
    const existente = db.prepare('SELECT id FROM recetas WHERE LOWER(nombre) = LOWER(?)').get(nombre);
    if (existente) return res.status(400).json({ error: 'Ya existe una receta con este nombre.' });

    const result = db.transaction(() => {
        const info = db.prepare(`
            INSERT INTO recetas (nombre, descripcion, producto_id, porciones) VALUES (?, ?, ?, ?)
        `).run(nombre, descripcion || null, producto_id || null, porciones || 1);

        const recetaId = info.lastInsertRowid;

        if (ingredientes && ingredientes.length) {
            const ins = db.prepare(`
                INSERT INTO receta_ingredientes (receta_id, producto_id, cantidad) VALUES (?, ?, ?)
            `);
            for (const ing of ingredientes) {
                ins.run(recetaId, ing.producto_id, ing.cantidad);
            }
        }

        return recetaId;
    })();

    res.json({ ok: true, id: result });
});

// Editar receta
router.put('/api/recetas/:id', (req, res) => {
    const { nombre, descripcion, producto_id, porciones, ingredientes } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
    if (!producto_id) return res.status(400).json({ error: 'Selecciona el producto terminado que produce la receta.' });

    const productoTerminado = db.prepare(`
        SELECT p.id, c.nombre AS categoria
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.id = ?
    `).get(producto_id);
    if (!productoTerminado || productoTerminado.categoria !== 'Productos') {
        return res.status(400).json({ error: 'La receta debe producir un producto de categoria Productos.' });
    }

    // Validar que no exista otra receta con el mismo nombre
    const existente = db.prepare('SELECT id FROM recetas WHERE LOWER(nombre) = LOWER(?) AND id != ?')
        .get(nombre, req.params.id);
    if (existente) return res.status(400).json({ error: 'Ya existe una receta con este nombre.' });

    const result = db.transaction(() => {
        db.prepare(`
            UPDATE recetas SET nombre = ?, descripcion = ?, producto_id = ?, porciones = ? WHERE id = ?
        `).run(nombre, descripcion || null, producto_id || null, porciones || 1, req.params.id);

        // Eliminar ingredientes anteriores
        db.prepare('DELETE FROM receta_ingredientes WHERE receta_id = ?').run(req.params.id);

        // Agregar nuevos ingredientes
        if (ingredientes && ingredientes.length) {
            const ins = db.prepare(`
                INSERT INTO receta_ingredientes (receta_id, producto_id, cantidad) VALUES (?, ?, ?)
            `);
            for (const ing of ingredientes) {
                ins.run(req.params.id, ing.producto_id, ing.cantidad);
            }
        }

        return req.params.id;
    })();

    res.json({ ok: true, id: result });
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

    const factor = cantidad / receta.porciones;
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
    db.prepare('DELETE FROM recetas WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
