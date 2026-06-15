const db = require('../db/database');

class EmpleadoRepository {
    getByCorreo(correo) {
        return db.prepare('SELECT * FROM empleados WHERE correo = ? AND activo = 1').get(correo);
    }

    getById(id) {
        return db.prepare('SELECT id, nombre, apellido, correo, telefono, rol, activo, notas, creado_en FROM empleados WHERE id = ?').get(id);
    }

    updatePassword(id, hash) {
        return db.prepare('UPDATE empleados SET contrasena = ? WHERE id = ?').run(hash, id);
    }

    search({ rol, activo, q }) {
        let sql = 'SELECT id, nombre, apellido, correo, telefono, rol, activo, notas, creado_en FROM empleados WHERE 1=1';
        const params = [];
        if (rol) {
            sql += ' AND rol = ?';
            params.push(rol);
        }
        if (activo !== undefined && activo !== '') {
            sql += ' AND activo = ?';
            params.push(activo === '1' ? 1 : 0);
        }
        if (q) {
            sql += ' AND (nombre LIKE ? OR apellido LIKE ? OR correo LIKE ?)';
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        sql += ' ORDER BY nombre ASC';
        return db.prepare(sql).all(params);
    }

    create({ nombre, apellido, correo, telefono, rol, notas, hash }) {
        return db.prepare(`
            INSERT INTO empleados (nombre, apellido, correo, telefono, rol, notas, contrasena)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(nombre, apellido || null, correo || null, telefono || null, rol || 'empleado', notas || null, hash);
    }

    update(id, { nombre, apellido, correo, telefono, rol, notas, hash }) {
        if (hash) {
            return db.prepare(`
                UPDATE empleados SET
                    nombre = ?, apellido = ?, correo = ?, telefono = ?,
                    rol = ?, notas = ?, contrasena = ?
                WHERE id = ?
            `).run(nombre, apellido || null, correo || null, telefono || null, rol || 'empleado', notas || null, hash, id);
        } else {
            return db.prepare(`
                UPDATE empleados SET
                    nombre = ?, apellido = ?, correo = ?, telefono = ?,
                    rol = ?, notas = ?
                WHERE id = ?
            `).run(nombre, apellido || null, correo || null, telefono || null, rol || 'empleado', notas || null, id);
        }
    }

    toggleActivo(id, currentActivo) {
        const nuevo = currentActivo ? 0 : 1;
        db.prepare('UPDATE empleados SET activo = ? WHERE id = ?').run(nuevo, id);
        return nuevo;
    }

    getActivoStatus(id) {
        return db.prepare('SELECT activo FROM empleados WHERE id = ?').get(id);
    }

    delete(id) {
        return db.prepare('DELETE FROM empleados WHERE id = ?').run(id);
    }
}

module.exports = new EmpleadoRepository();
