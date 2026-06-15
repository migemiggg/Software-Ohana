const db = require('../db/database');

class PedidoRepository {
    getAll() {
        return db.prepare(`
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
    }

    getById(id) {
        return db.prepare(`
            SELECT p.*,
                   c.nombre AS cliente_normalizado,
                   c.contacto AS cliente_contacto_normalizado,
                   l.name AS ubicacion_nombre,
                   l.address AS ubicacion_direccion
            FROM pedidos p
            LEFT JOIN clientes c ON c.id = p.cliente_id
            LEFT JOIN locations l ON l.id = p.location_id
            WHERE p.id = ?
        `).get(id);
    }

    getDetalles(pedidoId) {
        return db.prepare(`
            SELECT d.*, pr.nombre AS producto_nombre, pr.unidad
            FROM pedido_detalles d
            JOIN productos pr ON pr.id = d.producto_id
            WHERE d.pedido_id = ?
        `).all(pedidoId);
    }

    createPedidoTransaction(fn) {
        return db.transaction(fn);
    }

    create({ cliente_id, location_id, cliente_nombre, cliente_contacto, fecha_entrega, notas, total, usuario_id }) {
        return db.prepare(`
            INSERT INTO pedidos (cliente_id, location_id, cliente_nombre, cliente_contacto, fecha_entrega, notas, total, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(cliente_id, location_id, cliente_nombre, cliente_contacto, fecha_entrega, notas, total, usuario_id);
    }

    insertDetalle({ pedido_id, producto_id, cantidad, precio }) {
        return db.prepare(`
            INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio)
            VALUES (?, ?, ?, ?)
        `).run(pedido_id, producto_id, cantidad, precio);
    }

    updateEstado(id, estado) {
        return db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run(estado, id);
    }

    delete(id) {
        return db.prepare('DELETE FROM pedidos WHERE id = ?').run(id);
    }
}

module.exports = new PedidoRepository();
