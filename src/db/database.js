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
