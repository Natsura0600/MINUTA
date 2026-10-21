// Prueba de carga de Minuta: 50 locales con pedidos a la vez, sin tocar ningún servicio real.
// Usa un Redis simulado que cuenta cada comando y le suma una demora parecida a la de Upstash.
// Uso:  node tools/carga.js [pedidosPorLocal=120] [demoraMs=8]
const POR_LOCAL = Number(process.argv[2] || 120), DEMORA = Number(process.argv[3] || 8), LOCALES = 50;

process.env.KV_REST_API_URL = 'https://redis.test'; process.env.KV_REST_API_TOKEN = 'x';
process.env.APP_SECRET = 'una-frase-larga-y-secreta-para-carga'; process.env.SUPERADMIN_PASSWORD = 'super'; process.env.ROOT_DOMAIN = 'pedidos.test';

const db = new Map(), sets = new Map(), lists = new Map();
const cuenta = {}; let total = 0, enSegundo = new Map();
function redis([c, ...a]) {
  cuenta[c] = (cuenta[c] || 0) + 1; total++;
  const s = Math.floor(Date.now() / 1000); enSegundo.set(s, (enSegundo.get(s) || 0) + 1);
  switch (c) {
    case 'GET': return db.has(a[0]) ? db.get(a[0]) : null;
    case 'SET': { if (a.includes('NX') && db.has(a[0])) return null; db.set(a[0], a[1]); return 'OK'; }
    case 'DEL': { let n = 0; a.forEach((k) => { if (db.delete(k)) n++; if (lists.delete(k)) n++; }); return n; }
    case 'INCR': { const n = Number(db.get(a[0]) || 0) + 1; db.set(a[0], String(n)); return n; }
    case 'INCRBY': { const n = Number(db.get(a[0]) || 0) + Number(a[1]); db.set(a[0], String(n)); return n; }
    case 'DECRBY': { const n = Number(db.get(a[0]) || 0) - Number(a[1]); db.set(a[0], String(n)); return n; }
    case 'EXPIRE': return 1;
    case 'SADD': { const s2 = sets.get(a[0]) || new Set(); s2.add(a[1]); sets.set(a[0], s2); return 1; }
    case 'SREM': { const s2 = sets.get(a[0]); if (s2) s2.delete(a[1]); return 1; }
    case 'SCARD': return (sets.get(a[0]) || new Set()).size;
    case 'SMEMBERS': return [...(sets.get(a[0]) || [])];
    case 'LPUSH': { const l = lists.get(a[0]) || []; l.unshift(a[1]); lists.set(a[0], l); return l.length; }
    case 'LTRIM': { const l = lists.get(a[0]); if (l) lists.set(a[0], l.slice(Number(a[1]), Number(a[2]) + 1)); return 'OK'; }
    case 'LRANGE': return (lists.get(a[0]) || []).slice(Number(a[1]), Number(a[2]) + 1);
    case 'MGET': return a.map((k) => (db.has(k) ? db.get(k) : null));
    default: throw new Error('comando no soportado ' + c);
  }
}
global.fetch = async (url, opts = {}) => {
  if (url !== 'https://redis.test') throw new Error('fetch inesperado ' + url);
  await new Promise((r) => setTimeout(r, DEMORA));
  return { ok: true, status: 200, json: async () => ({ result: redis(JSON.parse(opts.body)) }) };
};

const H = { menu: require('../api/menu'), login: require('../api/login'), checkout: require('../api/checkout'), orders: require('../api/orders'), superadmin: require('../api/superadmin') };
const seo = require('../lib/seo');
const { DEFAULT } = require('../lib/config');
let ipN = 0;
function call(name, { method = 'GET', query = {}, body, headers = {}, host }) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, req: { url: '/api/' + name, method, headers: {} }, setHeader(k, v) { this.headers[k] = v; }, end(s) { resolve({ status: this.statusCode, body: s ? JSON.parse(s) : null }); } };
    H[name]({ method, query, body, headers: Object.assign({ host, 'x-forwarded-for': '10.0.' + (Math.floor(++ipN / 250) % 250) + '.' + (ipN % 250) }, headers), socket: {} }, res);
  });
}
const snap = () => total;
async function costo(nombre, fn) { const a = snap(); const t = Date.now(); const r = await fn(); return { nombre, comandos: typeof r === 'number' ? r : snap() - a, ms: Date.now() - t, r }; }
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
async function pool(n, tareas) { let i = 0; const out = []; await Promise.all(Array.from({ length: n }, async () => { while (i < tareas.length) { const k = i++; out[k] = await tareas[k](); } })); return out; }

(async () => {
  console.log(`Prueba de carga · ${LOCALES} locales · ${POR_LOCAL} pedidos por local · demora de Redis simulada: ${DEMORA} ms\n`);
  const SUPER = { 'x-super-password': 'super' };
  const L = [];
  for (let i = 0; i < LOCALES; i++) {
    const slug = 'carga' + i, host = slug + '.pedidos.test';
    const c = await call('superadmin', { method: 'POST', headers: SUPER, host: 'pedidos.test', body: { accion: 'crear', nombre: 'Local ' + i, slug, email: slug + '@mail.com', venceEl: '2099-01-01' } });
    const l = await call('login', { method: 'POST', host, body: { email: slug + '@mail.com', password: c.body.password } });
    const cfg = JSON.parse(JSON.stringify(DEFAULT)); Object.assign(cfg, { nombre: 'Local ' + i, pausado: false, whatsapp: '5491155550000', horario: { dias: [0, 1, 2, 3, 4, 5, 6], desde: 0, hasta: 24 } });
    if (i === 0) cfg.menu.find((p) => p.id === 'cla').stock = 100;
    const g = await call('menu', { method: 'PUT', host, headers: { authorization: 'Bearer ' + l.body.token }, body: cfg });
    if (g.status !== 200) throw new Error('no se pudo preparar ' + slug + ': ' + JSON.stringify(g.body));
    L.push({ slug, host, token: l.body.token });
  }

  const L0 = L[1], nuevoTel = (() => { let n = 0; return () => '11 6' + String(1000000 + n++); })();
  const pedido = (extra) => Object.assign({ items: [{ id: 'agu', qty: 2 }, { id: 'pap', qty: 1 }], modo: 'retiro', cliente: { nombre: 'Cliente', tel: nuevoTel() }, pago: 'efectivo' }, extra);
  const checkout = (l, extra) => call('checkout', { method: 'POST', host: l.host, body: pedido(extra) });
  const bearer = (l) => ({ authorization: 'Bearer ' + l.token });

  // 1) Cuánto cuesta cada acción, en comandos de Redis
  await checkout(L0);
  const acciones = [
    await costo('Ver la tienda (página con menú)', () => seo.pagina({ method: 'GET', query: { pagina: 'tienda' }, headers: { host: L0.host }, socket: {} })),
    await costo('Ver la tienda (API del menú)', () => call('menu', { host: L0.host })),
    await costo('Enviar un pedido', () => checkout(L0)),
    await costo('Panel: consulta sin novedades (cada 10 s)', async () => { const r0 = await call('orders', { host: L0.host, headers: bearer(L0), query: { todo: '1' } }); const a = snap(); const r1 = await call('orders', { host: L0.host, headers: bearer(L0), query: { rev: String(r0.body.rev) } }); if (!r1.body.sinCambios) throw new Error('esperaba sin cambios'); return snap() - a; }),
    await costo('Panel: consulta con pedidos nuevos', () => call('orders', { host: L0.host, headers: bearer(L0), query: { todo: '1' } })),
  ];
  const ped = (await call('orders', { host: L0.host, headers: bearer(L0) })).body.orders[0];
  acciones.push(await costo('Panel: cambiar estado de un pedido', () => call('orders', { method: 'PATCH', host: L0.host, headers: bearer(L0), body: { id: ped.id, estado: 'preparando' } })));
  acciones.push(await costo('Panel: números de la semana (la 1ra vez)', () => call('orders', { host: L0.host, headers: bearer(L0), query: { stats: '7' } })));
  console.log('Comandos de Redis por acción:');
  acciones.forEach((a) => console.log('  ' + a.nombre.padEnd(46) + String(a.comandos).padStart(3) + ' comandos'));
  const cPedido = acciones[2].comandos, cPollSin = acciones[3].comandos, cPollCon = acciones[4].comandos, cTienda = acciones[0].comandos;
  const cPoll = 0.85 * cPollSin + 0.15 * cPollCon; // en la práctica, ~85% de las consultas no traen novedades

  // 2) Pico: todos los locales reciben pedidos a la vez mientras los 50 paneles consultan
  for (const k of Object.keys(cuenta)) delete cuenta[k]; total = 0; enSegundo = new Map();
  let corriendo = true, polls = 0, pollErr = 0;
  const paneles = L.map(async (l) => { let ult = 0; while (corriendo) { const r = await call('orders', { host: l.host, headers: bearer(l), query: { rev: String(ult) } }); polls++; if (r.status !== 200) pollErr++; else ult = r.body.rev; await new Promise((x) => setTimeout(x, 150)); } });
  const lat = [], estados = {};
  const tareas = []; for (let k = 0; k < POR_LOCAL; k++) for (const l of L) tareas.push(async () => { const t = Date.now(); const r = await checkout(l); lat.push(Date.now() - t); const e = r.status === 200 ? 'ok' : (r.body && r.body.error) || r.status; estados[e] = (estados[e] || 0) + 1; });
  const t0 = Date.now(); await pool(200, tareas); const seg = (Date.now() - t0) / 1000; corriendo = false; await Promise.all(paneles);
  const pico = Math.max(...enSegundo.values());
  console.log(`\nPico: ${tareas.length} pedidos en ${seg.toFixed(1)} s con 50 paneles consultando (200 envíos simultáneos)`);
  console.log('  Resultados:', JSON.stringify(estados), '| consultas de panel:', polls, '| con error:', pollErr);
  console.log(`  Tiempo de respuesta del pedido (con ${DEMORA} ms por comando): mediana ${pct(lat, 0.5)} ms · p95 ${pct(lat, 0.95)} ms · máximo ${Math.max(...lat)} ms`);
  console.log(`  Comandos de Redis: ${total} en total · máximo ${pico} por segundo`);
  console.log(`  Ojo: esto es una prueba de estrés (~${Math.round(tareas.length / seg)} pedidos por segundo). Un viernes real de 50 locales con 100 pedidos cada uno en 3 horas son ~${(LOCALES * 100 / 10800).toFixed(1)} pedidos por segundo.`);
  const realista = (LOCALES * 100 / 10800) * cPedido + (LOCALES / 10) * cPollSin + (LOCALES * 2 / 10800) * cTienda * 10;
  console.log(`  Pico realista estimado: ~${Math.ceil(realista)} comandos por segundo (el plan Fixed de Upstash aguanta 10.000 por segundo)`);

  // 3) Coherencia: nada duplicado ni perdido
  let mal = 0;
  for (const l of L) {
    const seq = Number(db.get('t:' + l.slug + ':orders:seq') || 0);
    const ids = lists.get('t:' + l.slug + ':orders:d:' + new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())) || [];
    const unicos = new Set(ids).size;
    const nums = new Set(ids.map((id) => JSON.parse(db.get('t:' + l.slug + ':order:' + id)).numero));
    if (unicos !== ids.length || nums.size !== ids.length || ids.length !== seq) { mal++; console.log('  ¡incoherente!', l.slug, { seq, ids: ids.length, unicos, nums: nums.size }); }
  }
  console.log(`  Coherencia de numeración y registro del día: ${mal ? mal + ' locales con problemas' : 'correcta en los ' + LOCALES + ' locales (sin pedidos perdidos ni números repetidos)'}`);

  // 4) Último plato: 150 clientes piden un plato con 100 unidades
  const l0 = L[0];
  const rs = await pool(150, Array.from({ length: 150 }, () => () => checkout(l0, { items: [{ id: 'cla', qty: 1 }] })));
  const ok = rs.filter((r) => r.status === 200).length, sin = rs.filter((r) => r.body && r.body.error === 'sin_stock').length;
  const quedan = Number(db.get('t:' + l0.slug + ':stk:cla'));
  console.log(`\nStock: 150 pedidos simultáneos de un plato con 100 unidades → ${ok} vendidos, ${sin} rechazados por falta de stock, quedan ${quedan}`);
  const stockOk = ok === 100 && quedan === 0;

  // 5) Proyección mensual de comandos (para dimensionar Upstash)
  const horas = 5, dias = 30;
  const polls10 = LOCALES * 6 * 60 * horas * dias, pedidosMes = LOCALES * 100 * dias, vistasMes = LOCALES * 300 * dias;
  const mes = polls10 * cPoll + pedidosMes * cPedido + vistasMes * cTienda * 0.3;
  console.log(`\nProyección por mes (estimada): ${LOCALES} paneles abiertos ${horas} h por día, ${pedidosMes.toLocaleString('es-AR')} pedidos, ${vistasMes.toLocaleString('es-AR')} visitas a tiendas (30% llegan a Redis; el resto lo atiende la red de Vercel)`);
  console.log(`  Consultas de panel: ${(polls10 * cPoll / 1e6).toFixed(1)} M · Pedidos: ${(pedidosMes * cPedido / 1e6).toFixed(1)} M · Tiendas: ${(vistasMes * cTienda * 0.3 / 1e6).toFixed(1)} M`);
  console.log(`  Total: ~${(mes / 1e6).toFixed(1)} millones de comandos por mes → con pago por comando (US$0,20 cada 100.000): ~US$${(mes / 1e5 * 0.2).toFixed(0)}; con el plan Fixed: costo fijo`);
  const fallo = mal || !stockOk || pollErr || Object.keys(estados).some((e) => e !== 'ok');
  console.log('\n' + (fallo ? 'RESULTADO: hay problemas, revisar arriba.' : 'RESULTADO: sin errores, sin pedidos duplicados ni perdidos, stock exacto.'));
  process.exit(fallo ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
