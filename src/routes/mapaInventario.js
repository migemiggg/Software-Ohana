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
    const location = db.prepare(`
        SELECT l.*,
               MIN(c.id) AS cliente_id,
               GROUP_CONCAT(DISTINCT c.id) AS cliente_ids,
               GROUP_CONCAT(c.nombre, ', ') AS clientes
        FROM locations l
        LEFT JOIN cliente_locations cl ON cl.location_id = l.id
        LEFT JOIN clientes c ON c.id = cl.cliente_id
        WHERE l.id = ?
        GROUP BY l.id
    `).get(id);
    if (!location) return null;
    location.inventory = db.prepare(`
        SELECT li.*,
               COALESCE(p.nombre, li.product_name) AS product_name,
               p.unidad,
               p.precio_unitario,
               c.nombre AS categoria
        FROM location_inventory li
        LEFT JOIN productos p ON p.id = li.producto_id
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE li.location_id = ?
          AND lower(COALESCE(c.nombre, '')) = lower('Productos')
        ORDER BY product_name
    `).all(id);
    return location;
}

router.get('/api/mapa-inventario/stats', (req, res) => {
    const locations = db.prepare('SELECT COUNT(*) AS total FROM locations').get().total || 0;
    const products = db.prepare(`
        SELECT COUNT(*) AS total
        FROM location_inventory li
        JOIN productos p ON p.id = li.producto_id
        JOIN categorias c ON c.id = p.categoria_id
        WHERE lower(c.nombre) = lower('Productos')
    `).get().total || 0;
    const units = db.prepare(`
        SELECT COALESCE(SUM(li.quantity), 0) AS total
        FROM location_inventory li
        JOIN productos p ON p.id = li.producto_id
        JOIN categorias c ON c.id = p.categoria_id
        WHERE lower(c.nombre) = lower('Productos')
    `).get().total || 0;
    const clients = db.prepare('SELECT COUNT(*) AS total FROM clientes').get().total || 0;
    const productTypes = db.prepare(`
        SELECT COUNT(DISTINCT product_type) AS total
        FROM location_inventory
        WHERE product_type IS NOT NULL AND TRIM(product_type) <> ''
    `).get().total || 0;
    res.json({ locations, products, units, productTypes, clients });
});

router.get('/api/mapa-inventario/locations', (req, res) => {
    const { q = '', product_type = '', presentation = '', cliente_id = '' } = req.query;
    const params = [];
    let where = '';

    if (q.trim()) {
        where += ` AND EXISTS (
            SELECT 1 FROM location_inventory li
            LEFT JOIN productos p ON p.id = li.producto_id
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE li.location_id = l.id
              AND lower(COALESCE(c.nombre, '')) = lower('Productos')
              AND lower(COALESCE(p.nombre, li.product_name)) LIKE ?
        )`;
        params.push(`%${q.trim().toLowerCase()}%`);
    }

    if (product_type.trim()) {
        where += ` AND EXISTS (
            SELECT 1 FROM location_inventory li
            WHERE li.location_id = l.id AND lower(li.product_type) = ?
        )`;
        params.push(product_type.trim().toLowerCase());
    }

    if (presentation.trim()) {
        where += ` AND EXISTS (
            SELECT 1 FROM location_inventory li
            WHERE li.location_id = l.id AND lower(li.presentation) = ?
        )`;
        params.push(presentation.trim().toLowerCase());
    }

    if (cliente_id) {
        where += ` AND EXISTS (
            SELECT 1 FROM cliente_locations cl
            WHERE cl.location_id = l.id AND cl.cliente_id = ?
        )`;
        params.push(cliente_id);
    }

    const locations = db.prepare(`
        SELECT l.*,
               MIN(c.id) AS cliente_id,
               GROUP_CONCAT(DISTINCT c.id) AS cliente_ids,
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
        WHERE 1 = 1 ${where}
        GROUP BY l.id
        ORDER BY l.name
    `).all(params);

    const inventoryStmt = db.prepare(`
        SELECT li.*,
               COALESCE(p.nombre, li.product_name) AS product_name,
               p.unidad,
               p.precio_unitario,
               c.nombre AS categoria
        FROM location_inventory li
        LEFT JOIN productos p ON p.id = li.producto_id
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE li.location_id = ?
          AND lower(COALESCE(c.nombre, '')) = lower('Productos')
        ORDER BY product_name
    `);

    const ordersStmt = db.prepare(`
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
          AND p.estado NOT IN ('cancelado', 'entregado')
          AND lower(cat.nombre) = lower('Productos')
        ORDER BY p.fecha_pedido DESC
        LIMIT 20
    `);

    res.json(locations.map(location => ({
        ...location,
        inventory: inventoryStmt.all(location.id),
        orders: ordersStmt.all(location.id)
    })));
});

router.get('/api/mapa-inventario/locations/:id', (req, res) => {
    const location = getLocationWithInventory(req.params.id);
    if (!location) return res.status(404).json({ error: 'Ubicacion no encontrada.' });
    res.json(location);
});

router.post('/api/mapa-inventario/locations', requireRoles('admin'), (req, res) => {
    const { name, address, description, cliente_id } = req.body;
    const latitude = numberOrNull(req.body.latitude);
    const longitude = numberOrNull(req.body.longitude);

    if (!cliente_id || !name || !address || latitude === null || longitude === null) {
        return res.status(400).json({ error: 'Cliente, nombre, direccion, latitud y longitud son requeridos.' });
    }

    const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado.' });

    const info = db.transaction(() => {
        const inserted = db.prepare(`
            INSERT INTO locations (name, address, latitude, longitude, description)
            VALUES (?, ?, ?, ?, ?)
        `).run(name.trim(), address.trim(), latitude, longitude, description || null);

        db.prepare(`
            INSERT OR IGNORE INTO cliente_locations (cliente_id, location_id)
            VALUES (?, ?)
        `).run(cliente_id, inserted.lastInsertRowid);
        db.prepare(`
            UPDATE pedidos
            SET location_id = ?
            WHERE cliente_id = ?
              AND location_id IS NULL
        `).run(inserted.lastInsertRowid, cliente_id);
        db.prepare('UPDATE clientes SET actualizado_en = datetime("now") WHERE id = ?').run(cliente_id);

        return inserted;
    })();

    res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/api/mapa-inventario/locations/:id', requireRoles('admin'), (req, res) => {
    const { name, address, description, cliente_id } = req.body;
    const latitude = numberOrNull(req.body.latitude);
    const longitude = numberOrNull(req.body.longitude);

    if (!cliente_id || !name || !address || latitude === null || longitude === null) {
        return res.status(400).json({ error: 'Cliente, nombre, direccion, latitud y longitud son requeridos.' });
    }

    const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado.' });

    db.transaction(() => {
        db.prepare(`
            UPDATE locations
            SET name = ?, address = ?, latitude = ?, longitude = ?, description = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(name.trim(), address.trim(), latitude, longitude, description || null, req.params.id);

        db.prepare('DELETE FROM cliente_locations WHERE location_id = ?').run(req.params.id);
        db.prepare(`
            INSERT OR IGNORE INTO cliente_locations (cliente_id, location_id)
            VALUES (?, ?)
        `).run(cliente_id, req.params.id);
        db.prepare(`
            UPDATE pedidos
            SET location_id = ?
            WHERE cliente_id = ?
              AND location_id IS NULL
        `).run(req.params.id, cliente_id);
        db.prepare('UPDATE clientes SET actualizado_en = datetime("now") WHERE id = ?').run(cliente_id);
    })();

    res.json({ ok: true });
});

router.delete('/api/mapa-inventario/locations/:id', requireRoles('admin'), (req, res) => {
    db.transaction(() => {
        db.prepare('DELETE FROM location_inventory WHERE location_id = ?').run(req.params.id);
        db.prepare('DELETE FROM location_inventory_history WHERE location_id = ?').run(req.params.id);
        db.prepare('DELETE FROM cliente_locations WHERE location_id = ?').run(req.params.id);
        db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
    })();
    res.json({ ok: true });
});

router.post('/api/mapa-inventario/inventory', requireRoles('admin'), (req, res) => {
    const { location_id, producto_id, notes, image_url } = req.body;
    const quantity = numberOrNull(req.body.quantity);

    if (!location_id || !producto_id || quantity === null) {
        return res.status(400).json({ error: 'Ubicacion, producto y cantidad son requeridos.' });
    }

    const location = db.prepare('SELECT id FROM locations WHERE id = ?').get(location_id);
    if (!location) return res.status(404).json({ error: 'Ubicacion no encontrada.' });
    const producto = db.prepare(`
        SELECT p.*, c.nombre AS categoria
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.id = ?
    `).get(producto_id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' });

    let newId = null;
    db.transaction(() => {
        const info = db.prepare(`
            INSERT INTO location_inventory (location_id, producto_id, product_name, product_type, presentation, quantity, notes, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(location_id, producto_id, producto.nombre, producto.categoria || null, producto.unidad || null, quantity, notes || null, image_url || null);
        newId = info.lastInsertRowid;

        db.prepare(`
            INSERT INTO location_inventory_history
                (inventory_id, location_id, product_name, old_quantity, new_quantity, notes, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(newId, location_id, producto.nombre, null, quantity, 'Alta de inventario', req.session.usuario.id);
    })();

    res.json({ ok: true, id: newId });
});

router.put('/api/mapa-inventario/inventory/:id', requireRoles('admin'), (req, res) => {
    const { producto_id, notes, image_url } = req.body;
    const quantity = numberOrNull(req.body.quantity);
    if (!producto_id || quantity === null) {
        return res.status(400).json({ error: 'Producto y cantidad son requeridos.' });
    }

    const current = db.prepare('SELECT * FROM location_inventory WHERE id = ?').get(req.params.id);
    if (!current) return res.status(404).json({ error: 'Inventario no encontrado.' });
    const producto = db.prepare(`
        SELECT p.*, c.nombre AS categoria
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.id = ?
    `).get(producto_id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' });

    db.transaction(() => {
        db.prepare(`
            UPDATE location_inventory
            SET producto_id = ?, product_name = ?, product_type = ?, presentation = ?, quantity = ?, notes = ?, image_url = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(producto_id, producto.nombre, producto.categoria || null, producto.unidad || null, quantity, notes || null, image_url || null, req.params.id);

        db.prepare(`
            INSERT INTO location_inventory_history
                (inventory_id, location_id, product_name, old_quantity, new_quantity, notes, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.params.id, current.location_id, producto.nombre, current.quantity, quantity, notes || 'Actualizacion de cantidad', req.session.usuario.id);
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

router.get('/api/clientes', (req, res) => {
    const { q = '' } = req.query;
    const params = [];
    let where = '';
    if (q.trim()) {
        where = 'WHERE lower(nombre) LIKE ? OR lower(COALESCE(contacto, "")) LIKE ?';
        params.push(`%${q.trim().toLowerCase()}%`, `%${q.trim().toLowerCase()}%`);
    }

    const rows = db.prepare(`
        SELECT c.*,
               COUNT(cl.location_id) AS ubicaciones,
               (
                   SELECT l2.id
                   FROM cliente_locations cl2
                   JOIN locations l2 ON l2.id = cl2.location_id
                   WHERE cl2.cliente_id = c.id
                   ORDER BY datetime(l2.updated_at) DESC, l2.id DESC
                   LIMIT 1
               ) AS location_id,
               (
                   SELECT l2.name
                   FROM cliente_locations cl2
                   JOIN locations l2 ON l2.id = cl2.location_id
                   WHERE cl2.cliente_id = c.id
                   ORDER BY datetime(l2.updated_at) DESC, l2.id DESC
                   LIMIT 1
               ) AS ubicacion_nombre,
               (
                   SELECT l2.address
                   FROM cliente_locations cl2
                   JOIN locations l2 ON l2.id = cl2.location_id
                   WHERE cl2.cliente_id = c.id
                   ORDER BY datetime(l2.updated_at) DESC, l2.id DESC
                   LIMIT 1
               ) AS direccion,
               (
                   SELECT l2.latitude
                   FROM cliente_locations cl2
                   JOIN locations l2 ON l2.id = cl2.location_id
                   WHERE cl2.cliente_id = c.id
                   ORDER BY datetime(l2.updated_at) DESC, l2.id DESC
                   LIMIT 1
               ) AS latitude,
               (
                   SELECT l2.longitude
                   FROM cliente_locations cl2
                   JOIN locations l2 ON l2.id = cl2.location_id
                   WHERE cl2.cliente_id = c.id
                   ORDER BY datetime(l2.updated_at) DESC, l2.id DESC
                   LIMIT 1
               ) AS longitude
        FROM clientes c
        LEFT JOIN cliente_locations cl ON cl.cliente_id = c.id
        ${where}
        GROUP BY c.id
        ORDER BY c.nombre
    `).all(params);
    res.json(rows);
});

router.post('/api/clientes', requireRoles('admin'), (req, res) => {
    const { nombre, contacto, correo, notas } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del cliente es requerido.' });

    const info = db.prepare(`
        INSERT INTO clientes (nombre, contacto, correo, notas)
        VALUES (?, ?, ?, ?)
    `).run(nombre.trim(), contacto || null, correo || null, notas || null);

    res.json({ ok: true, id: info.lastInsertRowid });
});

router.get('/api/clientes/:id/locations', (req, res) => {
    const rows = db.prepare(`
        SELECT l.*
        FROM locations l
        JOIN cliente_locations cl ON cl.location_id = l.id
        WHERE cl.cliente_id = ?
        ORDER BY datetime(l.updated_at) DESC, l.id DESC
    `).all(req.params.id);
    res.json(rows);
});

router.get('/api/mapa-inventario/product-types', (req, res) => {
    const rows = db.prepare(`
        SELECT DISTINCT product_type
        FROM location_inventory
        WHERE product_type IS NOT NULL AND TRIM(product_type) <> ''
        ORDER BY product_type
    `).all();
    res.json(rows.map(r => r.product_type));
});

module.exports = router;
