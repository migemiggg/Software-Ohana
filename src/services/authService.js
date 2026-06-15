const bcrypt = require('bcryptjs');
const usuarioRepository = require('../repositories/usuarioRepository');
const empleadoRepository = require('../repositories/empleadoRepository');

class AuthService {
    async login(correo, contrasena) {
        if (!correo || !contrasena) {
            throw new Error('Campos requeridos.');
        }

        // 1. Buscar en tabla usuarios (admin / encargados del sistema)
        const usuario = usuarioRepository.getByCorreo(correo);
        if (usuario) {
            const coincide = bcrypt.compareSync(contrasena, usuario.contrasena);
            if (!coincide) throw new Error('Correo o contraseña incorrectos.');

            return {
                id:     usuario.id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol:    usuario.rol,
                origen: 'usuarios'
            };
        }

        // 2. Buscar en tabla empleados
        const empleado = empleadoRepository.getByCorreo(correo);
        if (!empleado || !empleado.contrasena) {
            throw new Error('Correo o contraseña incorrectos.');
        }

        const coincide = bcrypt.compareSync(contrasena, empleado.contrasena);
        if (!coincide) {
            throw new Error('Correo o contraseña incorrectos.');
        }

        return {
            id:     empleado.id,
            nombre: `${empleado.nombre}${empleado.apellido ? ' ' + empleado.apellido : ''}`,
            correo: empleado.correo,
            rol:    empleado.rol,   // 'admin' | 'empleado' | 'proveedor'
            origen: 'empleados'
        };
    }

    async changePassword(sessionUser, actual, nueva) {
        if (!sessionUser) {
            throw new Error('No autenticado.');
        }
        if (!actual || !nueva) {
            throw new Error('Campos requeridos.');
        }
        if (nueva.length < 6) {
            throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
        }

        const { id, origen } = sessionUser;
        const repository = origen === 'empleados' ? empleadoRepository : usuarioRepository;

        const registro = repository.getById(id);
        if (!registro) {
            throw new Error('Usuario no encontrado.');
        }

        if (!bcrypt.compareSync(actual, registro.contrasena)) {
            throw new Error('La contraseña actual es incorrecta.');
        }

        const hash = bcrypt.hashSync(nueva, 10);
        repository.updatePassword(id, hash);
        return true;
    }
}

module.exports = new AuthService();
