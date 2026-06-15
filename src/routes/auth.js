const express = require('express');
const authController = require('../controllers/authController');
const router = express.Router();

router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/logout', authController.getLogout);
router.get('/api/session', authController.getSession);
router.patch('/api/perfil/password', authController.patchPassword);

module.exports = router;
