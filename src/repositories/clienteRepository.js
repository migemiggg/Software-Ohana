const db = require('../db/database');

class ClienteRepository {
    getById(id) {
        return db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
    }

    getByNombre(nombre) {
        return db.prepare('SELECT * FROM clientes WHERE lower(nombre) = lower(?) LIMIT 1').get(nombre);
    }

    create(nombre, contacto, correo, notas) {
        return db.prepare(`
            INSERT INTO clientes (nombre, contacto, correo, notas)
            VALUES (?, ?, ?, ?)
        `).run(nombre, contacto, correo, notas);
    }

    getAll(q) {
        const params = [];
        let where = '';
        if (q && q.trim()) {
            where = 'WHERE lower(nombre) LIKE ? OR lower(COALESCE(contacto, "")) LIKE ?';
            params.push(`%${q.trim().toLowerCase()}%`, `%${q.trim().toLowerCase()}%`);
        }

        return db.prepare(`
            SELECT c.*,
                   COUNT(cl.location_id) AS ubicaciones
            FROM clientes c
            LEFT JOIN cliente_locations cl ON cl.cliente_id = c.id
            ${where}
            GROUP BY c.id
            ORDER BY c.nombre
        `).all(params);
    }

    getLocations(clienteId) {
        return db.prepare(`
            SELECT l.*
            FROM locations l
            JOIN cliente_locations cl ON cl.location_id = l.id
            WHERE cl.cliente_id = ?
            ORDER BY l.name
        `).all(clienteId);
    }
}

module.exports = new ClienteRepository();
