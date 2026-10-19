const redis = require('./redis');
const mp = require('./mp');
const { Reject } = require('./http');

const TTL = 60 * 60 * 24 * 90;
const ESTADOS = ['pendiente_pago', 'nuevo', 'preparando', 'listo', 'entregado', 'cancelado'];

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
  const ids = await redis.cmd('LRANGE', redis.tk(slug, 'orders:list'), 0, (n || 60) - 1);
  if (!ids || !ids.length) return [];
  const rows = await redis.cmd('MGET', ...ids.map((i) => okey(slug, i)));
  return rows.filter(Boolean).map((r) => JSON.parse(r));
}

const clean = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const no = (m) => { throw new Reject(m, 400); };

// Arma el pedido con los precios del servidor. Nunca se confía en los precios que manda el navegador.
function buildOrder(cfg, b, opts) {
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

  const modo = b.modo === 'delivery' ? 'delivery' : 'retiro';
  let envio = 0, zona = '', dir = '';
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

  const metodo = ['mp', 'efectivo', 'transferencia'].includes(b.pago) ? b.pago : '';
  if (!metodo) no('Elegí cómo vas a pagar.');
  if (metodo === 'mp' && !opts.mpOk) no('El pago con Mercado Pago no está disponible ahora.');

  const total = subtotal + envio;
  if (total > 2000000) no('El total del pedido es demasiado alto.');

  return {
    id: '', numero: 0,
    creado: new Date().toISOString(),
    estado: metodo === 'mp' ? 'pendiente_pago' : 'nuevo',
    pago: { metodo, estado: 'pendiente', cambio: metodo === 'efectivo' ? clean(b.cambio, 20) : '' },
    cliente: { nombre, tel },
    entrega: { modo, zona, dir },
    items, subtotal, envio, total,
    nota: clean(b.nota, 200)
  };
}

// Datos que Mercado Pago necesita para armar la pantalla de pago.
// site = { origin, local }. "local" solo se agrega a los links cuando el sitio no usa subdominio.
function preferenceFor(o, cfg, site) {
  const items = o.items.map((i) => ({
    id: i.id,
    title: (i.nom + (i.extras.length ? ' + ' + i.extras.join(', ') : '')).slice(0, 250),
    quantity: i.qty, unit_price: i.unit, currency_id: 'ARS'
  }));
  if (o.envio > 0) {
    items.push({ id: 'envio', title: 'Envío' + (o.entrega.zona ? ' a ' + o.entrega.zona : ''), quantity: 1, unit_price: o.envio, currency_id: 'ARS' });
  }
  const loc = site.local ? '&local=' + encodeURIComponent(site.local) : '';
  const back = site.origin + '/?pedido=' + o.id + loc;
  // Fechas con el formato de la documentación, en hora argentina (-03:00).
  const argISO = (ms) => new Date(ms - 3 * 3600e3).toISOString().replace('Z', '-03:00');
  const now = Date.now();
  const desc = cfg.nombre.normalize('NFD').replace(/[^\x20-\x7E]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 16);
  const pref = {
    items,
    external_reference: o.id,
    notification_url: site.origin + '/api/webhook' + (site.local ? '?local=' + encodeURIComponent(site.local) : ''),
    back_urls: { success: back, pending: back, failure: back },
    auto_return: 'approved',
    payer: { name: o.cliente.nombre },
    expires: true,
    expiration_date_from: argISO(now),
    expiration_date_to: argISO(now + 2 * 3600e3)
  };
  if (desc) pref.statement_descriptor = desc;
  return pref;
}

// Consulta el pago directamente a Mercado Pago (con el token del local) y actualiza el pedido.
// Se usa desde el aviso automático (webhook) y cuando el cliente vuelve a la página.
async function syncPayment(slug, token, paymentId) {
  const p = await mp.getPayment(token, paymentId);
  if (!p) return null;
  const o = await getOrder(slug, String(p.external_reference || ''));
  if (!o || o.pago.metodo !== 'mp') return null;

  if (p.currency_id !== 'ARS' || Math.abs(Number(p.transaction_amount) - o.total) > 0.01) {
    console.warn('El monto del pago no coincide con el pedido', slug, o.id, p.transaction_amount, o.total);
    return o;
  }

  if (p.status === 'approved') {
    if (o.pago.estado !== 'aprobado') {
      o.pago.estado = 'aprobado';
      o.pago.mpPaymentId = String(p.id);
      o.pago.aprobado = new Date().toISOString();
      if (o.estado === 'pendiente_pago') o.estado = 'nuevo';
      await saveOrder(slug, o);
    }
  } else if (p.status === 'rejected' || p.status === 'cancelled') {
    if (o.pago.estado === 'pendiente') {
      o.pago.estado = 'rechazado';
      await saveOrder(slug, o);
    }
  } else if (p.status === 'refunded' || p.status === 'charged_back') {
    o.pago.estado = p.status === 'refunded' ? 'devuelto' : 'contracargo';
    await saveOrder(slug, o);
  }
  return o;
}

module.exports = { ESTADOS, saveOrder, getOrder, nextNumber, addToList, listOrders, buildOrder, preferenceFor, syncPayment };
