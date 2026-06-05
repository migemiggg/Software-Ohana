-- =====================================================
-- OhanApp - Schema de Base de Datos
-- Empresa: Ohana®
-- =====================================================

-- Tabla de usuarios del sistema
CREATE TABLE IF NOT EXISTS usuarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT    NOT NULL,
    correo      TEXT    NOT NULL UNIQUE,
    contrasena  TEXT    NOT NULL,
    rol         TEXT    NOT NULL DEFAULT 'encargado',  -- 'admin' | 'encargado'
    creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Tabla de categorías de productos/insumos
CREATE TABLE IF NOT EXISTS categorias (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT    NOT NULL UNIQUE,
    descripcion TEXT
);

-- Tabla de productos / insumos del inventario
CREATE TABLE IF NOT EXISTS productos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT    NOT NULL,
    descripcion     TEXT,
    categoria_id    INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    unidad          TEXT    NOT NULL DEFAULT 'pza',   -- pza, kg, lt, caja, etc.
    stock_actual    REAL    NOT NULL DEFAULT 0,
    stock_minimo    REAL    NOT NULL DEFAULT 0,
    precio_unitario REAL    NOT NULL DEFAULT 0,
    creado_en       TEXT    NOT NULL DEFAULT (datetime('now')),
    actualizado_en  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Tabla de movimientos de inventario (entradas y salidas)
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    tipo        TEXT    NOT NULL,   -- 'entrada' | 'salida'
    cantidad    REAL    NOT NULL,
    motivo      TEXT,
    usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Tabla de recetas (para cálculo de insumos)
CREATE TABLE IF NOT EXISTS recetas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT    NOT NULL,
    descripcion TEXT,
    porciones   REAL    NOT NULL DEFAULT 1,
    creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Ingredientes de cada receta
CREATE TABLE IF NOT EXISTS receta_ingredientes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    receta_id   INTEGER NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad    REAL    NOT NULL
);

-- Tabla de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_nombre  TEXT    NOT NULL,
    cliente_contacto TEXT,
    estado          TEXT    NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'en_proceso' | 'entregado' | 'cancelado'
    total           REAL    NOT NULL DEFAULT 0,
    notas           TEXT,
    usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_pedido    TEXT    NOT NULL DEFAULT (datetime('now')),
    fecha_entrega   TEXT
);

-- Detalle de cada pedido
CREATE TABLE IF NOT EXISTS pedido_detalles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id   INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad    REAL    NOT NULL,
    precio      REAL    NOT NULL
);

-- Tabla de recordatorios
CREATE TABLE IF NOT EXISTS recordatorios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo      TEXT    NOT NULL,
    descripcion TEXT,
    fecha       TEXT    NOT NULL,
    completado  INTEGER NOT NULL DEFAULT 0,  -- 0 = pendiente, 1 = completado
    usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- Datos iniciales
-- =====================================================

-- Usuario admin por defecto (contraseña: ohana123)
INSERT OR IGNORE INTO usuarios (nombre, correo, contrasena, rol)
VALUES ('Administrador', 'admin@ohana.com',
        '$2a$10$aun8CCRRYgsXAFLgHENCCeJ1f.aa5kKbRbZQYDtSHwY.2MY9O3Ewe', 'admin');

-- Categorías base
INSERT OR IGNORE INTO categorias (nombre, descripcion) VALUES
    ('Insumos',      'Materias primas y materiales de producción'),
    ('Productos',    'Productos terminados para venta'),
    ('Empaques',     'Materiales de empaque y presentación'),
    ('Limpieza',     'Productos de limpieza e higiene');

-- Tabla de empleados
CREATE TABLE IF NOT EXISTS empleados (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT    NOT NULL,
    apellido    TEXT,
    correo      TEXT    UNIQUE,
    telefono    TEXT,
    rol         TEXT    NOT NULL DEFAULT 'empleado',  -- 'admin' | 'empleado' | 'proveedor'
    activo      INTEGER NOT NULL DEFAULT 1,
    notas       TEXT,
    contrasena  TEXT,
    creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Solicitudes de entrada de inventario (propuestas por proveedores)
CREATE TABLE IF NOT EXISTS solicitudes_entrada (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id     INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad        REAL    NOT NULL,
    motivo          TEXT,
    solicitante_id  INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
    estado          TEXT    NOT NULL DEFAULT 'pendiente', -- 'pendiente'|'aprobada'|'rechazada'
    revisado_por    INTEGER REFERENCES empleados(id) ON DELETE SET NULL,
    nota_revision   TEXT,
    creado_en       TEXT    NOT NULL DEFAULT (datetime('now')),
    revisado_en     TEXT
);

-- Ubicaciones fisicas con inventario georreferenciado
CREATE TABLE IF NOT EXISTS locations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    address     TEXT    NOT NULL,
    latitude    REAL    NOT NULL,
    longitude   REAL    NOT NULL,
    description TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS location_inventory (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id  INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    product_name TEXT    NOT NULL,
    category     TEXT,
    quantity     REAL    NOT NULL DEFAULT 0,
    notes        TEXT,
    image_url    TEXT,
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS location_inventory_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER REFERENCES location_inventory(id) ON DELETE SET NULL,
    location_id  INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    product_name TEXT    NOT NULL,
    old_quantity REAL,
    new_quantity REAL    NOT NULL,
    notes        TEXT,
    usuario_id   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    changed_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_locations_coords ON locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_location_inventory_location ON location_inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_location_inventory_product ON location_inventory(product_name);
CREATE INDEX IF NOT EXISTS idx_location_inventory_category ON location_inventory(category);
