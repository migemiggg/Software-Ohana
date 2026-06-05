let map;
let userMarker = null;
let locations = [];
let markers = new Map();
let selectedLocationId = null;

const normalizar = value => String(value || '').trim().toLowerCase();

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
    map = L.map('inventory-map', { zoomControl: true }).setView([20.6736, -103.344], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);
}

function popupHtml(location) {
    const items = location.inventory || [];
    const inventory = items.length
        ? items.map(item => `
            <tr>
                <td>${item.product_name}</td>
                <td><strong>${Number(item.quantity).toLocaleString('es-MX')}</strong></td>
                <td>${fmtFecha(item.updated_at)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" style="color:#8fa4b8">Sin inventario registrado</td></tr>';

    return `
        <div class="map-popup">
            <h4>${location.name}</h4>
            <p>${location.address}</p>
            <table>
                <thead><tr><th>Producto</th><th>Cant.</th><th>Actualizado</th></tr></thead>
                <tbody>${inventory}</tbody>
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
                <span>${item.product_name}</span>
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
                <small>${location.product_count || 0} productos &middot; ${unidadesEncontradas(location).toLocaleString('es-MX')} unidades</small>
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
    const category = document.getElementById('filtro-categoria')?.value || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);

    locations = await api.get(`/api/mapa-inventario/locations?${params.toString()}`);
    renderMarkers();
    renderLista();
}

async function cargarStats() {
    const stats = await api.get('/api/mapa-inventario/stats');
    document.getElementById('stat-locations').textContent = stats.locations;
    document.getElementById('stat-products').textContent = stats.products;
    document.getElementById('stat-units').textContent = Number(stats.units || 0).toLocaleString('es-MX');
    document.getElementById('stat-categories').textContent = stats.categories;
}

async function cargarCategorias() {
    const select = document.getElementById('filtro-categoria');
    const current = select.value;
    const categories = await api.get('/api/mapa-inventario/categories');
    select.innerHTML = '<option value="">Todas las categorias</option>' +
        categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    select.value = current;
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
    document.getElementById('filtro-categoria').value = '';
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
    document.getElementById('loc-name').value = location?.name || '';
    document.getElementById('loc-address').value = location?.address || '';
    document.getElementById('loc-latitude').value = location?.latitude || '';
    document.getElementById('loc-longitude').value = location?.longitude || '';
    document.getElementById('loc-description').value = location?.description || '';
    openModal('modal-ubicacion');
}

function tomarCentroMapa() {
    const center = map.getCenter();
    document.getElementById('loc-latitude').value = center.lat.toFixed(6);
    document.getElementById('loc-longitude').value = center.lng.toFixed(6);
}

async function guardarUbicacion(event) {
    event.preventDefault();
    const id = document.getElementById('loc-id').value;
    const payload = {
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
    toast('Ubicacion guardada');
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
    document.getElementById('inv-product').value = item?.product_name || '';
    document.getElementById('inv-category').value = item?.category || '';
    document.getElementById('inv-quantity').value = item?.quantity ?? '';
    document.getElementById('inv-image').value = item?.image_url || '';
    document.getElementById('inv-notes').value = item?.notes || '';
    openModal('modal-inventario');
}

async function guardarInventario(event) {
    event.preventDefault();
    const id = document.getElementById('inv-id').value;
    const payload = {
        location_id: document.getElementById('inv-location-id').value,
        product_name: document.getElementById('inv-product').value,
        category: document.getElementById('inv-category').value,
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
    const header = ['ubicacion', 'direccion', 'latitud', 'longitud', 'producto', 'categoria', 'cantidad', 'actualizado'];
    const rows = [];
    locations.forEach(location => {
        if (!location.inventory.length) {
            rows.push([location.name, location.address, location.latitude, location.longitude, '', '', '', '']);
        }
        location.inventory.forEach(item => {
            rows.push([location.name, location.address, location.latitude, location.longitude, item.product_name, item.category || '', item.quantity, item.updated_at]);
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
    await Promise.all([cargarCategorias(), cargarStats(), cargarDatos(), cargarHistorial()]);
}

document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    await refrescarTodo();
    setTimeout(() => map.invalidateSize(), 100);
});
