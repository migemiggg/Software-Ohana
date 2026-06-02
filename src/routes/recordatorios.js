const express = require('express');
const db      = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

router.use(requireLogin);

// Listar recordatorios del usuario actual
router.get('/api/recordatorios', (req, res) => {
    const rows = db.prepare(`
        SELECT * FROM recordatorios
        WHERE usuario_id = ? OR usuario_id IS NULL
        ORDER BY completado ASC, fecha ASC
    `).all(req.session.usuario.id);
    res.json(rows);
});

// Crear recordatorio
router.post('/api/recordatorios', (req, res) => {
    const { titulo, descripcion, fecha } = req.body;
    if (!titulo || !fecha) return res.status(400).json({ error: 'Título y fecha son requeridos.' });

    const info = db.prepare(`
        INSERT INTO recordatorios (titulo, descripcion, fecha, usuario_id)
        VALUES (?, ?, ?, ?)
    `).run(titulo, descripcion || null, fecha, req.session.usuario.id);

    res.json({ ok: true, id: info.lastInsertRowid });
});

// Marcar como completado / pendiente
router.patch('/api/recordatorios/:id/toggle', (req, res) => {
    const rec = db.prepare('SELECT * FROM recordatorios WHERE id = ?').get(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Recordatorio no encontrado.' });
    db.prepare('UPDATE recordatorios SET completado = ? WHERE id = ?')
      .run(rec.completado ? 0 : 1, req.params.id);
    res.json({ ok: true, completado: !rec.completado });
});

// Editar recordatorio
router.put('/api/recordatorios/:id', (req, res) => {
    const { titulo, descripcion, fecha } = req.body;
    db.prepare(`
        UPDATE recordatorios SET titulo = ?, descripcion = ?, fecha = ? WHERE id = ?
    `).run(titulo, descripcion || null, fecha, req.params.id);
    res.json({ ok: true });
});

// Eliminar recordatorio
router.delete('/api/recordatorios/:id', (req, res) => {
    db.prepare('DELETE FROM recordatorios WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
