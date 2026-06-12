/* ─────────────────────────────────────────────────────
   OhanApp — Utilidades globales
   ───────────────────────────────────────────────────── */

/* ── API helper ──────────────────────────────────────── */
const api = {
    async get(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    },
    async post(url, data) {
        const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        return r.json();
    },
    async put(url, data) {
        const r = await fetch(url, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        return r.json();
    },
    async patch(url, data) {
        const r = await fetch(url, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        return r.json();
    },
    async delete(url) {
        const r = await fetch(url, { method:'DELETE' });
        return r.json();
    }
};

/* ── Toast ───────────────────────────────────────────── */
function toast(msg, tipo='ok') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.style.background = tipo==='error' ? '#DC2626' : tipo==='warn' ? '#D97706' : '#18181B';
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
}

/* ── Modal ───────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

/* ── Helpers ─────────────────────────────────────────── */
const fmt = n => '$' + parseFloat(n||0).toLocaleString('es-MX',{minimumFractionDigits:2});

const fmtFecha = str => {
    if (!str) return '—';
    const d = new Date(str.replace(' ','T'));
    return d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
};

function estadoBadge(estado) {
    const map = { pendiente:['badge-yellow','Pendiente'], en_proceso:['badge-blue','En proceso'], entregado:['badge-green','Entregado'], cancelado:['badge-red','Cancelado'] };
    const [cls,label] = map[estado]||['badge-gray',estado];
    return `<span class="badge ${cls}">${label}</span>`;
}

function rolBadge(rol) {
    const map = { admin:['role-admin','Admin'], empleado:['role-empleado','Empleado'], proveedor:['role-proveedor','Proveedor'] };
    const [cls,label] = map[rol]||['badge-gray',rol];
    return `<span class="badge ${cls}">${label}</span>`;
}

function confirmar(msg='¿Confirmar esta acción?') { return confirm(msg); }

/* ── Perfil dropdown ─────────────────────────────────── */
let _sesion = null;

function _inyectarPerfilDropdown() {
    const badge = document.querySelector('.user-badge');
    if (!badge) return;
    badge.style.cursor = 'pointer';
    badge.style.userSelect = 'none';
    badge.style.position = 'relative';

    const drop = document.createElement('div');
    drop.innerHTML = `<div id="perfil-drop-inner" style="
        position:absolute;top:calc(100% + 8px);right:0;
        background:#fff;border:1px solid #E4E4E7;border-radius:8px;
        box-shadow:0 4px 16px rgba(0,0,0,.10),0 1px 3px rgba(0,0,0,.06);
        min-width:200px;z-index:999;overflow:hidden;
        opacity:0;transform:translateY(-4px);
        transition:opacity 140ms ease,transform 140ms ease;pointer-events:none;">
        <div style="padding:.75rem 1rem;border-bottom:1px solid #F4F4F5;">
            <div style="font-size:.825rem;font-weight:600;color:#18181B" id="drop-nombre">—</div>
            <div style="font-size:.72rem;color:#71717A;margin-top:.1rem" id="drop-correo">—</div>
            <div style="margin-top:.4rem" id="drop-rol"></div>
        </div>
        <div style="padding:.375rem 0;">
            <button onclick="abrirCambiarPassword()" style="width:100%;text-align:left;background:none;border:none;padding:.475rem 1rem;font-size:.8rem;color:#18181B;cursor:pointer;display:flex;align-items:center;gap:.5rem;font-family:inherit;" onmouseover="this.style.background='#F4F4F5'" onmouseout="this.style.background='none'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Cambiar contraseña
            </button>
            <div style="height:1px;background:#F4F4F5;margin:.25rem 0"></div>
            <a href="/logout" style="display:flex;align-items:center;gap:.5rem;padding:.475rem 1rem;font-size:.8rem;color:#DC2626;text-decoration:none;" onmouseover="this.style.background='#FEF2F2'" onmouseout="this.style.background='none'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Cerrar sesión
            </a>
        </div>
    </div>`;
    badge.appendChild(drop);

    let open = false;
    const inner = document.getElementById('perfil-drop-inner');

    badge.addEventListener('click', e => {
        e.stopPropagation();
        open = !open;
        inner.style.opacity = open ? '1' : '0';
        inner.style.transform = open ? 'translateY(0)' : 'translateY(-4px)';
        inner.style.pointerEvents = open ? 'all' : 'none';
    });

    document.addEventListener('click', () => {
        open = false;
        inner.style.opacity = '0';
        inner.style.transform = 'translateY(-4px)';
        inner.style.pointerEvents = 'none';
    });
}

function _inyectarModalPassword() {
    if (document.getElementById('modal-pwd')) return;
    const el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = 'modal-pwd';
    el.innerHTML = `<div class="modal-box" style="max-width:380px">
        <div class="modal-header">
            <h4>Cambiar contraseña</h4>
            <button class="modal-close" onclick="closeModal('modal-pwd')">&#x2715;</button>
        </div>
        <div class="form-group">
            <label>Contraseña actual</label>
            <input type="password" id="pwd-actual" class="form-control" placeholder="••••••••">
        </div>
        <div class="form-group">
            <label>Nueva contraseña</label>
            <input type="password" id="pwd-nueva" class="form-control" placeholder="Mínimo 6 caracteres">
        </div>
        <div class="form-group">
            <label>Confirmar nueva contraseña</label>
            <input type="password" id="pwd-confirmar" class="form-control" placeholder="Repetir contraseña">
        </div>
        <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:.25rem">
            <button class="btn-outline" onclick="closeModal('modal-pwd')">Cancelar</button>
            <button class="btn-ohana" onclick="guardarPassword()">Guardar</button>
        </div>
    </div>`;
    document.body.appendChild(el);
}

function abrirCambiarPassword() {
    const inner = document.getElementById('perfil-drop-inner');
    if (inner) { inner.style.opacity='0'; inner.style.pointerEvents='none'; }
    ['pwd-actual','pwd-nueva','pwd-confirmar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    openModal('modal-pwd');
}

async function guardarPassword() {
    const actual    = document.getElementById('pwd-actual')?.value;
    const nueva     = document.getElementById('pwd-nueva')?.value;
    const confirmar = document.getElementById('pwd-confirmar')?.value;
    if (!actual || !nueva) return toast('Completa todos los campos','error');
    if (nueva.length < 6)  return toast('Mínimo 6 caracteres','error');
    if (nueva !== confirmar) return toast('Las contraseñas no coinciden','error');
    try {
        const res = await api.patch('/api/perfil/password',{actual,nueva});
        if (res.ok) { closeModal('modal-pwd'); toast('Contraseña actualizada'); }
        else toast(res.error||'Error al cambiar contraseña','error');
    } catch(e) { toast('Error de conexión','error'); }
}

/* ── Init global ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    const nav = document.querySelector('.sidebar-nav');
    if (nav && !nav.querySelector('a[href="/mapa-inventario"]')) {
        const item = document.createElement('div');
        item.className = 'nav-item';
        item.innerHTML = '<a href="/mapa-inventario"><i data-lucide="map-pinned"></i> Mapa inventario</a>';
        const inventario = nav.querySelector('a[href="/inventario"]')?.parentElement;
        if (inventario?.nextSibling) nav.insertBefore(item, inventario.nextSibling);
        else nav.appendChild(item);
    }
    const recetasLink = nav?.querySelector('a[href="/recetas"]');
    if (recetasLink) {
        recetasLink.innerHTML = '<i data-lucide="package-check"></i> Registro de productos';
    }

    // Sidebar: marcar enlace activo
    const path = window.location.pathname;
    document.querySelectorAll('.nav-item a').forEach(a => {
        if (a.getAttribute('href') === path) a.classList.add('active');
    });

    // Lucide
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Cargar sesión → topbar en TODAS las páginas
    try {
        const ses = await api.get('/api/session');
        if (ses.ok && ses.usuario) {
            _sesion = ses.usuario;
            const nameEl   = document.getElementById('user-name');
            const avatarEl = document.getElementById('avatar-initials');
            if (nameEl)   nameEl.textContent  = ses.usuario.nombre;
            if (avatarEl) avatarEl.textContent = ses.usuario.nombre.charAt(0).toUpperCase();

            const dropNombre = document.getElementById('drop-nombre');
            const dropCorreo = document.getElementById('drop-correo');
            const dropRol    = document.getElementById('drop-rol');
            if (dropNombre) dropNombre.textContent = ses.usuario.nombre;
            if (dropCorreo) dropCorreo.textContent = ses.usuario.correo || '';
            if (dropRol)    dropRol.innerHTML      = rolBadge(ses.usuario.rol);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    } catch(_) {}

    // Inyectar dropdown + modal de contraseña
    _inyectarPerfilDropdown();
    _inyectarModalPassword();

    // Rellenar dropdown con datos de sesión (si ya cargaron antes)
    if (_sesion) {
        const dn = document.getElementById('drop-nombre');
        const dc = document.getElementById('drop-correo');
        const dr = document.getElementById('drop-rol');
        if (dn) dn.textContent = _sesion.nombre;
        if (dc) dc.textContent = _sesion.correo || '';
        if (dr) dr.innerHTML   = rolBadge(_sesion.rol);
    }
});
