const express = require('express');
const db      = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

router.use(requireLogin);

// Listar recetas
router.get('/api/recetas', (req, res) => {
    const rows = db.prepare('SELECT * FROM recetas ORDER BY nombre').all();
    res.json(rows);
});

// Obtener receta con ingredientes
router.get('/api/recetas/:id', (req, res) => {
    const receta = db.prepare('SELECT * FROM recetas WHERE id = ?').get(req.params.id);
    if (!receta) return res.status(404).json({ error: 'Receta no encontrada.' });

    const ingredientes = db.prepare(`
        SELECT ri.*, p.nombre AS producto, p.unidad, p.stock_actual
        FROM receta_ingredientes ri
        JOIN productos p ON p.id = ri.producto_id
        WHERE ri.receta_id = ?
    `).all(req.params.id);

    res.json({ ...receta, ingredientes });
});

// Crear receta
router.post('/api/recetas', (req, res) => {
    const { nombre, descripcion, porciones, ingredientes } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });

    // Validar que no exista una receta con el mismo nombre
    const existente = db.prepare('SELECT id FROM recetas WHERE LOWER(nombre) = LOWER(?)').get(nombre);
    if (existente) return res.status(400).json({ error: 'Ya existe una receta con este nombre.' });

    const result = db.transaction(() => {
        const info = db.prepare(`
            INSERT INTO recetas (nombre, descripcion, porciones) VALUES (?, ?, ?)
        `).run(nombre, descripcion || null, porciones || 1);

        const recetaId = info.lastInsertRowid;

        if (ingredientes && ingredientes.length) {
            const ins = db.prepare(`
                INSERT INTO receta_ingredientes (receta_id, producto_id, cantidad) VALUES (?, ?, ?)
            `);
            for (const ing of ingredientes) {
                ins.run(recetaId, ing.producto_id, ing.cantidad);
            }
        }

        return recetaId;
    })();

    res.json({ ok: true, id: result });
});

// Editar receta
router.put('/api/recetas/:id', (req, res) => {
    const { nombre, descripcion, porciones, ingredientes } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });

    // Validar que no exista otra receta con el mismo nombre
    const existente = db.prepare('SELECT id FROM recetas WHERE LOWER(nombre) = LOWER(?) AND id != ?')
        .get(nombre, req.params.id);
    if (existente) return res.status(400).json({ error: 'Ya existe una receta con este nombre.' });

    const result = db.transaction(() => {
        db.prepare(`
            UPDATE recetas SET nombre = ?, descripcion = ?, porciones = ? WHERE id = ?
        `).run(nombre, descripcion || null, porciones || 1, req.params.id);

        // Eliminar ingredientes anteriores
        db.prepare('DELETE FROM receta_ingredientes WHERE receta_id = ?').run(req.params.id);

        // Agregar nuevos ingredientes
        if (ingredientes && ingredientes.length) {
            const ins = db.prepare(`
                INSERT INTO receta_ingredientes (receta_id, producto_id, cantidad) VALUES (?, ?, ?)
            `);
            for (const ing of ingredientes) {
                ins.run(req.params.id, ing.producto_id, ing.cantidad);
            }
        }

        return req.params.id;
    })();

    res.json({ ok: true, id: result });
});

// Calcular insumos necesarios para N porciones
router.get('/api/recetas/:id/calcular', (req, res) => {
    const porciones = parseFloat(req.query.porciones) || 1;
    const receta = db.prepare('SELECT * FROM recetas WHERE id = ?').get(req.params.id);
    if (!receta) return res.status(404).json({ error: 'Receta no encontrada.' });

    const ingredientes = db.prepare(`
        SELECT ri.*, p.nombre AS producto, p.unidad, p.stock_actual, p.precio_unitario
        FROM receta_ingredientes ri
        JOIN productos p ON p.id = ri.producto_id
        WHERE ri.receta_id = ?
    `).all(req.params.id);

    const factor = porciones / receta.porciones;

    const resultado = ingredientes.map(ing => ({
        producto:      ing.producto,
        unidad:        ing.unidad,
        cantidad_base: ing.cantidad,
        cantidad_necesaria: +(ing.cantidad * factor).toFixed(3),
        stock_actual:  ing.stock_actual,
        suficiente:    ing.stock_actual >= ing.cantidad * factor,
        costo:         +(ing.precio_unitario * ing.cantidad * factor).toFixed(2)
    }));

    const costo_total = resultado.reduce((s, r) => s + r.costo, 0);

    res.json({ receta: receta.nombre, porciones, ingredientes: resultado, costo_total: +costo_total.toFixed(2) });
});

// Eliminar receta
router.delete('/api/recetas/:id', (req, res) => {
    db.prepare('DELETE FROM recetas WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
