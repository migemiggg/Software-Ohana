const express = require('express');
const inventarioController = require('../controllers/inventarioController');
const { requireLogin } = require('../middleware/auth');
const router = express.Router();

router.use(requireLogin);

/* ─── CATEGORÍAS ─── */
router.get('/api/categorias', inventarioController.getCategorias);

/* ─── PRODUCTOS ─── */
router.get('/api/productos', inventarioController.getProductos);
router.get('/api/productos/:id', inventarioController.getProductoById);
router.post('/api/productos', inventarioController.createProducto);
router.put('/api/productos/:id', inventarioController.updateProducto);
router.delete('/api/productos/:id', inventarioController.deleteProducto);

/* ─── MOVIMIENTOS ─── */
router.post('/api/movimientos', inventarioController.createMovimiento);
router.get('/api/movimientos', inventarioController.getMovimientos);
router.put('/api/movimientos/:id', inventarioController.updateMovimiento);
router.delete('/api/movimientos/:id', inventarioController.deleteMovimiento);
router.get('/api/movimientos/:producto_id', inventarioController.getMovimientosByProductoId);

/* ─── ALERTAS DE STOCK BAJO ─── */
router.get('/api/alertas/stock', inventarioController.getAlertasStock);

module.exports = router;
