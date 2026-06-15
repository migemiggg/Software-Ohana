const db = require('../db/database');

class CategoriaRepository {
    getAll() {
        return db.prepare('SELECT * FROM categorias ORDER BY nombre').all();
    }
    getById(id) {
        return db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
    }
}

module.exports = new CategoriaRepository();
