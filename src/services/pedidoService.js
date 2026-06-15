const db = require('../db/database');
const pedidoRepository = require('../repositories/pedidoRepository');
const clienteRepository = require('../repositories/clienteRepository');
const productoRepository = require('../repositories/productoRepository');

class PedidoService {
    async getAll() {
        return pedidoRepository.getAll();
    }

    async getById(id) {
        const pedido = pedidoRepository.getById(id);
        if (!pedido) throw new Error('Pedido no encontrado.');
        const detalles = pedidoRepository.getDetalles(id);
        return { ...pedido, detalles };
    }

    async create({ cliente_id, location_id, cliente_nombre, cliente_contacto, fecha_entrega, notas, detalles }, usuarioId) {
        if ((!cliente_id && !cliente_nombre) || !detalles || !detalles.length) {
            throw new Error('Faltan datos del pedido.');
        }

        for (const d of detalles) {
            const producto = db.prepare(`
                SELECT p.id, c.nombre AS categoria
                FROM productos p
                LEFT JOIN categorias c ON c.id = p.categoria_id
                WHERE p.id = ?
            `).get(d.producto_id);
            if (!producto || producto.categoria !== 'Productos') {
                throw new Error('Los pedidos solo pueden incluir productos terminados.');
            }
        }

        const total = detalles.reduce((sum, d) => sum + d.cantidad * d.precio, 0);

        const pedidoId = pedidoRepository.createPedidoTransaction(() => {
            let cliente = cliente_id ? clienteRepository.getById(cliente_id) : null;
            if (!cliente && cliente_nombre) {
                cliente = clienteRepository.getByNombre(cliente_nombre);
                if (!cliente) {
                    const insertedCliente = clienteRepository.create(cliente_nombre.trim(), cliente_contacto || null, null, null);
                    cliente = clienteRepository.getById(insertedCliente.lastInsertRowid);
                }
            }

            const info = pedidoRepository.create({
                cliente_id: cliente?.id || null,
                location_id: location_id || null,
                cliente_nombre: cliente?.nombre || cliente_nombre,
                cliente_contacto: cliente?.contacto || cliente_contacto || null,
                fecha_entrega: fecha_entrega || null,
                notas: notas || null,
                total,
                usuario_id: usuarioId
            });

            const pId = info.lastInsertRowid;

            for (const d of detalles) {
                pedidoRepository.insertDetalle({
                    pedido_id: pId,
                    producto_id: d.producto_id,
                    cantidad: d.cantidad,
                    precio: d.precio
                });
            }

            return pId;
        })();

        return pedidoId;
    }

    async updateEstado(id, estado) {
        const estados = ['pendiente', 'en_proceso', 'entregado', 'cancelado'];
        if (!estados.includes(estado)) {
            throw new Error('Estado inválido.');
        }
        pedidoRepository.updateEstado(id, estado);
        return true;
    }

    async delete(id) {
        pedidoRepository.delete(id);
        return true;
    }
}

module.exports = new PedidoService();
