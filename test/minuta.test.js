// Pruebas de las funciones nuevas de Minuta (fotos, retiro con hora, mínimo, pagos, trámites).
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
  superadmin: require('../api/superadmin'), plan: require('../api/plan'), suscribir: require('../api/suscribir'),
  foto: require('../api/foto'), tramite: require('../api/tramite')
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
      end(s) { const bin = Buffer.isBuffer(s); resolve({ status: this.statusCode, body: s && !bin ? JSON.parse(s) : null, raw: bin ? s : null, headers: this.headers }); }
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


// Hora argentina dentro de "min" minutos, como "HH:MM".
function horaAR(min) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(Date.now() + min * 60000));
}

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('fotos de productos y banner: solo el dueño sube, cualquiera ve, y se borran al sacar el plato', async () => {
  const a = await nuevoLocal('fotos');
  const b = await nuevoLocal('otras-fotos');
  const put = (body, h, token) => call('foto', { method: 'PUT', host: h || a.h, headers: token === null ? {} : bearer(token || a.token), body });
  assert.strictEqual((await put({ id: 'cla', data: PNG }, a.h, null)).status, 401);
  assert.strictEqual((await put({ id: 'cla', data: PNG }, a.h, b.token)).status, 401);
  assert.strictEqual((await put({ id: 'cla', data: 'data:image/svg+xml;base64,PHN2Zz4=' })).status, 400);
  assert.strictEqual((await put({ id: 'cla', data: 'data:image/png;base64,' + 'A'.repeat(170000) })).status, 400);
  assert.strictEqual((await put({ id: '../x', data: PNG })).status, 400);
  const up = await put({ id: 'cla', data: PNG });
  assert.strictEqual(up.status, 200, JSON.stringify(up.body));
  assert.match(up.body.v, /^[a-f0-9]{10}$/);
  const ban = await put({ id: 'banner', data: PNG });
  assert.strictEqual(ban.status, 200);

  const g = await call('foto', { host: a.h, query: { id: 'cla', v: up.body.v } });
  assert.strictEqual(g.status, 200);
  assert.strictEqual(g.headers['Content-Type'], 'image/png');
  assert.match(g.headers['Cache-Control'], /immutable/);
  assert.ok(Buffer.isBuffer(g.raw) && g.raw.length > 10);
  assert.strictEqual((await call('foto', { host: b.h, query: { id: 'cla' } })).status, 404); // cada local tiene las suyas

  const cfg = abierto({ estilo: 'banner', banner: ban.body.v });
  cfg.menu[0].foto = up.body.v;
  assert.strictEqual((await call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: cfg })).status, 200);
  const pub = (await call('menu', { host: a.h })).body.config;
  assert.strictEqual(pub.menu[0].foto, up.body.v);
  assert.strictEqual(pub.banner, ban.body.v);
  assert.strictEqual(pub.estilo, 'banner');

  const mala = abierto(); mala.menu[0].foto = 'https://otro.sitio/x.png';
  assert.strictEqual((await call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: mala })).status, 400);

  // saco el plato y el banner: las imágenes se borran
  const sin = abierto(); sin.menu = sin.menu.filter((p) => p.id !== 'cla');
  assert.strictEqual((await call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: sin })).status, 200);
  assert.ok(!db.has('t:fotos:img:cla'));
  assert.ok(!db.has('t:fotos:img:banner'));
});

test('el local elige tipografía, dirección, etiquetas, aviso y formas de entrega', async () => {
  const a = await nuevoLocal('estilos');
  const put = (cfg) => call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: cfg });
  const cfg = abierto({ fuente: 'pizzeria', direccion: 'Av. San Martín 1234, Luján', instagram: '@el.bodegon', anuncio: 'Hoy 2x1 en milas', minimo: 5000, demora: { retiro: 20, delivery: 40 } });
  cfg.menu[0].tags = ['sintacc', 'inventada', 'veggie', 'sintacc'];
  cfg.menu[0].destacado = true;
  assert.strictEqual((await put(cfg)).status, 200);
  const c = (await call('menu', { host: a.h })).body.config;
  assert.strictEqual(c.fuente, 'pizzeria');
  assert.strictEqual(c.direccion, 'Av. San Martín 1234, Luján');
  assert.strictEqual(c.instagram, 'el.bodegon');
  assert.strictEqual(c.anuncio, 'Hoy 2x1 en milas');
  assert.deepStrictEqual(c.menu[0].tags, ['sintacc', 'veggie']);
  assert.strictEqual(c.menu[0].destacado, true);
  assert.deepStrictEqual(c.demora, { retiro: 20, delivery: 40 });
  assert.strictEqual((await put(abierto({ fuente: 'comic-sans' }))).status, 200); // fuente desconocida: vuelve a la de bodegón
  assert.strictEqual((await call('menu', { host: a.h })).body.config.fuente, 'bodegon');
  assert.strictEqual((await put(abierto({ modos: { retiro: false, delivery: false } }))).status, 400);
  assert.strictEqual((await put(abierto({ demora: { retiro: 999 } }))).status, 400);
});

test('retiro con hora (take away unificado), formas de entrega apagadas y pedido mínimo', async () => {
  const a = await nuevoLocal('retirohora');
  const co = (b) => call('checkout', { method: 'POST', host: a.h, body: pedido(Object.assign({ pago: 'efectivo' }, b)) });
  const enUnaHora = horaAR(60);
  const r = await co({ modo: 'retiro', hora: enUnaHora });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const o = JSON.parse(db.get('t:retirohora:order:' + r.body.id));
  assert.deepStrictEqual(o.entrega, { modo: 'retiro', zona: '', dir: '', hora: enUnaHora });
  assert.strictEqual(o.envio, 0);
  assert.strictEqual(o.historial[0].e, 'nuevo');
  assert.strictEqual((await co({ modo: 'retiro', hora: '' })).status, 200); // lo antes posible
  assert.strictEqual((await co({ modo: 'retiro', hora: '25:00' })).status, 400);
  // Una tienda vieja que todavía manda "takeaway" queda como retiro con hora.
  const viejo = await co({ modo: 'takeaway', hora: horaAR(30) });
  assert.strictEqual(viejo.status, 200);
  assert.strictEqual(JSON.parse(db.get('t:retirohora:order:' + viejo.body.id)).entrega.modo, 'retiro');
  const pub = (await call('order', { host: a.h, query: { id: r.body.id } })).body;
  assert.strictEqual(pub.modo, 'retiro');
  assert.strictEqual(pub.hora, enUnaHora);
  // El servidor no acepta una hora que ya pasó.
  const pasada = await co({ modo: 'retiro', hora: horaAR(-60) });
  assert.strictEqual(pasada.status, 400);
  assert.match(pasada.body.mensaje, /ya pasó/);
  // "en camino" sigue siendo solo para delivery
  assert.strictEqual((await call('orders', { method: 'PATCH', host: a.h, headers: bearer(a.token), body: { id: r.body.id, estado: 'en_camino' } })).status, 400);

  // Si el local no deja elegir hora, la hora se ignora.
  await call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: abierto({ elegirHora: false }) });
  const sinHora = await co({ modo: 'retiro', hora: horaAR(-60) }); // ni siquiera se valida: se ignora
  assert.strictEqual(JSON.parse(db.get('t:retirohora:order:' + sinHora.body.id)).entrega.hora, '');

  await call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: abierto({ modos: { retiro: true, delivery: false } }) });
  assert.strictEqual((await co({ modo: 'delivery' })).status, 400);
  assert.strictEqual((await co({ modo: 'retiro' })).status, 200);
  assert.deepStrictEqual((await call('menu', { host: a.h })).body.config.modos, { retiro: true, delivery: false });

  await call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: abierto({ minimo: 50000 }) });
  const chico = await co({ modo: 'retiro', items: [{ id: 'agu', qty: 1 }] });
  assert.strictEqual(chico.status, 400);
  assert.match(chico.body.mensaje, /mínimo/);
});

test('la hora de retiro tiene que caer dentro del horario del local', async () => {
  const a = await nuevoLocal('horario');
  const h = nowAR().h;
  const desde = Math.floor(h), hasta = Math.min(24, desde + 1);
  // Abierto solo esta hora: dentro de 2 horas y media ya está cerrado.
  await call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: abierto({ horario: { dias: [0, 1, 2, 3, 4, 5, 6], desde, hasta } }) });
  const co = (hora) => call('checkout', { method: 'POST', host: a.h, body: pedido({ pago: 'efectivo', modo: 'retiro', hora }) });
  const fuera = await co(horaAR(150));
  assert.strictEqual(fuera.status, 400);
  assert.match(fuera.body.mensaje, /cerrado/);
  assert.strictEqual((await co(horaAR(0))).status, 200); // ahora mismo sí
});

test('dos dispositivos: el que guarda sobre una versión vieja recibe aviso en vez de pisar', async () => {
  const a = await nuevoLocal('versiones');
  const put = (cfg) => call('menu', { method: 'PUT', host: a.h, headers: bearer(a.token), body: cfg });
  const base = (await call('menu', { host: a.h })).body.config;
  const compu = abierto({ rev: base.rev, nombre: 'Desde la compu' });
  const tablet = abierto({ rev: base.rev, anuncio: 'Desde la tablet' });
  const r1 = await put(compu);
  assert.strictEqual(r1.status, 200);
  assert.strictEqual(r1.body.config.rev, base.rev + 1);
  const r2 = await put(tablet);
  assert.strictEqual(r2.status, 409);
  assert.strictEqual(r2.body.error, 'conflicto');
  assert.strictEqual(r2.body.config.nombre, 'Desde la compu'); // le devuelve lo último para que decida
  // El panel ve que cambió la versión sin bajar el menú.
  assert.strictEqual((await call('orders', { host: a.h, headers: bearer(a.token) })).body.cfgRev, base.rev + 1);
  // Con la versión nueva, guarda bien.
  assert.strictEqual((await put(Object.assign(tablet, { rev: base.rev + 1 }))).body.config.rev, base.rev + 2);
  // Un panel viejo que no manda versión sigue funcionando.
  assert.strictEqual((await put(abierto())).status, 200);
});

test('logo viejo embebido se pasa solo al sistema de fotos', async () => {
  const a = await nuevoLocal('logoviejo');
  const cfg = JSON.parse(db.get('t:logoviejo:cfg'));
  cfg.logo = PNG;
  db.set('t:logoviejo:cfg', JSON.stringify(cfg));
  const c = (await call('menu', { host: a.h })).body.config;
  assert.match(c.logo, /^[a-f0-9]{10}$/);
  assert.strictEqual(JSON.parse(db.get('t:logoviejo:img:logo')).data, PNG);
  assert.strictEqual(JSON.parse(db.get('t:logoviejo:cfg')).logo, c.logo); // quedó migrado
});

test('pedidos del día completos aunque pasen de 300, y consulta liviana con los activos', async () => {
  const a = await nuevoLocal('viernes');
  const ids = [];
  for (let i = 0; i < 310; i++) ids.push((await call('checkout', { method: 'POST', host: a.h, body: pedido({ pago: 'efectivo', modo: 'retiro' }) })).body.id);
  const todo = (await call('orders', { host: a.h, headers: bearer(a.token), query: { todo: '1' } })).body.orders;
  assert.strictEqual(todo.length, 310);
  assert.strictEqual(todo[0].numero, 310); // los más nuevos primero
  // Sin cambios desde la última consulta: no viaja ningún pedido.
  const r0 = (await call('orders', { host: a.h, headers: bearer(a.token) })).body;
  const quieta = (await call('orders', { host: a.h, headers: bearer(a.token), query: { rev: String(r0.rev) } })).body;
  assert.strictEqual(quieta.sinCambios, true);
  assert.strictEqual(quieta.orders.length, 0);
  await call('checkout', { method: 'POST', host: a.h, body: pedido({ pago: 'efectivo', modo: 'retiro' }) });
  const conNuevo = (await call('orders', { host: a.h, headers: bearer(a.token), query: { rev: String(r0.rev) } })).body;
  assert.ok(!conNuevo.sinCambios);
  assert.strictEqual(conNuevo.orders[0].numero, 311);
  assert.ok(conNuevo.rev > r0.rev);
  // El primero de la noche ya no está entre los últimos 40, pero sigue en curso: la consulta liviana lo trae.
  const liviana = (await call('orders', { host: a.h, headers: bearer(a.token) })).body.orders;
  assert.ok(liviana.some((o) => o.id === ids[0]));
  // Cuando termina hace rato, deja de viajar en cada consulta.
  const patch = (b) => call('orders', { method: 'PATCH', host: a.h, headers: bearer(a.token), body: b });
  await patch({ id: ids[0], estado: 'entregado' });
  assert.ok((await call('orders', { host: a.h, headers: bearer(a.token) })).body.orders.some((o) => o.id === ids[0])); // recién terminado: sí
  const k = 't:viernes:order:' + ids[0], o = JSON.parse(db.get(k));
  o.historial[o.historial.length - 1].t = new Date(Date.now() - 3600000).toISOString();
  db.set(k, JSON.stringify(o));
  await call('orders', { host: a.h, headers: bearer(a.token) });
  assert.ok(!sets.get('t:viernes:orders:activos').has(ids[0]));
  // Si se reabre, vuelve a la lista de activos.
  await patch({ id: ids[0], estado: 'preparando' });
  assert.ok(sets.get('t:viernes:orders:activos').has(ids[0]));
});

test('panel: historial de estados, rechazo con motivo y nota interna', async () => {
  const a = await nuevoLocal('historial');
  const r = await call('checkout', { method: 'POST', host: a.h, body: pedido({ pago: 'efectivo', modo: 'retiro' }) });
  const patch = (b) => call('orders', { method: 'PATCH', host: a.h, headers: bearer(a.token), body: Object.assign({ id: r.body.id }, b) });
  assert.strictEqual((await patch({ estado: 'preparando' })).status, 200);
  await patch({ estado: 'preparando' }); // repetir el mismo estado no suma historial
  const o1 = (await patch({ notaLocal: '  lo retira   el hermano ' })).body.order;
  assert.deepStrictEqual(o1.historial.map((h) => h.e), ['nuevo', 'preparando']);
  assert.strictEqual(o1.notaLocal, 'lo retira el hermano');
  const o2 = (await patch({ estado: 'cancelado', motivo: 'Nos quedamos sin milanesas' })).body.order;
  assert.strictEqual(o2.motivo, 'Nos quedamos sin milanesas');
  const pub = (await call('order', { host: a.h, query: { id: r.body.id } })).body;
  assert.strictEqual(pub.motivo, 'Nos quedamos sin milanesas');
  assert.strictEqual(pub.notaLocal, undefined); // la nota interna no sale al cliente
  // Si lo vuelven a aceptar, el motivo se borra.
  const o3 = (await patch({ estado: 'preparando' })).body.order;
  assert.strictEqual(o3.motivo, undefined);
  assert.deepStrictEqual(o3.historial.map((h) => h.e), ['nuevo', 'preparando', 'cancelado', 'preparando']);
});

test('pedidos viejos con take away se leen como retiro', async () => {
  const a = await nuevoLocal('legado');
  const r = await call('checkout', { method: 'POST', host: a.h, body: pedido({ pago: 'efectivo', modo: 'retiro', hora: '' }) });
  const k = 't:legado:order:' + r.body.id;
  const o = JSON.parse(db.get(k));
  o.entrega.modo = 'takeaway'; o.entrega.hora = '20:15'; delete o.historial;
  db.set(k, JSON.stringify(o));
  const list = (await call('orders', { host: a.h, headers: bearer(a.token) })).body.orders;
  assert.strictEqual(list[0].entrega.modo, 'retiro');
  assert.strictEqual(list[0].entrega.hora, '20:15');
  assert.strictEqual(list[0].historial[0].e, 'nuevo');
});

test('un local guardado antes de Minuta sigue funcionando con los campos nuevos', async () => {
  const a = await nuevoLocal('viejo');
  const viejo = JSON.parse(db.get('t:viejo:cfg'));
  delete viejo.modos; delete viejo.demora; delete viejo.fuente;
  viejo.menu.forEach((p) => { delete p.foto; delete p.tags; delete p.destacado; });
  db.set('t:viejo:cfg', JSON.stringify(viejo));
  const c = (await call('menu', { host: a.h })).body.config;
  assert.deepStrictEqual(c.modos, { retiro: true, delivery: true });
  assert.strictEqual(c.elegirHora, true);
  assert.deepStrictEqual(c.menu[0].tags, []);
  assert.strictEqual(c.menu[0].foto, '');
  assert.strictEqual((await call('checkout', { method: 'POST', host: a.h, body: pedido({ pago: 'efectivo', modo: 'takeaway' }) })).status, 200);
  // Un local que solo tenía take away (retiro apagado) queda con retiro prendido y con hora.
  const v2 = JSON.parse(db.get('t:viejo:cfg'));
  v2.modos = { retiro: false, takeaway: true, delivery: false }; delete v2.elegirHora;
  db.set('t:viejo:cfg', JSON.stringify(v2));
  const c2 = (await call('menu', { host: a.h })).body.config;
  assert.deepStrictEqual(c2.modos, { retiro: true, delivery: false });
  assert.strictEqual(c2.elegirHora, true);
  // Y uno que tenía take away apagado no ofrece elegir hora.
  v2.modos = { retiro: true, takeaway: false, delivery: true };
  db.set('t:viejo:cfg', JSON.stringify(v2));
  assert.strictEqual((await call('menu', { host: a.h })).body.config.elegirHora, false);
});

test('superadmin: pagos con monto e historial, WhatsApp y cuota del local, pedidos contados', async () => {
  const a = await nuevoLocal('cobros');
  await call('checkout', { method: 'POST', host: a.h, body: pedido({ pago: 'efectivo', modo: 'retiro' }) });
  let r = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'editar', slug: 'cobros', whatsapp: '11 5249-5689', cuota: 25000, contacto: 'Luis' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.local.whatsapp, '1152495689');
  assert.strictEqual(r.body.local.cuota, 25000);
  assert.strictEqual((await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'editar', slug: 'cobros', cuota: -1 } })).status, 400);
  assert.strictEqual((await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'editar', slug: 'cobros', email: 'no-es-email' } })).status, 400);
  r = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'pago', slug: 'cobros', meses: 3 } });
  assert.strictEqual(r.body.local.pagos[0].meses, 3);
  assert.strictEqual(r.body.local.pagos[0].monto, 75000); // cuota × meses si no se indica el monto
  r = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'pago', slug: 'cobros', meses: 1, monto: 20000 } });
  assert.strictEqual(r.body.local.pagos[0].monto, 20000);
  assert.strictEqual(r.body.local.pagos.length, 2);
  const lista = (await call('superadmin', { headers: SUPER })).body;
  assert.strictEqual(lista.locales.find((l) => l.slug === 'cobros').pedidos, 1);
  assert.match(lista.hoy, /^\d{4}-\d{2}-\d{2}$/);
});

test('imágenes de tu página de inicio: solo vos las subís', async () => {
  const sin = await call('foto', { method: 'PUT', query: { site: '1' }, body: { id: 'hero', data: PNG } });
  assert.strictEqual(sin.status, 401);
  const up = await call('foto', { method: 'PUT', query: { site: '1' }, headers: SUPER, body: { id: 'hero', data: PNG } });
  assert.strictEqual(up.status, 200);
  const g = await call('foto', { query: { site: '1', id: 'hero', v: up.body.v } });
  assert.strictEqual(g.status, 200);
  const ok = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'plan', plan: { hero: up.body.v, galeria: [{ id: 'gabc', v: up.body.v, titulo: 'Bodegón Don Luis' }, { id: 'mal id', v: 'x' }], legal: { titular: 'Picture Web Dev', cuit: '20-12345678-9' } } } });
  assert.strictEqual(ok.status, 200);
  const p = (await call('plan')).body.plan;
  assert.strictEqual(p.hero, up.body.v);
  assert.deepStrictEqual(p.galeria, [{ id: 'gabc', v: up.body.v, titulo: 'Bodegón Don Luis' }]);
  assert.strictEqual(p.legal.cuit, '20-12345678-9');
  assert.strictEqual(p.whatsapp, '5491152495689'); // tu número por defecto
  assert.strictEqual((await call('foto', { method: 'DELETE', query: { site: '1', id: 'hero' }, headers: SUPER })).status, 200);
  assert.strictEqual((await call('foto', { query: { site: '1', id: 'hero' } })).status, 404);
});

test('botón de arrepentimiento y de baja: código al instante, y lo resolvés desde tu panel', async () => {
  assert.strictEqual((await call('tramite')).status, 405);
  assert.strictEqual((await call('tramite', { method: 'POST', body: { tipo: 'otro', nombre: 'Ana', email: 'a@b.com' } })).status, 400);
  assert.strictEqual((await call('tramite', { method: 'POST', body: { tipo: 'baja', nombre: 'Ana', email: 'no' } })).status, 400);
  const r = await call('tramite', { method: 'POST', body: { tipo: 'baja', nombre: 'Ana', email: 'ana@mail.com', local: 'Bodegón Ana' } });
  assert.strictEqual(r.status, 200);
  assert.match(r.body.codigo, /^MN-[A-F0-9]{6}$/);
  const t = (await call('superadmin', { headers: SUPER })).body.tramites;
  assert.strictEqual(t.length, 1);
  assert.strictEqual(t[0].estado, 'pendiente');
  const res = await call('superadmin', { method: 'POST', headers: SUPER, body: { accion: 'tramite', id: t[0].id, estado: 'resuelto' } });
  assert.strictEqual(res.body.tramite.estado, 'resuelto');
});
