const express = require('express');
const reporteController = require('../controllers/reporteController');
const { requireLogin } = require('../middleware/auth');
const router = express.Router();

router.use(requireLogin);

router.get('/api/reportes/inventario', reporteController.getInventario);
router.get('/api/reportes/movimientos', reporteController.getMovimientos);
router.get('/api/reportes/pedidos', reporteController.getPedidos);

module.exports = router;
