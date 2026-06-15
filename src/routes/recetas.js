const express = require('express');
const recetaController = require('../controllers/recetaController');
const { requireLogin } = require('../middleware/auth');
const router = express.Router();

router.use(requireLogin);

router.get('/api/recetas', recetaController.getAll);
router.get('/api/recetas/:id', recetaController.getById);
router.post('/api/recetas', recetaController.create);
router.put('/api/recetas/:id', recetaController.update);
router.get('/api/recetas/:id/calcular', recetaController.calcular);
router.post('/api/recetas/:id/registrar', recetaController.registrarProduccion);
router.delete('/api/recetas/:id', recetaController.delete);

module.exports = router;
