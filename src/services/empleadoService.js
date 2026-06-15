const bcrypt = require('bcryptjs');
const empleadoRepository = require('../repositories/empleadoRepository');

class EmpleadoService {
    async search(filters) {
        return empleadoRepository.search(filters);
    }

    async getById(id) {
        const emp = empleadoRepository.getById(id);
        if (!emp) throw new Error('Empleado no encontrado.');
        return emp;
    }

    async create({ nombre, apellido, correo, telefono, rol, notas, contrasena }) {
        if (!nombre) throw new Error('El nombre es requerido.');
        if (!correo) throw new Error('El correo es requerido para poder iniciar sesión.');
        if (!contrasena) throw new Error('La contraseña es requerida.');

        const roles = ['admin', 'empleado', 'proveedor'];
        if (rol && !roles.includes(rol)) throw new Error('Rol inválido.');

        const hash = bcrypt.hashSync(contrasena, 10);
        const result = empleadoRepository.create({ nombre, apellido, correo, telefono, rol, notas, hash });
        return result.lastInsertRowid;
    }

    async update(id, { nombre, apellido, correo, telefono, rol, notas, contrasena }) {
        if (!nombre) throw new Error('El nombre es requerido.');

        const roles = ['admin', 'empleado', 'proveedor'];
        if (rol && !roles.includes(rol)) throw new Error('Rol inválido.');

        let hash = null;
        if (contrasena && contrasena.trim() !== '') {
            hash = bcrypt.hashSync(contrasena, 10);
        }

        empleadoRepository.update(id, { nombre, apellido, correo, telefono, rol, notas, hash });
        return true;
    }

    async toggle(id) {
        const emp = empleadoRepository.getActivoStatus(id);
        if (!emp) throw new Error('Empleado no encontrado.');
        const nuevoEstado = empleadoRepository.toggleActivo(id, emp.activo);
        return nuevoEstado;
    }

    async delete(id) {
        empleadoRepository.delete(id);
        return true;
    }
}

module.exports = new EmpleadoService();
