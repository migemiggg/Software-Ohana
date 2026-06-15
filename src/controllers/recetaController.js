const recetaService = require('../services/recetaService');

class RecetaController {
    async getAll(req, res) {
        try {
            const list = await recetaService.getAll();
            res.json(list);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getById(req, res) {
        try {
            const receta = await recetaService.getById(req.params.id);
            res.json(receta);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async create(req, res) {
        try {
            const result = await recetaService.create(req.body);
            res.json({ ok: true, ...result });
        } catch (error) {
            res.status(error.status || 400).json({ error: error.message });
        }
    }

    async update(req, res) {
        try {
            const result = await recetaService.update(req.params.id, req.body);
            res.json({ ok: true, ...result });
        } catch (error) {
            res.status(error.status || 400).json({ error: error.message });
        }
    }

    async calcular(req, res) {
        try {
            const result = await recetaService.calcular(req.params.id, req.query.porciones);
            res.json(result);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async registrarProduccion(req, res) {
        const cantidad = parseFloat(req.body.cantidad) || 0;
        try {
            const result = await recetaService.registrarProduccion(req.params.id, cantidad);
            res.json({ ok: true, ...result });
        } catch (error) {
            if (error.faltantes) {
                res.status(400).json({ error: error.message, faltantes: error.faltantes });
            } else {
                res.status(400).json({ error: error.message });
            }
        }
    }

    async delete(req, res) {
        try {
            const productoId = await recetaService.delete(req.params.id);
            res.json({ ok: true, producto_id: productoId });
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }
}

module.exports = new RecetaController();
