const express = require('express');
const db = require('../db/database');
const { requireLogin, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(requireLogin);

function numberOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function getLocationWithInventory(id) {
    const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
    if (!location) return null;
    location.inventory = db.prepare(`
        SELECT *
        FROM location_inventory
        WHERE location_id = ?
        ORDER BY product_name
    `).all(id);
    return location;
}

router.get('/api/mapa-inventario/stats', (req, res) => {
    const locations = db.prepare('SELECT COUNT(*) AS total FROM locations').get().total || 0;
    const products = db.prepare('SELECT COUNT(*) AS total FROM location_inventory').get().total || 0;
    const units = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS total FROM location_inventory').get().total || 0;
    const categories = db.prepare(`
        SELECT COUNT(DISTINCT category) AS total
        FROM location_inventory
        WHERE category IS NOT NULL AND TRIM(category) <> ''
    `).get().total || 0;
    res.json({ locations, products, units, categories });
});

router.get('/api/mapa-inventario/locations', (req, res) => {
    const { q = '', category = '' } = req.query;
    const params = [];
    let where = '';

    if (q.trim()) {
        where += ` AND EXISTS (
            SELECT 1 FROM location_inventory li
            WHERE li.location_id = l.id AND lower(li.product_name) LIKE ?
        )`;
        params.push(`%${q.trim().toLowerCase()}%`);
    }

    if (category.trim()) {
        where += ` AND EXISTS (
            SELECT 1 FROM location_inventory li
            WHERE li.location_id = l.id AND lower(li.category) = ?
        )`;
        params.push(category.trim().toLowerCase());
    }

    const locations = db.prepare(`
        SELECT l.*,
               COUNT(li.id) AS product_count,
               COALESCE(SUM(li.quantity), 0) AS total_quantity
        FROM locations l
        LEFT JOIN location_inventory li ON li.location_id = l.id
        WHERE 1 = 1 ${where}
        GROUP BY l.id
        ORDER BY l.name
    `).all(params);

    const inventoryStmt = db.prepare(`
        SELECT *
        FROM location_inventory
        WHERE location_id = ?
        ORDER BY product_name
    `);

    res.json(locations.map(location => ({
        ...location,
        inventory: inventoryStmt.all(location.id)
    })));
});

router.get('/api/mapa-inventario/locations/:id', (req, res) => {
    const location = getLocationWithInventory(req.params.id);
    if (!location) return res.status(404).json({ error: 'Ubicacion no encontrada.' });
    res.json(location);
});

router.post('/api/mapa-inventario/locations', requireRoles('admin'), (req, res) => {
    const { name, address, description } = req.body;
    const latitude = numberOrNull(req.body.latitude);
    const longitude = numberOrNull(req.body.longitude);

    if (!name || !address || latitude === null || longitude === null) {
        return res.status(400).json({ error: 'Nombre, direccion, latitud y longitud son requeridos.' });
    }

    const info = db.prepare(`
        INSERT INTO locations (name, address, latitude, longitude, description)
        VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), address.trim(), latitude, longitude, description || null);

    res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/api/mapa-inventario/locations/:id', requireRoles('admin'), (req, res) => {
    const { name, address, description } = req.body;
    const latitude = numberOrNull(req.body.latitude);
    const longitude = numberOrNull(req.body.longitude);

    if (!name || !address || latitude === null || longitude === null) {
        return res.status(400).json({ error: 'Nombre, direccion, latitud y longitud son requeridos.' });
    }

    db.prepare(`
        UPDATE locations
        SET name = ?, address = ?, latitude = ?, longitude = ?, description = ?, updated_at = datetime('now')
        WHERE id = ?
    `).run(name.trim(), address.trim(), latitude, longitude, description || null, req.params.id);

    res.json({ ok: true });
});

router.delete('/api/mapa-inventario/locations/:id', requireRoles('admin'), (req, res) => {
    db.transaction(() => {
        db.prepare('DELETE FROM location_inventory WHERE location_id = ?').run(req.params.id);
        db.prepare('DELETE FROM location_inventory_history WHERE location_id = ?').run(req.params.id);
        db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
    })();
    res.json({ ok: true });
});

router.post('/api/mapa-inventario/inventory', requireRoles('admin'), (req, res) => {
    const { location_id, product_name, category, notes, image_url } = req.body;
    const quantity = numberOrNull(req.body.quantity);

    if (!location_id || !product_name || quantity === null) {
        return res.status(400).json({ error: 'Ubicacion, producto y cantidad son requeridos.' });
    }

    const location = db.prepare('SELECT id FROM locations WHERE id = ?').get(location_id);
    if (!location) return res.status(404).json({ error: 'Ubicacion no encontrada.' });

    let newId = null;
    db.transaction(() => {
        const info = db.prepare(`
            INSERT INTO location_inventory (location_id, product_name, category, quantity, notes, image_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(location_id, product_name.trim(), category || null, quantity, notes || null, image_url || null);
        newId = info.lastInsertRowid;

        db.prepare(`
            INSERT INTO location_inventory_history
                (inventory_id, location_id, product_name, old_quantity, new_quantity, notes, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(newId, location_id, product_name.trim(), null, quantity, 'Alta de inventario', req.session.usuario.id);
    })();

    res.json({ ok: true, id: newId });
});

router.put('/api/mapa-inventario/inventory/:id', requireRoles('admin'), (req, res) => {
    const { product_name, category, notes, image_url } = req.body;
    const quantity = numberOrNull(req.body.quantity);
    if (!product_name || quantity === null) {
        return res.status(400).json({ error: 'Producto y cantidad son requeridos.' });
    }

    const current = db.prepare('SELECT * FROM location_inventory WHERE id = ?').get(req.params.id);
    if (!current) return res.status(404).json({ error: 'Inventario no encontrado.' });

    db.transaction(() => {
        db.prepare(`
            UPDATE location_inventory
            SET product_name = ?, category = ?, quantity = ?, notes = ?, image_url = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(product_name.trim(), category || null, quantity, notes || null, image_url || null, req.params.id);

        db.prepare(`
            INSERT INTO location_inventory_history
                (inventory_id, location_id, product_name, old_quantity, new_quantity, notes, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.params.id, current.location_id, product_name.trim(), current.quantity, quantity, notes || 'Actualizacion de cantidad', req.session.usuario.id);
    })();

    res.json({ ok: true });
});

router.delete('/api/mapa-inventario/inventory/:id', requireRoles('admin'), (req, res) => {
    db.prepare('DELETE FROM location_inventory WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

router.get('/api/mapa-inventario/history', (req, res) => {
    const rows = db.prepare(`
        SELECT h.*, l.name AS location_name, u.nombre AS usuario
        FROM location_inventory_history h
        LEFT JOIN locations l ON l.id = h.location_id
        LEFT JOIN usuarios u ON u.id = h.usuario_id
        ORDER BY h.changed_at DESC
        LIMIT 100
    `).all();
    res.json(rows);
});

router.get('/api/mapa-inventario/categories', (req, res) => {
    const rows = db.prepare(`
        SELECT DISTINCT category
        FROM location_inventory
        WHERE category IS NOT NULL AND TRIM(category) <> ''
        ORDER BY category
    `).all();
    res.json(rows.map(r => r.category));
});

module.exports = router;
