// Datos de la página pública: el plan que ofrecés y las solicitudes de los locales.
const crypto = require('crypto');
const redis = require('./redis');
const { Reject } = require('./http');

const PLAN_DEFAULT = {
  marca: 'Picture Web Dev',
  titulo: 'Tu hamburguesería con pedidos online propios',
  precio: '',          // ej. "$25.000" (vacío = "Consultá el precio")
  periodo: 'por mes',
  alta: '',            // ej. "Alta sin cargo" o "Alta $50.000 (pago único)"
  whatsapp: '',        // tu WhatsApp, con código de país
  instagram: '',       // usuario sin @
  incluye: [
    'Tienda online con tu logo y los colores de tu marca',
    'Dirección propia para tu local (tulocal.tudominio.com)',
    'Pedidos al instante en tu panel, con aviso sonoro',
    'Menú, precios, extras y horarios que cambiás vos cuando quieras',
    'Delivery con costo por barrio y retiro en el local',
    'Alias de transferencia por WhatsApp con un toque',
    'Tus clientes ven cómo avanza el pedido: preparando, listo, en camino',
    'Un usuario y contraseña para tu local'
  ]
};

const clean = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

async function getPlan() {
  const raw = await redis.cmd('GET', 'site:plan');
  let p = {};
  try { p = raw ? JSON.parse(raw) : {}; } catch (e) { p = {}; }
  return Object.assign({}, PLAN_DEFAULT, p);
}

function sanitizePlan(inp) {
  inp = inp || {};
  const incluye = (Array.isArray(inp.incluye) ? inp.incluye : String(inp.incluye || '').split('\n'))
    .map((x) => clean(String(x), 120)).filter(Boolean).slice(0, 14);
  const whatsapp = String(inp.whatsapp || '').replace(/\D/g, '');
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) throw new Reject('Tu WhatsApp: escribilo con código de país, por ejemplo 5491155550000.', 400);
  return {
    marca: clean(inp.marca, 40) || PLAN_DEFAULT.marca,
    titulo: clean(inp.titulo, 90) || PLAN_DEFAULT.titulo,
    precio: clean(inp.precio, 30),
    periodo: clean(inp.periodo, 20) || PLAN_DEFAULT.periodo,
    alta: clean(inp.alta, 80),
    whatsapp,
    instagram: clean(inp.instagram, 40).replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, ''),
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
    zona: clean(inp.zona, 60), mensaje: clean(inp.mensaje, 300),
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

module.exports = { PLAN_DEFAULT, getPlan, sanitizePlan, savePlan, createLead, listLeads, getLead, saveLead, deleteLead };
