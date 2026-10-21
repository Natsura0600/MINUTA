const cr = require('../lib/crypto');
const redis = require('../lib/redis');
const T = require('../lib/tenants');
const { send, fail, body, ip, tope, Reject } = require('../lib/http');

// Entrada del dueño al panel de su local, con email y contraseña.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    tope(req, 2000);
    const tenant = await T.requireTenant(req);
    if (!(await redis.limit('rl:login:' + tenant.slug + ':' + ip(req), 10, 300))) {
      throw new Reject('Demasiados intentos. Esperá unos minutos.', 429, 'demasiados');
    }
    // Tope por cuenta: frena también a quien prueba contraseñas desde muchas IPs distintas.
    if (!(await redis.limit('rl:loginacc:' + tenant.slug, 40, 900))) throw new Reject('Hay demasiados intentos en esta cuenta. Esperá unos minutos.', 429, 'demasiados');
    const b = body(req);
    const email = String(b.email || '').trim().toLowerCase();
    // Siempre se calcula la contraseña para tardar lo mismo con un email equivocado.
    const passOk = await cr.checkPassword(String(b.password || ''), tenant.pass || cr.DUMMY);
    if (!(passOk && email === tenant.email)) {
      await new Promise((r) => setTimeout(r, 600));
      throw new Reject('Email o contraseña incorrectos.', 401, 'unauthorized');
    }
    send(res, 200, { token: T.newSession(tenant), nombre: tenant.nombre });
  } catch (e) {
    fail(res, e);
  }
};
