// Estadísticas del local: ventas, pedidos, horas pico y productos más pedidos de los últimos N días,
// comparadas con los N días anteriores. Sale de los registros diarios (orders:d:<día>), que duran 90 días.
const redis = require('./redis');
const { dkey, traer, diaAR } = require('./orders');
const { nowAR } = require('./config');

const DIA_MS = 86400000;

function vacio() {
  return {
    pedidos: 0, ventas: 0, ticket: 0, cancelados: 0, envios: 0,
    retiro: 0, delivery: 0, efectivo: 0, transferencia: 0,
    porDia: [], porHora: Array(24).fill(0), porSemana: Array(7).fill(0), top: []
  };
}

// Suma los pedidos de una lista de días. Los cancelados no cuentan como venta.
function resumir(dias, pedidosPorDia) {
  const r = vacio(), top = new Map();
  dias.forEach((dia) => {
    const lista = pedidosPorDia.get(dia) || [];
    let n = 0, v = 0;
    lista.forEach((o) => {
      if (o.estado === 'cancelado') { r.cancelados++; return; }
      n++; v += o.total || 0;
      r.envios += o.envio || 0;
      if (o.entrega && o.entrega.modo === 'delivery') r.delivery++; else r.retiro++;
      if (o.pago && o.pago.metodo === 'transferencia') r.transferencia++; else r.efectivo++;
      const { dow, h } = nowAR(new Date(o.creado));
      r.porHora[Math.floor(h)]++;
      r.porSemana[dow]++;
      (o.items || []).forEach((it) => {
        const nom = it.variante ? it.nom + ' (' + it.variante + ')' : it.nom;
        const t = top.get(nom) || { nom, qty: 0, ventas: 0 };
        t.qty += it.qty; t.ventas += (it.unit || 0) * it.qty;
        top.set(nom, t);
      });
    });
    r.pedidos += n; r.ventas += v;
    r.porDia.push({ d: dia, n, v });
  });
  r.ticket = r.pedidos ? Math.round(r.ventas / r.pedidos) : 0;
  r.top = [...top.values()].sort((a, b) => b.qty - a.qty || b.ventas - a.ventas).slice(0, 8);
  return r;
}

// dias: 7 o 30. Guarda el resultado 5 minutos para no leer cientos de pedidos cada vez que se abre la pestaña.
async function estadisticas(slug, dias, ahora) {
  const n = dias === 30 ? 30 : 7;
  const hoy = ahora || new Date();
  const ck = redis.tk(slug, 'stats:' + n + ':' + diaAR(hoy));
  const cache = await redis.cmd('GET', ck);
  if (cache) { try { return JSON.parse(cache); } catch (e) { /* se recalcula */ } }

  const lista = [];
  for (let i = 2 * n - 1; i >= 0; i--) lista.push(diaAR(new Date(hoy.getTime() - i * DIA_MS)));
  const listas = await Promise.all(lista.map((d) => redis.cmd('LRANGE', dkey(slug, d), 0, 4999)));
  const ids = [...new Set([].concat(...listas.map((l) => l || [])))];
  const rows = ids.length ? await traer(slug, ids) : [];
  const porId = new Map(rows.filter(([, o]) => o).map(([id, o]) => [id, o]));
  const porDia = new Map();
  lista.forEach((d, i) => porDia.set(d, (listas[i] || []).map((id) => porId.get(id)).filter(Boolean)));

  const out = {
    dias: n,
    desde: lista[n], hasta: lista[2 * n - 1],
    actual: resumir(lista.slice(n), porDia),
    anterior: resumir(lista.slice(0, n), porDia)
  };
  await redis.cmd('SET', ck, JSON.stringify(out), 'EX', 300);
  return out;
}

module.exports = { estadisticas, resumir };
