// Pruebas del servidor con Redis y Mercado Pago simulados. Correr con: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

process.env.KV_REST_API_URL = 'https://redis.test';
process.env.KV_REST_API_TOKEN = 'redis-token';
process.env.ROOT_DOMAIN = 'pedidos.test';
process.env.APP_SECRET = 'una-frase-larga-y-secreta-para-las-pruebas';
process.env.SUPERADMIN_PASSWORD = 'jefe ñandú';

// ---- Redis simulado ----
const db = new Map();
const sets = new Map();
const lists = new Map();

function redis(args) {
  const [c, ...a] = args;
  switch (c) {
    case 'GET': return db.has(a[0]) ? db.get(a[0]) : null;
    case 'SET': {
      if (a.includes('NX') && db.has(a[0])) return null;
      db.set(a[0], a[1]); return 'OK';
    }
    case 'DEL': { let n = 0; a.forEach((k) => { if (db.delete(k)) n++; if (lists.delete(k)) n++; }); return n; }
    case 'INCR': { const n = Number(db.get(a[0]) || 0) + 1; db.set(a[0], String(n)); return n; }
    case 'EXPIRE': return 1;
    case 'SADD': { const s = sets.get(a[0]) || new Set(); s.add(a[1]); sets.set(a[0], s); return 1; }
    case 'SREM': { const s = sets.get(a[0]); if (s) s.delete(a[1]); return 1; }
    case 'SCARD': return (sets.get(a[0]) || new Set()).size;
    case 'SMEMBERS': return [...(sets.get(a[0]) || [])];
    case 'LPUSH': { const l = lists.get(a[0]) || []; l.unshift(a[1]); lists.set(a[0], l); return l.length; }
    case 'LTRIM': return 'OK';
    case 'LRANGE': return (lists.get(a[0]) || []).slice(Number(a[1]), Number(a[2]) + 1);
    case 'MGET': return a.map((k) => (db.has(k) ? db.get(k) : null));
    default: throw new Error('comando no soportado ' + c);
  }
}

global.fetch = async (url, opts = {}) => {
  if (url === 'https://redis.test') return { ok: true, status: 200, json: async () => ({ result: redis(JSON.parse(opts.body)) }) };
  throw new Error('fetch inesperado: ' + url);
};

const handlers = {
  menu: require('../api/menu'), login: require('../api/login'), account: require('../api/account'),
  checkout: require('../api/checkout'), order: require('../api/order'), orders: require('../api/orders'),
  superadmin: require('../api/superadmin'), plan: require('../api/plan'), suscribir: require('../api/suscribir')
};
const { isOpen, nowAR, DEFAULT } = require('../lib/config');
const T = require('../lib/tenants');
const cr = require('../lib/crypto');
const { slugFromReq, siteFor } = require('../lib/http');

function call(name, { method = 'GET', query = {}, body, headers = {}, host = 'smash.pedidos.test', keepLimits = false } = {}) {
  if (!keepLimits) for (const k of [...db.keys()]) if (k.startsWith('rl:')) db.delete(k);
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(s) { resolve({ status: this.statusCode, body: s ? JSON.parse(s) : null, headers: this.headers }); }
    };
    handlers[name]({ method, query, body, headers: Object.assign({ host }, headers), socket: {} }, res);
  });
}

const SUPER = { 'x-super-password': encodeURIComponent('jefe ñandú') };
const bearer = (t) => ({ authorization: 'Bearer ' + t });
const host = (slug) => slug + '.pedidos.test';
const abierto = (extra) => {
  const c = JSON.parse(JSON.stringify(DEFAULT));
  c.horario = { dias: [0, 1, 2, 3, 4, 5, 6], desde: 0, hasta: 24 };
  c.whatsapp = '5491155550000';
  return Object.assign(c, extra);
};
const pedido = (extra) => Object.assign({
  items: [{ id: 'cla', qty: 2, extras: ['e2'], nota: 'sin pickles' }],
  modo: 'delivery', zona: 'z1', dir: 'San Martín 123',
  cliente: { nombre: 'Ana', tel: '11 5555-1234' }, pago: 'transferencia'
}, extra);

// Crea un local, entra como dueño y deja el menú abierto. Devuelve lo necesario para operar.
async function nuevoLocal(slug, email) {
  const c = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'crear', nombre: 'Local ' + slug, slug, email: email || slug + '@mail.com', venceEl: '2099-01-01' } });
  assert.strictEqual(c.status, 200, JSON.stringify(c.body));
  const l = await call('login', { method: 'POST', host: host(slug), body: { email: email || slug + '@mail.com', password: c.body.password } });
  assert.strictEqual(l.status, 200, JSON.stringify(l.body));
  const token = l.body.token;
  const g = await call('menu', { method: 'PUT', host: host(slug), headers: bearer(token), body: abierto({ nombre: 'Local ' + slug }) });
  assert.strictEqual(g.status, 200, JSON.stringify(g.body));
  return { slug, token, password: c.body.password, h: host(slug) };
}

test('el local sale del subdominio y las direcciones reservadas no existen', async () => {
  const q = (h, query) => slugFromReq({ headers: { host: h }, query: query || {} });
  assert.strictEqual(q('smash.pedidos.test'), 'smash');
  assert.strictEqual(q('SMASH.pedidos.test:3000'), 'smash');
  assert.strictEqual(q('a.b.pedidos.test'), null);
  assert.strictEqual(q('pedidos.test'), null);
  assert.strictEqual(q('algo.vercel.app', { local: 'Smash' }), 'smash'); // modo de prueba
  assert.strictEqual(q('smash.pedidos.test', { local: 'otro' }), 'smash'); // el subdominio manda
  assert.deepStrictEqual(siteFor({ headers: { host: 'smash.pedidos.test' } }, 'smash'), { origin: 'https://smash.pedidos.test', local: '' });
  assert.deepStrictEqual(siteFor({ headers: { host: 'x.vercel.app', 'x-forwarded-proto': 'https' } }, 'smash'), { origin: 'https://x.vercel.app', local: 'smash' });
  assert.strictEqual(await T.getTenant('www'), null);
  assert.strictEqual(await T.getTenant('admin'), null);
});

test('un local que no existe responde 404 y el panel tuyo pide contraseña', async () => {
  const r = await call('menu', { host: host('nadie') });
  assert.strictEqual(r.status, 404);
  assert.strictEqual(r.body.error, 'local_no_encontrado');
  assert.strictEqual((await call('superadmin')).status, 401);
  assert.strictEqual((await call('superadmin', { headers: { 'x-super-password': 'mala' } })).status, 401);
  assert.strictEqual((await call('superadmin', { headers: SUPER })).status, 200);
});

test('alta de locales: validaciones, contraseña inicial y duplicados', async () => {
  const crear = (b) => call('superadmin', { method: 'POST', headers: SUPER, body: Object.assign({ accion: 'crear', nombre: 'Burger', slug: 'burger', email: 'a@b.com' }, b) });
  assert.strictEqual((await crear({ slug: 'Mal Slug' })).status, 400);
  assert.strictEqual((await crear({ slug: 'www' })).status, 400);
  assert.strictEqual((await crear({ slug: 'ab' })).status, 400);
  assert.strictEqual((await crear({ email: 'no-es-email' })).status, 400);
  assert.strictEqual((await crear({ venceEl: '31/12/2030' })).status, 400);
  const ok = await crear({ venceEl: '2099-05-31' });
  assert.strictEqual(ok.status, 200);
  assert.ok(ok.body.password.length >= 12);
  assert.strictEqual(ok.body.local.url, 'https://burger.pedidos.test');
  assert.strictEqual((await crear({})).status, 409);

  // la contraseña no queda guardada en claro
  assert.ok(!db.get('t:burger:meta').includes(ok.body.password));

  // un local nuevo arranca pausado y sin WhatsApp: no se puede pedir hasta que el dueño lo prepare
  const m = await call('menu', { host: host('burger') });
  assert.strictEqual(m.status, 200);
  assert.strictEqual(m.body.config.pausado, true);
  assert.strictEqual(m.body.config.whatsapp, '');
  assert.strictEqual(m.body.abierto, false);
});

test('login: solo entra el dueño de ese local, y la contraseña nueva cierra las sesiones viejas', async () => {
  const a = await nuevoLocal('lalo');
  const b = await nuevoLocal('pepe');

  assert.strictEqual((await call('login', { method: 'POST', host: a.h, body: { email: 'lalo@mail.com', password: 'mala' } })).status, 401);
  assert.strictEqual((await call('login', { method: 'POST', host: a.h, body: { email: 'otro@mail.com', password: a.password } })).status, 401);
  // las credenciales de un local no sirven en el subdominio de otro
  assert.strictEqual((await call('login', { method: 'POST', host: b.h, body: { email: 'lalo@mail.com', password: a.password } })).status, 401);

  // el token de un local no abre el panel de otro
  assert.strictEqual((await call('orders', { host: b.h, headers: bearer(a.token) })).status, 401);
  assert.strictEqual((await call('orders', { host: a.h, headers: bearer(a.token) })).status, 200);
  assert.strictEqual((await call('orders', { host: a.h })).status, 401);
  assert.strictEqual((await call('orders', { host: a.h, headers: bearer(a.token + 'x') })).status, 401);

  // cambio de contraseña
  const corta = await call('account', { method: 'POST', host: a.h, headers: bearer(a.token), body: { accion: 'clave', actual: a.password, nueva: '123' } });
  assert.strictEqual(corta.status, 400);
  const equivocada = await call('account', { method: 'POST', host: a.h, headers: bearer(a.token), body: { accion: 'clave', actual: 'no', nueva: 'una clave larga 123' } });
  assert.strictEqual(equivocada.status, 400);
  const cambio = await call('account', { method: 'POST', host: a.h, headers: bearer(a.token), body: { accion: 'clave', actual: a.password, nueva: 'una clave larga 123' } });
  assert.strictEqual(cambio.status, 200);
  assert.strictEqual((await call('orders', { host: a.h, headers: bearer(a.token) })).status, 401); // sesión vieja
  assert.strictEqual((await call('orders', { host: a.h, headers: bearer(cambio.body.token) })).status, 200);
  assert.strictEqual((await call('login', { method: 'POST', host: a.h, body: { email: 'lalo@mail.com', password: 'una clave larga 123' } })).status, 200);
});

test('cada local tiene su menú y sus pedidos, sin mezclarse', async () => {
  const a = await nuevoLocal('uno');
  const b = await nuevoLocal('dos');
  const cfgB = abierto({ nombre: 'Local dos' }); cfgB.menu[0].precio = 5000; // la Clásica cuesta distinto en "dos"
  assert.strictEqual((await call('menu', { method: 'PUT', host: b.h, headers: bearer(b.token), body: cfgB })).status, 200);

  assert.strictEqual((await call('menu', { host: a.h })).body.config.menu[0].precio, 9800);
  assert.strictEqual((await call('menu', { host: b.h })).body.config.menu[0].precio, 5000);

  // el dueño de "uno" no puede cambiar el menú de "dos"
  assert.strictEqual((await call('menu', { method: 'PUT', host: b.h, headers: bearer(a.token), body: abierto() })).status, 401);

  const efectivo = { pago: 'efectivo', modo: 'retiro', items: [{ id: 'cla', qty: 1 }] };
  const pa = await call('checkout', { method: 'POST', host: a.h, body: pedido(efectivo) });
  const pb = await call('checkout', { method: 'POST', host: b.h, body: pedido(efectivo) });
  assert.strictEqual(pa.status, 200); assert.strictEqual(pb.status, 200);
  assert.strictEqual(JSON.parse(db.get('t:uno:order:' + pa.body.id)).total, 9800);
  assert.strictEqual(JSON.parse(db.get('t:dos:order:' + pb.body.id)).total, 5000);

  const la = (await call('orders', { host: a.h, headers: bearer(a.token) })).body.orders;
  const lb = (await call('orders', { host: b.h, headers: bearer(b.token) })).body.orders;
  assert.deepStrictEqual(la.map((o) => o.id), [pa.body.id]);
  assert.deepStrictEqual(lb.map((o) => o.id), [pb.body.id]);

  // un pedido de un local no se ve ni se toca desde el otro
  assert.strictEqual((await call('order', { host: b.h, query: { id: pa.body.id } })).status, 404);
  const cambiar = await call('orders', { method: 'PATCH', host: b.h, headers: bearer(b.token), body: { id: pa.body.id, estado: 'cancelado' } });
  assert.strictEqual(cambiar.status, 404);
  assert.strictEqual((await call('order', { host: a.h, query: { id: pa.body.id } })).body.estado, 'nuevo');
  assert.strictEqual(pa.body.numero, 1); assert.strictEqual(pb.body.numero, 1); // numeración propia
});

test('mensualidad: un local vencido o suspendido no toma pedidos, y registrar el pago lo reactiva', async () => {
  const a = await nuevoLocal('mensual');
  const efectivo = pedido({ pago: 'efectivo', modo: 'retiro' });
  assert.strictEqual((await call('checkout', { method: 'POST', host: a.h, body: efectivo })).status, 200);

  // vencido ayer
  const ayer = T.addMonths(T.hoyAR(), -1);
  let r = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'editar', slug: 'mensual', venceEl: ayer } });
  assert.strictEqual(r.body.local.estado, 'vencido');
  const menu = await call('menu', { host: a.h });
  assert.strictEqual(menu.body.suspendido, true);
  assert.strictEqual(menu.body.abierto, false);
  const co = await call('checkout', { method: 'POST', host: a.h, body: efectivo });
  assert.strictEqual(co.status, 403);
  assert.strictEqual((await call('orders', { host: a.h, headers: bearer(a.token) })).body.estado, 'vencido'); // el panel sigue abriendo

  // registrar pago: suma un mes a partir de hoy (ya había vencido)
  r = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'pago', slug: 'mensual' } });
  assert.strictEqual(r.body.local.venceEl, T.addMonths(T.hoyAR(), 1));
  assert.strictEqual(r.body.local.estado, 'activo');
  assert.strictEqual((await call('checkout', { method: 'POST', host: a.h, body: efectivo })).status, 200);

  // un segundo pago suma sobre la fecha vigente
  const antes = r.body.local.venceEl;
  r = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'pago', slug: 'mensual' } });
  assert.strictEqual(r.body.local.venceEl, T.addMonths(antes, 1));

  // suspensión manual
  r = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'editar', slug: 'mensual', activo: false } });
  assert.strictEqual(r.body.local.estado, 'suspendido');
  assert.strictEqual((await call('checkout', { method: 'POST', host: a.h, body: efectivo })).status, 403);
  await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'editar', slug: 'mensual', activo: true } });
  assert.strictEqual((await call('checkout', { method: 'POST', host: a.h, body: efectivo })).status, 200);
});

test('superadmin: contraseña nueva, edición, borrado con confirmación', async () => {
  const a = await nuevoLocal('temporal');
  const r = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'clave', slug: 'temporal' } });
  assert.strictEqual(r.status, 200);
  assert.notStrictEqual(r.body.password, a.password);
  assert.strictEqual((await call('orders', { host: a.h, headers: bearer(a.token) })).status, 401); // la sesión vieja se cierra
  assert.strictEqual((await call('login', { method: 'POST', host: a.h, body: { email: 'temporal@mail.com', password: a.password } })).status, 401);
  assert.strictEqual((await call('login', { method: 'POST', host: a.h, body: { email: 'temporal@mail.com', password: r.body.password } })).status, 200);

  const notas = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'editar', slug: 'temporal', notas: 'Paga por transferencia los 5' } });
  assert.strictEqual(notas.body.local.notas, 'Paga por transferencia los 5');

  assert.strictEqual((await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'borrar', slug: 'temporal' } })).status, 400);
  assert.strictEqual((await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'borrar', slug: 'temporal', confirmar: 'temporal' } })).status, 200);
  assert.strictEqual((await call('menu', { host: a.h })).status, 404);
  const lista = (await call('superadmin', { headers: SUPER })).body.locales.map((l) => l.slug);
  assert.ok(!lista.includes('temporal'));
  assert.strictEqual((await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'editar', slug: 'temporal', activo: true } })).status, 404);
});

test('el menú se valida, y el pedido se cobra con los precios del servidor', async () => {
  const a = await nuevoLocal('precios');
  const roto = abierto(); roto.menu[0].precio = -5;
  assert.strictEqual((await call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: roto })).status, 400);
  const sinWa = abierto({ whatsapp: '' });
  assert.strictEqual((await call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: sinWa })).status, 400);
  assert.strictEqual((await call('menu', { method: 'PUT', host: a.h, body: abierto() })).status, 401);

  const trampa = pedido({ pago: 'efectivo', items: [{ id: 'cla', qty: 2, extras: ['e2'], unit: 1, precio: 1 }], total: 1 });
  const r = await call('checkout', { method: 'POST', host: a.h, body: trampa });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(JSON.parse(db.get('t:precios:order:' + r.body.id)).total, (9800 + 1500) * 2 + 1500);
});

test('rechaza pedidos inválidos, productos agotados, local cerrado o pausado', async () => {
  const a = await nuevoLocal('reglas');
  const base = { pago: 'efectivo' };
  const casos = [
    pedido({ ...base, items: [] }), pedido({ ...base, items: [{ id: 'noexiste', qty: 1 }] }),
    pedido({ ...base, items: [{ id: 'cla', qty: 0 }] }), pedido({ ...base, items: [{ id: 'pap', qty: 1, extras: ['e1'] }] }),
    pedido({ ...base, items: [{ id: 'cla', qty: 1, extras: ['nada'] }] }), pedido({ ...base, zona: 'nada' }),
    pedido({ ...base, dir: '' }), pedido({ ...base, cliente: { nombre: '', tel: '1155551234' } }),
    pedido({ ...base, cliente: { nombre: 'Ana', tel: '12' } }), pedido({ pago: 'bitcoin' }), pedido({ pago: 'mp' })
  ];
  for (const b of casos) assert.strictEqual((await call('checkout', { method: 'POST', host: a.h, body: b })).status, 400, JSON.stringify(b));

  const agotado = abierto(); agotado.menu[0].off = true;
  await call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: agotado });
  assert.strictEqual((await call('checkout', { method: 'POST', host: a.h, body: pedido(base) })).status, 400);

  const pausado = abierto({ pausado: true });
  await call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: pausado });
  assert.strictEqual((await call('checkout', { method: 'POST', host: a.h, body: pedido(base) })).status, 409);
  assert.strictEqual((await call('menu', { host: a.h })).body.abierto, false);
});

test('limita los pedidos repetidos y los intentos de contraseña', async () => {
  const a = await nuevoLocal('limites');
  const h = { 'x-forwarded-for': '9.9.9.9' };
  let ultimo;
  for (let i = 0; i < 9; i++) ultimo = await call('checkout', { method: 'POST', host: a.h, body: pedido({ pago: 'bitcoin' }), headers: h, keepLimits: true });
  assert.strictEqual(ultimo.status, 429);

  const g = { 'x-forwarded-for': '8.8.8.8' };
  for (let i = 0; i < 10; i++) ultimo = await call('login', { method: 'POST', host: a.h, body: { email: 'x@y.com', password: 'mala' }, headers: g, keepLimits: true });
  assert.strictEqual(ultimo.status, 401);
  ultimo = await call('login', { method: 'POST', host: a.h, body: { email: 'x@y.com', password: 'mala' }, headers: g, keepLimits: true });
  assert.strictEqual(ultimo.status, 429);
});

test('el cliente sigue su pedido y el local lo va avanzando', async () => {
  const a = await nuevoLocal('sigue');
  const b = await nuevoLocal('otro-sigue');
  const c = await call('checkout', { method: 'POST', host: a.h, body: pedido() });
  assert.strictEqual(c.status, 200, JSON.stringify(c.body));
  const id = c.body.id;
  const ver = async (h) => call('order', { host: h || a.h, query: { id } });
  let s = await ver();
  assert.strictEqual(s.body.estado, 'nuevo');
  assert.strictEqual(s.body.modo, 'delivery');
  assert.strictEqual(s.body.pago.metodo, 'transferencia');
  assert.strictEqual(s.body.pago.pagado, false);
  assert.strictEqual(s.body.cliente, undefined); // sin datos personales
  assert.strictEqual(s.headers['Cache-Control'], 'no-store');
  const patch = (body, token, h) => call('orders', { method: 'PATCH', host: h || a.h, headers: bearer(token || a.token), body: Object.assign({ id }, body) });

  // el cliente no puede cambiar el estado, ni otro local
  assert.strictEqual((await call('orders', { method: 'PATCH', host: a.h, body: { id, estado: 'listo' } })).status, 401);
  assert.strictEqual((await patch({ estado: 'listo' }, b.token, b.h)).status, 404);

  assert.strictEqual((await patch({ estado: 'preparando' })).status, 200);
  assert.strictEqual((await ver()).body.estado, 'preparando');
  assert.strictEqual((await patch({ estado: 'inventado' })).status, 400);
  assert.strictEqual((await patch({ estado: 'listo' })).status, 200);
  assert.strictEqual((await patch({ estado: 'en_camino' })).status, 200);
  assert.strictEqual((await ver()).body.estado, 'en_camino');
  assert.strictEqual((await patch({ pagado: true })).status, 200);
  s = await ver();
  assert.strictEqual(s.body.pago.pagado, true);
  assert.strictEqual(s.body.estado, 'en_camino');
  assert.strictEqual((await patch({ estado: 'entregado' })).status, 200);
  assert.strictEqual((await ver()).body.estado, 'entregado');

  // "en camino" solo existe para delivery
  const r = await call('checkout', { method: 'POST', host: a.h, body: pedido({ modo: 'retiro', pago: 'efectivo' }) });
  const bad = await call('orders', { method: 'PATCH', host: a.h, headers: bearer(a.token), body: { id: r.body.id, estado: 'en_camino' } });
  assert.strictEqual(bad.status, 400);

  assert.strictEqual((await ver(b.h)).status, 404);
  assert.strictEqual((await call('order', { host: a.h, query: { id: 'no-es-un-id' } })).status, 404);
});

test('logo y color del local se validan', async () => {
  const a = await nuevoLocal('marca');
  const put = (cfg) => call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: cfg });
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  assert.strictEqual((await put(abierto({ color: '#1d4ed8', logo: png }))).status, 200);
  const m = await call('menu', { host: a.h });
  assert.strictEqual(m.body.config.color, '#1d4ed8');
  assert.strictEqual(m.body.config.logo, png);
  assert.strictEqual((await put(abierto({ color: 'rojo' }))).status, 400);
  assert.strictEqual((await put(abierto({ color: '#12345' }))).status, 400);
  assert.strictEqual((await put(abierto({ logo: 'https://malo.test/x.png' }))).status, 400);
  assert.strictEqual((await put(abierto({ logo: 'data:image/svg+xml;base64,PHN2Zz4=' }))).status, 400);
  assert.strictEqual((await put(abierto({ logo: 'data:text/html;base64,PGI+' }))).status, 400);
  assert.strictEqual((await put(abierto({ logo: 'data:image/png;base64,' + 'A'.repeat(150001) }))).status, 400);
  assert.strictEqual((await put(abierto({ logo: '' }))).status, 200);
});

test('la página principal: sin local, el menú avisa que es la presentación', async () => {
  const r = await call('menu', { host: 'pedidos.test' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.landing, true);
  assert.strictEqual((await call('menu', { host: 'pedidos.test', query: { local: 'nadie' } })).status, 404);
});

test('plan público: valores iniciales y edición desde tu panel', async () => {
  const p0 = await call('plan');
  assert.strictEqual(p0.status, 200);
  assert.strictEqual(p0.body.plan.precio, '');
  assert.ok(p0.body.plan.incluye.length >= 5);
  const guardar = (plan) => call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'plan', plan } });
  assert.strictEqual((await call('superadmin', { method: 'POST', body: { accion: 'plan', plan: {} } })).status, 401);
  assert.strictEqual((await guardar({ whatsapp: '123' })).status, 400);
  const ok = await guardar({ precio: '$25.000', periodo: 'por mes', alta: 'Alta sin cargo', whatsapp: '54 9 11 5555-0000', instagram: '@picture.web', incluye: ['Uno', ' ', 'Dos'], marca: 'Picture Web Dev' });
  assert.strictEqual(ok.status, 200);
  const p1 = (await call('plan')).body.plan;
  assert.strictEqual(p1.precio, '$25.000');
  assert.strictEqual(p1.whatsapp, '5491155550000');
  assert.strictEqual(p1.instagram, 'picture.web');
  assert.deepStrictEqual(p1.incluye, ['Uno', 'Dos']);
});

test('solicitudes públicas: se validan, no crean locales y se aprueban desde tu panel', async () => {
  const enviar = (b, extra) => call('suscribir', Object.assign({ method: 'POST', body: Object.assign({ nombre: 'Burger Norte', email: 'norte@mail.com', whatsapp: '11 5555-1234' }, b) }, extra));
  assert.strictEqual((await call('suscribir')).status, 405);
  assert.strictEqual((await enviar({ nombre: '' })).status, 400);
  assert.strictEqual((await enviar({ email: 'no' })).status, 400);
  assert.strictEqual((await enviar({ whatsapp: '12' })).status, 400);
  assert.strictEqual((await enviar({ web: 'robot' })).status, 200); // trampa: se ignora en silencio
  assert.strictEqual((await call('superadmin', { headers: SUPER })).body.solicitudes.length, 0);

  const ok = await enviar({ zona: 'Centro', mensaje: 'Hola' });
  assert.strictEqual(ok.status, 200);
  const lista = (await call('superadmin', { headers: SUPER })).body;
  assert.strictEqual(lista.solicitudes.length, 1);
  const lead = lista.solicitudes[0];
  assert.strictEqual(lead.estado, 'nueva');
  assert.strictEqual(lead.email, 'norte@mail.com');
  assert.ok(!lista.locales.some((l) => l.slug === 'burger-norte')); // no crea nada solo
  assert.strictEqual((await call('superadmin', { method: 'POST', body: { accion: 'solicitud_aprobar', id: lead.id, slug: 'burger-norte' } })).status, 401);

  const mala = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'solicitud_aprobar', id: lead.id, slug: 'Mal Slug' } });
  assert.strictEqual(mala.status, 400);
  const apr = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'solicitud_aprobar', id: lead.id, slug: 'burger-norte', venceEl: '2099-01-01' } });
  assert.strictEqual(apr.status, 200, JSON.stringify(apr.body));
  assert.strictEqual(apr.body.local.email, 'norte@mail.com');
  assert.ok(apr.body.password.length >= 12);
  const login = await call('login', { method: 'POST', host: host('burger-norte'), body: { email: 'norte@mail.com', password: apr.body.password } });
  assert.strictEqual(login.status, 200);
  const despues = (await call('superadmin', { headers: SUPER })).body.solicitudes[0];
  assert.strictEqual(despues.estado, 'aprobada');
  assert.strictEqual(despues.slug, 'burger-norte');

  // descartar otra
  await enviar({ nombre: 'Otro Local', email: 'otro@mail.com' });
  const otra = (await call('superadmin', { headers: SUPER })).body.solicitudes.find((l) => l.estado === 'nueva');
  assert.strictEqual((await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'solicitud_borrar', id: otra.id } })).status, 200);
  assert.ok(!(await call('superadmin', { headers: SUPER })).body.solicitudes.some((l) => l.id === otra.id));
});

test('las solicitudes tienen límite por persona', async () => {
  const h = { 'x-forwarded-for': '7.7.7.7' };
  let r;
  for (let i = 0; i < 5; i++) r = await call('suscribir', { method: 'POST', headers: h, keepLimits: true, body: { nombre: 'Local ' + i, email: 'a' + i + '@mail.com', whatsapp: '1155551234' } });
  assert.strictEqual(r.status, 429);
});

test('horario con hora argentina y fechas de la mensualidad', () => {
  const cfg = { pausado: false, horario: { dias: [5], desde: 20, hasta: 24 } };
  assert.strictEqual(isOpen(cfg, new Date('2026-10-17T00:00:00Z')), true); // viernes 21:00 en Argentina
  assert.strictEqual(isOpen(cfg, new Date('2026-10-16T18:00:00Z')), false);
  const noche = { pausado: false, horario: { dias: [5], desde: 20, hasta: 2 } };
  assert.strictEqual(isOpen(noche, new Date('2026-10-17T03:00:00Z')), true);
  assert.strictEqual(isOpen(noche, new Date('2026-10-17T06:00:00Z')), false);
  assert.strictEqual(nowAR(new Date('2026-10-17T00:00:00Z')).dow, 5);
  assert.strictEqual(T.addMonths('2026-01-31', 1), '2026-02-28');
  assert.strictEqual(T.addMonths('2028-01-31', 1), '2028-02-29');
  assert.strictEqual(T.addMonths('2026-12-15', 1), '2027-01-15');
  assert.strictEqual(T.hoyAR(new Date('2026-10-17T01:00:00Z')), '2026-10-16'); // en Argentina todavía es el 16
  assert.strictEqual(T.estado({ activo: true, venceEl: '2026-10-16' }, new Date('2026-10-17T01:00:00Z')), 'activo');
  assert.strictEqual(T.estado({ activo: true, venceEl: '2026-10-16' }, new Date('2026-10-18T01:00:00Z')), 'vencido');
});

test('sesiones y cifrado', async () => {
  const t = cr.signToken({ s: 'x', v: 1, e: Math.floor(Date.now() / 1000) + 60 });
  assert.strictEqual(cr.verifyToken(t).s, 'x');
  assert.strictEqual(cr.verifyToken(t.slice(0, -2) + 'aa'), null);
  const [body] = t.split('.');
  const otro = Buffer.from(JSON.stringify({ s: 'y', v: 1, e: 9999999999 })).toString('base64url');
  assert.strictEqual(cr.verifyToken(otro + '.' + t.split('.')[1]), null);
  assert.strictEqual(cr.verifyToken(cr.signToken({ s: 'x', v: 1, e: 1 })), null); // vencido
  assert.strictEqual(cr.decrypt(cr.encrypt('secreto')), 'secreto');
  assert.notStrictEqual(cr.encrypt('secreto'), cr.encrypt('secreto'));
  const h = await cr.hashPassword('clave');
  assert.strictEqual(await cr.checkPassword('clave', h), true);
  assert.strictEqual(await cr.checkPassword('otra', h), false);

  const viejo = process.env.APP_SECRET;
  process.env.APP_SECRET = 'corto';
  // sin un secreto válido no se firman sesiones ni se cifran tokens
  assert.throws(() => cr.signToken({ s: 'x', v: 1, e: 9999999999 }), /app_secret_missing/);
  assert.throws(() => cr.encrypt('x'), /app_secret_missing/);
  process.env.APP_SECRET = viejo;
});

test('el menú de ejemplo de la página es el mismo que el del servidor', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const m = html.match(/var DEFAULT_CONFIG=(\{[\s\S]*?\n\});/);
  assert.ok(m, 'no encontré DEFAULT_CONFIG en index.html');
  assert.deepStrictEqual(JSON.parse(m[1]), DEFAULT);
});
