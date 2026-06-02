/**
 * OhanApp — Módulo de Reportes
 * Rutas:
 *   GET /api/reportes/inventario              — stock actual + resumen valorizado
 *   GET /api/reportes/movimientos?desde&hasta  — entradas/salidas por rango de fechas
 *   GET /api/reportes/pedidos?desde&hasta&estado — pedidos filtrados con detalle de totales
 *
 * Todos requieren sesión activa (requireLogin).
 * La generación de PDF y Excel se realiza en el cliente (navegador).
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { requireLogin } = require('../middleware/auth');

/* ─────────────────────────────────────────────
   GET /api/reportes/inventario
   Devuelve:
     - items: lista completa de productos con categoria, stock y valor
     - resumen: { total_productos, total_valor, bajo_minimo }
   ───────────────────────────────────────────── */
router.get('/api/reportes/inventario', requireLogin, (req, res) => {
    try {
    const items = db.prepare(`
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

    const resumen = {
        total_productos: items.length,
        total_valor:     items.reduce((s, i) => s + (i.valor_total || 0), 0).toFixed(2),
        bajo_minimo:     items.filter(i => i.alerta).length
    };

    res.json({ ok: true, items, resumen });
    } catch(e) { console.error('/api/reportes/inventario:', e.message); res.json({ ok: false, error: e.message }); }
});

/* ─────────────────────────────────────────────
   GET /api/reportes/movimientos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
   Devuelve:
     - movimientos: lista de entradas/salidas con nombre de producto y usuario
     - resumen: { total_entradas, total_salidas, total_registros }
   Si no se pasan fechas, devuelve los últimos 30 días.
   ───────────────────────────────────────────── */
router.get('/api/reportes/movimientos', requireLogin, (req, res) => { try {
    // Rango por defecto: últimos 30 días
    const hoy    = new Date();
    const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
    const fmt    = d => d.toISOString().slice(0, 10);

    const desde = req.query.desde || fmt(hace30);
    const hasta = req.query.hasta || fmt(hoy);

    const movimientos = db.prepare(`
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

    const entradas = movimientos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.cantidad, 0);
    const salidas  = movimientos.filter(m => m.tipo === 'salida').reduce((s, m) => s + m.cantidad, 0);

    res.json({
        ok: true,
        filtros: { desde, hasta },
        movimientos,
        resumen: {
            total_registros: movimientos.length,
            total_entradas:  entradas,
            total_salidas:   salidas
        }
    });
    } catch(e) { console.error('/api/reportes/movimientos:', e.message); res.json({ ok: false, error: e.message }); }
});

/* ─────────────────────────────────────────────
   GET /api/reportes/pedidos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estado=
   Devuelve:
     - pedidos: lista con estado, cliente, total y fecha
     - resumen: { total_pedidos, monto_total, por_estado: {...} }
   Si no se pasan fechas, devuelve los últimos 30 días.
   ───────────────────────────────────────────── */
router.get('/api/reportes/pedidos', requireLogin, (req, res) => { try {
    const hoy    = new Date();
    const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
    const fmt    = d => d.toISOString().slice(0, 10);

    const desde  = req.query.desde  || fmt(hace30);
    const hasta  = req.query.hasta  || fmt(hoy);
    const estado = req.query.estado || '';

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

    if (estado) { sql += ' AND p.estado = ?'; params.push(estado); }
    sql += ' ORDER BY p.fecha_pedido DESC';

    const pedidos = db.prepare(sql).all(...params);

    // Conteo por estado
    const por_estado = pedidos.reduce((acc, p) => {
        acc[p.estado] = (acc[p.estado] || 0) + 1;
        return acc;
    }, {});

    const monto_total = pedidos.reduce((s, p) => s + (p.total || 0), 0).toFixed(2);

    res.json({
        ok: true,
        filtros: { desde, hasta, estado },
        pedidos,
        resumen: {
            total_pedidos: pedidos.length,
            monto_total,
            por_estado
        }
    });
    } catch(e) { console.error('/api/reportes/pedidos:', e.message); res.json({ ok: false, error: e.message }); }
});

module.exports = router;
