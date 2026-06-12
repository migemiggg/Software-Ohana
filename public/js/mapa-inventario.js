let map;
let userMarker = null;
let locations = [];
let clientes = [];
let productos = [];
let markers = new Map();
let selectedLocationId = null;

const normalizar = value => String(value || '').trim().toLowerCase();
const GEOCODE_CONTEXT = 'Culiacan, Sinaloa, Mexico';

function setDireccionStatus(message, type = 'neutral') {
    const status = document.getElementById('loc-address-status');
    if (!status) return;
    const colors = {
        neutral: 'var(--txt-3)',
        ok: 'var(--leaf-1)',
        warn: 'var(--sun-1)',
        error: 'var(--berry)'
    };
    status.textContent = message;
    status.style.color = colors[type] || colors.neutral;
}

function direccionConContexto(address) {
    const value = String(address || '').trim();
    if (/culiac|sinaloa|mex/i.test(value)) return value;
    return `${value}, ${GEOCODE_CONTEXT}`;
}

function coordenadasValidas() {
    const lat = Number(document.getElementById('loc-latitude').value);
    const lon = Number(document.getElementById('loc-longitude').value);
    return Number.isFinite(lat) && Number.isFinite(lon) &&
        Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function marcarDireccionPendiente() {
    const address = document.getElementById('loc-address');
    if (!address) return;
    if (address.value.trim() !== (address.dataset.resolvedAddress || '')) {
        document.getElementById('loc-latitude').value = '';
        document.getElementById('loc-longitude').value = '';
        setDireccionStatus('Direccion pendiente de ubicar. Se buscara al guardar.', 'warn');
    }
}

async function geocodificarDireccion({ enfocar = true } = {}) {
    const addressInput = document.getElementById('loc-address');
    const rawAddress = addressInput.value.trim();
    if (!rawAddress) {
        setDireccionStatus('Escribe una direccion completa para ubicarla.', 'error');
        return false;
    }

    setDireccionStatus('Buscando direccion en el mapa...', 'neutral');
    const query = new URLSearchParams({
        format: 'jsonv2',
        limit: '1',
        countrycodes: 'mx',
        'accept-language': 'es',
        q: direccionConContexto(rawAddress)
    });

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`);
        if (!res.ok) throw new Error('No se pudo consultar el mapa.');
        const results = await res.json();
        if (!results.length) {
            setDireccionStatus('No encontre esa direccion. Agrega colonia, ciudad y estado.', 'error');
            return false;
        }

        const result = results[0];
        const lat = Number(result.lat);
        const lon = Number(result.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            setDireccionStatus('La direccion no regreso un punto valido.', 'error');
            return false;
        }

        document.getElementById('loc-latitude').value = lat.toFixed(6);
        document.getElementById('loc-longitude').value = lon.toFixed(6);
        addressInput.value = result.display_name || rawAddress;
        addressInput.dataset.resolvedAddress = addressInput.value.trim();
        setDireccionStatus('Direccion ubicada y lista para guardar.', 'ok');

        if (enfocar && map) {
            map.setView([lat, lon], 16);
        }
        return true;
    } catch (error) {
        setDireccionStatus('No se pudo ubicar la direccion. Revisa internet o usa el punto del mapa.', 'error');
        return false;
    }
}

async function buscarDireccionModal() {
    const ok = await geocodificarDireccion();
    if (ok) toast('Direccion ubicada');
}

async function direccionDesdeCoordenadas(lat, lon) {
    const query = new URLSearchParams({
        format: 'jsonv2',
        lat,
        lon,
        zoom: '18',
        addressdetails: '1',
        'accept-language': 'es'
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`);
    if (!res.ok) throw new Error('No se pudo leer la direccion.');
    return res.json();
}

function markerIcon(highlight = false) {
    return L.divIcon({
        className: '',
        html: `<div class="map-marker ${highlight ? 'is-highlight' : ''}"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -12]
    });
}

function initMap() {
    map = L.map('inventory-map', { zoomControl: true }).setView([24.8091, -107.3940], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);
}

function popupHtml(location) {
    const items = location.inventory || [];
    const pedidos = location.orders || [];
    const inventory = items.length
        ? items.map(item => `
            <tr>
                <td>${item.product_name}</td>
                <td><strong>${Number(item.quantity).toLocaleString('es-MX')}</strong></td>
                <td>${fmtFecha(item.updated_at)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" style="color:#8fa4b8">Sin inventario registrado</td></tr>';
    const pedidosHtml = pedidos.length
        ? pedidos.map(p => `
            <tr>
                <td>#${p.pedido_id}</td>
                <td>${p.producto}</td>
                <td><strong>${Number(p.cantidad).toLocaleString('es-MX')}</strong> ${p.unidad || ''}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" style="color:#8fa4b8">Sin pedidos activos</td></tr>';

    return `
        <div class="map-popup">
            <h4>${location.name}</h4>
            <p>${location.address}</p>
            <table>
                <thead><tr><th>Producto</th><th>Cant.</th><th>Actualizado</th></tr></thead>
                <tbody>${inventory}</tbody>
            </table>
            <strong style="display:block;margin:.55rem 0 .25rem;font-size:.78rem">Pedidos asignados</strong>
            <table>
                <thead><tr><th>#</th><th>Producto</th><th>Cant.</th></tr></thead>
                <tbody>${pedidosHtml}</tbody>
            </table>
            <button class="btn-ohana" onclick="seleccionarUbicacion(${location.id})">Administrar</button>
        </div>
    `;
}

function renderMarkers() {
    markers.forEach(marker => marker.remove());
    markers.clear();

    const query = normalizar(document.getElementById('buscar-producto')?.value);
    const bounds = [];

    locations.forEach(location => {
        const highlight = query && location.inventory.some(item => normalizar(item.product_name).includes(query));
        const marker = L.marker([location.latitude, location.longitude], { icon: markerIcon(highlight) })
            .addTo(map)
            .bindPopup(popupHtml(location));
        markers.set(location.id, marker);
        bounds.push([location.latitude, location.longitude]);
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
}

function unidadesEncontradas(location) {
    const query = normalizar(document.getElementById('buscar-producto')?.value);
    if (!query) return Number(location.total_quantity || 0);
    return location.inventory
        .filter(item => normalizar(item.product_name).includes(query))
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function renderLista() {
    const cont = document.getElementById('lista-ubicaciones');
    document.getElementById('resultado-count').textContent = `${locations.length} ubicacion${locations.length === 1 ? '' : 'es'}`;

    if (!locations.length) {
        cont.innerHTML = '<div class="empty-state">No hay ubicaciones con esos filtros.</div>';
        return;
    }

    cont.innerHTML = locations.map(location => {
        const inventory = (location.inventory || []).slice(0, 5).map(item => `
            <div class="location-product">
                <span>${item.product_name}<small>${item.categoria || item.product_type || '-'} &middot; ${item.unidad || item.presentation || '-'}</small></span>
                <strong>${Number(item.quantity).toLocaleString('es-MX')}</strong>
                <button class="btn-icon" title="Editar producto" onclick='event.stopPropagation(); abrirInventario(${location.id}, ${JSON.stringify(item)})'><i data-lucide="pencil"></i></button>
                <button class="btn-icon danger" title="Eliminar producto" onclick="event.stopPropagation(); eliminarInventario(${item.id})"><i data-lucide="trash-2"></i></button>
            </div>
        `).join('');

        return `
        <article class="location-item ${selectedLocationId === location.id ? 'active' : ''}" onclick="enfocarUbicacion(${location.id})">
            <div>
                <h4>${location.name}</h4>
                <p>${location.address}</p>
                <small>${location.clientes || 'Sin cliente'} &middot; ${location.product_count || 0} productos &middot; ${unidadesEncontradas(location).toLocaleString('es-MX')} unidades</small>
                ${(location.orders || []).length ? `<small>${location.orders.length} producto(s) en pedidos activos</small>` : ''}
            </div>
            <div class="location-products">
                ${inventory || '<span class="product-empty">Sin productos</span>'}
            </div>
            <div class="location-actions">
                <button class="btn-icon" title="Inventario" onclick="event.stopPropagation(); abrirInventario(${location.id})"><i data-lucide="boxes"></i></button>
                <button class="btn-icon" title="Editar" onclick="event.stopPropagation(); abrirUbicacion(${location.id})"><i data-lucide="pencil"></i></button>
                <button class="btn-icon danger" title="Eliminar" onclick="event.stopPropagation(); eliminarUbicacion(${location.id})"><i data-lucide="trash-2"></i></button>
            </div>
        </article>
    `;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function cargarDatos() {
    const q = document.getElementById('buscar-producto')?.value || '';
    const clienteId = document.getElementById('filtro-cliente')?.value || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (clienteId) params.set('cliente_id', clienteId);

    locations = await api.get(`/api/mapa-inventario/locations?${params.toString()}`);
    renderMarkers();
    renderLista();
}

async function cargarStats() {
    const stats = await api.get('/api/mapa-inventario/stats');
    document.getElementById('stat-locations').textContent = stats.locations;
    document.getElementById('stat-products').textContent = stats.products;
    document.getElementById('stat-units').textContent = Number(stats.units || 0).toLocaleString('es-MX');
    document.getElementById('stat-clients').textContent = stats.clients || 0;
}

async function cargarCatalogos() {
    [clientes, productos] = await Promise.all([
        api.get('/api/clientes'),
        api.get('/api/productos?categoria=Productos')
    ]);

    const filtroCliente = document.getElementById('filtro-cliente');
    const locCliente = document.getElementById('loc-cliente');
    const clienteOptions = clientes.map(c => `<option value="${c.id}">${c.nombre}${c.contacto ? ' - ' + c.contacto : ''}</option>`).join('');
    filtroCliente.innerHTML = '<option value="">Todos los clientes</option>' + clienteOptions;
    locCliente.innerHTML = '<option value="">Seleccionar cliente...</option>' + clienteOptions;

    document.getElementById('productos-lista').innerHTML = productos.map(p =>
        `<option value="${p.nombre}" data-id="${p.id}">${p.categoria || 'Sin categoria'} - ${p.unidad}</option>`
    ).join('');
}

async function cargarHistorial() {
    const rows = await api.get('/api/mapa-inventario/history');
    const tbody = document.getElementById('tbl-historial');
    tbody.innerHTML = rows.length ? rows.map(row => `
        <tr>
            <td>${fmtFecha(row.changed_at)}</td>
            <td>${row.location_name || '-'}</td>
            <td>${row.product_name}</td>
            <td>${row.old_quantity ?? '-'}</td>
            <td><strong>${row.new_quantity}</strong></td>
            <td>${row.usuario || '-'}</td>
        </tr>
    `).join('') : '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:#9ca3af">Sin cambios registrados</td></tr>';
}

let filterTimer = null;
function aplicarFiltros() {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(cargarDatos, 180);
}

function limpiarFiltros() {
    document.getElementById('buscar-producto').value = '';
    document.getElementById('filtro-cliente').value = '';
    cargarDatos();
}

function enfocarUbicacion(id) {
    selectedLocationId = id;
    const location = locations.find(item => item.id === id);
    const marker = markers.get(id);
    if (!location || !marker) return;
    map.setView([location.latitude, location.longitude], 15);
    marker.openPopup();
    renderLista();
}

function seleccionarUbicacion(id) {
    selectedLocationId = id;
    abrirInventario(id);
}

function abrirUbicacion(id = null) {
    const location = id ? locations.find(item => item.id === id) : null;
    document.getElementById('ubicacion-titulo').textContent = location ? 'Editar ubicacion' : 'Nueva ubicacion';
    document.getElementById('loc-id').value = location?.id || '';
    const linkedClienteId = location?.cliente_id || String(location?.cliente_ids || '').split(',').filter(Boolean)[0];
    document.getElementById('loc-cliente').value = linkedClienteId || document.getElementById('filtro-cliente').value || '';
    document.getElementById('loc-name').value = location?.name || '';
    const addressInput = document.getElementById('loc-address');
    addressInput.value = location?.address || '';
    addressInput.dataset.resolvedAddress = location?.address || '';
    document.getElementById('loc-latitude').value = location?.latitude || '';
    document.getElementById('loc-longitude').value = location?.longitude || '';
    document.getElementById('loc-description').value = location?.description || '';
    setDireccionStatus(location ? 'Direccion ligada al punto guardado.' : 'Escribe la direccion y el sistema ubicara el punto en el mapa.');
    openModal('modal-ubicacion');
}

async function tomarCentroMapa() {
    const center = map.getCenter();
    const lat = center.lat.toFixed(6);
    const lon = center.lng.toFixed(6);
    document.getElementById('loc-latitude').value = lat;
    document.getElementById('loc-longitude').value = lon;
    setDireccionStatus('Leyendo direccion del punto seleccionado...', 'neutral');

    try {
        const result = await direccionDesdeCoordenadas(lat, lon);
        const address = result.display_name || document.getElementById('loc-address').value;
        document.getElementById('loc-address').value = address;
        document.getElementById('loc-address').dataset.resolvedAddress = address.trim();
        setDireccionStatus('Punto del mapa ligado a esta direccion.', 'ok');
    } catch (error) {
        document.getElementById('loc-address').dataset.resolvedAddress = document.getElementById('loc-address').value.trim();
        setDireccionStatus('Punto del mapa tomado. Puedes escribir la direccion manualmente.', 'warn');
    }
}

async function guardarUbicacion(event) {
    event.preventDefault();
    const addressInput = document.getElementById('loc-address');
    const necesitaUbicar = !coordenadasValidas() || addressInput.value.trim() !== (addressInput.dataset.resolvedAddress || '');
    if (necesitaUbicar) {
        const ubicada = await geocodificarDireccion({ enfocar: false });
        if (!ubicada) {
            toast('No se pudo ubicar la direccion', 'error');
            return;
        }
    }
    const id = document.getElementById('loc-id').value;
    const payload = {
        cliente_id: document.getElementById('loc-cliente').value,
        name: document.getElementById('loc-name').value,
        address: document.getElementById('loc-address').value,
        latitude: document.getElementById('loc-latitude').value,
        longitude: document.getElementById('loc-longitude').value,
        description: document.getElementById('loc-description').value
    };
    const res = id
        ? await api.put(`/api/mapa-inventario/locations/${id}`, payload)
        : await api.post('/api/mapa-inventario/locations', payload);
    if (!res.ok) return toast(res.error || 'No se pudo guardar', 'error');
    closeModal('modal-ubicacion');
    toast('Ubicacion guardada y ligada al cliente');
    await refrescarTodo();
}

function abrirCliente() {
    document.getElementById('cli-nombre').value = '';
    document.getElementById('cli-contacto').value = '';
    document.getElementById('cli-correo').value = '';
    document.getElementById('cli-notas').value = '';
    openModal('modal-cliente');
}

async function guardarCliente(event) {
    event.preventDefault();
    const res = await api.post('/api/clientes', {
        nombre: document.getElementById('cli-nombre').value,
        contacto: document.getElementById('cli-contacto').value,
        correo: document.getElementById('cli-correo').value,
        notas: document.getElementById('cli-notas').value
    });
    if (!res.ok) return toast(res.error || 'No se pudo guardar cliente', 'error');
    closeModal('modal-cliente');
    toast('Cliente guardado');
    await refrescarTodo();
}

async function eliminarUbicacion(id) {
    if (!confirmar('Eliminar esta ubicacion y su inventario?')) return;
    const res = await api.delete(`/api/mapa-inventario/locations/${id}`);
    if (!res.ok) return toast(res.error || 'No se pudo eliminar', 'error');
    toast('Ubicacion eliminada');
    await refrescarTodo();
}

function abrirInventario(locationId, item = null) {
    const location = locations.find(l => l.id === locationId);
    document.getElementById('inventario-titulo').textContent = location ? `Inventario: ${location.name}` : 'Inventario';
    document.getElementById('inv-location-id').value = locationId;
    document.getElementById('inv-id').value = item?.id || '';
    document.getElementById('inv-product-search').value = item?.product_name || '';
    document.getElementById('inv-producto-id').value = item?.producto_id || productos.find(p => p.nombre === item?.product_name)?.id || '';
    document.getElementById('inv-quantity').value = item?.quantity ?? '';
    document.getElementById('inv-image').value = item?.image_url || '';
    document.getElementById('inv-notes').value = item?.notes || '';
    openModal('modal-inventario');
}

function sincronizarProductoSeleccionado() {
    const nombre = normalizar(document.getElementById('inv-product-search').value);
    const producto = productos.find(p => normalizar(p.nombre) === nombre);
    document.getElementById('inv-producto-id').value = producto?.id || '';
}

async function guardarInventario(event) {
    event.preventDefault();
    sincronizarProductoSeleccionado();
    if (!document.getElementById('inv-producto-id').value) {
        toast('Selecciona un producto existente del buscador', 'warn');
        return;
    }
    const id = document.getElementById('inv-id').value;
    const payload = {
        location_id: document.getElementById('inv-location-id').value,
        producto_id: document.getElementById('inv-producto-id').value,
        quantity: document.getElementById('inv-quantity').value,
        image_url: document.getElementById('inv-image').value,
        notes: document.getElementById('inv-notes').value
    };
    const res = id
        ? await api.put(`/api/mapa-inventario/inventory/${id}`, payload)
        : await api.post('/api/mapa-inventario/inventory', payload);
    if (!res.ok) return toast(res.error || 'No se pudo guardar inventario', 'error');
    closeModal('modal-inventario');
    toast('Inventario actualizado');
    await refrescarTodo();
}

async function eliminarInventario(id) {
    if (!confirmar('Eliminar este producto de la ubicacion?')) return;
    const res = await api.delete(`/api/mapa-inventario/inventory/${id}`);
    if (!res.ok) return toast(res.error || 'No se pudo eliminar inventario', 'error');
    toast('Producto eliminado de la ubicacion');
    await refrescarTodo();
}

function usarMiUbicacion() {
    if (!navigator.geolocation) return toast('Tu navegador no soporta geolocalizacion', 'error');
    navigator.geolocation.getCurrentPosition(pos => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        map.setView(latlng, 14);
        if (userMarker) userMarker.remove();
        userMarker = L.circleMarker(latlng, {
            radius: 8,
            color: '#0a8fd6',
            weight: 3,
            fillColor: '#48b8e8',
            fillOpacity: 0.4
        }).addTo(map).bindPopup('Tu ubicacion aproximada').openPopup();
    }, () => toast('No se pudo obtener tu ubicacion', 'error'));
}

function exportarCSV() {
    const header = ['cliente', 'ubicacion', 'direccion', 'latitud', 'longitud', 'producto', 'categoria', 'unidad', 'cantidad', 'actualizado'];
    const rows = [];
    locations.forEach(location => {
        if (!location.inventory.length) {
            rows.push([location.clientes || '', location.name, location.address, location.latitude, location.longitude, '', '', '', '', '']);
        }
        location.inventory.forEach(item => {
            rows.push([location.clientes || '', location.name, location.address, location.latitude, location.longitude, item.product_name, item.categoria || item.product_type || '', item.unidad || item.presentation || '', item.quantity, item.updated_at]);
        });
    });
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mapa-inventario.csv';
    a.click();
    URL.revokeObjectURL(url);
}

async function refrescarTodo() {
    await cargarCatalogos();
    await Promise.all([cargarStats(), cargarDatos(), cargarHistorial()]);
}

document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    await refrescarTodo();
    setTimeout(() => map.invalidateSize(), 100);
});
