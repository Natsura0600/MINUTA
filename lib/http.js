const crypto = require('crypto');
const redis = require('./redis');

class Reject extends Error {
  constructor(message, status = 400, code = 'rechazado') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function send(res, status, obj, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(obj));
}

function fail(res, e) {
  if (e instanceof Reject) return send(res, e.status, { error: e.code, mensaje: e.message });
  if (e && e.code === 'storage_not_configured') {
    return send(res, 503, { error: 'storage', mensaje: 'Falta conectar la base de datos (Upstash Redis) en Vercel.' });
  }
  if (e && e.code === 'app_secret_missing') {
    return send(res, 503, { error: 'secret', mensaje: 'Falta configurar APP_SECRET en Vercel (mínimo 16 caracteres).' });
  }
  console.error(e);
  send(res, 500, { error: 'server', mensaje: 'Algo falló de nuestro lado. Probá de nuevo en un momento.' });
}

function body(req) {
  let b = req.body;
  if (typeof b === 'string' || Buffer.isBuffer(b)) {
    try { b = JSON.parse(String(b)); } catch (e) { b = null; }
  }
  return b && typeof b === 'object' ? b : {};
}

function ip(req) {
  const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return f || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// ---- A qué local pertenece el pedido ----
const rootDomain = () => String(process.env.ROOT_DOMAIN || '').trim().toLowerCase().replace(/^\.+|\/+$/g, '');
const rawHost = (req) => String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
const hostOf = (req) => rawHost(req).toLowerCase().split(':')[0];

// El local sale del subdominio (smash.tudominio.com). Fuera del dominio principal
// (por ejemplo en un deploy de prueba de Vercel) se acepta ?local=smash.
function slugFromReq(req) {
  const root = rootDomain(), host = hostOf(req);
  if (root && host.endsWith('.' + root)) {
    const sub = host.slice(0, -(root.length + 1));
    return sub.includes('.') ? null : sub;
  }
  const q = req.query && req.query.local;
  return q ? String(q).toLowerCase() : null;
}

// Dirección pública del local, para los links de vuelta y los avisos de Mercado Pago.
function siteFor(req, slug) {
  const root = rootDomain(), host = hostOf(req);
  if (root && host.endsWith('.' + root)) return { origin: 'https://' + host, local: '' };
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return { origin: proto + '://' + rawHost(req), local: slug };
}

// ---- Acceso del dueño de la plataforma (vos) ----
const sha = (s) => crypto.createHash('sha256').update(s).digest();

async function requireSuper(req) {
  const real = process.env.SUPERADMIN_PASSWORD;
  if (!real) throw new Reject('Falta configurar SUPERADMIN_PASSWORD en Vercel.', 503, 'super_not_configured');
  let given = '';
  try { given = decodeURIComponent(String(req.headers['x-super-password'] || '')); } catch (e) { given = ''; }
  if (crypto.timingSafeEqual(sha(given), sha(real))) return;
  if (!(await redis.limit('rl:super:' + ip(req), 10, 300))) throw new Reject('Demasiados intentos. Esperá unos minutos.', 429, 'demasiados');
  await new Promise((r) => setTimeout(r, 600));
  throw new Reject('Contraseña incorrecta.', 401, 'unauthorized');
}

module.exports = { Reject, send, fail, body, ip, rootDomain, hostOf, slugFromReq, siteFor, requireSuper };
