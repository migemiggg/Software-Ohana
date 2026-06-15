const inventarioService = require('../services/inventarioService');

class InventarioController {
    async getCategorias(req, res) {
        try {
            const list = await inventarioService.getCategorias();
            res.json(list);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getProductos(req, res) {
        try {
            const list = await inventarioService.getProductos(req.query.categoria);
            res.json(list);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getProductoById(req, res) {
        try {
            const prod = await inventarioService.getProductoById(req.params.id);
            res.json(prod);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async createProducto(req, res) {
        try {
            const id = await inventarioService.createProducto(req.body);
            res.json({ ok: true, id });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async updateProducto(req, res) {
        try {
            await inventarioService.updateProducto(req.params.id, req.body);
            res.json({ ok: true });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteProducto(req, res) {
        try {
            const recetasEliminadas = await inventarioService.deleteProducto(req.params.id);
            res.json({ ok: true, recetas_eliminadas: recetasEliminadas });
        } catch (error) {
            res.status(error.message === 'Producto no encontrado.' ? 404 : 500).json({ ok: false, error: error.message });
        }
    }

    async createMovimiento(req, res) {
        try {
            const result = await inventarioService.registrarMovimientos(req.body.movimientos, req.body, req.session.usuario.id);
            res.json({ ok: true, ...result });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, error: error.message });
        }
    }

    async getMovimientos(req, res) {
        const { producto_id = '', q = '', limit = 150 } = req.query;
        try {
            const list = await inventarioService.getMovimientos({ producto_id, q, limit });
            res.json(list);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getMovimientosByProductoId(req, res) {
        try {
            const list = await inventarioService.getMovimientosByProductoId(req.params.producto_id);
            res.json(list);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateMovimiento(req, res) {
        try {
            const stockNuevo = await inventarioService.updateMovimiento(req.params.id, req.body);
            res.json({ ok: true, stock_nuevo: stockNuevo });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, error: error.message });
        }
    }

    async deleteMovimiento(req, res) {
        try {
            const result = await inventarioService.deleteMovimiento(req.params.id);
            res.json({ ok: true, ...result });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, error: error.message });
        }
    }

    async getAlertasStock(req, res) {
        try {
            const list = await inventarioService.getAlertasStock();
            res.json(list);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new InventarioController();
