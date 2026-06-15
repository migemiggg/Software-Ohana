const empleadoService = require('../services/empleadoService');

class EmpleadoController {
    async getAll(req, res) {
        const { rol, activo, q } = req.query;
        try {
            const list = await empleadoService.search({ rol, activo, q });
            res.json(list);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getById(req, res) {
        try {
            const emp = await empleadoService.getById(req.params.id);
            res.json(emp);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async create(req, res) {
        const { nombre, apellido, correo, telefono, rol, notas, contrasena } = req.body;
        try {
            const id = await empleadoService.create({ nombre, apellido, correo, telefono, rol, notas, contrasena });
            res.json({ ok: true, id });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async update(req, res) {
        const { nombre, apellido, correo, telefono, rol, notas, contrasena } = req.body;
        try {
            await empleadoService.update(req.params.id, { nombre, apellido, correo, telefono, rol, notas, contrasena });
            res.json({ ok: true });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async toggle(req, res) {
        try {
            const activo = await empleadoService.toggle(req.params.id);
            res.json({ ok: true, activo });
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async delete(req, res) {
        try {
            await empleadoService.delete(req.params.id);
            res.json({ ok: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new EmpleadoController();
