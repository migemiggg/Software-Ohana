# OhanApp - Guía de Desarrollo

## 🚀 Instalación Rápida

```bash
npm install
```

## 📊 Cargar Datos Iniciales

Para llenar la base de datos con datos de ejemplo:

### En Windows:
```bash
scripts/seed.bat
```

### En Linux/Mac:
```bash
bash scripts/seed.sh
```

O directamente:
```bash
node src/db/seeders.js
```

## 📝 Datos Incluidos en los Seeders

Los seeders cargan automáticamente:

- **1 Usuario Admin** (admin@ohana.com)
- **1 Usuario Empleado** (juan@ohana.com)
- **6 Categorías** de productos
- **17 Productos** en inventario con stock y precios
- **4 Recetas** ejemplo con sus ingredientes

## 🔒 Validaciones de Recetas

### Crear Receta
- ✅ El nombre es obligatorio
- ✅ **No se pueden crear recetas con nombres duplicados** (case-insensitive)
- ✅ Los ingredientes son opcionales pero recomendados

### Editar Receta
- ✅ El nombre es obligatorio
- ✅ **No se permite cambiar el nombre a uno que ya existe**
- ✅ Se pueden agregar, modificar o eliminar ingredientes

### Error de Duplicados
Cuando intentes crear o editar una receta con un nombre que ya existe, recibirás:
```
Error: Ya existe una receta con este nombre.
```

## 📁 Estructura de Archivos

```
src/
├── db/
│   ├── database.js       # Capa de acceso a datos
│   ├── schema.sql        # Esquema de la base de datos
│   └── seeders.js        # 🌱 Datos iniciales (nuevo)
├── routes/
│   ├── recetas.js        # ✨ Endpoints con validación de duplicados
│   ├── [...otros]
├── server.js
└── middleware/

scripts/
├── seed.sh              # 🌱 Script para Linux/Mac
└── seed.bat             # 🌱 Script para Windows

.gitignore              # ✨ Actualizado para ignorar *.docx y *.doc
```

## 📄 Documentación en Git

Se han actualizado las reglas de **.gitignore** para ignorar:
- `*.docx` - Documentos Word
- `*.doc` - Documentos Word antiguos
- `*.docm` - Documentos Word con macros
- `*.docb` - Documentos Word binarios
- `docs/**/*.docx` - Documentos en carpeta docs

Puedes usar documentos Word locales para documentar cambios sin que se suban al repositorio.

## 🌱 Ejemplo: Estructura del Seeder

```javascript
const productos = [
    { nombre: 'Harina de trigo', categoria_id: 1, unidad: 'kg', stock: 50, minimo: 10, precio: 2.50 },
    // ... más productos
];

const recetas = [
    {
        nombre: 'Pan de trigo básico',
        descripcion: 'Pan clásico de trigo',
        porciones: 1,
        ingredientes: [
            { nombre: 'Harina de trigo', cantidad: 3 },
            // ... más ingredientes
        ]
    },
    // ... más recetas
];
```

## 🔄 Workflow de Desarrollo

1. **Ejecutar seeders**: `npm run seed` (si se configura en package.json)
2. **Iniciar servidor**: `npm start`
3. **Documentar cambios**: Crear archivo .docx localmente (se ignora en git)
4. **Hacer commit**: Los cambios de código se suben, no los documentos

## 📞 Soporte

- Las validaciones previenen crear recetas duplicadas
- Los seeders garantizan datos consistentes para desarrollo
- Los documentos Word locales no interfieren con git

---

**Última actualización:** 2026-06-03
