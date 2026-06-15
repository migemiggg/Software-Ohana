const recordatorioRepository = require('../repositories/recordatorioRepository');

class RecordatorioService {
    async getAll(usuarioId) {
        return recordatorioRepository.getAllByUsuarioId(usuarioId);
    }

    async create({ titulo, descripcion, fecha }, usuarioId) {
        if (!titulo || !fecha) throw new Error('Título y fecha son requeridos.');
        const info = recordatorioRepository.create({
            titulo,
            descripcion: descripcion || null,
            fecha,
            usuario_id: usuarioId
        });
        return info.lastInsertRowid;
    }

    async toggle(id) {
        const rec = recordatorioRepository.getById(id);
        if (!rec) throw new Error('Recordatorio no encontrado.');
        const nuevoEstado = rec.completado ? 0 : 1;
        recordatorioRepository.updateCompletado(id, nuevoEstado);
        return !!nuevoEstado;
    }

    async update(id, { titulo, descripcion, fecha }) {
        recordatorioRepository.update(id, {
            titulo,
            descripcion: descripcion || null,
            fecha
        });
        return true;
    }

    async delete(id) {
        recordatorioRepository.delete(id);
        return true;
    }
}

module.exports = new RecordatorioService();
