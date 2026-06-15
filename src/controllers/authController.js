const authService = require('../services/authService');

class AuthController {
    getLogin(req, res) {
        if (req.session.usuario) return res.redirect('/dashboard');
        res.sendFile('login.html', { root: 'public' });
    }

    async postLogin(req, res) {
        const { correo, contrasena } = req.body;
        try {
            const sessionData = await authService.login(correo, contrasena);
            req.session.usuario = sessionData;
            res.json({ ok: true });
        } catch (error) {
            res.json({ ok: false, error: error.message });
        }
    }

    getLogout(req, res) {
        req.session.destroy(() => res.redirect('/login'));
    }

    getSession(req, res) {
        if (req.session.usuario) {
            res.json({ ok: true, usuario: req.session.usuario });
        } else {
            res.json({ ok: false });
        }
    }

    async patchPassword(req, res) {
        const { actual, nueva } = req.body;
        try {
            await authService.changePassword(req.session.usuario, actual, nueva);
            res.json({ ok: true });
        } catch (error) {
            const status = error.message === 'No autenticado.' ? 401 : 200;
            res.status(status).json({ ok: false, error: error.message });
        }
    }
}

module.exports = new AuthController();
