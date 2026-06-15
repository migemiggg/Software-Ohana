const db = require('../db/database');

class ReporteRepository {
    getInventarioReport() {
        return db.prepare(`
            SELECT
                p.id,
                p.nombre,
                COALESCE(c.nombre, 'Sin categoria') AS categoria,
                p.unidad,
                p.stock_actual,
                p.stock_minimo,
                p.precio_unitario,
                ROUND(p.stock_actual * p.precio_unitario, 2) AS valor_total,
                CASE WHEN p.stock_actual <= p.stock_minimo THEN 1 ELSE 0 END AS alerta
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            ORDER BY p.nombre ASC
        `).all();
    }

    getMovimientosReport(desde, hasta) {
        return db.prepare(`
            SELECT
                m.id,
                m.fecha,
                p.nombre        AS producto,
                m.tipo,
                m.cantidad,
                p.unidad,
                m.motivo,
                COALESCE(u.nombre, '—') AS usuario
            FROM movimientos_inventario m
            LEFT JOIN productos p ON p.id = m.producto_id
            LEFT JOIN usuarios  u ON u.id = m.usuario_id
            WHERE DATE(m.fecha) BETWEEN ? AND ?
            ORDER BY m.fecha DESC
        `).all(desde, hasta);
    }

    getPedidosReport(desde, hasta, estado) {
        let sql = `
            SELECT
                p.id,
                p.fecha_pedido,
                p.fecha_entrega,
                p.cliente_nombre,
                p.cliente_contacto,
                p.estado,
                p.total,
                p.notas,
                COALESCE(u.nombre, '—') AS usuario
            FROM pedidos p
            LEFT JOIN usuarios u ON u.id = p.usuario_id
            WHERE DATE(p.fecha_pedido) BETWEEN ? AND ?
        `;
        const params = [desde, hasta];

        if (estado) {
            sql += ' AND p.estado = ?';
            params.push(estado);
        }
        sql += ' ORDER BY p.fecha_pedido DESC';

        return db.prepare(sql).all(params);
    }
}

module.exports = new ReporteRepository();
