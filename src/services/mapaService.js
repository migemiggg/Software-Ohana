const db = require('../db/database');
const locationRepository = require('../repositories/locationRepository');
const locationInventoryRepository = require('../repositories/locationInventoryRepository');
const clienteRepository = require('../repositories/clienteRepository');
const productoRepository = require('../repositories/productoRepository');

class MapaService {
    async getStats() {
        const locations = locationRepository.getLocationStats();
        const products = locationInventoryRepository.getStatsProducts();
        const units = locationInventoryRepository.getStatsUnits();
        const clients = clienteRepository.getAll().length;
        const productTypes = locationInventoryRepository.getStatsProductTypes();

        return { locations, products, units, productTypes, clients };
    }

    async getLocations({ q, product_type, presentation, cliente_id }) {
        const params = [];
        let whereClause = '';

        if (q && q.trim()) {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM location_inventory li
                JOIN productos p ON p.id = li.producto_id
                JOIN categorias c ON c.id = p.categoria_id
                WHERE li.location_id = l.id
                  AND lower(c.nombre) = lower('Productos')
                  AND lower(p.nombre) LIKE ?
            )`;
            params.push(`%${q.trim().toLowerCase()}%`);
        }

        if (product_type && product_type.trim()) {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM location_inventory li
                JOIN productos p ON p.id = li.producto_id
                JOIN categorias c ON c.id = p.categoria_id
                WHERE li.location_id = l.id AND lower(c.nombre) = ?
            )`;
            params.push(product_type.trim().toLowerCase());
        }

        if (presentation && presentation.trim()) {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM location_inventory li
                JOIN productos p ON p.id = li.producto_id
                WHERE li.location_id = l.id AND lower(p.unidad) = ?
            )`;
            params.push(presentation.trim().toLowerCase());
        }

        if (cliente_id) {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM cliente_locations cl
                WHERE cl.location_id = l.id AND cl.cliente_id = ?
            )`;
            params.push(cliente_id);
        }

        const locations = locationRepository.getAll(whereClause, params);

        return locations.map(location => ({
            ...location,
            inventory: locationInventoryRepository.getInventoryByLocation(location.id),
            orders: locationRepository.getOrdersForLocation(location.id)
        }));
    }

    async getLocationWithInventory(id) {
        const location = locationRepository.getById(id);
        if (!location) return null;
        location.inventory = locationInventoryRepository.getInventoryByLocation(id);
        return location;
    }

    async createLocation({ name, address, latitude, longitude, description, cliente_id }) {
        if (!cliente_id || !name || !address || latitude === null || longitude === null) {
            throw new Error('Cliente, nombre, direccion, latitud y longitud son requeridos.');
        }

        return db.transaction(() => {
            const info = locationRepository.create({
                name: name.trim(),
                address: address.trim(),
                latitude,
                longitude,
                description: description || null
            });

            locationRepository.linkCliente(cliente_id, info.lastInsertRowid);
            return info.lastInsertRowid;
        })();
    }

    async updateLocation(id, { name, address, latitude, longitude, description, cliente_id }) {
        if (!cliente_id || !name || !address || latitude === null || longitude === null) {
            throw new Error('Cliente, nombre, direccion, latitud y longitud son requeridos.');
        }

        db.transaction(() => {
            locationRepository.update(id, {
                name: name.trim(),
                address: address.trim(),
                latitude,
                longitude,
                description: description || null
            });

            locationRepository.unlinkClienteByLocation(id);
            locationRepository.linkCliente(cliente_id, id);
        })();

        return true;
    }

    async deleteLocation(id) {
        db.transaction(() => {
            locationInventoryRepository.deleteByLocationId(id);
            locationInventoryRepository.deleteHistoryByLocationId(id);
            locationRepository.unlinkClienteByLocation(id);
            locationRepository.delete(id);
        })();
        return true;
    }

    async addInventory({ location_id, producto_id, notes, image_url, quantity }, usuarioId) {
        if (!location_id || !producto_id || quantity === null) {
            throw new Error('Ubicacion, producto y cantidad son requeridos.');
        }

        const location = locationRepository.getByIdRaw(location_id);
        if (!location) throw new Error('Ubicacion no encontrada.');

        const producto = productoRepository.getById(producto_id);
        if (!producto) throw new Error('Producto no encontrado.');

        let newId = null;
        db.transaction(() => {
            const info = locationInventoryRepository.create({
                location_id,
                producto_id,
                quantity,
                notes: notes || null,
                image_url: image_url || null
            });
            newId = info.lastInsertRowid;

            locationInventoryRepository.createHistory({
                inventory_id: newId,
                location_id,
                product_name: producto.nombre,
                old_quantity: null,
                new_quantity: quantity,
                notes: 'Alta de inventario',
                usuario_id: usuarioId
            });
        })();

        return newId;
    }

    async updateInventory(id, { producto_id, quantity, notes, image_url }, usuarioId) {
        if (!producto_id || quantity === null) {
            throw new Error('Producto y cantidad son requeridos.');
        }

        const current = locationInventoryRepository.getById(id);
        if (!current) throw new Error('Inventario no encontrado.');

        const producto = productoRepository.getById(producto_id);
        if (!producto) throw new Error('Producto no encontrado.');

        db.transaction(() => {
            locationInventoryRepository.update(id, {
                producto_id,
                quantity,
                notes: notes || null,
                image_url: image_url || null
            });

            locationInventoryRepository.createHistory({
                inventory_id: id,
                location_id: current.location_id,
                product_name: producto.nombre,
                old_quantity: current.quantity,
                new_quantity: quantity,
                notes: notes || 'Actualizacion de cantidad',
                usuario_id: usuarioId
            });
        })();

        return true;
    }

    async deleteInventory(id) {
        locationInventoryRepository.delete(id);
        return true;
    }

    async getHistory() {
        return locationInventoryRepository.getHistory();
    }

    async getProductTypes() {
        const rows = locationInventoryRepository.getProductTypes();
        return rows.map(r => r.product_type);
    }

    async getClientes(q) {
        return clienteRepository.getAll(q);
    }

    async createCliente({ nombre, contacto, correo, notas }) {
        if (!nombre) throw new Error('El nombre del cliente es requerido.');
        const info = clienteRepository.create(nombre.trim(), contacto || null, correo || null, notas || null);
        return info.lastInsertRowid;
    }

    async getClienteLocations(clienteId) {
        return clienteRepository.getLocations(clienteId);
    }
}

module.exports = new MapaService();
