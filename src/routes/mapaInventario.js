const express = require('express');
const mapaController = require('../controllers/mapaController');
const { requireLogin, requireRoles } = require('../middleware/auth');
const router = express.Router();

router.use(requireLogin);

router.get('/api/mapa-inventario/stats', mapaController.getStats);
router.get('/api/mapa-inventario/locations', mapaController.getLocations);
router.get('/api/mapa-inventario/locations/:id', mapaController.getLocationById);
router.post('/api/mapa-inventario/locations', requireRoles('admin'), mapaController.createLocation);
router.put('/api/mapa-inventario/locations/:id', requireRoles('admin'), mapaController.updateLocation);
router.delete('/api/mapa-inventario/locations/:id', requireRoles('admin'), mapaController.deleteLocation);

router.post('/api/mapa-inventario/inventory', requireRoles('admin'), mapaController.addInventory);
router.put('/api/mapa-inventario/inventory/:id', requireRoles('admin'), mapaController.updateInventory);
router.delete('/api/mapa-inventario/inventory/:id', requireRoles('admin'), mapaController.deleteInventory);

router.get('/api/mapa-inventario/history', mapaController.getHistory);
router.get('/api/clientes', mapaController.getClientes);
router.post('/api/clientes', requireRoles('admin'), mapaController.createCliente);
router.get('/api/clientes/:id/locations', mapaController.getClienteLocations);
router.get('/api/mapa-inventario/product-types', mapaController.getProductTypes);

module.exports = router;
