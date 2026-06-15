const solicitudService = require('../services/solicitudService');

class SolicitudController {
    async getAll(req, res) {
        try {
            const list = await solicitudService.getAll(req.query.estado);
            res.json({ ok: true, solicitudes: list });
        } catch (error) {
            res.json({ ok: false, error: error.message });
        }
    }

    async getMias(req, res) {
        try {
            const list = await solicitudService.getMias(req.session.usuario.id);
            res.json({ ok: true, solicitudes: list });
        } catch (error) {
            res.json({ ok: false, error: error.message });
        }
    }

    async create(req, res) {
        try {
            const id = await solicitudService.create(req.body, req.session.usuario);
            res.json({ ok: true, id });
        } catch (error) {
            res.json({ ok: false, error: error.message });
        }
    }

    async aprobar(req, res) {
        try {
            await solicitudService.aprobar(req.params.id, req.body, req.session.usuario.id);
            res.json({ ok: true });
        } catch (error) {
            res.json({ ok: false, error: error.message });
        }
    }

    async rechazar(req, res) {
        try {
            await solicitudService.rechazar(req.params.id, req.body, req.session.usuario.id);
            res.json({ ok: true });
        } catch (error) {
            res.json({ ok: false, error: error.message });
        }
    }
}

module.exports = new SolicitudController();
