const express = require('express');
const db      = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

router.use(requireLogin);

// Listar pedidos
router.get('/api/pedidos', (req, res) => {
    const rows = db.prepare(`
        SELECT p.*,
               u.nombre AS usuario,
               c.nombre AS cliente_normalizado,
               c.contacto AS cliente_contacto_normalizado,
               l.name AS ubicacion_nombre,
               l.address AS ubicacion_direccion
        FROM pedidos p
        LEFT JOIN usuarios u ON u.id = p.usuario_id
        LEFT JOIN clientes c ON c.id = p.cliente_id
        LEFT JOIN locations l ON l.id = p.location_id
        ORDER BY p.fecha_pedido DESC
    `).all();
    res.json(rows);
});

// Obtener pedido con detalles
router.get('/api/pedidos/:id', (req, res) => {
    const pedido = db.prepare(`
        SELECT p.*,
               c.nombre AS cliente_normalizado,
               c.contacto AS cliente_contacto_normalizado,
               l.name AS ubicacion_nombre,
               l.address AS ubicacion_direccion
        FROM pedidos p
        LEFT JOIN clientes c ON c.id = p.cliente_id
        LEFT JOIN locations l ON l.id = p.location_id
        WHERE p.id = ?
    `).get(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });

    const detalles = db.prepare(`
        SELECT d.*, pr.nombre AS producto_nombre, pr.unidad
        FROM pedido_detalles d
        JOIN productos pr ON pr.id = d.producto_id
        WHERE d.pedido_id = ?
    `).all(req.params.id);

    res.json({ ...pedido, detalles });
});

// Crear pedido
router.post('/api/pedidos', (req, res) => {
    const { cliente_id, location_id, cliente_nombre, cliente_contacto, fecha_entrega, notas, detalles } = req.body;
    if ((!cliente_id && !cliente_nombre) || !detalles || !detalles.length) {
        return res.status(400).json({ error: 'Faltan datos del pedido.' });
    }

    for (const d of detalles) {
        const producto = db.prepare(`
            SELECT p.id, c.nombre AS categoria
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE p.id = ?
        `).get(d.producto_id);
        if (!producto || producto.categoria !== 'Productos') {
            return res.status(400).json({ error: 'Los pedidos solo pueden incluir productos terminados.' });
        }
    }

    const total = detalles.reduce((sum, d) => sum + d.cantidad * d.precio, 0);

    const result = db.transaction(() => {
        let cliente = cliente_id ? db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente_id) : null;
        if (!cliente && cliente_nombre) {
            cliente = db.prepare('SELECT * FROM clientes WHERE lower(nombre) = lower(?) LIMIT 1').get(cliente_nombre);
            if (!cliente) {
                const insertedCliente = db.prepare(`
                    INSERT INTO clientes (nombre, contacto)
                    VALUES (?, ?)
                `).run(cliente_nombre.trim(), cliente_contacto || null);
                cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(insertedCliente.lastInsertRowid);
            }
        }

        const info = db.prepare(`
            INSERT INTO pedidos (cliente_id, location_id, cliente_nombre, cliente_contacto, fecha_entrega, notas, total, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(cliente?.id || null, location_id || null, cliente?.nombre || cliente_nombre,
               cliente?.contacto || cliente_contacto || null, fecha_entrega || null,
               notas || null, total, req.session.usuario.id);

        const pedidoId = info.lastInsertRowid;

        const insertDetalle = db.prepare(`
            INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio)
            VALUES (?, ?, ?, ?)
        `);

        for (const d of detalles) {
            insertDetalle.run(pedidoId, d.producto_id, d.cantidad, d.precio);
        }

        return pedidoId;
    })();

    res.json({ ok: true, id: result });
});

// Actualizar estado del pedido
router.patch('/api/pedidos/:id/estado', (req, res) => {
    const { estado } = req.body;
    const estados = ['pendiente', 'en_proceso', 'entregado', 'cancelado'];
    if (!estados.includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido.' });
    }
    db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run(estado, req.params.id);
    res.json({ ok: true });
});

// Eliminar pedido
router.delete('/api/pedidos/:id', (req, res) => {
    db.prepare('DELETE FROM pedidos WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
