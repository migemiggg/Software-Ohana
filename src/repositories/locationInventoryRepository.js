const db = require('../db/database');

class LocationInventoryRepository {
    getInventoryByLocation(locationId) {
        return db.prepare(`
            SELECT li.*,
                   p.nombre AS product_name,
                   p.unidad,
                   p.precio_unitario,
                   c.nombre AS categoria
            FROM location_inventory li
            JOIN productos p ON p.id = li.producto_id
            JOIN categorias c ON c.id = p.categoria_id
            WHERE li.location_id = ?
              AND lower(c.nombre) = lower('Productos')
            ORDER BY product_name
        `).all(locationId);
    }

    getById(id) {
        return db.prepare('SELECT * FROM location_inventory WHERE id = ?').get(id);
    }

    create({ location_id, producto_id, quantity, notes, image_url }) {
        return db.prepare(`
            INSERT INTO location_inventory (location_id, producto_id, quantity, notes, image_url)
            VALUES (?, ?, ?, ?, ?)
        `).run(location_id, producto_id, quantity, notes, image_url);
    }

    update(id, { producto_id, quantity, notes, image_url }) {
        return db.prepare(`
            UPDATE location_inventory
            SET producto_id = ?, quantity = ?, notes = ?, image_url = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(producto_id, quantity, notes, image_url, id);
    }

    delete(id) {
        return db.prepare('DELETE FROM location_inventory WHERE id = ?').run(id);
    }

    deleteByLocationId(locationId) {
        return db.prepare('DELETE FROM location_inventory WHERE location_id = ?').run(locationId);
    }

    createHistory({ inventory_id, location_id, product_name, old_quantity, new_quantity, notes, usuario_id }) {
        return db.prepare(`
            INSERT INTO location_inventory_history
                (inventory_id, location_id, product_name, old_quantity, new_quantity, notes, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(inventory_id, location_id, product_name, old_quantity, new_quantity, notes, usuario_id);
    }

    deleteHistoryByLocationId(locationId) {
        return db.prepare('DELETE FROM location_inventory_history WHERE location_id = ?').run(locationId);
    }

    getHistory() {
        return db.prepare(`
            SELECT h.*, l.name AS location_name, u.nombre AS usuario
            FROM location_inventory_history h
            LEFT JOIN locations l ON l.id = h.location_id
            LEFT JOIN usuarios u ON u.id = h.usuario_id
            ORDER BY h.changed_at DESC
            LIMIT 100
        `).all();
    }

    getStatsProducts() {
        return db.prepare(`
            SELECT COUNT(*) AS total
            FROM location_inventory li
            JOIN productos p ON p.id = li.producto_id
            JOIN categorias c ON c.id = p.categoria_id
            WHERE lower(c.nombre) = lower('Productos')
        `).get().total || 0;
    }

    getStatsUnits() {
        return db.prepare(`
            SELECT COALESCE(SUM(li.quantity), 0) AS total
            FROM location_inventory li
            JOIN productos p ON p.id = li.producto_id
            JOIN categorias c ON c.id = p.categoria_id
            WHERE lower(c.nombre) = lower('Productos')
        `).get().total || 0;
    }

    getStatsProductTypes() {
        return db.prepare(`
            SELECT COUNT(DISTINCT c.id) AS total
            FROM location_inventory li
            JOIN productos p ON p.id = li.producto_id
            JOIN categorias c ON c.id = p.categoria_id
        `).get().total || 0;
    }

    getProductTypes() {
        return db.prepare(`
            SELECT DISTINCT c.nombre AS product_type
            FROM location_inventory li
            JOIN productos p ON p.id = li.producto_id
            JOIN categorias c ON c.id = p.categoria_id
            WHERE c.nombre IS NOT NULL AND TRIM(c.nombre) <> ''
            ORDER BY product_type
        `).all();
    }
}

module.exports = new LocationInventoryRepository();
