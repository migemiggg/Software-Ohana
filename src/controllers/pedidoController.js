const pedidoService = require('../services/pedidoService');

class PedidoController {
    async getAll(req, res) {
        try {
            const list = await pedidoService.getAll();
            res.json(list);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getById(req, res) {
        try {
            const pedido = await pedidoService.getById(req.params.id);
            res.json(pedido);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async create(req, res) {
        try {
            const id = await pedidoService.create(req.body, req.session.usuario.id);
            res.json({ ok: true, id });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async updateEstado(req, res) {
        const { estado } = req.body;
        try {
            await pedidoService.updateEstado(req.params.id, estado);
            res.json({ ok: true });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async delete(req, res) {
        try {
            await pedidoService.delete(req.params.id);
            res.json({ ok: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new PedidoController();
