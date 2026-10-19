// Contraseñas, sesiones y cifrado del token de Mercado Pago de cada local.
// Todo se deriva de la variable APP_SECRET (una frase larga y secreta que elegís vos).
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

function secret() {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) {
    const e = new Error('app_secret_missing');
    e.code = 'app_secret_missing';
    throw e;
  }
  return s;
}
const key = (label) => crypto.createHash('sha256').update(label + ':' + secret()).digest();

// ---- Contraseñas (scrypt con sal propia) ----
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(String(pw), salt, 32);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

async function checkPassword(pw, rec) {
  const h = await scrypt(String(pw), Buffer.from(rec.salt, 'hex'), 32);
  return crypto.timingSafeEqual(h, Buffer.from(rec.hash, 'hex'));
}

// Para gastar el mismo tiempo cuando el usuario no existe.
const DUMMY = { salt: '00'.repeat(16), hash: '00'.repeat(32) };

const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomPassword(n = 12) {
  let s = '';
  const bytes = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) s += ALFABETO[bytes[i] % ALFABETO.length];
  return s;
}

// ---- Sesiones firmadas (sin guardar nada en el servidor) ----
const b64 = (s) => Buffer.from(s).toString('base64url');
const mac = (body) => crypto.createHmac('sha256', key('sign')).update(body).digest('base64url');

function signToken(payload) {
  const body = b64(JSON.stringify(payload));
  return body + '.' + mac(body);
}

function verifyToken(t) {
  if (typeof t !== 'string') return null;
  const [body, sig] = t.split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(mac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.e > Date.now() / 1000 ? p : null;
  } catch (e) {
    return null;
  }
}

// ---- Cifrado del token de Mercado Pago (AES-256-GCM) ----
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key('enc'), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

function decrypt(s) {
  const [iv, tag, enc] = s.split('.').map((x) => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key('enc'), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

module.exports = { hashPassword, checkPassword, DUMMY, randomPassword, signToken, verifyToken, encrypt, decrypt };
