const recordatorioService = require('../services/recordatorioService');

class RecordatorioController {
    async getAll(req, res) {
        try {
            const list = await recordatorioService.getAll(req.session.usuario.id);
            res.json(list);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async create(req, res) {
        try {
            const id = await recordatorioService.create(req.body, req.session.usuario.id);
            res.json({ ok: true, id });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async toggle(req, res) {
        try {
            const completado = await recordatorioService.toggle(req.params.id);
            res.json({ ok: true, completado });
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async update(req, res) {
        try {
            await recordatorioService.update(req.params.id, req.body);
            res.json({ ok: true });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async delete(req, res) {
        try {
            await recordatorioService.delete(req.params.id);
            res.json({ ok: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new RecordatorioController();
