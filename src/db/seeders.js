/**
 * OhanApp - Seeders (datos iniciales)
 * Ejecutar: node src/db/seeders.js
 */

const db = require('./database');

function seed() {
    console.log('🌱 Iniciando seeders...');

    try {
        // Limpiar tablas existentes
        db.prepare('DELETE FROM receta_ingredientes').run();
        db.prepare('DELETE FROM recetas').run();
        db.prepare('DELETE FROM movimientos_inventario').run();
        db.prepare('DELETE FROM productos').run();
        db.prepare('DELETE FROM categorias').run();
        db.prepare('DELETE FROM usuarios').run();

        // ════════════════════════════════════════════════════
        // USUARIOS
        // ════════════════════════════════════════════════════
        db.prepare(`
            INSERT INTO usuarios (nombre, correo, contrasena, rol) 
            VALUES (?, ?, ?, ?)
        `).run('Admin Ohana', 'admin@ohana.com', 'admin123', 'admin');

        db.prepare(`
            INSERT INTO usuarios (nombre, correo, contrasena, rol) 
            VALUES (?, ?, ?, ?)
        `).run('Juan Pérez', 'juan@ohana.com', 'juan123', 'empleado');

        console.log('✓ Usuarios insertados');

        // ════════════════════════════════════════════════════
        // CATEGORÍAS
        // ════════════════════════════════════════════════════
        const categorias = [
            { id: 1, nombre: 'Harina y Harinas', descripcion: 'Harinas de trigo y otras' },
            { id: 2, nombre: 'Lácteos', descripcion: 'Leche, queso, mantequilla' },
            { id: 3, nombre: 'Frutas y Verduras', descripcion: 'Productos frescos' },
            { id: 4, nombre: 'Carnes', descripcion: 'Carnes frescas y procesadas' },
            { id: 5, nombre: 'Condimentos', descripcion: 'Especias y condimentos' },
            { id: 6, nombre: 'Azúcares y Edulcorantes', descripcion: 'Azúcar, miel, etc' }
        ];

        for (const cat of categorias) {
            db.prepare('INSERT INTO categorias (id, nombre, descripcion) VALUES (?, ?, ?)')
                .run(cat.id, cat.nombre, cat.descripcion);
        }
        console.log('✓ Categorías insertadas');

        // ════════════════════════════════════════════════════
        // PRODUCTOS
        // ════════════════════════════════════════════════════
        const productos = [
            // Harinas
            { nombre: 'Harina de trigo', categoria_id: 1, unidad: 'kg', stock: 50, minimo: 10, precio: 2.50 },
            { nombre: 'Harina de maíz', categoria_id: 1, unidad: 'kg', stock: 30, minimo: 5, precio: 3.00 },
            
            // Lácteos
            { nombre: 'Leche fresca', categoria_id: 2, unidad: 'lt', stock: 100, minimo: 20, precio: 1.20 },
            { nombre: 'Queso oaxaca', categoria_id: 2, unidad: 'kg', stock: 25, minimo: 5, precio: 12.00 },
            { nombre: 'Mantequilla', categoria_id: 2, unidad: 'kg', stock: 15, minimo: 3, precio: 8.50 },
            { nombre: 'Huevos', categoria_id: 2, unidad: 'docena', stock: 40, minimo: 10, precio: 3.50 },
            
            // Frutas y Verduras
            { nombre: 'Tomate rojo', categoria_id: 3, unidad: 'kg', stock: 45, minimo: 10, precio: 1.80 },
            { nombre: 'Cebolla blanca', categoria_id: 3, unidad: 'kg', stock: 60, minimo: 15, precio: 0.90 },
            { nombre: 'Ajo', categoria_id: 3, unidad: 'kg', stock: 20, minimo: 5, precio: 4.50 },
            { nombre: 'Cilantro', categoria_id: 3, unidad: 'manojo', stock: 35, minimo: 5, precio: 0.80 },
            
            // Carnes
            { nombre: 'Pollo entero', categoria_id: 4, unidad: 'kg', stock: 55, minimo: 15, precio: 7.00 },
            { nombre: 'Carne molida', categoria_id: 4, unidad: 'kg', stock: 30, minimo: 10, precio: 9.50 },
            
            // Condimentos
            { nombre: 'Sal de mar', categoria_id: 5, unidad: 'kg', stock: 25, minimo: 5, precio: 0.50 },
            { nombre: 'Pimienta negra', categoria_id: 5, unidad: 'kg', stock: 5, minimo: 1, precio: 8.00 },
            { nombre: 'Orégano seco', categoria_id: 5, unidad: 'kg', stock: 3, minimo: 1, precio: 6.00 },
            
            // Azúcares
            { nombre: 'Azúcar blanca', categoria_id: 6, unidad: 'kg', stock: 75, minimo: 20, precio: 1.00 },
            { nombre: 'Miel pura', categoria_id: 6, unidad: 'kg', stock: 10, minimo: 2, precio: 12.00 }
        ];

        for (const prod of productos) {
            db.prepare(`
                INSERT INTO productos (nombre, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario) 
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(prod.nombre, prod.categoria_id, prod.unidad, prod.stock, prod.minimo, prod.precio);
        }
        console.log('✓ Productos insertados');

        // ════════════════════════════════════════════════════
        // RECETAS
        // ════════════════════════════════════════════════════
        const recetas = [
            {
                nombre: 'Pan de trigo básico',
                descripcion: 'Pan clásico de trigo para acompañamientos',
                porciones: 1,
                ingredientes: [
                    { nombre: 'Harina de trigo', cantidad: 3 },
                    { nombre: 'Leche fresca', cantidad: 0.5 },
                    { nombre: 'Mantequilla', cantidad: 0.1 },
                    { nombre: 'Sal de mar', cantidad: 0.01 }
                ]
            },
            {
                nombre: 'Salsa de tomate',
                descripcion: 'Salsa casera de tomate fresco',
                porciones: 1,
                ingredientes: [
                    { nombre: 'Tomate rojo', cantidad: 1 },
                    { nombre: 'Cebolla blanca', cantidad: 0.25 },
                    { nombre: 'Ajo', cantidad: 0.05 },
                    { nombre: 'Sal de mar', cantidad: 0.005 },
                    { nombre: 'Pimienta negra', cantidad: 0.001 },
                    { nombre: 'Orégano seco', cantidad: 0.01 }
                ]
            },
            {
                nombre: 'Pollo a la parrilla',
                descripcion: 'Pechuga de pollo marinada y asada',
                porciones: 2,
                ingredientes: [
                    { nombre: 'Pollo entero', cantidad: 0.5 },
                    { nombre: 'Ajo', cantidad: 0.05 },
                    { nombre: 'Limón', cantidad: 0.5 },
                    { nombre: 'Sal de mar', cantidad: 0.01 },
                    { nombre: 'Pimienta negra', cantidad: 0.002 }
                ]
            },
            {
                nombre: 'Huevos rancheros',
                descripcion: 'Huevos con salsa picante y queso',
                porciones: 2,
                ingredientes: [
                    { nombre: 'Huevos', cantidad: 1 },
                    { nombre: 'Tomate rojo', cantidad: 0.5 },
                    { nombre: 'Cebolla blanca', cantidad: 0.25 },
                    { nombre: 'Queso oaxaca', cantidad: 0.1 },
                    { nombre: 'Cilantro', cantidad: 0.5 }
                ]
            }
        ];

        for (const receta of recetas) {
            const info = db.prepare(`
                INSERT INTO recetas (nombre, descripcion, porciones) 
                VALUES (?, ?, ?)
            `).run(receta.nombre, receta.descripcion, receta.porciones);

            const recetaId = info.lastInsertRowid;

            for (const ing of receta.ingredientes) {
                const prod = db.prepare('SELECT id FROM productos WHERE nombre = ?')
                    .get(ing.nombre);
                
                if (prod) {
                    db.prepare(`
                        INSERT INTO receta_ingredientes (receta_id, producto_id, cantidad) 
                        VALUES (?, ?, ?)
                    `).run(recetaId, prod.id, ing.cantidad);
                }
            }
        }
        console.log('✓ Recetas insertadas');

        console.log('✅ ¡Seeders completados exitosamente!');
    } catch (error) {
        console.error('❌ Error durante seeders:', error.message);
        process.exit(1);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    seed();
}

module.exports = { seed };
