const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const db      = require('../db/database');
const { requireLogin, requireAdmin } = require('../middleware/auth');

// GET /api/empleados  — nunca devuelve la contrasena
router.get('/api/empleados', requireLogin, (req, res) => {
    const { rol, activo, q } = req.query;
    let sql = 'SELECT id,nombre,apellido,correo,telefono,rol,activo,notas,creado_en FROM empleados WHERE 1=1';
    const params = [];
    if (rol)    { sql += ' AND rol = ?';    params.push(rol); }
    if (activo !== undefined && activo !== '') {
        sql += ' AND activo = ?';
        params.push(activo === '1' ? 1 : 0);
    }
    if (q) {
        sql += ' AND (nombre LIKE ? OR apellido LIKE ? OR correo LIKE ?)';
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY nombre ASC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
});

// GET /api/empleados/:id  — sin contrasena
router.get('/api/empleados/:id', requireLogin, (req, res) => {
    const emp = db.prepare(
        'SELECT id,nombre,apellido,correo,telefono,rol,activo,notas,creado_en FROM empleados WHERE id = ?'
    ).get(req.params.id);
    if (!emp) return res.status(404).json({ error: 'No encontrado' });
    res.json(emp);
});

// POST /api/empleados
router.post('/api/empleados', requireLogin, (req, res) => {
    const { nombre, apellido, correo, telefono, rol, notas, contrasena } = req.body;
    if (!nombre)     return res.status(400).json({ error: 'El nombre es requerido' });
    if (!correo)     return res.status(400).json({ error: 'El correo es requerido para poder iniciar sesión' });
    if (!contrasena) return res.status(400).json({ error: 'La contraseña es requerida' });

    const roles = ['admin', 'empleado', 'proveedor'];
    if (rol && !roles.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

    const hash = bcrypt.hashSync(contrasena, 10);
    const result = db.prepare(
        'INSERT INTO empleados (nombre, apellido, correo, telefono, rol, notas, contrasena) VALUES (?,?,?,?,?,?,?)'
    ).run(nombre, apellido || null, correo || null, telefono || null, rol || 'empleado', notas || null, hash);
    res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/empleados/:id
router.put('/api/empleados/:id', requireLogin, (req, res) => {
    const { nombre, apellido, correo, telefono, rol, notas, contrasena } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const roles = ['admin', 'empleado', 'proveedor'];
    if (rol && !roles.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

    if (contrasena && contrasena.trim() !== '') {
        // Cambiar contraseña también
        const hash = bcrypt.hashSync(contrasena, 10);
        db.prepare(
            'UPDATE empleados SET nombre=?, apellido=?, correo=?, telefono=?, rol=?, notas=?, contrasena=? WHERE id=?'
        ).run(nombre, apellido || null, correo || null, telefono || null, rol || 'empleado', notas || null, hash, req.params.id);
    } else {
        // No tocar la contraseña
        db.prepare(
            'UPDATE empleados SET nombre=?, apellido=?, correo=?, telefono=?, rol=?, notas=? WHERE id=?'
        ).run(nombre, apellido || null, correo || null, telefono || null, rol || 'empleado', notas || null, req.params.id);
    }
    res.json({ ok: true });
});

// PATCH /api/empleados/:id/toggle  (activo / inactivo)
router.patch('/api/empleados/:id/toggle', requireLogin, (req, res) => {
    const emp = db.prepare('SELECT activo FROM empleados WHERE id = ?').get(req.params.id);
    if (!emp) return res.status(404).json({ error: 'No encontrado' });
    db.prepare('UPDATE empleados SET activo = ? WHERE id = ?').run(emp.activo ? 0 : 1, req.params.id);
    res.json({ ok: true, activo: emp.activo ? 0 : 1 });
});

// DELETE /api/empleados/:id  — solo admin
router.delete('/api/empleados/:id', requireLogin, requireAdmin, (req, res) => {
    db.prepare('DELETE FROM empleados WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
