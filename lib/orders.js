const redis = require('./redis');
const { Reject } = require('./http');

const TTL = 60 * 60 * 24 * 90;
const ESTADOS = ['nuevo', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado'];

// Todo pedido vive bajo la clave de su local: un local nunca ve los pedidos de otro.
const okey = (slug, id) => redis.tk(slug, 'order:' + id);

async function saveOrder(slug, o) {
  await redis.cmd('SET', okey(slug, o.id), JSON.stringify(o), 'EX', TTL);
}

async function getOrder(slug, id) {
  if (!/^[a-f0-9]{16}$/.test(String(id))) return null;
  const raw = await redis.cmd('GET', okey(slug, id));
  return raw ? JSON.parse(raw) : null;
}

async function nextNumber(slug) {
  return redis.cmd('INCR', redis.tk(slug, 'orders:seq'));
}

async function addToList(slug, id) {
  await redis.cmd('LPUSH', redis.tk(slug, 'orders:list'), id);
  await redis.cmd('LTRIM', redis.tk(slug, 'orders:list'), 0, 299);
}

async function listOrders(slug, n) {
  // n hasta 300: el panel usa los últimos para las estadísticas del día.
  const ids = await redis.cmd('LRANGE', redis.tk(slug, 'orders:list'), 0, (n || 60) - 1);
  if (!ids || !ids.length) return [];
  const rows = await redis.cmd('MGET', ...ids.map((i) => okey(slug, i)));
  return rows.filter(Boolean).map((r) => JSON.parse(r));
}

const clean = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const no = (m) => { throw new Reject(m, 400); };

// Arma el pedido con los precios del servidor. Nunca se confía en los precios que manda el navegador.
function buildOrder(cfg, b) {
  const lines = Array.isArray(b.items) ? b.items : [];
  if (!lines.length) no('Tu pedido está vacío.');
  if (lines.length > 30) no('Demasiados productos en el pedido.');

  const prod = new Map(cfg.menu.map((p) => [p.id, p]));
  const extra = new Map(cfg.extras.map((x) => [x.id, x]));
  let subtotal = 0;

  const items = lines.map((l) => {
    const p = prod.get(String(l.id));
    if (!p) no('Un producto del pedido ya no existe. Actualizá la página.');
    if (p.off) no('"' + p.nom + '" está agotado.');
    const qty = Number(l.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) no('Cantidad inválida.');
    const exIds = Array.isArray(l.extras) ? [...new Set(l.extras.map(String))] : [];
    if (exIds.length && !p.extras) no('"' + p.nom + '" no admite extras.');
    let unit = p.precio;
    const names = exIds.map((id) => {
      const x = extra.get(id);
      if (!x) no('Un extra del pedido ya no existe. Actualizá la página.');
      unit += x.precio;
      return x.nom;
    });
    subtotal += unit * qty;
    return { id: p.id, nom: p.nom, qty, unit, extras: names, nota: clean(l.nota, 120) };
  });

  const modo = ['delivery', 'takeaway'].includes(b.modo) ? b.modo : 'retiro';
  const modos = cfg.modos || {};
  if (modos[modo] === false) no('Esa forma de entrega no está disponible en este local.');
  if (cfg.minimo && subtotal < cfg.minimo) no('El pedido mínimo es de $' + cfg.minimo.toLocaleString('es-AR') + '.');
  let envio = 0, zona = '', dir = '', hora = '';
  if (modo === 'takeaway') {
    hora = clean(b.hora, 5);
    if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) no('Elegí una hora válida para pasar a buscar.');
  }
  if (modo === 'delivery') {
    const z = cfg.zonas.find((x) => x.id === String(b.zona));
    if (!z) no('Elegí un barrio para el envío.');
    dir = clean(b.dir, 120);
    if (dir.length < 5) no('Escribí la dirección de entrega.');
    envio = z.costo;
    zona = z.nom;
  }

  const c = b.cliente || {};
  const nombre = clean(c.nombre, 60);
  const tel = clean(c.tel, 30);
  if (nombre.length < 2) no('Escribí tu nombre.');
  const digits = tel.replace(/\D/g, '').length;
  if (digits < 8 || digits > 15) no('Escribí un teléfono válido para avisarte.');

  const metodo = ['efectivo', 'transferencia'].includes(b.pago) ? b.pago : '';
  if (!metodo) no('Elegí cómo vas a pagar.');

  const total = subtotal + envio;
  if (total > 2000000) no('El total del pedido es demasiado alto.');

  return {
    id: '', numero: 0,
    creado: new Date().toISOString(),
    estado: 'nuevo',
    pago: { metodo, pagado: false, cambio: metodo === 'efectivo' ? clean(b.cambio, 20) : '' },
    cliente: { nombre, tel },
    entrega: { modo, zona, dir, hora },
    items, subtotal, envio, total,
    nota: clean(b.nota, 200)
  };
}

module.exports = { ESTADOS, saveOrder, getOrder, nextNumber, addToList, listOrders, buildOrder };
