const db = require('../db/database');

class RecetaRepository {
    getAll() {
        return db.prepare(`
            SELECT r.*, p.nombre AS producto_nombre, p.unidad AS producto_unidad
            FROM recetas r
            LEFT JOIN productos p ON p.id = r.producto_id
            ORDER BY r.nombre
        `).all();
    }

    getById(id) {
        return db.prepare(`
            SELECT r.*, p.nombre AS producto_nombre, p.unidad AS producto_unidad
            FROM recetas r
            LEFT JOIN productos p ON p.id = r.producto_id
            WHERE r.id = ?
        `).get(id);
    }

    getIngredientes(recetaId) {
        return db.prepare(`
            SELECT ri.*, p.nombre AS producto, p.unidad, p.stock_actual
            FROM receta_ingredientes ri
            JOIN productos p ON p.id = ri.producto_id
            WHERE ri.receta_id = ?
        `).all(recetaId);
    }

    getIngredientesWithPrice(recetaId) {
        return db.prepare(`
            SELECT ri.*, p.nombre AS producto, p.unidad, p.stock_actual, p.precio_unitario
            FROM receta_ingredientes ri
            JOIN productos p ON p.id = ri.producto_id
            WHERE ri.receta_id = ?
        `).all(recetaId);
    }

    getByName(nombre) {
        return db.prepare('SELECT id FROM recetas WHERE LOWER(nombre) = LOWER(?)').get(nombre);
    }

    getByNameExcludeId(nombre, id) {
        return db.prepare('SELECT id FROM recetas WHERE LOWER(nombre) = LOWER(?) AND id != ?').get(nombre, id);
    }

    getByProductoId(productoId) {
        return db.prepare('SELECT id FROM recetas WHERE producto_id = ?').get(productoId);
    }

    create({ nombre, descripcion, producto_id, porciones }) {
        return db.prepare(`
            INSERT INTO recetas (nombre, descripcion, producto_id, porciones) VALUES (?, ?, ?, ?)
        `).run(nombre, descripcion, producto_id, porciones);
    }

    update(id, { nombre, descripcion, producto_id, porciones }) {
        return db.prepare(`
            UPDATE recetas SET nombre = ?, descripcion = ?, producto_id = ?, porciones = ? WHERE id = ?
        `).run(nombre, descripcion, producto_id, porciones, id);
    }

    insertIngrediente({ receta_id, producto_id, cantidad }) {
        return db.prepare(`
            INSERT INTO receta_ingredientes (receta_id, producto_id, cantidad) VALUES (?, ?, ?)
        `).run(receta_id, producto_id, cantidad);
    }

    deleteIngredientes(recetaId) {
        return db.prepare('DELETE FROM receta_ingredientes WHERE receta_id = ?').run(recetaId);
    }

    delete(id) {
        return db.prepare('DELETE FROM recetas WHERE id = ?').run(id);
    }

    getCategoriaByName(nombre) {
        return db.prepare('SELECT id FROM categorias WHERE lower(nombre) = lower(?)').get(nombre);
    }

    createCategoria(nombre, descripcion) {
        return db.prepare('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)')
            .run(nombre, descripcion);
    }

    getProductoById(id) {
        return db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    }

    getProductoTerminadoByName(nombre) {
        return db.prepare(`
            SELECT p.*
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE lower(p.nombre) = lower(?)
              AND lower(COALESCE(c.nombre, '')) = lower('Productos')
            LIMIT 1
        `).get(nombre);
    }

    createProductoTerminado({ nombre, descripcion, categoriaId, unidad, precioUnitario }) {
        return db.prepare(`
            INSERT INTO productos (nombre, descripcion, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario)
            VALUES (?, ?, ?, ?, 0, 0, ?)
        `).run(nombre, descripcion, categoriaId, unidad, precioUnitario);
    }

    updateProductoTerminado(id, { nombre, descripcion, categoriaId, unidad, precioUnitario }) {
        return db.prepare(`
            UPDATE productos
            SET nombre = ?, descripcion = ?, categoria_id = ?, unidad = ?,
                stock_minimo = 0,
                precio_unitario = ?, actualizado_en = datetime('now')
            WHERE id = ?
        `).run(nombre, descripcion, categoriaId, unidad, precioUnitario, id);
    }

    deleteProductoTerminado(id) {
        db.prepare('DELETE FROM pedido_detalles WHERE producto_id = ?').run(id);
        db.prepare('DELETE FROM location_inventory WHERE producto_id = ?').run(id);
        db.prepare('DELETE FROM productos WHERE id = ?').run(id);
    }

    executeTransaction(fn) {
        return db.transaction(fn);
    }
}

module.exports = new RecetaRepository();
