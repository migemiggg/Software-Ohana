const mapaService = require('../services/mapaService');

function numberOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

class MapaController {
    async getStats(req, res) {
        try {
            const stats = await mapaService.getStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getLocations(req, res) {
        const { q = '', product_type = '', presentation = '', cliente_id = '' } = req.query;
        try {
            const locations = await mapaService.getLocations({ q, product_type, presentation, cliente_id });
            res.json(locations);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getLocationById(req, res) {
        try {
            const loc = await mapaService.getLocationWithInventory(req.params.id);
            if (!loc) return res.status(404).json({ error: 'Ubicacion no encontrada.' });
            res.json(loc);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createLocation(req, res) {
        const { name, address, description, cliente_id } = req.body;
        const latitude = numberOrNull(req.body.latitude);
        const longitude = numberOrNull(req.body.longitude);

        try {
            const id = await mapaService.createLocation({ name, address, latitude, longitude, description, cliente_id });
            res.json({ ok: true, id });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async updateLocation(req, res) {
        const { name, address, description, cliente_id } = req.body;
        const latitude = numberOrNull(req.body.latitude);
        const longitude = numberOrNull(req.body.longitude);

        try {
            await mapaService.updateLocation(req.params.id, { name, address, latitude, longitude, description, cliente_id });
            res.json({ ok: true });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteLocation(req, res) {
        try {
            await mapaService.deleteLocation(req.params.id);
            res.json({ ok: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async addInventory(req, res) {
        const { location_id, producto_id, notes, image_url } = req.body;
        const quantity = numberOrNull(req.body.quantity);

        try {
            const id = await mapaService.addInventory({ location_id, producto_id, notes, image_url, quantity }, req.session.usuario.id);
            res.json({ ok: true, id });
        } catch (error) {
            const status = error.message.includes('no encontrada') || error.message.includes('no encontrado') ? 404 : 400;
            res.status(status).json({ error: error.message });
        }
    }

    async updateInventory(req, res) {
        const { producto_id, notes, image_url } = req.body;
        const quantity = numberOrNull(req.body.quantity);

        try {
            await mapaService.updateInventory(req.params.id, { producto_id, quantity, notes, image_url }, req.session.usuario.id);
            res.json({ ok: true });
        } catch (error) {
            const status = error.message.includes('no encontrado') ? 404 : 400;
            res.status(status).json({ error: error.message });
        }
    }

    async deleteInventory(req, res) {
        try {
            await mapaService.deleteInventory(req.params.id);
            res.json({ ok: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getHistory(req, res) {
        try {
            const history = await mapaService.getHistory();
            res.json(history);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getClientes(req, res) {
        try {
            const list = await mapaService.getClientes(req.query.q);
            res.json(list);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createCliente(req, res) {
        try {
            const id = await mapaService.createCliente(req.body);
            res.json({ ok: true, id });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getClienteLocations(req, res) {
        try {
            const locations = await mapaService.getClienteLocations(req.params.id);
            res.json(locations);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getProductTypes(req, res) {
        try {
            const types = await mapaService.getProductTypes();
            res.json(types);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new MapaController();
