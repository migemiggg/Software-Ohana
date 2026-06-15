const db = require('../db/database');

class UsuarioRepository {
    getByCorreo(correo) {
        return db.prepare('SELECT * FROM usuarios WHERE correo = ?').get(correo);
    }

    getById(id) {
        return db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    }

    updatePassword(id, hash) {
        return db.prepare('UPDATE usuarios SET contrasena = ? WHERE id = ?').run(hash, id);
    }
}

module.exports = new UsuarioRepository();
