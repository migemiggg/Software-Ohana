const express = require('express');
const pedidoController = require('../controllers/pedidoController');
const { requireLogin } = require('../middleware/auth');
const router = express.Router();

router.use(requireLogin);

router.get('/api/pedidos', pedidoController.getAll);
router.get('/api/pedidos/:id', pedidoController.getById);
router.post('/api/pedidos', pedidoController.create);
router.patch('/api/pedidos/:id/estado', pedidoController.updateEstado);
router.delete('/api/pedidos/:id', pedidoController.delete);

module.exports = router;
