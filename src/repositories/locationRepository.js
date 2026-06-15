const db = require('../db/database');

class LocationRepository {
    getById(id) {
        return db.prepare(`
            SELECT l.*,
                   GROUP_CONCAT(c.nombre, ', ') AS clientes
            FROM locations l
            LEFT JOIN cliente_locations cl ON cl.location_id = l.id
            LEFT JOIN clientes c ON c.id = cl.cliente_id
            WHERE l.id = ?
            GROUP BY l.id
        `).get(id);
    }

    getByIdRaw(id) {
        return db.prepare('SELECT id FROM locations WHERE id = ?').get(id);
    }

    create({ name, address, latitude, longitude, description }) {
        return db.prepare(`
            INSERT INTO locations (name, address, latitude, longitude, description)
            VALUES (?, ?, ?, ?, ?)
        `).run(name, address, latitude, longitude, description);
    }

    update(id, { name, address, latitude, longitude, description }) {
        return db.prepare(`
            UPDATE locations
            SET name = ?, address = ?, latitude = ?, longitude = ?, description = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(name, address, latitude, longitude, description, id);
    }

    delete(id) {
        return db.prepare('DELETE FROM locations WHERE id = ?').run(id);
    }

    linkCliente(clienteId, locationId) {
        return db.prepare(`
            INSERT OR IGNORE INTO cliente_locations (cliente_id, location_id)
            VALUES (?, ?)
        `).run(clienteId, locationId);
    }

    unlinkClienteByLocation(locationId) {
        return db.prepare('DELETE FROM cliente_locations WHERE location_id = ?').run(locationId);
    }

    getAll(whereClause, params) {
        return db.prepare(`
            SELECT l.*,
                   GROUP_CONCAT(DISTINCT c.nombre) AS clientes,
                   (
                       SELECT COUNT(*)
                       FROM location_inventory li2
                       JOIN productos p2 ON p2.id = li2.producto_id
                       JOIN categorias c2 ON c2.id = p2.categoria_id
                       WHERE li2.location_id = l.id
                         AND lower(c2.nombre) = lower('Productos')
                   ) AS product_count,
                   (
                       SELECT COALESCE(SUM(li3.quantity), 0)
                       FROM location_inventory li3
                       JOIN productos p3 ON p3.id = li3.producto_id
                       JOIN categorias c3 ON c3.id = p3.categoria_id
                       WHERE li3.location_id = l.id
                         AND lower(c3.nombre) = lower('Productos')
                   ) AS total_quantity
             FROM locations l
             LEFT JOIN cliente_locations cl ON cl.location_id = l.id
             LEFT JOIN clientes c ON c.id = cl.cliente_id
             WHERE 1 = 1 ${whereClause}
             GROUP BY l.id
             ORDER BY l.name
        `).all(params);
    }

    getLocationStats() {
        return db.prepare('SELECT COUNT(*) AS total FROM locations').get().total || 0;
    }

    getOrdersForLocation(locationId) {
        return db.prepare(`
            SELECT p.id AS pedido_id,
                   p.estado,
                   p.fecha_entrega,
                   pr.nombre AS producto,
                   pr.unidad,
                   d.cantidad
            FROM pedidos p
            JOIN pedido_detalles d ON d.pedido_id = p.id
            JOIN productos pr ON pr.id = d.producto_id
            JOIN categorias cat ON cat.id = pr.categoria_id
            WHERE p.location_id = ?
              AND p.estado <> 'cancelado'
              AND lower(cat.nombre) = lower('Productos')
            ORDER BY p.fecha_pedido DESC
            LIMIT 20
        `).all(locationId);
    }
}

module.exports = new LocationRepository();
