const express = require('express');
const solicitudController = require('../controllers/solicitudController');
const { requireRoles } = require('../middleware/auth');
const router = express.Router();

const ADMIN_EMP = requireRoles('admin', 'empleado');
const ALL_AUTH  = requireRoles('admin', 'empleado', 'proveedor');

router.get('/api/solicitudes', ADMIN_EMP, solicitudController.getAll);
router.get('/api/solicitudes/mias', ALL_AUTH, solicitudController.getMias);
router.post('/api/solicitudes', ALL_AUTH, solicitudController.create);
router.patch('/api/solicitudes/:id/aprobar', ADMIN_EMP, solicitudController.aprobar);
router.patch('/api/solicitudes/:id/rechazar', ADMIN_EMP, solicitudController.rechazar);

module.exports = router;
