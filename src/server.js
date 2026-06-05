const express  = require('express');
const session  = require('express-session');
const path     = require('path');
const db       = require('./db/database');

const authRoutes          = require('./routes/auth');
const inventarioRoutes    = require('./routes/inventario');
const pedidosRoutes       = require('./routes/pedidos');
const recordatoriosRoutes = require('./routes/recordatorios');
const recetasRoutes       = require('./routes/recetas');
const empleadosRoutes     = require('./routes/empleados');
const reportesRoutes      = require('./routes/reportes');
const solicitudesRoutes   = require('./routes/solicitudes');
const mapaInventarioRoutes = require('./routes/mapaInventario');
const { requireLogin, requireRoles } = require('./middleware/auth');

const PORT = process.env.PORT || 3000;

async function start() {
    await db.init();

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, '../public')));
    app.use(session({
        secret: 'ohana-secret-2024',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 8 * 60 * 60 * 1000 }
    }));

    // API routes
    app.use('/', authRoutes);
    app.use('/', inventarioRoutes);
    app.use('/', pedidosRoutes);
    app.use('/', recordatoriosRoutes);
    app.use('/', recetasRoutes);
    app.use('/', empleadosRoutes);
    app.use('/', reportesRoutes);
    app.use('/', solicitudesRoutes);
    app.use('/', mapaInventarioRoutes);

    // Raíz → home según rol
    app.get('/', (req, res) => {
        if (!req.session.usuario) return res.redirect('/login');
        if (req.session.usuario.rol === 'proveedor') return res.redirect('/mis-solicitudes');
        res.redirect('/dashboard');
    });

    // ── Páginas protegidas por rol ──────────────────────────────────────
    // Admin + Empleado + Proveedor
    app.get('/dashboard',        requireRoles('admin','empleado'),            (req,res) => res.sendFile('dashboard.html',         {root:'public'}));

    // Admin + Empleado
    app.get('/inventario',       requireRoles('admin','empleado'),            (req,res) => res.sendFile('inventario.html',        {root:'public'}));
    app.get('/mapa-inventario',  requireRoles('admin','empleado'),            (req,res) => res.sendFile('mapa-inventario.html',   {root:'public'}));
    app.get('/recordatorios',    requireRoles('admin','empleado'),            (req,res) => res.sendFile('recordatorios.html',     {root:'public'}));
    app.get('/solicitudes',      requireRoles('admin','empleado'),            (req,res) => res.sendFile('solicitudes.html',       {root:'public'}));

    // Admin only
    app.get('/pedidos',          requireRoles('admin'),                       (req,res) => res.sendFile('pedidos.html',           {root:'public'}));
    app.get('/recetas',          requireRoles('admin'),                       (req,res) => res.sendFile('recetas.html',           {root:'public'}));
    app.get('/empleados',        requireRoles('admin'),                       (req,res) => res.sendFile('empleados.html',         {root:'public'}));
    app.get('/reportes',         requireRoles('admin'),                       (req,res) => res.sendFile('reportes.html',          {root:'public'}));

    // Proveedor only
    app.get('/mis-solicitudes',  requireRoles('admin','empleado','proveedor'),(req,res) => res.sendFile('mis-solicitudes.html',   {root:'public'}));

    app.use((req, res) => res.status(404).sendFile('404.html', {root:'public'}));

    app.listen(PORT, () => {
        console.log('\n  OhanApp → http://localhost:' + PORT);
        console.log('  admin@ohana.com / ohana123\n');
    });
}

start().catch(err => { console.error(err); process.exit(1); });
