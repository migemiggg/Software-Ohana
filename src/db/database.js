/**
 * OhanApp - Capa de acceso a datos
 * Usa sql.js (SQLite en WebAssembly, sin compilacion nativa).
 * Exporta un objeto con la misma API que better-sqlite3.
 */

const initSqlJs  = require('sql.js');
const path       = require('path');
const fs         = require('fs');

const DB_PATH     = path.join(__dirname, '../../ohana.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let _db = null;

// Statement wrapper
class Stmt {
    constructor(db, sql) {
        this._db  = db;
        this._sql = sql;
    }

    _norm(args) {
        if (args.length === 0) return [];
        if (args.length === 1 && Array.isArray(args[0])) return args[0];
        return args;
    }

    run(...args) {
        const params = this._norm(args);
        const stmt   = this._db._sqldb.prepare(this._sql);
        stmt.run(params.length ? params : undefined);
        stmt.free();
        const lastId = this._db._sqldb
            .exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0;
        this._db._save();
        return { lastInsertRowid: Number(lastId), changes: 1 };
    }

    get(...args) {
        const params = this._norm(args);
        const stmt   = this._db._sqldb.prepare(this._sql);
        if (params.length) stmt.bind(params);
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return row;
    }

    all(...args) {
        const params = this._norm(args);
        const stmt   = this._db._sqldb.prepare(this._sql);
        if (params.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
    }
}

// Database wrapper
class Db {
    constructor(SQL) {
        if (fs.existsSync(DB_PATH)) {
            this._sqldb = new SQL.Database(fs.readFileSync(DB_PATH));
        } else {
            this._sqldb = new SQL.Database();
        }
        this._inTx = false;
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        this._sqldb.exec(schema);
        try { this._sqldb.exec('CREATE TABLE IF NOT EXISTS solicitudes_entrada (id INTEGER PRIMARY KEY AUTOINCREMENT, producto_id INTEGER NOT NULL, cantidad REAL NOT NULL, motivo TEXT, solicitante_id INTEGER NOT NULL, estado TEXT NOT NULL DEFAULT "pendiente", revisado_por INTEGER, nota_revision TEXT, creado_en TEXT NOT NULL DEFAULT (datetime("now")), revisado_en TEXT)'); } catch(_) {}
                // Migracion: agregar columna contrasena si no existe (BD preexistente)
        try { this._sqldb.exec('ALTER TABLE empleados ADD COLUMN contrasena TEXT'); } catch (_) { /* ya existe */ }
        // Migracion: agregar restriccion UNIQUE en correo de empleados si no existe
        try { this._sqldb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_empleados_correo ON empleados(correo)'); } catch (_) { /* ya existe */ }
        // Migraciones: clientes normalizados, pedidos y ubicaciones
        try { this._sqldb.exec('CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, contacto TEXT, correo TEXT, notas TEXT, creado_en TEXT NOT NULL DEFAULT (datetime("now")), actualizado_en TEXT NOT NULL DEFAULT (datetime("now")))'); } catch (_) { /* ignorar */ }
        try { this._sqldb.exec('CREATE TABLE IF NOT EXISTS cliente_locations (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL, location_id INTEGER NOT NULL, notas TEXT, creado_en TEXT NOT NULL DEFAULT (datetime("now")), UNIQUE(cliente_id, location_id))'); } catch (_) { /* ignorar */ }
        try { this._sqldb.exec('ALTER TABLE pedidos ADD COLUMN cliente_id INTEGER'); } catch (_) { /* ya existe */ }
        try { this._sqldb.exec('ALTER TABLE pedidos ADD COLUMN location_id INTEGER'); } catch (_) { /* ya existe */ }
        try { this._sqldb.exec('ALTER TABLE pedidos ADD COLUMN inventario_descontado INTEGER NOT NULL DEFAULT 0'); } catch (_) { /* ya existe */ }
        try { this._sqldb.exec('CREATE INDEX IF NOT EXISTS idx_cliente_locations_cliente ON cliente_locations(cliente_id)'); } catch (_) { /* ignorar */ }
        try { this._sqldb.exec('CREATE INDEX IF NOT EXISTS idx_cliente_locations_location ON cliente_locations(location_id)'); } catch (_) { /* ignorar */ }
        try {
            this._sqldb.exec(`
                INSERT INTO clientes (nombre, contacto)
                SELECT DISTINCT cliente_nombre, cliente_contacto
                FROM pedidos
                WHERE cliente_nombre IS NOT NULL
                  AND TRIM(cliente_nombre) <> ''
                  AND NOT EXISTS (
                      SELECT 1 FROM clientes c
                      WHERE lower(c.nombre) = lower(pedidos.cliente_nombre)
                  )
            `);
        } catch (_) { /* ignorar */ }
        try {
            this._sqldb.exec(`
                UPDATE pedidos
                SET cliente_id = (
                    SELECT c.id FROM clientes c
                    WHERE lower(c.nombre) = lower(pedidos.cliente_nombre)
                    LIMIT 1
                )
                WHERE cliente_id IS NULL
            `);
        } catch (_) { /* ignorar */ }
<<<<<<< Updated upstream
        try {
            this._sqldb.exec(`
                UPDATE pedidos
                SET location_id = (
                    SELECT cl.location_id
                    FROM cliente_locations cl
                    JOIN locations l ON l.id = cl.location_id
                    WHERE cl.cliente_id = pedidos.cliente_id
                    ORDER BY datetime(l.updated_at) DESC, l.id DESC
                    LIMIT 1
                )
                WHERE location_id IS NULL
                  AND cliente_id IS NOT NULL
                  AND EXISTS (
                      SELECT 1
                      FROM cliente_locations cl
                      WHERE cl.cliente_id = pedidos.cliente_id
                  )
            `);
        } catch (_) { /* ignorar */ }
        // Migraciones: inventario por ubicacion
        try { this._sqldb.exec('ALTER TABLE location_inventory ADD COLUMN producto_id INTEGER'); } catch (_) { /* ya existe */ }
        try { this._sqldb.exec('ALTER TABLE location_inventory ADD COLUMN product_type TEXT'); } catch (_) { /* ya existe */ }
        try { this._sqldb.exec('ALTER TABLE location_inventory ADD COLUMN presentation TEXT'); } catch (_) { /* ya existe */ }
        try { this._sqldb.exec('CREATE INDEX IF NOT EXISTS idx_location_inventory_producto ON location_inventory(producto_id)'); } catch (_) { /* ignorar */ }
        try { this._sqldb.exec('CREATE INDEX IF NOT EXISTS idx_location_inventory_type ON location_inventory(product_type)'); } catch (_) { /* ignorar */ }
        try { this._sqldb.exec('CREATE INDEX IF NOT EXISTS idx_location_inventory_presentation ON location_inventory(presentation)'); } catch (_) { /* ignorar */ }
=======
        // Migraciones: inventario por ubicacion y normalizacion de la tabla
>>>>>>> Stashed changes
        try {
            // Asegurar que la columna producto_id existe antes de la normalización
            try { this._sqldb.exec('ALTER TABLE location_inventory ADD COLUMN producto_id INTEGER'); } catch (_) {}
            try { this._sqldb.exec('ALTER TABLE location_inventory ADD COLUMN product_name TEXT'); } catch (_) {}
            try { this._sqldb.exec('ALTER TABLE location_inventory ADD COLUMN presentation TEXT'); } catch (_) {}

            // 1. Vincular o crear productos para registros sin producto_id
            const orphaned = this.prepare('SELECT id, product_name, presentation FROM location_inventory WHERE producto_id IS NULL').all();
            for (const row of orphaned) {
                // Limpieza de nombre
                const cleanName = row.product_name.trim();
                const cleanPresentation = row.presentation ? row.presentation.trim() : 'pza';
                
                // Intentar buscar por coincidencia exacta (sin distinguir mayúsculas/minúsculas ni espacios)
                const searchName = cleanName.toLowerCase().replace(/\s+/g, '');
                let match = this.prepare(`
                    SELECT id FROM productos
                    WHERE lower(replace(nombre, ' ', '')) = ?
                    LIMIT 1
                `).get(searchName);

                if (!match) {
                    // Si no existe, crear el producto nuevo en la categoría de "Productos" (ID 2 o buscada por nombre)
                    let cat = this.prepare("SELECT id FROM categorias WHERE nombre = 'Productos'").get();
                    const catId = cat ? cat.id : null;
                    
                    const newProd = this.prepare(`
                        INSERT INTO productos (nombre, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario)
                        VALUES (?, ?, ?, 0, 0, 0)
                    `).run(cleanName, catId, cleanPresentation);
                    
                    match = { id: newProd.lastInsertRowid };
                }

                // Actualizar el registro para apuntar al producto
                this.prepare('UPDATE location_inventory SET producto_id = ? WHERE id = ?').run(match.id, row.id);
            }

            // Eliminar cualquier registro que por alguna razón extrema haya quedado con producto_id NULL
            this._sqldb.exec('DELETE FROM location_inventory WHERE producto_id IS NULL');

            // 2. Comprobar si la columna redundant "product_name" existe para hacer la normalización
            const tableInfo = this.prepare("PRAGMA table_info(location_inventory)").all();
            const hasRedundant = tableInfo.some(col => col.name === 'product_name');

            if (hasRedundant) {
                // Hacer la recreación de la tabla para normalizar
                this._sqldb.exec(`
                    BEGIN TRANSACTION;
                    
                    CREATE TABLE location_inventory_new (
                        id           INTEGER PRIMARY KEY AUTOINCREMENT,
                        location_id  INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
                        producto_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                        quantity     REAL    NOT NULL DEFAULT 0,
                        notes        TEXT,
                        image_url    TEXT,
                        updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
                    );
                    
                    INSERT INTO location_inventory_new (id, location_id, producto_id, quantity, notes, image_url, updated_at)
                    SELECT id, location_id, producto_id, quantity, notes, image_url, updated_at
                    FROM location_inventory;
                    
                    DROP TABLE location_inventory;
                    
                    ALTER TABLE location_inventory_new RENAME TO location_inventory;
                    
                    CREATE INDEX IF NOT EXISTS idx_location_inventory_location ON location_inventory(location_id);
                    CREATE INDEX IF NOT EXISTS idx_location_inventory_producto ON location_inventory(producto_id);
                    
                    COMMIT;
                `);
            }
        } catch (err) {
            console.error('Error al normalizar la tabla location_inventory:', err);
        }

        // Migraciones: recetas producen productos terminados
        try { this._sqldb.exec('ALTER TABLE recetas ADD COLUMN producto_id INTEGER'); } catch (_) { /* ya existe */ }
        try {
            this._sqldb.exec(`
                INSERT INTO productos (nombre, descripcion, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario)
                SELECT r.nombre,
                       COALESCE(r.descripcion, 'Producto terminado desde receta'),
                       c.id,
                       'pza',
                       0,
                       0,
                       0
                FROM recetas r
                JOIN categorias c ON lower(c.nombre) = lower('Productos')
                WHERE r.producto_id IS NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM productos p
                      LEFT JOIN categorias pc ON pc.id = p.categoria_id
                      WHERE lower(p.nombre) = lower(r.nombre)
                        AND lower(COALESCE(pc.nombre, '')) = lower('Productos')
                  )
            `);
        } catch (_) { /* ignorar */ }
        try {
            this._sqldb.exec(`
                UPDATE recetas
                SET producto_id = (
                    SELECT p.id
                    FROM productos p
                    LEFT JOIN categorias c ON c.id = p.categoria_id
                    WHERE lower(p.nombre) = lower(recetas.nombre)
                      AND lower(COALESCE(c.nombre, '')) = lower('Productos')
                    LIMIT 1
                )
                WHERE producto_id IS NULL
            `);
        } catch (_) { /* ignorar */ }
        // Migraciones: insumos en unidades pequenas para evitar decimales largos.
        // kg -> g y lt -> ml, manteniendo costo total equivalente.
        try {
            this._sqldb.exec(`
                UPDATE receta_ingredientes
                SET cantidad = ROUND(cantidad * 1000, 6)
                WHERE producto_id IN (
                    SELECT p.id
                    FROM productos p
                    JOIN categorias c ON c.id = p.categoria_id
                    WHERE lower(c.nombre) = lower('Insumos')
                      AND lower(p.unidad) = lower('kg')
                )
            `);
            this._sqldb.exec(`
                UPDATE movimientos_inventario
                SET cantidad = ROUND(cantidad * 1000, 6)
                WHERE producto_id IN (
                    SELECT p.id
                    FROM productos p
                    JOIN categorias c ON c.id = p.categoria_id
                    WHERE lower(c.nombre) = lower('Insumos')
                      AND lower(p.unidad) = lower('kg')
                )
            `);
            this._sqldb.exec(`
                UPDATE solicitudes_entrada
                SET cantidad = ROUND(cantidad * 1000, 6)
                WHERE producto_id IN (
                    SELECT p.id
                    FROM productos p
                    JOIN categorias c ON c.id = p.categoria_id
                    WHERE lower(c.nombre) = lower('Insumos')
                      AND lower(p.unidad) = lower('kg')
                )
            `);
            this._sqldb.exec(`
                UPDATE productos
                SET unidad = 'g',
                    stock_actual = ROUND(stock_actual * 1000, 6),
                    stock_minimo = ROUND(stock_minimo * 1000, 6),
                    precio_unitario = ROUND(precio_unitario / 1000, 6),
                    actualizado_en = datetime('now')
                WHERE id IN (
                    SELECT p.id
                    FROM productos p
                    JOIN categorias c ON c.id = p.categoria_id
                    WHERE lower(c.nombre) = lower('Insumos')
                      AND lower(p.unidad) = lower('kg')
                )
            `);
        } catch (_) { /* ignorar */ }
        try {
            this._sqldb.exec(`
                UPDATE receta_ingredientes
                SET cantidad = ROUND(cantidad * 1000, 6)
                WHERE producto_id IN (
                    SELECT p.id
                    FROM productos p
                    JOIN categorias c ON c.id = p.categoria_id
                    WHERE lower(c.nombre) = lower('Insumos')
                      AND lower(p.unidad) = lower('lt')
                )
            `);
            this._sqldb.exec(`
                UPDATE movimientos_inventario
                SET cantidad = ROUND(cantidad * 1000, 6)
                WHERE producto_id IN (
                    SELECT p.id
                    FROM productos p
                    JOIN categorias c ON c.id = p.categoria_id
                    WHERE lower(c.nombre) = lower('Insumos')
                      AND lower(p.unidad) = lower('lt')
                )
            `);
            this._sqldb.exec(`
                UPDATE solicitudes_entrada
                SET cantidad = ROUND(cantidad * 1000, 6)
                WHERE producto_id IN (
                    SELECT p.id
                    FROM productos p
                    JOIN categorias c ON c.id = p.categoria_id
                    WHERE lower(c.nombre) = lower('Insumos')
                      AND lower(p.unidad) = lower('lt')
                )
            `);
            this._sqldb.exec(`
                UPDATE productos
                SET unidad = 'ml',
                    stock_actual = ROUND(stock_actual * 1000, 6),
                    stock_minimo = ROUND(stock_minimo * 1000, 6),
                    precio_unitario = ROUND(precio_unitario / 1000, 6),
                    actualizado_en = datetime('now')
                WHERE id IN (
                    SELECT p.id
                    FROM productos p
                    JOIN categorias c ON c.id = p.categoria_id
                    WHERE lower(c.nombre) = lower('Insumos')
                      AND lower(p.unidad) = lower('lt')
                )
            `);
        } catch (_) { /* ignorar */ }
        this._save();
    }

    _save() {
        if (!this._inTx) {
            fs.writeFileSync(DB_PATH, Buffer.from(this._sqldb.export()));
        }
    }

    prepare(sql)  { return new Stmt(this, sql); }

    exec(sql) {
        this._sqldb.exec(sql);
        this._save();
    }

    pragma() { /* no-op */ }

    transaction(fn) {
        return (...args) => {
            this._sqldb.exec('BEGIN');
            this._inTx = true;
            try {
                const result = fn(...args);
                this._sqldb.exec('COMMIT');
                this._inTx = false;
                this._save();
                return result;
            } catch (e) {
                this._inTx = false;
                try { this._sqldb.exec('ROLLBACK'); } catch (_) { /* ignorar */ }
                throw e;
            }
        };
    }
}

// Modulo publico
const db = {
    async init() {
        const SQL = await initSqlJs();
        _db = new Db(SQL);
        console.log('  Base de datos lista ->', DB_PATH);
    },

    prepare(sql)        { return _db.prepare(sql); },
    exec(sql)           { return _db.exec(sql); },
    pragma(str)         { /* no-op */ },
    transaction(fn)     { return _db.transaction(fn); },
};

module.exports = db;
