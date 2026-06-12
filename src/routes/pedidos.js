const express = require('express');
const db      = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

router.use(requireLogin);

const ESTADOS_PEDIDO = ['pendiente', 'en_proceso', 'entregado', 'cancelado'];

function parsePositiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}

function parseNonNegativeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeOrderDetails(detalles) {
    if (!Array.isArray(detalles) || !detalles.length) return [];

    const grouped = new Map();
    for (const detalle of detalles) {
        const producto_id = Number(detalle.producto_id);
        const cantidad = parsePositiveNumber(detalle.cantidad);
        const precio = parseNonNegativeNumber(detalle.precio);

        if (!producto_id || cantidad === null || precio === null) {
            const err = new Error('Cada producto del pedido necesita producto, cantidad mayor a 0 y precio valido.');
            err.status = 400;
            throw err;
        }

        const current = grouped.get(producto_id) || {
            producto_id,
            cantidad: 0,
            total: 0
        };
        current.cantidad += cantidad;
        current.total += cantidad * precio;
        grouped.set(producto_id, current);
    }

    return [...grouped.values()].map(item => ({
        producto_id: item.producto_id,
        cantidad: Number(item.cantidad.toFixed(3)),
        precio: item.cantidad > 0 ? Number((item.total / item.cantidad).toFixed(2)) : 0
    }));
}

function assertProductosTerminados(detalles) {
    const getProducto = db.prepare(`
        SELECT p.id, p.nombre, c.nombre AS categoria
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.id = ?
    `);

    for (const detalle of detalles) {
        const producto = getProducto.get(detalle.producto_id);
        if (!producto || producto.categoria !== 'Productos') {
            const err = new Error('Los pedidos solo pueden incluir productos terminados.');
            err.status = 400;
            throw err;
        }
    }
}

function resolvePedidoLocationId(clienteId, requestedLocationId) {
    // Aqui se amarra Pedido con Mapa inventario.
    // Si el usuario no escoge ubicacion, se usa la ubicacion principal del cliente.
    if (!clienteId) return null;

    const selectedId = Number(requestedLocationId);
    if (Number.isFinite(selectedId) && selectedId > 0) {
        const location = db.prepare('SELECT id FROM locations WHERE id = ?').get(selectedId);
        if (!location) {
            const err = new Error('Ubicacion no encontrada.');
            err.status = 400;
            throw err;
        }

        db.prepare(`
            INSERT OR IGNORE INTO cliente_locations (cliente_id, location_id)
            VALUES (?, ?)
        `).run(clienteId, selectedId);
        db.prepare('UPDATE clientes SET actualizado_en = datetime("now") WHERE id = ?').run(clienteId);
        return selectedId;
    }

    const defaultLocation = db.prepare(`
        SELECT l.id
        FROM locations l
        JOIN cliente_locations cl ON cl.location_id = l.id
        WHERE cl.cliente_id = ?
        ORDER BY datetime(l.updated_at) DESC, l.id DESC
        LIMIT 1
    `).get(clienteId);

    return defaultLocation?.id || null;
}

function getPedido(id) {
    return db.prepare(`
        SELECT p.*,
               c.nombre AS cliente_normalizado,
               c.contacto AS cliente_contacto_normalizado,
               l.name AS ubicacion_nombre,
               l.address AS ubicacion_direccion
        FROM pedidos p
        LEFT JOIN clientes c ON c.id = p.cliente_id
        LEFT JOIN locations l ON l.id = p.location_id
        WHERE p.id = ?
    `).get(id);
}

function getDetallesPedidoAgrupados(id) {
    return db.prepare(`
        SELECT d.producto_id,
               SUM(d.cantidad) AS cantidad,
               pr.nombre AS producto_nombre,
               pr.unidad,
               pr.stock_actual
        FROM pedido_detalles d
        JOIN productos pr ON pr.id = d.producto_id
        WHERE d.pedido_id = ?
        GROUP BY d.producto_id, pr.nombre, pr.unidad, pr.stock_actual
        ORDER BY pr.nombre
    `).all(id);
}

function buildFaltantes(detalles) {
    return detalles
        .filter(d => Number(d.stock_actual) < Number(d.cantidad))
        .map(d => ({
            producto: d.producto_nombre,
            necesario: Number(d.cantidad),
            stock_actual: Number(d.stock_actual),
            unidad: d.unidad
        }));
}

function registrarMovimiento(productoId, tipo, cantidad, motivo, usuarioId) {
    const delta = tipo === 'entrada' ? Number(cantidad) : -Number(cantidad);
    db.prepare(`
        UPDATE productos
        SET stock_actual = stock_actual + ?, actualizado_en = datetime('now')
        WHERE id = ?
    `).run(delta, productoId);

    db.prepare(`
        INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
        VALUES (?, ?, ?, ?, ?)
    `).run(productoId, tipo, cantidad, motivo, usuarioId);
}

function descontarPedidoEntregado(pedido, usuarioId) {
    // Esta es la entrega real del pedido: valida stock y descuenta productos terminados.
    // Por eso se llama solo cuando el pedido cambia a estado entregado.
    const detalles = getDetallesPedidoAgrupados(pedido.id);
    if (!detalles.length) {
        const err = new Error('El pedido no tiene productos para entregar.');
        err.status = 400;
        throw err;
    }

    const faltantes = buildFaltantes(detalles);
    if (faltantes.length) {
        const err = new Error('Stock insuficiente para entregar el pedido.');
        err.status = 400;
        err.faltantes = faltantes;
        throw err;
    }

    for (const detalle of detalles) {
        registrarMovimiento(
            detalle.producto_id,
            'salida',
            detalle.cantidad,
            `Entrega de pedido #${pedido.id}`,
            usuarioId
        );
    }

    db.prepare(`
        UPDATE pedidos
        SET estado = 'entregado',
            inventario_descontado = 1,
            fecha_entrega = COALESCE(fecha_entrega, datetime('now'))
        WHERE id = ?
    `).run(pedido.id);

    return { descontado: true, productos: detalles.length };
}

function revertirEntregaPedido(pedido, nuevoEstado, usuarioId) {
    // Si se reabre o cancela un pedido ya entregado, aqui se regresa el stock.
    // Sirve para corregir errores sin perder el historial del movimiento.
    const detalles = getDetallesPedidoAgrupados(pedido.id);
    for (const detalle of detalles) {
        registrarMovimiento(
            detalle.producto_id,
            'entrada',
            detalle.cantidad,
            `Reversion de entrega de pedido #${pedido.id}`,
            usuarioId
        );
    }

    db.prepare(`
        UPDATE pedidos
        SET estado = ?, inventario_descontado = 0
        WHERE id = ?
    `).run(nuevoEstado, pedido.id);

    return { restituido: true, productos: detalles.length };
}

function handleError(res, error) {
    const status = error.status || 500;
    const payload = { ok: false, error: error.message || 'Error inesperado.' };
    if (error.faltantes) payload.faltantes = error.faltantes;
    res.status(status).json(payload);
}

// Listar pedidos
router.get('/api/pedidos', (req, res) => {
    const rows = db.prepare(`
        SELECT p.*,
               COALESCE(p.inventario_descontado, 0) AS inventario_descontado,
               u.nombre AS usuario,
               c.nombre AS cliente_normalizado,
               c.contacto AS cliente_contacto_normalizado,
               l.name AS ubicacion_nombre,
               l.address AS ubicacion_direccion,
               COALESCE(SUM(d.cantidad), 0) AS cantidad_productos,
               COUNT(d.id) AS lineas,
               (
                   SELECT GROUP_CONCAT(pr2.nombre || ' x' || d2.cantidad, ', ')
                   FROM pedido_detalles d2
                   JOIN productos pr2 ON pr2.id = d2.producto_id
                   WHERE d2.pedido_id = p.id
               ) AS productos_resumen
        FROM pedidos p
        LEFT JOIN usuarios u ON u.id = p.usuario_id
        LEFT JOIN clientes c ON c.id = p.cliente_id
        LEFT JOIN locations l ON l.id = p.location_id
        LEFT JOIN pedido_detalles d ON d.pedido_id = p.id
        GROUP BY p.id
        ORDER BY p.fecha_pedido DESC
    `).all();
    res.json(rows);
});

// Obtener pedido con detalles
router.get('/api/pedidos/:id', (req, res) => {
    const pedido = getPedido(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });

    const detalles = db.prepare(`
        SELECT d.*, pr.nombre AS producto_nombre, pr.unidad, pr.stock_actual
        FROM pedido_detalles d
        JOIN productos pr ON pr.id = d.producto_id
        WHERE d.pedido_id = ?
        ORDER BY pr.nombre
    `).all(req.params.id);

    res.json({ ...pedido, detalles });
});

// Crear pedido
router.post('/api/pedidos', (req, res) => {
    try {
        const { cliente_id, location_id, cliente_nombre, cliente_contacto, fecha_entrega, notas } = req.body;
        const detalles = normalizeOrderDetails(req.body.detalles);

        if ((!cliente_id && !cliente_nombre) || !detalles.length) {
            return res.status(400).json({ ok: false, error: 'Faltan datos del pedido.' });
        }

        assertProductosTerminados(detalles);

        const total = detalles.reduce((sum, d) => sum + d.cantidad * d.precio, 0);

        const result = db.transaction(() => {
            let cliente = cliente_id ? db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente_id) : null;
            if (cliente_id && !cliente) {
                const err = new Error('Cliente no encontrado.');
                err.status = 400;
                throw err;
            }

            if (!cliente && cliente_nombre) {
                cliente = db.prepare('SELECT * FROM clientes WHERE lower(nombre) = lower(?) LIMIT 1').get(cliente_nombre.trim());
                if (!cliente) {
                    const insertedCliente = db.prepare(`
                        INSERT INTO clientes (nombre, contacto)
                        VALUES (?, ?)
                    `).run(cliente_nombre.trim(), cliente_contacto || null);
                    cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(insertedCliente.lastInsertRowid);
                }
            }

            const pedidoLocationId = resolvePedidoLocationId(cliente?.id, location_id);

            const info = db.prepare(`
                INSERT INTO pedidos (cliente_id, location_id, cliente_nombre, cliente_contacto, fecha_entrega, notas, total, usuario_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(cliente?.id || null, pedidoLocationId, cliente?.nombre || cliente_nombre.trim(),
                   cliente?.contacto || cliente_contacto || null, fecha_entrega || null,
                   notas || null, Number(total.toFixed(2)), req.session.usuario.id);

            const pedidoId = info.lastInsertRowid;
            const insertDetalle = db.prepare(`
                INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio)
                VALUES (?, ?, ?, ?)
            `);

            for (const detalle of detalles) {
                insertDetalle.run(pedidoId, detalle.producto_id, detalle.cantidad, detalle.precio);
            }

            return pedidoId;
        })();

        res.json({ ok: true, id: result });
    } catch (error) {
        handleError(res, error);
    }
});

// Actualizar estado del pedido
router.patch('/api/pedidos/:id/estado', (req, res) => {
    try {
        const { estado } = req.body;
        if (!ESTADOS_PEDIDO.includes(estado)) {
            return res.status(400).json({ ok: false, error: 'Estado invalido.' });
        }

        const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
        if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });

        let resultado = { ok: true };
        db.transaction(() => {
            const inventarioDescontado = Number(pedido.inventario_descontado || 0) === 1;

            if (estado === 'entregado' && !inventarioDescontado) {
                resultado = { ok: true, ...descontarPedidoEntregado(pedido, req.session.usuario.id) };
                return;
            }

            if (estado !== 'entregado' && inventarioDescontado) {
                resultado = { ok: true, ...revertirEntregaPedido(pedido, estado, req.session.usuario.id) };
                return;
            }

            db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run(estado, pedido.id);
        })();

        res.json(resultado);
    } catch (error) {
        handleError(res, error);
    }
});

// Eliminar pedido
router.delete('/api/pedidos/:id', (req, res) => {
    try {
        const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
        if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });

        db.transaction(() => {
            if (Number(pedido.inventario_descontado || 0) === 1) {
                revertirEntregaPedido(pedido, 'cancelado', req.session.usuario.id);
            }
            db.prepare('DELETE FROM pedido_detalles WHERE pedido_id = ?').run(pedido.id);
            db.prepare('DELETE FROM pedidos WHERE id = ?').run(pedido.id);
        })();

        res.json({ ok: true });
    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;
