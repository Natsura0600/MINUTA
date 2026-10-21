// Locales: alta, estado de la mensualidad y sesión del dueño.
const redis = require('./redis');
const img = require('./imagenes');
const cr = require('./crypto');
const { nuevoConfig, TZ, imgKey, imagenesDe } = require('./config');
const { Reject, slugFromReq } = require('./http');

const SLUG = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const RESERVED = ['www', 'admin', 'app', 'api', 'superadmin', 'panel', 'mail', 'ftp', 'static', 'assets', 'cdn', 'root', 'test', 'demo', 'soporte', 'ayuda', 'inicio', 'terminos', 'privacidad', 'arrepentimiento', 'minuta', 'brand'];
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,200}\.[^\s@]{2,}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const SESION_DIAS = 7;

const mkey = (slug) => redis.tk(slug, 'meta');

async function getTenant(slug) {
  if (!slug || !SLUG.test(slug) || RESERVED.includes(slug)) return null;
  const raw = await redis.cmd('GET', mkey(slug));
  return raw ? JSON.parse(raw) : null;
}

async function saveTenant(m) {
  await redis.cmd('SET', mkey(m.slug), JSON.stringify(m));
}

// Resuelve el local de un pedido HTTP o responde 404.
async function requireTenant(req) {
  if (!redis.enabled()) {
    const e = new Error('storage_not_configured');
    e.code = 'storage_not_configured';
    throw e;
  }
  const t = await getTenant(slugFromReq(req));
  if (!t) throw new Reject('No encontramos este local.', 404, 'local_no_encontrado');
  return t;
}

// ---- Mensualidad ----
const hoyAR = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d || new Date());

// "activo": toma pedidos. "suspendido": lo apagaste vos. "vencido": pasó la fecha de la mensualidad.
function estado(m, d) {
  if (!m.activo) return 'suspendido';
  if (m.venceEl && hoyAR(d) > m.venceEl) return 'vencido';
  return 'activo';
}

function addMonths(fecha, n) {
  const [y, mo, d] = fecha.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + n, 1));
  const ultimo = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, ultimo));
  return t.toISOString().slice(0, 10);
}

function validarFecha(v) {
  if (v === null || v === '' || v === undefined) return null;
  if (!FECHA.test(String(v)) || Number.isNaN(Date.parse(v + 'T12:00:00Z'))) throw new Reject('La fecha de vencimiento no es válida.', 400);
  return String(v);
}

// Suma meses a partir de la fecha de vencimiento, o de hoy si ya venció o no tenía.
function registrarPago(m, meses, monto) {
  const hoy = hoyAR();
  const base = m.venceEl && m.venceEl > hoy ? m.venceEl : hoy;
  m.venceEl = addMonths(base, meses);
  m.pagos = [{ fecha: hoy, meses, monto: Number.isInteger(monto) && monto > 0 ? monto : 0, hasta: m.venceEl }].concat(m.pagos || []).slice(0, 36);
  return m;
}

const soloDigitos = (v) => String(v || '').replace(/\D/g, '').slice(0, 15);

// ---- Alta y baja ----
async function createTenant(inp) {
  const nombre = String(inp.nombre || '').trim().replace(/\s+/g, ' ');
  const slug = String(inp.slug || '').trim().toLowerCase();
  const email = String(inp.email || '').trim().toLowerCase();
  if (nombre.length < 2 || nombre.length > 40) throw new Reject('El nombre del local tiene que tener entre 2 y 40 caracteres.', 400);
  if (!SLUG.test(slug)) throw new Reject('La dirección admite letras minúsculas, números y guiones (de 3 a 30 caracteres), sin empezar ni terminar con guion.', 400);
  if (RESERVED.includes(slug)) throw new Reject('Esa dirección está reservada. Elegí otra.', 400);
  if (!EMAIL.test(email)) throw new Reject('El email no es válido.', 400);

  const password = cr.randomPassword();
  const meta = {
    slug, nombre, email,
    pass: await cr.hashPassword(password), pv: 1,
    activo: true,
    venceEl: validarFecha(inp.venceEl),
    creado: new Date().toISOString(), notas: '',
    whatsapp: soloDigitos(inp.whatsapp), contacto: String(inp.contacto || '').trim().slice(0, 60),
    cuota: 0, pagos: []
  };
  const ok = await redis.cmd('SET', mkey(slug), JSON.stringify(meta), 'NX');
  if (!ok) throw new Reject('Ya existe un local con esa dirección.', 409);
  await redis.cmd('SADD', 'tenants', slug);
  await redis.cmd('SET', redis.tk(slug, 'cfg'), JSON.stringify(nuevoConfig(nombre)));
  return { meta, password };
}

async function listTenants() {
  const slugs = await redis.cmd('SMEMBERS', 'tenants');
  if (!slugs || !slugs.length) return [];
  const rows = await redis.cmd('MGET', ...slugs.map(mkey));
  return rows.filter(Boolean).map((r) => JSON.parse(r)).sort((a, b) => a.creado.localeCompare(b.creado));
}

// Borra los datos del local. Los pedidos sueltos se vencen solos a los 90 días.
async function deleteTenant(slug) {
  try {
    const raw = await redis.cmd('GET', redis.tk(slug, 'cfg'));
    const ids = raw ? [...imagenesDe(JSON.parse(raw)).keys()] : [];
    if (ids.length) await img.borrar(ids.map((id) => imgKey(slug, id)));
  } catch (e) { /* las fotos sueltas no impiden borrar el local */ }
  await redis.cmd('DEL', mkey(slug), redis.tk(slug, 'cfg'), redis.tk(slug, 'cfgrev'), redis.tk(slug, 'orders:list'), redis.tk(slug, 'orders:seq'), redis.tk(slug, 'orders:activos'), redis.tk(slug, 'orders:rev'));
  await redis.cmd('SREM', 'tenants', slug);
}

async function setPassword(m, plain) {
  m.pass = await cr.hashPassword(plain);
  m.pv = (m.pv || 0) + 1; // invalida las sesiones abiertas
}

// ---- Sesión del dueño de un local ----
function newSession(m) {
  return cr.signToken({ s: m.slug, v: m.pv || 0, e: Math.floor(Date.now() / 1000) + SESION_DIAS * 86400 });
}

function requireOwner(req, m) {
  const h = String(req.headers.authorization || '');
  const p = cr.verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '');
  if (!p || p.s !== m.slug || p.v !== (m.pv || 0)) throw new Reject('Tu sesión venció. Volvé a entrar.', 401, 'unauthorized');
  return p;
}

module.exports = {
  SLUG, RESERVED, getTenant, saveTenant, requireTenant, estado, hoyAR, addMonths, validarFecha, registrarPago,
  createTenant, listTenants, deleteTenant, setPassword, newSession, requireOwner, soloDigitos
};
