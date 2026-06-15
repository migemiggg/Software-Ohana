const reporteRepository = require('../repositories/reporteRepository');

class ReporteService {
    async getInventarioReport() {
        const items = reporteRepository.getInventarioReport();
        const resumen = {
            total_productos: items.length,
            total_valor:     items.reduce((s, i) => s + (i.valor_total || 0), 0).toFixed(2),
            bajo_minimo:     items.filter(i => i.alerta).length
        };
        return { items, resumen };
    }

    async getMovimientosReport(desdeRaw, hastaRaw) {
        const hoy    = new Date();
        const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
        const fmt    = d => d.toISOString().slice(0, 10);

        const desde = desdeRaw || fmt(hace30);
        const hasta = hastaRaw || fmt(hoy);

        const movimientos = reporteRepository.getMovimientosReport(desde, hasta);
        const entradas = movimientos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.cantidad, 0);
        const salidas  = movimientos.filter(m => m.tipo === 'salida').reduce((s, m) => s + m.cantidad, 0);

        return {
            filtros: { desde, hasta },
            movimientos,
            resumen: {
                total_registros: movimientos.length,
                total_entradas:  entradas,
                total_salidas:   salidas
            }
        };
    }

    async getPedidosReport(desdeRaw, hastaRaw, estado) {
        const hoy    = new Date();
        const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
        const fmt    = d => d.toISOString().slice(0, 10);

        const desde  = desdeRaw  || fmt(hace30);
        const hasta  = hastaRaw  || fmt(hoy);

        const pedidos = reporteRepository.getPedidosReport(desde, hasta, estado);

        const por_estado = pedidos.reduce((acc, p) => {
            acc[p.estado] = (acc[p.estado] || 0) + 1;
            return acc;
        }, {});

        const monto_total = pedidos.reduce((s, p) => s + (p.total || 0), 0).toFixed(2);

        return {
            filtros: { desde, hasta, estado },
            pedidos,
            resumen: {
                total_pedidos: pedidos.length,
                monto_total,
                por_estado
            }
        };
    }
}

module.exports = new ReporteService();
