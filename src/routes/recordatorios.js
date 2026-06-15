const express = require('express');
const recordatorioController = require('../controllers/recordatorioController');
const { requireLogin } = require('../middleware/auth');
const router = express.Router();

router.use(requireLogin);

router.get('/api/recordatorios', recordatorioController.getAll);
router.post('/api/recordatorios', recordatorioController.create);
router.patch('/api/recordatorios/:id/toggle', recordatorioController.toggle);
router.put('/api/recordatorios/:id', recordatorioController.update);
router.delete('/api/recordatorios/:id', recordatorioController.delete);

module.exports = router;
