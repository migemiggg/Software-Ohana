const db = require('../db/database');

class SolicitudRepository {
    getAll(estado) {
        let sql = `
            SELECT s.*,
                   p.nombre AS producto_nombre, p.unidad,
                   e.nombre || COALESCE(' ' || e.apellido, '') AS solicitante_nombre,
                   r.nombre || COALESCE(' ' || r.apellido, '') AS revisor_nombre
            FROM solicitudes_entrada s
            LEFT JOIN productos p  ON p.id = s.producto_id
            LEFT JOIN empleados e  ON e.id = s.solicitante_id
            LEFT JOIN empleados r  ON r.id = s.revisado_por
        `;
        const params = [];
        if (estado) {
            sql += ' WHERE s.estado = ?';
            params.push(estado);
        }
        sql += ' ORDER BY s.creado_en DESC';
        return db.prepare(sql).all(params);
    }

    getAllBySolicitanteId(solicitanteId) {
        return db.prepare(`
            SELECT s.*,
                   p.nombre AS producto_nombre, p.unidad,
                   r.nombre || COALESCE(' ' || r.apellido, '') AS revisor_nombre
            FROM solicitudes_entrada s
            LEFT JOIN productos p ON p.id = s.producto_id
            LEFT JOIN empleados r ON r.id = s.revisado_por
            WHERE s.solicitante_id = ?
            ORDER BY s.creado_en DESC
        `).all(solicitanteId);
    }

    getById(id) {
        return db.prepare('SELECT * FROM solicitudes_entrada WHERE id = ?').get(id);
    }

    create({ producto_id, cantidad, motivo, solicitante_id }) {
        return db.prepare(`
            INSERT INTO solicitudes_entrada (producto_id, cantidad, motivo, solicitante_id)
            VALUES (?, ?, ?, ?)
        `).run(producto_id, cantidad, motivo, solicitante_id);
    }

    aprobarTransaction(fn) {
        return db.transaction(fn);
    }

    updateEstadoAprobado(id, { revisado_por, nota_revision }) {
        return db.prepare(`
            UPDATE solicitudes_entrada
            SET estado='aprobada', revisado_por=?, nota_revision=?, revisado_en=datetime('now')
            WHERE id=?
        `).run(revisado_por, nota_revision, id);
    }

    updateEstadoRechazado(id, { revisado_por, nota_revision }) {
        return db.prepare(`
            UPDATE solicitudes_entrada
            SET estado='rechazada', revisado_por=?, nota_revision=?, revisado_en=datetime('now')
            WHERE id=?
        `).run(revisado_por, nota_revision, id);
    }

    insertMovimiento({ producto_id, cantidad, motivo, usuario_id }) {
        return db.prepare(`
            INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
            VALUES (?, 'entrada', ?, ?, ?)
        `).run(producto_id, cantidad, motivo, usuario_id);
    }

    updateStock(productoId, cantidad) {
        return db.prepare(`
            UPDATE productos SET stock_actual = stock_actual + ?,
            actualizado_en = datetime('now') WHERE id = ?
        `).run(cantidad, productoId);
    }
}

module.exports = new SolicitudRepository();
