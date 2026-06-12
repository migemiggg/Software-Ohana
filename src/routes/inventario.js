const express = require('express');
const db      = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

// Todos los endpoints requieren login
router.use(requireLogin);

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
        SELECT p.*, c.nombre AS categoria
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        ${where}
        ORDER BY p.nombre
    `).all(params);
    res.json(rows);
});

// Obtener un producto
router.get('/api/productos/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(row);
});

// Crear producto
router.post('/api/productos', (req, res) => {
    const { nombre, descripcion, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });

    const info = db.prepare(`
        INSERT INTO productos (nombre, descripcion, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nombre, descripcion || null, categoria_id || null,
           unidad || 'pza', stock_actual || 0, stock_minimo || 0, precio_unitario || 0);

    res.json({ ok: true, id: info.lastInsertRowid });
});

// Editar producto
router.put('/api/productos/:id', (req, res) => {
    const { nombre, descripcion, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario } = req.body;
    db.prepare(`
        UPDATE productos SET
            nombre = ?, descripcion = ?, categoria_id = ?, unidad = ?,
            stock_actual = ?, stock_minimo = ?, precio_unitario = ?,
            actualizado_en = datetime('now')
        WHERE id = ?
    `).run(nombre, descripcion || null, categoria_id || null, unidad,
           stock_actual, stock_minimo, precio_unitario, req.params.id);
    res.json({ ok: true });
});

// Eliminar producto
router.delete('/api/productos/:id', (req, res) => {
    db.prepare('DELETE FROM productos WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

/* ─── MOVIMIENTOS ─── */
// Registrar entrada o salida
router.post('/api/movimientos', (req, res) => {
    const { producto_id, tipo, cantidad, motivo } = req.body;
    if (!producto_id || !tipo || !cantidad) {
        return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(producto_id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' });

    const nuevoStock = tipo === 'entrada'
        ? producto.stock_actual + Number(cantidad)
        : producto.stock_actual - Number(cantidad);

    if (nuevoStock < 0) return res.status(400).json({ error: 'Stock insuficiente para la salida.' });

    db.transaction(() => {
        db.prepare(`
            INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(producto_id, tipo, cantidad, motivo || null, req.session.usuario.id);

        db.prepare(`UPDATE productos SET stock_actual = ?, actualizado_en = datetime('now') WHERE id = ?`)
          .run(nuevoStock, producto_id);
    })();

    res.json({ ok: true, stock_nuevo: nuevoStock });
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
