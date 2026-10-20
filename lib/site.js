// Datos de la página pública: el plan que ofrecés y las solicitudes de los locales.
const crypto = require('crypto');
const redis = require('./redis');
const { Reject } = require('./http');

const MI_WHATSAPP = '5491152495689'; // +54 11 5249-5689

const PLAN_DEFAULT = {
  marca: 'Minuta',
  titulo: 'Tu menú online, tus pedidos, sin comisiones',
  bajada: 'Tus clientes piden desde el celular, vos recibís la comanda al instante y el local se queda con todo.',
  precio: '',          // ej. "$25.000" (vacío = "Consultá el precio")
  periodo: 'por mes',
  alta: '',            // ej. "Alta sin cargo" o "Alta $50.000 (pago único)"
  whatsapp: MI_WHATSAPP,
  instagram: '',       // usuario sin @
  email: '',
  hero: '',            // versión de la imagen principal (site:img:hero)
  galeria: [],         // [{ id, v, titulo }]
  legal: { titular: '', cuit: '', domicilio: '', email: '' },
  incluye: [
    'Menú online con tu logo, tu color o tu banner, y la tipografía que va con tu local',
    'Fotos de cada plato, etiquetas sin TACC y veggie, y platos destacados',
    'Dirección propia para tu local (tulocal.minuta.com.ar)',
    'Comandas al instante en tu panel, con aviso sonoro y ticket para imprimir',
    'Retiro en el local (con hora elegida por el cliente) y delivery con costo por barrio',
    'Alias de transferencia por WhatsApp con un toque',
    'Tus clientes ven cómo avanza el pedido: en preparación, listo, en camino',
    'Ventas del día y productos más pedidos, a la vista',
    'Sin comisión por pedido'
  ]
};

const clean = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const VER = /^[a-f0-9]{10}$/;
const GID = /^g[a-z0-9]{1,20}$/;

async function getPlan() {
  const raw = await redis.cmd('GET', 'site:plan');
  let p = {};
  try { p = raw ? JSON.parse(raw) : {}; } catch (e) { p = {}; }
  const out = Object.assign({}, PLAN_DEFAULT, p);
  out.legal = Object.assign({}, PLAN_DEFAULT.legal, p.legal);
  if (!out.whatsapp) out.whatsapp = MI_WHATSAPP;
  return out;
}

function sanitizePlan(inp) {
  inp = inp || {};
  const incluye = (Array.isArray(inp.incluye) ? inp.incluye : String(inp.incluye || '').split('\n'))
    .map((x) => clean(String(x), 120)).filter(Boolean).slice(0, 14);
  const whatsapp = String(inp.whatsapp || '').replace(/\D/g, '');
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) throw new Reject('Tu WhatsApp: escribilo con código de país, por ejemplo 5491155550000.', 400);
  const email = clean(inp.email, 120).toLowerCase();
  if (email && !EMAIL.test(email)) throw new Reject('Tu email de contacto no es válido.', 400);
  const hero = typeof inp.hero === 'string' && VER.test(inp.hero) ? inp.hero : '';
  const galeria = (Array.isArray(inp.galeria) ? inp.galeria : []).slice(0, 8)
    .filter((g) => g && GID.test(String(g.id)) && VER.test(String(g.v)))
    .map((g) => ({ id: String(g.id), v: String(g.v), titulo: clean(g.titulo, 60) }));
  const l = inp.legal || {};
  const cuit = String(l.cuit || '').replace(/[^\d-]/g, '').slice(0, 13);
  return {
    marca: clean(inp.marca, 40) || PLAN_DEFAULT.marca,
    titulo: clean(inp.titulo, 90) || PLAN_DEFAULT.titulo,
    bajada: clean(inp.bajada, 200) || PLAN_DEFAULT.bajada,
    precio: clean(inp.precio, 30),
    periodo: clean(inp.periodo, 20) || PLAN_DEFAULT.periodo,
    alta: clean(inp.alta, 80),
    whatsapp: whatsapp || MI_WHATSAPP,
    instagram: clean(inp.instagram, 40).replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, ''),
    email, hero, galeria,
    legal: { titular: clean(l.titular, 80), cuit, domicilio: clean(l.domicilio, 120), email: clean(l.email, 120).toLowerCase() },
    incluye: incluye.length ? incluye : PLAN_DEFAULT.incluye
  };
}

async function savePlan(p) {
  await redis.cmd('SET', 'site:plan', JSON.stringify(p));
}

// ---- Solicitudes ----
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,200}\.[^\s@]{2,}$/;
const lkey = (id) => 'lead:' + id;

async function createLead(inp) {
  const nombre = clean(inp.nombre, 40);
  const email = clean(inp.email, 120).toLowerCase();
  const whatsapp = String(inp.whatsapp || '').replace(/\D/g, '');
  if (nombre.length < 2) throw new Reject('Escribí el nombre de tu local.', 400);
  if (!EMAIL.test(email)) throw new Reject('Escribí un email válido: ahí te mandamos tus datos.', 400);
  if (whatsapp.length < 10 || whatsapp.length > 15) throw new Reject('Escribí tu WhatsApp con código de área, por ejemplo 1155551234.', 400);
  const total = Number(await redis.cmd('SCARD', 'leads')) || 0;
  if (total >= 500) throw new Reject('Ahora no podemos recibir más solicitudes. Escribinos por WhatsApp.', 429, 'lleno');
  const lead = {
    id: crypto.randomBytes(8).toString('hex'),
    nombre, email, whatsapp,
    zona: clean(inp.zona, 60), rubro: clean(inp.rubro, 40), mensaje: clean(inp.mensaje, 300),
    creado: new Date().toISOString(), estado: 'nueva'
  };
  await redis.cmd('SET', lkey(lead.id), JSON.stringify(lead));
  await redis.cmd('SADD', 'leads', lead.id);
  return lead;
}

async function listLeads() {
  const ids = await redis.cmd('SMEMBERS', 'leads');
  if (!ids || !ids.length) return [];
  const rows = await redis.cmd('MGET', ...ids.map(lkey));
  return rows.filter(Boolean).map((r) => JSON.parse(r)).sort((a, b) => b.creado.localeCompare(a.creado));
}

async function getLead(id) {
  if (!/^[a-f0-9]{16}$/.test(String(id))) return null;
  const raw = await redis.cmd('GET', lkey(id));
  return raw ? JSON.parse(raw) : null;
}

async function saveLead(l) {
  await redis.cmd('SET', lkey(l.id), JSON.stringify(l));
}

async function deleteLead(id) {
  await redis.cmd('DEL', lkey(id));
  await redis.cmd('SREM', 'leads', id);
}

// ---- Botón de arrepentimiento / botón de baja (Ley 24.240 y Disp. 954/2025) ----
// Queda registrado con un código que se le muestra al instante a quien lo pide.
const TIPOS = ['arrepentimiento', 'baja'];
async function createTramite(inp) {
  const tipo = TIPOS.includes(inp.tipo) ? inp.tipo : '';
  if (!tipo) throw new Reject('Elegí qué querés hacer.', 400);
  const nombre = clean(inp.nombre, 60);
  const email = clean(inp.email, 120).toLowerCase();
  if (nombre.length < 2) throw new Reject('Escribí tu nombre o el de tu local.', 400);
  if (!EMAIL.test(email)) throw new Reject('Escribí un email válido: ahí te confirmamos el trámite.', 400);
  const total = Number(await redis.cmd('SCARD', 'tramites')) || 0;
  if (total >= 2000) throw new Reject('Ahora no podemos registrar el trámite por acá. Escribinos por WhatsApp.', 429, 'lleno');
  const id = crypto.randomBytes(8).toString('hex');
  const codigo = 'MN-' + id.slice(0, 6).toUpperCase();
  const t = {
    id, codigo, tipo, nombre, email,
    whatsapp: String(inp.whatsapp || '').replace(/\D/g, '').slice(0, 15),
    local: clean(inp.local, 60), detalle: clean(inp.detalle, 400),
    creado: new Date().toISOString(), estado: 'pendiente'
  };
  await redis.cmd('SET', 'tramite:' + id, JSON.stringify(t));
  await redis.cmd('SADD', 'tramites', id);
  return t;
}
async function listTramites() {
  const ids = await redis.cmd('SMEMBERS', 'tramites');
  if (!ids || !ids.length) return [];
  const rows = await redis.cmd('MGET', ...ids.map((i) => 'tramite:' + i));
  return rows.filter(Boolean).map((r) => JSON.parse(r)).sort((a, b) => b.creado.localeCompare(a.creado));
}
async function setTramite(id, estado) {
  if (!/^[a-f0-9]{16}$/.test(String(id))) throw new Reject('Trámite inválido.', 400);
  const raw = await redis.cmd('GET', 'tramite:' + id);
  if (!raw) throw new Reject('No encontramos ese trámite.', 404);
  const t = JSON.parse(raw);
  t.estado = estado === 'resuelto' ? 'resuelto' : 'pendiente';
  await redis.cmd('SET', 'tramite:' + id, JSON.stringify(t));
  return t;
}

module.exports = { MI_WHATSAPP, createTramite, listTramites, setTramite, PLAN_DEFAULT, getPlan, sanitizePlan, savePlan, createLead, listLeads, getLead, saveLead, deleteLead };
