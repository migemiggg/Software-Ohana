# OhanApp

Sistema web de administracion para Ohana. Permite gestionar inventario, productos, pedidos, clientes, ubicaciones en mapa, recetas base y registro de produccion.

## Tecnologias

- Node.js
- Express
- SQLite mediante `sql.js`
- HTML, CSS y JavaScript
- Leaflet
- OpenStreetMap
- Lucide Icons

## Requisitos

- Node.js LTS instalado
- npm disponible en terminal
- Navegador web moderno

En Windows, si PowerShell bloquea `npm`, usa `npm.cmd`.

## Instalacion

Desde la carpeta del proyecto:

```powershell
cd C:\Users\Admin\Documents\GitHub\Software-Ohana
npm.cmd install
```

## Ejecutar en local

```powershell
npm.cmd start
```

Luego abrir:

```text
http://localhost:3000
```

Modo desarrollo:

```powershell
npm.cmd run dev
```

## Acceso

Usuario administrador por defecto:

```text
admin@ohana.com
ohana123
```

## Estructura del proyecto

```text
Software-Ohana/
  public/
    css/
      ohana.css
    js/
      app.js
      mapa-inventario.js
    dashboard.html
    inventario.html
    mapa-inventario.html
    pedidos.html
    recetas.html
  src/
    db/
      database.js
      schema.sql
      seeders.js
    middleware/
      auth.js
    routes/
      auth.js
      inventario.js
      mapaInventario.js
      pedidos.js
      recetas.js
      reportes.js
      solicitudes.js
    server.js
  ohana.db
  package.json
```

## Modulos principales

### Inventario

Administra productos e insumos. Cada producto pertenece a una categoria, por ejemplo:

- Insumos
- Productos
- Empaques
- Limpieza

Tambien permite registrar movimientos de entrada y salida.

### Pedidos

Permite crear pedidos ligados a clientes y, opcionalmente, a una ubicacion fisica. Los pedidos solo permiten seleccionar productos de la categoria `Productos`, evitando que se vendan insumos, limpieza o envases.

### Clientes y ubicaciones

El sistema normaliza clientes y ubicaciones:

- `clientes` guarda la informacion del cliente.
- `locations` guarda direcciones, latitud y longitud.
- `cliente_locations` permite ligar clientes con ubicaciones.

Esto permite que un cliente tenga ubicaciones en el mapa y que los pedidos se asignen a esas ubicaciones.

### Mapa de inventario

La pagina `/mapa-inventario` muestra ubicaciones fisicas usando Leaflet y OpenStreetMap.

Funcionalidades:

- Ver ubicaciones en mapa.
- Crear clientes.
- Crear ubicaciones ligadas a clientes.
- Buscar productos terminados.
- Ver inventario disponible por ubicacion.
- Ver pedidos activos asignados a una ubicacion.
- Exportar informacion a CSV.
- Usar geolocalizacion del navegador.

El mapa solo muestra inventario de productos de la categoria `Productos`.

### Registro de productos

La pagina `/recetas` ahora funciona como registro de productos.

Permite definir recetas base que producen un producto terminado. Al registrar produccion:

- Revisa si hay insumos suficientes.
- Descuenta los insumos usados.
- Suma el producto terminado al inventario.
- Registra movimientos de inventario de salida y entrada.

Esto conecta recetas con inventario real.

## Base de datos

La base usa SQLite mediante `sql.js`. El archivo principal es:

```text
ohana.db
```

El esquema esta en:

```text
src/db/schema.sql
```

Tablas importantes:

- `usuarios`
- `empleados`
- `categorias`
- `productos`
- `movimientos_inventario`
- `recetas`
- `receta_ingredientes`
- `clientes`
- `locations`
- `cliente_locations`
- `location_inventory`
- `pedidos`
- `pedido_detalles`

## APIs principales

### Productos

```text
GET /api/productos
GET /api/productos?categoria=Productos
POST /api/productos
PUT /api/productos/:id
DELETE /api/productos/:id
```

### Clientes

```text
GET /api/clientes
POST /api/clientes
GET /api/clientes/:id/locations
```

### Mapa de inventario

```text
GET /api/mapa-inventario/stats
GET /api/mapa-inventario/locations
POST /api/mapa-inventario/locations
PUT /api/mapa-inventario/locations/:id
DELETE /api/mapa-inventario/locations/:id
POST /api/mapa-inventario/inventory
PUT /api/mapa-inventario/inventory/:id
DELETE /api/mapa-inventario/inventory/:id
GET /api/mapa-inventario/history
```

### Pedidos

```text
GET /api/pedidos
GET /api/pedidos/:id
POST /api/pedidos
PATCH /api/pedidos/:id/estado
DELETE /api/pedidos/:id
```

### Registro de productos

```text
GET /api/recetas
GET /api/recetas/:id
POST /api/recetas
PUT /api/recetas/:id
GET /api/recetas/:id/calcular
POST /api/recetas/:id/registrar
DELETE /api/recetas/:id
```

## Flujo recomendado de uso

1. Crear categorias y productos en inventario.
2. Marcar los productos vendibles dentro de la categoria `Productos`.
3. Crear recetas base en `Registro de productos`.
4. Registrar produccion para descontar insumos y sumar producto terminado.
5. Crear clientes.
6. Crear ubicaciones ligadas a clientes en el mapa.
7. Asignar inventario disponible a ubicaciones.
8. Crear pedidos ligados a cliente y ubicacion.
9. Revisar en el mapa los pedidos activos asignados a cada ubicacion.

## Notas de despliegue

El proyecto puede desplegarse en servicios Node.js como Render o Railway.

Para produccion real se recomienda:

- Usar una base de datos persistente.
- Configurar una variable `SESSION_SECRET`.
- Migrar de archivo SQLite local a PostgreSQL si se espera uso multiusuario o alto volumen.

## Scripts disponibles

```text
npm.cmd start
npm.cmd run dev
npm.cmd run seed
```

`seed` carga datos iniciales de ejemplo.

