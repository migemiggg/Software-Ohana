const db = require('../db/database');

class MovimientoRepository {
    getById(id) {
        return db.prepare('SELECT * FROM movimientos_inventario WHERE id = ?').get(id);
    }

    create({ producto_id, tipo, cantidad, motivo, usuario_id }) {
        return db.prepare(`
            INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(producto_id, tipo, cantidad, motivo, usuario_id);
    }

    update(id, { producto_id, tipo, cantidad, motivo }) {
        return db.prepare(`
            UPDATE movimientos_inventario
            SET producto_id = ?, tipo = ?, cantidad = ?, motivo = ?
            WHERE id = ?
        `).run(producto_id, tipo, cantidad, motivo, id);
    }

    delete(id) {
        return db.prepare('DELETE FROM movimientos_inventario WHERE id = ?').run(id);
    }

    getAll({ producto_id, q, limit }) {
        const params = [];
        let where = 'WHERE 1 = 1';

        if (producto_id) {
            where += ' AND m.producto_id = ?';
            params.push(producto_id);
        }
        if (q && q.trim()) {
            where += ' AND (lower(p.nombre) LIKE ? OR lower(COALESCE(m.motivo, "")) LIKE ?)';
            params.push(`%${q.trim().toLowerCase()}%`, `%${q.trim().toLowerCase()}%`);
        }

        return db.prepare(`
            SELECT m.*, p.nombre AS producto_nombre, p.unidad, c.nombre AS categoria, u.nombre AS usuario
            FROM movimientos_inventario m
            JOIN productos p ON p.id = m.producto_id
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN usuarios u ON u.id = m.usuario_id
            ${where}
            ORDER BY m.fecha DESC, m.id DESC
            LIMIT ?
        `).all([...params, Math.min(Number(limit) || 150, 500)]);
    }

    getByProductoId(producto_id) {
        return db.prepare(`
            SELECT m.*, u.nombre AS usuario
            FROM movimientos_inventario m
            LEFT JOIN usuarios u ON u.id = m.usuario_id
            WHERE m.producto_id = ?
            ORDER BY m.fecha DESC
            LIMIT 50
        `).all(producto_id);
    }
}

module.exports = new MovimientoRepository();
