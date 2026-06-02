/**
 * OhanApp — Middleware de autenticación y autorización
 * Roles: admin | empleado | proveedor
 */

function requireLogin(req, res, next) {
    if (req.session && req.session.usuario) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ ok: false, error: 'No autenticado.' });
    res.redirect('/login');
}

function requireAdmin(req, res, next) {
    if (req.session?.usuario?.rol === 'admin') return next();
    res.status(403).json({ ok: false, error: 'Acceso restringido a administradores.' });
}

// requireRoles('admin','empleado') — factory que acepta lista de roles permitidos
function requireRoles(...roles) {
    return (req, res, next) => {
        if (!req.session?.usuario) {
            return req.path.startsWith('/api/')
                ? res.status(401).json({ ok: false, error: 'No autenticado.' })
                : res.redirect('/login');
        }
        if (roles.includes(req.session.usuario.rol)) return next();

        if (req.path.startsWith('/api/')) {
            return res.status(403).json({ ok: false, error: 'Sin permiso para esta acción.' });
        }
        // Redirigir a la home del rol
        const home = req.session.usuario.rol === 'proveedor' ? '/mis-solicitudes' : '/dashboard';
        res.redirect(home);
    };
}

module.exports = { requireLogin, requireAdmin, requireRoles };
