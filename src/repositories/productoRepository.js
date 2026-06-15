const db = require('../db/database');

class ProductoRepository {
    getAll(categoria) {
        const params = [];
        let where = '';

        if (categoria) {
            where = 'WHERE lower(c.nombre) = lower(?)';
            params.push(categoria);
        }

        return db.prepare(`
            SELECT p.*, c.nombre AS categoria,
                   r.id AS receta_id,
                   CASE WHEN r.id IS NULL THEN 0 ELSE 1 END AS ligado_registro
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN recetas r ON r.producto_id = p.id
            ${where}
            GROUP BY p.id
            ORDER BY p.nombre
        `).all(params);
    }

    getById(id) {
        return db.prepare(`
            SELECT p.*, c.nombre AS categoria,
                   r.id AS receta_id,
                   CASE WHEN r.id IS NULL THEN 0 ELSE 1 END AS ligado_registro
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN recetas r ON r.producto_id = p.id
            WHERE p.id = ?
            GROUP BY p.id
        `).get(id);
    }

    getByIdRaw(id) {
        return db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    }

    create({ nombre, descripcion, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario }) {
        return db.prepare(`
            INSERT INTO productos (nombre, descripcion, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(nombre, descripcion || null, categoria_id || null, unidad, stock_actual, stock_minimo, precio_unitario);
    }

    update(id, { nombre, descripcion, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario }) {
        return db.prepare(`
            UPDATE productos SET
                nombre = ?, descripcion = ?, categoria_id = ?, unidad = ?,
                stock_actual = ?, stock_minimo = ?, precio_unitario = ?,
                actualizado_en = datetime('now')
            WHERE id = ?
        `).run(nombre, descripcion || null, categoria_id || null, unidad,
               stock_actual, stock_minimo, precio_unitario, id);
    }

    deleteCascade(id, recetas) {
        db.transaction(() => {
            for (const receta of recetas) {
                db.prepare('DELETE FROM receta_ingredientes WHERE receta_id = ?').run(receta.id);
            }
            db.prepare('DELETE FROM recetas WHERE producto_id = ?').run(id);
            db.prepare('DELETE FROM receta_ingredientes WHERE producto_id = ?').run(id);
            db.prepare('DELETE FROM pedido_detalles WHERE producto_id = ?').run(id);
            db.prepare('DELETE FROM location_inventory WHERE producto_id = ?').run(id);
            db.prepare('DELETE FROM productos WHERE id = ?').run(id);
        })();
    }

    updateStock(id, stockNuevo) {
        return db.prepare(`
            UPDATE productos
            SET stock_actual = ?, actualizado_en = datetime('now')
            WHERE id = ?
        `).run(stockNuevo, id);
    }

    getLowStock() {
        return db.prepare(`
            SELECT * FROM productos
            WHERE stock_actual <= stock_minimo
            ORDER BY nombre
        `).all();
    }
}

module.exports = new ProductoRepository();
