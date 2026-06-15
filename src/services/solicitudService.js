const solicitudRepository = require('../repositories/solicitudRepository');

class SolicitudService {
    async getAll(estado) {
        return solicitudRepository.getAll(estado);
    }

    async getMias(solicitanteId) {
        return solicitudRepository.getAllBySolicitanteId(solicitanteId);
    }

    async create({ producto_id, cantidad, motivo }, sessionUser) {
        if (!producto_id || !cantidad || cantidad <= 0) {
            throw new Error('Producto y cantidad requeridos.');
        }

        const solicitante_id = sessionUser.id;

        // Verificar que el solicitante tenga permisos
        if (sessionUser.rol !== 'proveedor' &&
            sessionUser.rol !== 'admin' &&
            sessionUser.rol !== 'empleado') {
            throw new Error('Sin permiso.');
        }

        const result = solicitudRepository.create({
            producto_id,
            cantidad,
            motivo: motivo || null,
            solicitante_id
        });

        return result.lastInsertRowid;
    }

    async aprobar(id, { nota_revision }, revisorId) {
        const solicitud = solicitudRepository.getById(id);
        if (!solicitud) throw new Error('Solicitud no encontrada.');
        if (solicitud.estado !== 'pendiente') throw new Error('La solicitud ya fue procesada.');

        solicitudRepository.aprobarTransaction(() => {
            // 1. Actualizar solicitud
            solicitudRepository.updateEstadoAprobado(id, {
                revisado_por: revisorId,
                nota_revision: nota_revision || null
            });

            // 2. Crear movimiento de inventario
            solicitudRepository.insertMovimiento({
                producto_id: solicitud.producto_id,
                cantidad: solicitud.cantidad,
                motivo: `Solicitud #${solicitud.id} aprobada`,
                usuario_id: revisorId
            });

            // 3. Actualizar stock
            solicitudRepository.updateStock(solicitud.producto_id, solicitud.cantidad);
        })();

        return true;
    }

    async rechazar(id, { nota_revision }, revisorId) {
        const solicitud = solicitudRepository.getById(id);
        if (!solicitud) throw new Error('Solicitud no encontrada.');
        if (solicitud.estado !== 'pendiente') throw new Error('La solicitud ya fue procesada.');

        solicitudRepository.updateEstadoRechazado(id, {
            revisado_por: revisorId,
            nota_revision: nota_revision || null
        });

        return true;
    }
}

module.exports = new SolicitudService();
