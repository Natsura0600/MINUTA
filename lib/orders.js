const redis = require('./redis');
const { Reject } = require('./http');
const { isOpen, nowAR, TZ } = require('./config');

const TTL = 60 * 60 * 24 * 90;
const ESTADOS = ['nuevo', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado'];

// Todo pedido vive bajo la clave de su local: un local nunca ve los pedidos de otro.
const okey = (slug, id) => redis.tk(slug, 'order:' + id);

async function saveOrder(slug, o) {
  await redis.cmd('SET', okey(slug, o.id), JSON.stringify(o), 'EX', TTL);
  // Contador de cambios: el panel pregunta "¿hubo algo nuevo?" y, si no, no baja ningún pedido.
  await redis.cmd('INCR', redis.tk(slug, 'orders:rev'));
}

// Pedidos guardados antes de unificar "take away" con "retiro": se leen como retiro con hora.
function norm(o) {
  if (!o || !o.entrega) return o;
  if (o.entrega.modo === 'takeaway') o.entrega.modo = 'retiro';
  if (!Array.isArray(o.historial)) o.historial = [{ e: 'nuevo', t: o.creado }];
  return o;
}

async function getOrder(slug, id) {
  if (!/^[a-f0-9]{16}$/.test(String(id))) return null;
  const raw = await redis.cmd('GET', okey(slug, id));
  return raw ? norm(JSON.parse(raw)) : null;
}

async function nextNumber(slug) {
  return redis.cmd('INCR', redis.tk(slug, 'orders:seq'));
}

const FINAL = ['entregado', 'cancelado'];
const diaAR = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d || new Date());
const dkey = (slug, dia) => redis.tk(slug, 'orders:d:' + dia);
const akey = (slug) => redis.tk(slug, 'orders:activos');

async function addToList(slug, id) {
  await redis.cmd('LPUSH', redis.tk(slug, 'orders:list'), id);
  await redis.cmd('LTRIM', redis.tk(slug, 'orders:list'), 0, 299);
  // Registro del día (sin tope): caja, estadísticas y planilla completas aunque sea un viernes fuerte.
  await redis.cmd('LPUSH', dkey(slug, diaAR()), id);
  await redis.cmd('EXPIRE', dkey(slug, diaAR()), TTL);
  await marcarActivo(slug, id);
}

// Pedidos en curso (y los recién terminados, para que todos los dispositivos vean el cambio).
async function marcarActivo(slug, id) {
  await redis.cmd('SADD', akey(slug), id);
}

async function traer(slug, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const rows = await redis.cmd('MGET', ...ids.slice(i, i + 100).map((x) => okey(slug, x)));
    rows.forEach((r, k) => out.push([ids[i + k], r ? norm(JSON.parse(r)) : null]));
  }
  return out;
}

// Lo que necesita el panel. "completo": todos los pedidos de hoy y los últimos 150 (al entrar).
// Si no, una consulta liviana: los últimos 40 más los que están en curso.
async function ordersPanel(slug, completo) {
  const [recientes, activos, hoy] = await Promise.all([
    redis.cmd('LRANGE', redis.tk(slug, 'orders:list'), 0, (completo ? 150 : 40) - 1),
    redis.cmd('SMEMBERS', akey(slug)),
    completo ? redis.cmd('LRANGE', dkey(slug, diaAR()), 0, 1999) : Promise.resolve([])
  ]);
  const ids = [...new Set([].concat(recientes || [], activos || [], hoy || []))];
  if (!ids.length) return [];
  const rows = await traer(slug, ids);
  // Saca de "activos" lo que terminó hace más de 30 minutos o ya no existe.
  const limite = Date.now() - 30 * 60000;
  const viejos = rows.filter(([id, o]) => (activos || []).includes(id) && (!o || (FINAL.includes(o.estado) && new Date(ultimoCambio(o)).getTime() < limite))).map(([id]) => id);
  for (const id of viejos) await redis.cmd('SREM', akey(slug), id);
  return rows.map(([, o]) => o).filter(Boolean).sort((a, b) => b.creado.localeCompare(a.creado));
}

function ultimoCambio(o) {
  const h = Array.isArray(o.historial) ? o.historial : [];
  return h.length ? h[h.length - 1].t : o.creado;
}

async function listOrders(slug, n) {
  // n hasta 300: el panel usa los últimos para las estadísticas del día.
  const ids = await redis.cmd('LRANGE', redis.tk(slug, 'orders:list'), 0, (n || 60) - 1);
  if (!ids || !ids.length) return [];
  const rows = await redis.cmd('MGET', ...ids.map((i) => okey(slug, i)));
  return rows.filter(Boolean).map((r) => norm(JSON.parse(r)));
}

const clean = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const no = (m) => { throw new Reject(m, 400); };

// La hora de retiro tiene que ser de ahora en adelante (con 5 minutos de tolerancia) y con el local abierto.
function validarHora(cfg, hora, ahora) {
  const t = ahora || new Date();
  const { h } = nowAR(t);
  const [hh, mm] = hora.split(':').map(Number);
  let m = hh * 60 + mm - Math.floor(h * 60);
  if (m < -720) m += 1440;
  if (m > 720) m -= 1440;
  if (m < -5) no('Esa hora ya pasó. Elegí otra para pasar a buscar.');
  if (!isOpen(Object.assign({}, cfg, { pausado: false }), new Date(t.getTime() + m * 60000))) no('A esa hora el local está cerrado. Elegí otra para pasar a buscar.');
}

// Arma el pedido con los precios del servidor. Nunca se confía en los precios que manda el navegador.
function buildOrder(cfg, b, ahora) {
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
    // Producto con tamaños: hay que elegir uno y el precio es el de ese tamaño.
    let unit = p.precio, variante = '';
    if (Array.isArray(p.variantes) && p.variantes.length) {
      const v = p.variantes.find((x) => x.id === String(l.vid));
      if (!v) no('Elegí el tamaño de "' + p.nom + '".');
      unit = v.precio; variante = v.nom;
    }
    const names = exIds.map((id) => {
      const x = extra.get(id);
      if (!x) no('Un extra del pedido ya no existe. Actualizá la página.');
      unit += x.precio;
      return x.nom;
    });
    subtotal += unit * qty;
    return Object.assign({ id: p.id, nom: p.nom, qty, unit, extras: names, nota: clean(l.nota, 120) }, variante ? { variante } : {});
  });

  // "takeaway" ya no existe: es lo mismo que retirar en el local (lo aceptamos por si queda una tienda vieja abierta).
  const modo = b.modo === 'delivery' ? 'delivery' : 'retiro';
  const modos = cfg.modos || {};
  if (modos[modo] === false) no('Esa forma de entrega no está disponible en este local.');
  if (cfg.minimo && subtotal < cfg.minimo) no('El pedido mínimo es de $' + cfg.minimo.toLocaleString('es-AR') + '.');
  let envio = 0, zona = '', dir = '', hora = '';
  if (modo === 'retiro' && cfg.elegirHora !== false) {
    hora = clean(b.hora, 5);
    if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) no('Elegí una hora válida para pasar a buscar.');
    if (hora) validarHora(cfg, hora, ahora);
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

  const creado = new Date().toISOString();
  return {
    id: '', numero: 0,
    creado,
    estado: 'nuevo',
    historial: [{ e: 'nuevo', t: creado }],
    pago: { metodo, pagado: false, cambio: metodo === 'efectivo' ? clean(b.cambio, 20) : '' },
    cliente: { nombre, tel },
    entrega: { modo, zona, dir, hora },
    items, subtotal, envio, total,
    nota: clean(b.nota, 200)
  };
}

// Cambia el estado y deja anotado cuándo pasó (para ver tiempos de cocina).
function setEstado(o, estado) {
  if (o.estado === estado) return o;
  o.estado = estado;
  o.historial = (Array.isArray(o.historial) ? o.historial : []).concat({ e: estado, t: new Date().toISOString() }).slice(-20);
  return o;
}

module.exports = { dkey, traer, ESTADOS, FINAL, norm, setEstado, clean, ordersPanel, marcarActivo, diaAR, validarHora, saveOrder, getOrder, nextNumber, addToList, listOrders, buildOrder };
