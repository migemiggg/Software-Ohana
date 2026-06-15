const express = require('express');
const empleadoController = require('../controllers/empleadoController');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/api/empleados', requireLogin, empleadoController.getAll);
router.get('/api/empleados/:id', requireLogin, empleadoController.getById);
router.post('/api/empleados', requireLogin, empleadoController.create);
router.put('/api/empleados/:id', requireLogin, empleadoController.update);
router.patch('/api/empleados/:id/toggle', requireLogin, empleadoController.toggle);
router.delete('/api/empleados/:id', requireLogin, requireAdmin, empleadoController.delete);

module.exports = router;
