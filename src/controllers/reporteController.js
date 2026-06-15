const reporteService = require('../services/reporteService');

class ReporteController {
    async getInventario(req, res) {
        try {
            const result = await reporteService.getInventarioReport();
            res.json({ ok: true, ...result });
        } catch (error) {
            console.error('/api/reportes/inventario:', error.message);
            res.json({ ok: false, error: error.message });
        }
    }

    async getMovimientos(req, res) {
        const { desde, hasta } = req.query;
        try {
            const result = await reporteService.getMovimientosReport(desde, hasta);
            res.json({ ok: true, ...result });
        } catch (error) {
            console.error('/api/reportes/movimientos:', error.message);
            res.json({ ok: false, error: error.message });
        }
    }

    async getPedidos(req, res) {
        const { desde, hasta, estado } = req.query;
        try {
            const result = await reporteService.getPedidosReport(desde, hasta, estado);
            res.json({ ok: true, ...result });
        } catch (error) {
            console.error('/api/reportes/pedidos:', error.message);
            res.json({ ok: false, error: error.message });
        }
    }
}

module.exports = new ReporteController();
