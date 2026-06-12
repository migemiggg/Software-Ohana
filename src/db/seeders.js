/**
 * OhanApp - Seeders (datos iniciales)
 * Ejecutar: npm run seed
 */

const bcrypt = require('bcryptjs');
const db = require('./database');

function clearTable(table) {
    try { db.prepare(`DELETE FROM ${table}`).run(); } catch (_) { /* tabla opcional */ }
}

async function seed() {
    await db.init();
    console.log('Iniciando seeders...');

    try {
        [
            'location_inventory_history',
            'location_inventory',
            'cliente_locations',
            'locations',
            'pedido_detalles',
            'pedidos',
            'receta_ingredientes',
            'recetas',
            'movimientos_inventario',
            'solicitudes_entrada',
            'productos',
            'categorias',
            'usuarios'
        ].forEach(clearTable);

        const adminHash = bcrypt.hashSync('ohana123', 10);
        db.prepare(`
            INSERT INTO usuarios (nombre, correo, contrasena, rol)
            VALUES (?, ?, ?, ?)
        `).run('Administrador', 'admin@ohana.com', adminHash, 'admin');

        const categorias = [
            { id: 1, nombre: 'Insumos', descripcion: 'Materias primas para produccion' },
            { id: 2, nombre: 'Productos', descripcion: 'Productos terminados para venta' },
            { id: 3, nombre: 'Empaques', descripcion: 'Materiales de empaque y presentacion' },
            { id: 4, nombre: 'Limpieza', descripcion: 'Productos de limpieza e higiene' }
        ];

        for (const cat of categorias) {
            db.prepare('INSERT INTO categorias (id, nombre, descripcion) VALUES (?, ?, ?)')
                .run(cat.id, cat.nombre, cat.descripcion);
        }

        const productos = [
            { nombre: 'Azucar Refinada', categoria_id: 1, unidad: 'g', stock: 100000, minimo: 0, precio: 0.022 },
            { nombre: 'Concentrado de Horchata', categoria_id: 1, unidad: 'ml', stock: 100000, minimo: 0, precio: 0.052 },
            { nombre: 'Flor de Jamaica', categoria_id: 1, unidad: 'g', stock: 100000, minimo: 0, precio: 0.127 },
            { nombre: 'Limon', categoria_id: 1, unidad: 'g', stock: 2000, minimo: 0, precio: 0.03 },
            { nombre: 'Te Negro', categoria_id: 1, unidad: 'g', stock: 5000, minimo: 0, precio: 0.387 },
            { nombre: 'Botella PET 1LT', categoria_id: 3, unidad: 'pza', stock: 100, minimo: 0, precio: 3 },
            { nombre: 'Botella PET Con Tapas 500ml', categoria_id: 3, unidad: 'pza', stock: 100, minimo: 0, precio: 2.4 },
            { nombre: 'Sabor Jamaica 1LT', categoria_id: 2, unidad: 'lt', stock: 0, minimo: 0, precio: 6.47 },
            { nombre: 'Horchata Clasica 1lt', categoria_id: 2, unidad: 'lt', stock: 0, minimo: 0, precio: 10.55 },
            { nombre: 'Te Negro (1 LT)', categoria_id: 2, unidad: 'lt', stock: 0, minimo: 0, precio: 9.22 }
        ];

        const productIds = new Map();
        for (const prod of productos) {
            const info = db.prepare(`
                INSERT INTO productos (nombre, categoria_id, unidad, stock_actual, stock_minimo, precio_unitario)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(prod.nombre, prod.categoria_id, prod.unidad, prod.stock, prod.minimo, prod.precio);
            productIds.set(prod.nombre, info.lastInsertRowid);
        }

        const recetas = [
            {
                nombre: 'Sabor Jamaica 1LT',
                producto: 'Sabor Jamaica 1LT',
                descripcion: 'Sabor jamaica de 1 litro listo para venta',
                porciones: 1,
                ingredientes: [
                    { nombre: 'Flor de Jamaica', cantidad: 10 },
                    { nombre: 'Botella PET 1LT', cantidad: 1 },
                    { nombre: 'Azucar Refinada', cantidad: 100 }
                ]
            },
            {
                nombre: 'Horchata Clasica 1lt',
                producto: 'Horchata Clasica 1lt',
                descripcion: 'Horchata clasica de 1 litro lista para venta',
                porciones: 1,
                ingredientes: [
                    { nombre: 'Concentrado de Horchata', cantidad: 100 },
                    { nombre: 'Botella PET 1LT', cantidad: 1 },
                    { nombre: 'Azucar Refinada', cantidad: 100 },
                    { nombre: 'Limon', cantidad: 5 }
                ]
            },
            {
                nombre: 'Te Negro (1 LT)',
                producto: 'Te Negro (1 LT)',
                descripcion: 'Te negro de 1 litro listo para venta',
                porciones: 1,
                ingredientes: [
                    { nombre: 'Te Negro', cantidad: 10 },
                    { nombre: 'Botella PET 1LT', cantidad: 1 },
                    { nombre: 'Azucar Refinada', cantidad: 100 },
                    { nombre: 'Limon', cantidad: 5 }
                ]
            }
        ];

        for (const receta of recetas) {
            const info = db.prepare(`
                INSERT INTO recetas (nombre, descripcion, producto_id, porciones)
                VALUES (?, ?, ?, ?)
            `).run(receta.nombre, receta.descripcion, productIds.get(receta.producto), receta.porciones);

            const recetaId = info.lastInsertRowid;
            for (const ing of receta.ingredientes) {
                db.prepare(`
                    INSERT INTO receta_ingredientes (receta_id, producto_id, cantidad)
                    VALUES (?, ?, ?)
                `).run(recetaId, productIds.get(ing.nombre), ing.cantidad);
            }
        }

        console.log('Seeders completados. Login: admin@ohana.com / ohana123');
    } catch (error) {
        console.error('Error durante seeders:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    seed();
}

module.exports = { seed };
