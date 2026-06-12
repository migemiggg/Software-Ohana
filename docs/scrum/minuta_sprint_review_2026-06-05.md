# MINUTA DE REUNIÓN SCRUM

## Sprint Review y Sprint Planning

**Proyecto:** Sistema de Gestión de Inventario, Producción y Distribución
**Fecha:** 05 de junio de 2026
**Scrum Master:** Adal Gastelum Salazar
**Equipo de Desarrollo:** Integrantes del proyecto
**Tipo de reunión:** Sprint Review y Planeación del siguiente Sprint

---

# 1. Objetivo de la reunión

Revisar los avances actuales del sistema, presentar las funcionalidades desarrolladas durante el sprint, recibir retroalimentación por parte del Scrum Master y definir los ajustes, mejoras y tareas que serán incorporadas al Product Backlog para el siguiente sprint.

---

# 2. Retroalimentación del Scrum Master

Durante la revisión del sistema se identificaron los siguientes puntos de mejora:

### Inventario y Producción

* El inventario actual únicamente permite visualizar insumos.
* Se requiere incorporar la visualización de productos terminados disponibles.
* Las recetas deben descontar automáticamente los insumos utilizados durante la producción.
* El módulo de movimientos debe registrar tanto insumos como productos terminados.
* Se requiere la capacidad de confirmar o cancelar movimientos para corregir errores operativos.

### Gestión de Recetas

* El cálculo de recetas debe realizarse considerando la presentación o tamaño del producto.
* La producción debe reflejar correctamente las cantidades generadas según cada presentación.

### Búsqueda y Experiencia de Usuario

* Incorporar mecanismos de búsqueda para localizar productos mediante consultas.
* Implementar dropdowns donde sean útiles y buscadores donde exista una gran cantidad de registros.
* Facilitar la selección de productos dentro de los distintos módulos del sistema.

### Normalización de Base de Datos

* Normalizar la estructura de las tablas relacionadas con clientes y ubicaciones.
* Evitar duplicidad de información.
* Mantener una estructura de datos más escalable y consistente.

### Clientes, Ubicaciones y Mapa

* Separar correctamente las entidades Cliente y Ubicación.
* Permitir relaciones entre múltiples clientes y múltiples ubicaciones.
* Sustituir el ingreso manual de ubicaciones dentro del mapa por registros asociados a clientes.
* Utilizar una estructura relacional centralizada para el manejo de ubicaciones.
* Vincular el apartado de pedidos con las ubicaciones representadas en el mapa.

---

# 3. Requerimientos adicionales identificados por el equipo

El equipo propuso modificaciones adicionales para mejorar la funcionalidad del sistema:

### Asignación de Inventario a Ubicaciones

* Eliminar los campos de selección por Tipo de Producto.
* Eliminar los campos de selección por Tamaño.
* Sustituir dichos campos por un buscador de productos.
* Asociar las ubicaciones directamente a los clientes.
* Permitir vincular ubicaciones existentes a clientes en lugar de crear nuevas ubicaciones de forma manual.
* Integrar completamente el módulo de pedidos con las ubicaciones registradas en el mapa.

---

# 4. Product Backlog Actualizado

| ID    | Historia de Usuario                                                                                                                   | Prioridad |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| HU-01 | Como administrador, quiero visualizar el inventario de productos terminados para conocer la disponibilidad real de venta.             | Alta      |
| HU-02 | Como administrador, quiero que las recetas descuenten automáticamente los insumos utilizados para mantener actualizado el inventario. | Alta      |
| HU-03 | Como usuario, quiero registrar movimientos de insumos y productos para llevar un control completo del inventario.                     | Alta      |
| HU-04 | Como usuario, quiero confirmar o cancelar movimientos para corregir errores de captura.                                               | Media     |
| HU-05 | Como administrador, quiero calcular recetas según la presentación del producto para obtener cantidades precisas de producción.        | Alta      |
| HU-06 | Como usuario, quiero buscar productos mediante consultas para localizar información rápidamente.                                      | Media     |
| HU-07 | Como administrador, quiero normalizar las relaciones entre clientes y ubicaciones para evitar duplicidad de datos.                    | Alta      |
| HU-08 | Como usuario, quiero que el mapa utilice ubicaciones asociadas a clientes para simplificar la administración de registros.            | Alta      |
| HU-09 | Como usuario, quiero que los pedidos estén vinculados a las ubicaciones del mapa para mejorar el seguimiento de entregas.             | Alta      |
| HU-10 | Como usuario, quiero asignar inventario mediante búsqueda de productos para agilizar el proceso de captura.                           | Media     |

---

# 5. Planeación del siguiente Sprint

## Actividades Prioritarias

1. Implementar inventario de productos terminados.
2. Actualizar lógica de recetas para descontar insumos automáticamente.
3. Modificar el módulo de movimientos para incluir productos e insumos.
4. Incorporar confirmación y cancelación de movimientos.
5. Ajustar cálculos de producción por presentación.
6. Normalizar tablas relacionadas con clientes y ubicaciones.
7. Reestructurar la funcionalidad del mapa.
8. Integrar pedidos con las ubicaciones registradas.
9. Implementar buscadores de productos en los módulos correspondientes.
10. Rediseñar el módulo de asignación de inventario a ubicaciones.

---

# 6. Acuerdos de la reunión

* Se aprobó continuar con la normalización de la base de datos antes de desarrollar nuevas funcionalidades relacionadas con clientes y ubicaciones.
* Se acordó que el inventario deberá contemplar tanto insumos como productos terminados.
* Se definió que las ubicaciones estarán asociadas a clientes mediante una estructura relacional normalizada.
* Se aprobó la integración entre pedidos, clientes y mapa para centralizar la información operativa.
* Las funcionalidades identificadas serán incorporadas al siguiente sprint según la prioridad establecida.

---

# 7. Cierre

El Scrum Master validó los avances presentados y proporcionó las observaciones descritas anteriormente. El equipo de desarrollo se comprometió a incorporar las mejoras acordadas durante el siguiente sprint para incrementar la funcionalidad, usabilidad y consistencia del sistema.
