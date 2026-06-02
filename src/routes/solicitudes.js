/**
 * OhanApp — Módulo de Solicitudes de Entrada
 * Flujo:
 *   Proveedor  → POST /api/solicitudes          crea solicitud pendiente
 *   Admin/Emp  → GET  /api/solicitudes           lista todas (con filtro ?estado=)
 *   Proveedor  → GET  /api/solicitudes/mias      lista solo las suyas
 *   Admin/Emp  → PATCH /api/solicitudes/:id/aprobar  → crea movimiento + actualiza stock
 *   Admin/Emp  → PATCH /api/solicitudes/:id/rechazar
 */
const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { requireRoles } = require('../middleware/auth');

const ADMIN_EMP = requireRoles('admin', 'empleado');
const ALL_AUTH  = requireRoles('admin', 'empleado', 'proveedor');

// GET /api/solicitudes — admin/empleado ven todas
router.get('/api/solicitudes', ADMIN_EMP, (req, res) => {
    try {
        const { estado } = req.query;
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
        if (estado) { sql += ' WHERE s.estado = ?'; params.push(estado); }
        sql += ' ORDER BY s.creado_en DESC';
        res.json({ ok: true, solicitudes: db.prepare(sql).all(...params) });
    } catch(e) { res.json({ ok: false, error: e.message }); }
});

// GET /api/solicitudes/mias — el proveedor ve las suyas
router.get('/api/solicitudes/mias', ALL_AUTH, (req, res) => {
    try {
        const solicitante_id = req.session.usuario.id;
        const rows = db.prepare(`
            SELECT s.*,
                   p.nombre AS producto_nombre, p.unidad,
                   r.nombre || COALESCE(' ' || r.apellido, '') AS revisor_nombre
            FROM solicitudes_entrada s
            LEFT JOIN productos p ON p.id = s.producto_id
            LEFT JOIN empleados r ON r.id = s.revisado_por
            WHERE s.solicitante_id = ?
            ORDER BY s.creado_en DESC
        `).all(solicitante_id);
        res.json({ ok: true, solicitudes: rows });
    } catch(e) { res.json({ ok: false, error: e.message }); }
});

// POST /api/solicitudes — proveedor crea solicitud
router.post('/api/solicitudes', ALL_AUTH, (req, res) => {
    try {
        const { producto_id, cantidad, motivo } = req.body;
        if (!producto_id || !cantidad || cantidad <= 0)
            return res.json({ ok: false, error: 'Producto y cantidad requeridos.' });

        const solicitante_id = req.session.usuario.id;

        // Verificar que el solicitante sea proveedor (empleados crean movimientos directo)
        if (req.session.usuario.rol !== 'proveedor' &&
            req.session.usuario.rol !== 'admin' &&
            req.session.usuario.rol !== 'empleado') {
            return res.json({ ok: false, error: 'Sin permiso.' });
        }

        const result = db.prepare(`
            INSERT INTO solicitudes_entrada (producto_id, cantidad, motivo, solicitante_id)
            VALUES (?, ?, ?, ?)
        `).run(producto_id, cantidad, motivo || null, solicitante_id);

        res.json({ ok: true, id: result.lastInsertRowid });
    } catch(e) { res.json({ ok: false, error: e.message }); }
});

// PATCH /api/solicitudes/:id/aprobar — admin/empleado aprueban → crea movimiento
router.patch('/api/solicitudes/:id/aprobar', ADMIN_EMP, (req, res) => {
    try {
        const solicitud = db.prepare('SELECT * FROM solicitudes_entrada WHERE id = ?').get(req.params.id);
        if (!solicitud) return res.json({ ok: false, error: 'Solicitud no encontrada.' });
        if (solicitud.estado !== 'pendiente') return res.json({ ok: false, error: 'La solicitud ya fue procesada.' });

        const revisor_id = req.session.usuario.id;
        const { nota_revision } = req.body;

        const aprobar = db.transaction(() => {
            // 1. Actualizar solicitud
            db.prepare(`
                UPDATE solicitudes_entrada
                SET estado='aprobada', revisado_por=?, nota_revision=?, revisado_en=datetime('now')
                WHERE id=?
            `).run(revisor_id, nota_revision || null, solicitud.id);

            // 2. Crear movimiento de inventario
            db.prepare(`
                INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
                VALUES (?, 'entrada', ?, ?, ?)
            `).run(solicitud.producto_id, solicitud.cantidad,
                   `Solicitud #${solicitud.id} aprobada`, revisor_id);

            // 3. Actualizar stock
            db.prepare(`
                UPDATE productos SET stock_actual = stock_actual + ?,
                actualizado_en = datetime('now') WHERE id = ?
            `).run(solicitud.cantidad, solicitud.producto_id);
        });

        aprobar();
        res.json({ ok: true });
    } catch(e) { res.json({ ok: false, error: e.message }); }
});

// PATCH /api/solicitudes/:id/rechazar
router.patch('/api/solicitudes/:id/rechazar', ADMIN_EMP, (req, res) => {
    try {
        const solicitud = db.prepare('SELECT * FROM solicitudes_entrada WHERE id = ?').get(req.params.id);
        if (!solicitud) return res.json({ ok: false, error: 'Solicitud no encontrada.' });
        if (solicitud.estado !== 'pendiente') return res.json({ ok: false, error: 'La solicitud ya fue procesada.' });

        const revisor_id = req.session.usuario.id;
        const { nota_revision } = req.body;

        db.prepare(`
            UPDATE solicitudes_entrada
            SET estado='rechazada', revisado_por=?, nota_revision=?, revisado_en=datetime('now')
            WHERE id=?
        `).run(revisor_id, nota_revision || null, solicitud.id);

        res.json({ ok: true });
    } catch(e) { res.json({ ok: false, error: e.message }); }
});

module.exports = router;
