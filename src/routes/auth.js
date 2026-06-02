const express  = require('express');
const bcrypt   = require('bcryptjs');
const db       = require('../db/database');
const router   = express.Router();

// GET /login
router.get('/login', (req, res) => {
    if (req.session.usuario) return res.redirect('/dashboard');
    res.sendFile('login.html', { root: 'public' });
});

// POST /login
router.post('/login', (req, res) => {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) {
        return res.json({ ok: false, error: 'Campos requeridos.' });
    }

    // 1. Buscar en tabla usuarios (admin / encargados del sistema)
    let usuario = db.prepare('SELECT * FROM usuarios WHERE correo = ?').get(correo);
    if (usuario) {
        const coincide = bcrypt.compareSync(contrasena, usuario.contrasena);
        if (!coincide) return res.json({ ok: false, error: 'Correo o contraseña incorrectos.' });

        req.session.usuario = {
            id:     usuario.id,
            nombre: usuario.nombre,
            correo: usuario.correo,
            rol:    usuario.rol,
            origen: 'usuarios'
        };
        return res.json({ ok: true });
    }

    // 2. Buscar en tabla empleados
    const empleado = db.prepare(
        'SELECT * FROM empleados WHERE correo = ? AND activo = 1'
    ).get(correo);

    if (!empleado || !empleado.contrasena) {
        return res.json({ ok: false, error: 'Correo o contraseña incorrectos.' });
    }

    const coincide = bcrypt.compareSync(contrasena, empleado.contrasena);
    if (!coincide) {
        return res.json({ ok: false, error: 'Correo o contraseña incorrectos.' });
    }

    req.session.usuario = {
        id:     empleado.id,
        nombre: `${empleado.nombre}${empleado.apellido ? ' ' + empleado.apellido : ''}`,
        correo: empleado.correo,
        rol:    empleado.rol,   // 'admin' | 'empleado' | 'proveedor'
        origen: 'empleados'
    };
    res.json({ ok: true });
});

// GET /logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// GET /api/session  — devuelve datos del usuario actual
router.get('/api/session', (req, res) => {
    if (req.session.usuario) {
        res.json({ ok: true, usuario: req.session.usuario });
    } else {
        res.json({ ok: false });
    }
});

// PATCH /api/perfil/password  — cambia contraseña del usuario en sesión
router.patch('/api/perfil/password', (req, res) => {
    if (!req.session.usuario) return res.status(401).json({ ok: false, error: 'No autenticado.' });

    const { actual, nueva } = req.body;
    if (!actual || !nueva) return res.json({ ok: false, error: 'Campos requeridos.' });
    if (nueva.length < 6)  return res.json({ ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' });

    const { id, origen } = req.session.usuario;
    const tabla = origen === 'empleados' ? 'empleados' : 'usuarios';

    const registro = db.prepare(`SELECT contrasena FROM ${tabla} WHERE id = ?`).get(id);
    if (!registro) return res.json({ ok: false, error: 'Usuario no encontrado.' });

    if (!bcrypt.compareSync(actual, registro.contrasena)) {
        return res.json({ ok: false, error: 'La contraseña actual es incorrecta.' });
    }

    const hash = bcrypt.hashSync(nueva, 10);
    db.prepare(`UPDATE ${tabla} SET contrasena = ? WHERE id = ?`).run(hash, id);
    res.json({ ok: true });
});

module.exports = router;
