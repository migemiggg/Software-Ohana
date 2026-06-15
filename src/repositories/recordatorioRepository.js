const db = require('../db/database');

class RecordatorioRepository {
    getAllByUsuarioId(usuarioId) {
        return db.prepare(`
            SELECT * FROM recordatorios
            WHERE usuario_id = ? OR usuario_id IS NULL
            ORDER BY completado ASC, fecha ASC
        `).all(usuarioId);
    }

    getById(id) {
        return db.prepare('SELECT * FROM recordatorios WHERE id = ?').get(id);
    }

    create({ titulo, descripcion, fecha, usuario_id }) {
        return db.prepare(`
            INSERT INTO recordatorios (titulo, descripcion, fecha, usuario_id)
            VALUES (?, ?, ?, ?)
        `).run(titulo, descripcion, fecha, usuario_id);
    }

    update(id, { titulo, descripcion, fecha }) {
        return db.prepare(`
            UPDATE recordatorios SET titulo = ?, descripcion = ?, fecha = ? WHERE id = ?
        `).run(titulo, descripcion, fecha, id);
    }

    updateCompletado(id, completado) {
        return db.prepare('UPDATE recordatorios SET completado = ? WHERE id = ?').run(completado, id);
    }

    delete(id) {
        return db.prepare('DELETE FROM recordatorios WHERE id = ?').run(id);
    }
}

module.exports = new RecordatorioRepository();
